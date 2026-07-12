"""
Accounts Service
-----------------
نفس منطق src/account.py الأصلي بالظبط (Cosmos DB + bcrypt + Blob Storage
لصور البروفايل)، لكن من غير أي st.* أو cookies يدوية. الـ session
هنا بقت مسؤولية الـ JWT في routes/account.py.

Password reset: احنا بنخزن bcrypt hash بس، مفيش أي طريقة تقنية نرجّع بيها
كلمة السر الأصلية (ده مقصود، مش نقص). فالـ "forgot password" الحقيقي بيبعت
لينك فيه توكن موقّع (JWT قصير العمر) على الإيميل الحقيقي بتاع اليوزر، واليوزر
بيدخل يختار كلمة سر جديدة من خلاله. التوكن نفسه بيتعمل ويتفكك في routes/account.py.
"""
import datetime
import smtplib
from email.message import EmailMessage

import bcrypt
from azure.cosmos import CosmosClient, PartitionKey, exceptions
from azure.storage.blob import BlobServiceClient

from app.utils import get_secret

DATABASE_NAME = "kemetcosmos"
USERS_CONTAINER_NAME = "Users"
POSTS_CONTAINER_NAME = "Posts"
AVATAR_CONTAINER_NAME = "avatars"


class AccountsError(Exception):
    pass


def _get_containers():
    cosmos_endpoint = get_secret("COSMOS_ENDPOINT")
    cosmos_key = get_secret("COSMOS_KEY")
    if not cosmos_endpoint or not cosmos_key:
        raise AccountsError("COSMOS_ENDPOINT / COSMOS_KEY غير موجودين في الـ environment.")

    client = CosmosClient(cosmos_endpoint, cosmos_key)
    database = client.create_database_if_not_exists(id=DATABASE_NAME)
    container_users = database.create_container_if_not_exists(
        id=USERS_CONTAINER_NAME, partition_key=PartitionKey(path="/Username")
    )
    try:
        container_posts = database.create_container_if_not_exists(
            id=POSTS_CONTAINER_NAME, partition_key=PartitionKey(path="/Username")
        )
    except Exception:
        container_posts = None
    return container_users, container_posts


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _user_public(user_doc: dict) -> dict:
    """Shapes a raw Cosmos user document into what the frontend gets back.
    Falls back gracefully for accounts created before a field existed:
      - CreatedAt: Cosmos stamps every document with a system `_ts` (unix
        seconds of last write) even if we never set CreatedAt ourselves, so
        old accounts still show a reasonable "member since" instead of blank.
    """
    created_at = user_doc.get("CreatedAt")
    if not created_at and user_doc.get("_ts"):
        try:
            created_at = datetime.datetime.utcfromtimestamp(user_doc["_ts"]).isoformat() + "Z"
        except Exception:
            created_at = ""
    return {
        "username": user_doc["Username"],
        "email": user_doc.get("Email", ""),
        "profile_pic_url": user_doc.get("ProfilePicUrl", ""),
        "full_name": user_doc.get("FullName", ""),
        "country": user_doc.get("Country", ""),
        "language": user_doc.get("Language", "English"),
        "travel_preferences": user_doc.get("TravelPreferences", []),
        "created_at": created_at or "",
    }


