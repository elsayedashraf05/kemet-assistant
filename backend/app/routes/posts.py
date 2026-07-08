"""
Posts Routes
------------
Community feed endpoints: list/create posts, like, save (bookmark),
comment, delete, plus the "my posts" / "saved posts" views used on the
Account page's extra tabs.

Auth is intentionally OPTIONAL here, same behaviour as the old Streamlit
pages (home.py / your.py):
  - Logged-in users are identified from the JWT (Authorization: Bearer ...)
    and never need to type a name.
  - Guests act under whatever name they typed once in the UI. The frontend
    keeps that name in localStorage and sends it on every request as the
    'X-Guest-Name' header. If neither is present, write actions are
    rejected with a 400 asking for a name.
"""
import jwt
from flask import Blueprint, jsonify, request, current_app

from app.services import posts_service
from app.services.posts_service import PostsError

posts_bp = Blueprint("posts", __name__)


def _optional_jwt_username():
    """Returns the username from a valid JWT, or None (not an error) if
    there isn't one — unlike account.py's token_required, this never 401s,
    since guests are allowed on every one of these endpoints."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        return payload.get("username")
    except jwt.PyJWTError:
        return None


def _resolve_identity():
    """The name this request should act under: account username if logged
    in, otherwise the guest name the frontend attached as a header."""
    username = _optional_jwt_username()
    if username:
        return username
    return (request.headers.get("X-Guest-Name", "") or "").strip()


@posts_bp.route("", methods=["GET"])
def list_posts_route():
    viewer_id = _resolve_identity()
    try:
        posts = posts_service.list_posts(viewer_id=viewer_id or None)
    except PostsError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"posts": posts})


@posts_bp.route("", methods=["POST"])
def create_post_route():
    username = _resolve_identity()
    if not username:
        return jsonify({"error": "Please enter your name to post as a guest."}), 400

    text = request.form.get("text", "")
    image_file = request.files.get("file")
    image_bytes = image_file.read() if image_file else None
    image_filename = image_file.filename if image_file else None

    try:
        post = posts_service.create_post(username, text, image_bytes, image_filename)
    except PostsError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"post": post})


@posts_bp.route("/mine", methods=["GET"])
def my_posts_route():
    username = _resolve_identity()
    if not username:
        return jsonify({"error": "Please enter your name to view your posts."}), 400
    try:
        posts = posts_service.get_user_posts(username)
    except PostsError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"posts": posts, "username": username})


@posts_bp.route("/saved", methods=["GET"])
def saved_posts_route():
    username = _resolve_identity()
    if not username:
        return jsonify({"error": "Please enter your name to view saved posts."}), 400
    try:
        posts = posts_service.get_saved_posts(username)
    except PostsError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"posts": posts, "username": username})


@posts_bp.route("/<owner_username>/<int:content_index>/like", methods=["POST"])
def like_route(owner_username, content_index):
    reactor_id = _resolve_identity()
    if not reactor_id:
        return jsonify({"error": "Please enter your name to react."}), 400
    try:
        result = posts_service.toggle_like(owner_username, content_index, reactor_id)
    except PostsError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(result)


@posts_bp.route("/<owner_username>/<int:content_index>/save", methods=["POST"])
def save_route(owner_username, content_index):
    reactor_id = _resolve_identity()
    if not reactor_id:
        return jsonify({"error": "Please enter your name to save posts."}), 400
    try:
        result = posts_service.toggle_save(owner_username, content_index, reactor_id)
    except PostsError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(result)


@posts_bp.route("/<owner_username>/<int:content_index>/comment", methods=["POST"])
def comment_route(owner_username, content_index):
    author = _resolve_identity()
    if not author:
        return jsonify({"error": "Please enter your name to comment."}), 400
    data = request.get_json(force=True, silent=True) or {}
    try:
        result = posts_service.add_comment(owner_username, content_index, author, data.get("text", ""))
    except PostsError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(result)


@posts_bp.route("/<owner_username>/<int:content_index>", methods=["DELETE"])
def delete_post_route(owner_username, content_index):
    requester = _resolve_identity()
    if not requester:
        return jsonify({"error": "Please enter your name to delete a post."}), 400
    try:
        posts_service.delete_post(owner_username, content_index, requester)
    except PostsError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"message": "Post deleted."})