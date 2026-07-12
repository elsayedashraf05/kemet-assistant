"""
Account Routes
--------------
بديل src/account.py + src/cookie_utils.py:
- بدل الكوكيز اليدوية (streamlit_cookies_controller) بنستخدم JWT.
- الفرونت بيخزن التوكن (في localStorage غالباً) ويبعته في:
      Authorization: Bearer <token>
  مع أي request محتاج معرفة اليوزر (زي /me أو /change-password).
"""
import datetime
from functools import wraps

import jwt
from flask import Blueprint, jsonify, request, current_app
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.services import accounts_service
from app.services.accounts_service import AccountsError
from app.utils import get_secret

account_bp = Blueprint("account", __name__)


RESET_TOKEN_EXPIRES_MINUTES = 30


def _generate_token(username: str) -> str:
    payload = {
        "username": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(
            days=current_app.config["JWT_EXPIRES_DAYS"]
        ),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def _generate_reset_token(username: str) -> str:
    """Short-lived, single-purpose token — separate from the normal login
    JWT so a leaked reset link can't be reused to log in, and expires much
    sooner (30 min vs the login token's several days)."""
    payload = {
        "username": username,
        "purpose": "password_reset",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=RESET_TOKEN_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")


def _verify_reset_token(token: str):
    """Returns the username the token was issued for, or None if it's
    missing, expired, tampered with, or not actually a reset token."""
    try:
        payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != "password_reset":
        return None
    return payload.get("username")


def token_required(f):
    """نفس فكرة 'لو مسجل دخول' في Streamlit، لكن هنا عن طريق التحقق من الـ JWT
    المرسل في الهيدر بدل قراءة st.session_state."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header."}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired, please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401
        request.username = payload["username"]
        return f(*args, **kwargs)
    return decorated


@account_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(force=True, silent=True) or {}
    try:
        success, result = accounts_service.sign_up(
            data.get("username", ""),
            data.get("email", ""),
            data.get("password", ""),
            data.get("country", ""),
            data.get("language", "English"),
        )
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": result}), 400

    token = _generate_token(result["username"])
    return jsonify({"token": token, "user": result})


@account_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True, silent=True) or {}
    try:
        success, result = accounts_service.sign_in(
            data.get("identifier", ""), data.get("password", "")
        )
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": result}), 401

    token = _generate_token(result["username"])
    return jsonify({"token": token, "user": result})


@account_bp.route("/google-login", methods=["POST"])
def google_login():
    data = request.get_json(force=True, silent=True) or {}
    credential = data.get("credential", "")
    if not credential:
        return jsonify({"error": "Missing Google credential."}), 400

    client_id = get_secret("GOOGLE_CLIENT_ID")
    if not client_id:
        return jsonify({"error": "Google sign-in isn't configured on the server yet."}), 500

    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), client_id
        )
    except ValueError:
        return jsonify({"error": "Invalid or expired Google credential."}), 401

    if not idinfo.get("email_verified", False):
        return jsonify({"error": "Your Google email isn't verified."}), 401

    email = idinfo.get("email", "")
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")
    google_sub = idinfo.get("sub", "")

    try:
        success, result = accounts_service.google_sign_in(email, name, google_sub, picture)
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": result}), 400

    token = _generate_token(result["username"])
    return jsonify({"token": token, "user": result})


@account_bp.route("/me", methods=["GET"])
@token_required
def me():
    try:
        user = accounts_service.get_user(request.username)
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502
    if user is None:
        return jsonify({"error": "User not found."}), 404
    return jsonify({"user": user})


@account_bp.route("/profile", methods=["POST"])
@token_required
def update_profile_route():
    data = request.get_json(force=True, silent=True) or {}
    # Only pass through fields the client actually included, so a partial
    # save (e.g. just travel_preferences from the Overview tab) can't wipe
    # out other fields the user didn't touch this time.
    kwargs = {}
    if "full_name" in data:
        kwargs["full_name"] = data.get("full_name")
    if "country" in data:
        kwargs["country"] = data.get("country")
    if "language" in data:
        kwargs["language"] = data.get("language")
    if "travel_preferences" in data:
        kwargs["travel_preferences"] = data.get("travel_preferences")

    try:
        success, result = accounts_service.update_profile(request.username, **kwargs)
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": result}), 400
    return jsonify({"user": result})


@account_bp.route("/change-password", methods=["POST"])
@token_required
def change_password_route():
    data = request.get_json(force=True, silent=True) or {}
    try:
        success, message = accounts_service.change_password(
            request.username, data.get("old_password", ""), data.get("new_password", "")
        )
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})


@account_bp.route("/delete", methods=["POST"])
@token_required
def delete_account_route():
    data = request.get_json(force=True, silent=True) or {}
    try:
        success, message = accounts_service.delete_account(request.username, data.get("password", ""))
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})


@account_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip()
    # The frontend tells us where it currently lives (e.g.
    # "https://app.example.com/account") so the emailed link points back to
    # wherever the reset page actually is, without us hardcoding a domain here.
    reset_url_base = (data.get("reset_url_base") or "").strip()

    if not email or not reset_url_base:
        return jsonify({"error": "Email is required."}), 400

    # Always return the same message whether or not the email is
    # registered — otherwise this endpoint could be used to check which
    # emails have an account, which we don't want to leak.
    generic_message = "If an account exists for this email, we've sent a password reset link to it."

    try:
        user_doc = accounts_service.get_user_by_email(email)
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if user_doc is not None:
        token = _generate_reset_token(user_doc["Username"])
        separator = "&" if "?" in reset_url_base else "?"
        reset_link = f"{reset_url_base}{separator}token={token}"
        try:
            accounts_service.send_password_reset_email(user_doc["Email"], reset_link)
        except AccountsError:
            # Don't leak whether sending failed (e.g. SMTP not configured
            # yet) to the client — that's a server-side setup problem, not
            # something the visitor did wrong.
            pass

    return jsonify({"message": generic_message})


@account_bp.route("/reset-password", methods=["POST"])
def reset_password_route():
    data = request.get_json(force=True, silent=True) or {}
    token = data.get("token", "")
    new_password = data.get("new_password", "")

    username = _verify_reset_token(token)
    if not username:
        return jsonify({"error": "This reset link is invalid or has expired. Please request a new one."}), 400

    try:
        success, message = accounts_service.set_password(username, new_password)
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": message})


@account_bp.route("/avatar", methods=["POST"])
@token_required
def upload_avatar():
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400
    file = request.files["file"]
    try:
        success, result = accounts_service.update_profile_picture(
            request.username, file.read(), file.filename
        )
    except AccountsError as e:
        return jsonify({"error": str(e)}), 502

    if not success:
        return jsonify({"error": result}), 400
    return jsonify({"profile_pic_url": result})