def sign_up(username: str, email: str, password: str, country: str = "", language: str = "English"):
    """Returns (success: bool, message_or_user: str | dict)."""
    container_users, _ = _get_containers()
    username = (username or "").strip()
    email = (email or "").strip().lower()
    country = (country or "").strip()[:80]
    language = (language or "English").strip()[:40]

    if not username or not email or not password:
        return False, "Please fill in all fields."
    if len(password) < 6:
        return False, "Password must be at least 6 characters."

    try:
        container_users.read_item(item=username, partition_key=username)
        return False, "This username is already taken."
    except exceptions.CosmosResourceNotFoundError:
        pass
    except Exception as e:
        return False, f"Error checking username: {e}"

    try:
        query = "SELECT VALUE COUNT(1) FROM c WHERE c.Email = @email"
        count = list(container_users.query_items(
            query=query,
            parameters=[{"name": "@email", "value": email}],
            enable_cross_partition_query=True,
        ))[0]
        if count > 0:
            return False, "An account with this email already exists."
    except Exception as e:
        return False, f"Error checking email: {e}"

    try:
        new_user = {
            "id": username,
            "Username": username,
            "Email": email,
            "PasswordHash": _hash_password(password),
            "Country": country,
            "Language": language,
            "FullName": "",
            "TravelPreferences": [],
            "CreatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        }
        container_users.create_item(body=new_user)
        return True, _user_public(new_user)
    except Exception as e:
        return False, f"Error creating account: {e}"


def google_sign_in(email: str, name: str, google_sub: str, picture: str = ""):
    """Finds an existing account by email, or creates one, based on an
    already-verified Google identity (the verification itself happens in
    routes/account.py before this is called). Returns (success, user_dict).

    Google accounts don't have a local password — PasswordHash is left
    empty, which also means sign_in() with a password will correctly
    reject them (bcrypt.checkpw against an empty hash fails safely)."""
    container_users, _ = _get_containers()
    email = (email or "").strip().lower()
    if not email:
        return False, "This Google account has no email address."

    try:
        query = "SELECT * FROM c WHERE c.Email = @email"
        items = list(container_users.query_items(
            query=query,
            parameters=[{"name": "@email", "value": email}],
            enable_cross_partition_query=True,
        ))
        user_doc = items[0] if items else None
    except Exception as e:
        return False, f"Error checking account: {e}"

    if user_doc is not None:
        # Existing account (created via password signup or a previous
        # Google sign-in) — just log them in, and link the Google ID
        # for reference if it isn't already linked.
        if not user_doc.get("GoogleId"):
            user_doc["GoogleId"] = google_sub
            try:
                container_users.upsert_item(body=user_doc)
            except Exception:
                pass
        public = _user_public(user_doc)
        # Prefer the freshest Google avatar if we never stored one locally.
        if not public["profile_pic_url"] and picture:
            public["profile_pic_url"] = picture
        return True, public

    # First time we've seen this Google account — create a new user.
    # Derive a username from their Google name/email, then make it unique.
    base_username = "".join(ch for ch in (name or email.split("@")[0]) if ch.isalnum() or ch in "_-").strip("_-")
    base_username = base_username or "user"
    username = base_username
    suffix = 1
    while True:
        try:
            container_users.read_item(item=username, partition_key=username)
        except exceptions.CosmosResourceNotFoundError:
            break
        except Exception as e:
            return False, f"Error creating account: {e}"
        suffix += 1
        username = f"{base_username}{suffix}"

    try:
        new_user = {
            "id": username,
            "Username": username,
            "Email": email,
            "PasswordHash": "",
            "GoogleId": google_sub,
            "ProfilePicUrl": picture or "",
            "FullName": name or "",
            "Country": "",
            "Language": "English",
            "TravelPreferences": [],
            "CreatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        }
        container_users.create_item(body=new_user)
        return True, _user_public(new_user)
    except Exception as e:
        return False, f"Error creating account: {e}"


def sign_in(identifier: str, password: str):
    """identifier can be a username or an email. Returns (success, result)."""
    container_users, _ = _get_containers()
    identifier = (identifier or "").strip()
    if not identifier or not password:
        return False, "Please enter your username/email and password."

    identifier_lower = identifier.lower()
    user_doc = None

    try:
        user_doc = container_users.read_item(item=identifier, partition_key=identifier)
    except exceptions.CosmosResourceNotFoundError:
        user_doc = None
    except Exception as e:
        return False, f"Error signing in: {e}"

    if user_doc is None:
        try:
            query = "SELECT * FROM c WHERE c.Email = @email"
            items = list(container_users.query_items(
                query=query,
                parameters=[{"name": "@email", "value": identifier_lower}],
                enable_cross_partition_query=True,
            ))
            if items:
                user_doc = items[0]
        except Exception as e:
            return False, f"Error signing in: {e}"

    if user_doc is None:
        return False, "No account found with this username/email."

    if not _verify_password(password, user_doc.get("PasswordHash", "")):
        return False, "Incorrect password."

    return True, _user_public(user_doc)


def get_user(username: str):
    container_users, _ = _get_containers()
    try:
        user_doc = container_users.read_item(item=username, partition_key=username)
    except exceptions.CosmosResourceNotFoundError:
        return None
    return _user_public(user_doc)


def change_password(username: str, old_password: str, new_password: str):
    container_users, _ = _get_containers()
    if len(new_password) < 6:
        return False, "New password must be at least 6 characters."
    try:
        user_doc = container_users.read_item(item=username, partition_key=username)
    except Exception as e:
        return False, f"Error: {e}"

    if not _verify_password(old_password, user_doc.get("PasswordHash", "")):
        return False, "Current password is incorrect."

    try:
        user_doc["PasswordHash"] = _hash_password(new_password)
        container_users.upsert_item(body=user_doc)
        return True, "Password updated successfully."
    except Exception as e:
        return False, f"Error updating password: {e}"


def delete_account(username: str, password: str):
    container_users, container_posts = _get_containers()
    try:
        user_doc = container_users.read_item(item=username, partition_key=username)
    except Exception as e:
        return False, f"Error: {e}"

    if not _verify_password(password, user_doc.get("PasswordHash", "")):
        return False, "Incorrect password."

    try:
        container_users.delete_item(item=username, partition_key=username)
    except Exception as e:
        return False, f"Error deleting account: {e}"

    if container_posts is not None:
        try:
            container_posts.delete_item(item=username, partition_key=username)
        except Exception:
            pass

    return True, "Your account has been permanently deleted."


def update_profile_picture(username: str, file_bytes: bytes, file_name: str):
    """Uploads to Azure Blob Storage and saves the URL on the user's document."""
    container_users, _ = _get_containers()
    storage_conn = get_secret("AZURE_STORAGE_CONNECTION_STRING")
    if not storage_conn:
        return False, "Storage connection not configured."

    try:
        blob_service_client = BlobServiceClient.from_connection_string(storage_conn)
        blob_name = f"{username}_{datetime.datetime.now().timestamp()}_{file_name}"
        blob_client = blob_service_client.get_blob_client(container=AVATAR_CONTAINER_NAME, blob=blob_name)
        blob_client.upload_blob(file_bytes, overwrite=True)
        image_url = blob_client.url
    except Exception as e:
        return False, f"Error uploading image: {e}"

    try:
        user_doc = container_users.read_item(item=username, partition_key=username)
        user_doc["ProfilePicUrl"] = image_url
        container_users.upsert_item(body=user_doc)
        return True, image_url
    except Exception as e:
        return False, f"Error saving profile picture: {e}"


def update_profile(username: str, full_name=None, country=None, language=None, travel_preferences=None):
    """Partial update — only fields that are not None get touched, so the
    frontend can send just the section the user edited (e.g. only
    travel_preferences from the Overview tab) without clobbering the rest.
    Username and email are intentionally not editable here: username is the
    Cosmos partition key and the public @handle referenced by every post the
    user has made, so renaming it would silently orphan their content.
    """
    container_users, _ = _get_containers()
    try:
        user_doc = container_users.read_item(item=username, partition_key=username)
    except exceptions.CosmosResourceNotFoundError:
        return False, "User not found."
    except Exception as e:
        return False, f"Error: {e}"

    if full_name is not None:
        user_doc["FullName"] = str(full_name).strip()[:80]
    if country is not None:
        user_doc["Country"] = str(country).strip()[:80]
    if language is not None:
        user_doc["Language"] = str(language).strip()[:40] or "English"
    if travel_preferences is not None:
        if not isinstance(travel_preferences, list):
            return False, "Travel preferences must be a list."
        user_doc["TravelPreferences"] = [str(p).strip()[:40] for p in travel_preferences if str(p).strip()][:20]

    try:
        container_users.upsert_item(body=user_doc)
    except Exception as e:
        return False, f"Error updating profile: {e}"
    return True, _user_public(user_doc)


def get_user_by_email(email: str):
    """Returns the RAW user document (including the password hash) or None.
    Internal-only helper for the password-reset flow — never expose this
    directly through a route the way get_user() is exposed."""
    container_users, _ = _get_containers()
    email = (email or "").strip().lower()
    if not email:
        return None
    try:
        query = "SELECT * FROM c WHERE c.Email = @email"
        items = list(container_users.query_items(
            query=query,
            parameters=[{"name": "@email", "value": email}],
            enable_cross_partition_query=True,
        ))
        return items[0] if items else None
    except Exception:
        return None


def set_password(username: str, new_password: str):
    """Overwrites the password hash directly. Used by the reset-password
    flow AFTER the reset token has already been verified — there's no old
    password check here because the emailed link IS the verification."""
    container_users, _ = _get_containers()
    if len(new_password or "") < 6:
        return False, "New password must be at least 6 characters."
    try:
        user_doc = container_users.read_item(item=username, partition_key=username)
    except Exception as e:
        return False, f"Error: {e}"

    try:
        user_doc["PasswordHash"] = _hash_password(new_password)
        container_users.upsert_item(body=user_doc)
        return True, "Password updated successfully."
    except Exception as e:
        return False, f"Error updating password: {e}"


def send_password_reset_email(to_email: str, reset_link: str):
    """Sends a real email with the reset link over SMTP. Configure these as
    secrets (same pattern as COSMOS_ENDPOINT etc.):
      SMTP_HOST, SMTP_PORT (default 587), SMTP_USERNAME, SMTP_PASSWORD,
      SMTP_FROM (optional, defaults to SMTP_USERNAME).
    We can't send the user's original password back — it's stored as a
    one-way bcrypt hash and can't be reversed, which is intentional. This
    is the standard, secure alternative: a time-limited link to set a new one.
    """
    smtp_host = get_secret("SMTP_HOST")
    smtp_port = int(get_secret("SMTP_PORT") or 587)
    smtp_user = get_secret("SMTP_USERNAME")
    smtp_password = get_secret("SMTP_PASSWORD")
    smtp_from = get_secret("SMTP_FROM") or smtp_user

    if not smtp_host or not smtp_user or not smtp_password:
        raise AccountsError(
            "Email sending isn't configured yet (need SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD)."
        )

    message = EmailMessage()
    message["Subject"] = "Reset your KEMET password"
    message["From"] = smtp_from
    message["To"] = to_email
    message.set_content(
        "We received a request to reset your KEMET password.\n\n"
        f"Click the link below to choose a new password (expires in 30 minutes):\n{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email — your password won't change."
    )

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)