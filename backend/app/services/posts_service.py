"""
Posts Service
-------------
Community posts logic, extracted from the old Streamlit pages (home.py +
your.py) into framework-agnostic functions, same style as accounts_service.py.

Storage layout is unchanged from the Streamlit version, so existing data
keeps working:
  Cosmos DB "kemetcosmos" / "Posts" container, partition key /Username:
    { id, Username, Content: [ {...post item...}, ... ] }

Each post item now looks like:
  {
    "text": str,
    "image_url": str | None,
    "timestamp": iso string,
    "reactions": { "<emoji>": [reactor_id, ...] },   # "❤️" bucket == Likes
    "saves": [reactor_id, ...],                       # Bookmarks
    "comments": [ {"author": str, "text": str, "timestamp": iso string}, ... ]
  }

Old documents created by the Streamlit app only had text/image_url/timestamp
(sometimes reactions). _normalize_item() fills in the missing fields on read
so nothing breaks. Any older document that still has a leftover "shares"
key is simply ignored — the Share feature was removed.
"""
import datetime

from azure.cosmos import CosmosClient, PartitionKey, exceptions
from azure.storage.blob import BlobServiceClient

from app.utils import get_secret

DATABASE_NAME = "kemetcosmos"
POSTS_CONTAINER_NAME = "Posts"
USERS_CONTAINER_NAME = "Users"
IMAGES_CONTAINER_NAME = "posts"  # Azure Blob container (same one home.py used)

LIKE_EMOJI = "❤️"  # the "Like" button maps onto this reaction bucket


class PostsError(Exception):
    pass


def _get_containers():
    cosmos_endpoint = get_secret("COSMOS_ENDPOINT")
    cosmos_key = get_secret("COSMOS_KEY")
    if not cosmos_endpoint or not cosmos_key:
        raise PostsError("COSMOS_ENDPOINT / COSMOS_KEY are not configured.")

    client = CosmosClient(cosmos_endpoint, cosmos_key)
    database = client.create_database_if_not_exists(id=DATABASE_NAME)
    container_posts = database.create_container_if_not_exists(
        id=POSTS_CONTAINER_NAME, partition_key=PartitionKey(path="/Username")
    )
    container_users = database.create_container_if_not_exists(
        id=USERS_CONTAINER_NAME, partition_key=PartitionKey(path="/Username")
    )
    return container_posts, container_users


def _normalize_item(raw_item):
    """Backfills fields on posts that predate reactions/saves/comments."""
    if not isinstance(raw_item, dict):
        raw_item = {"text": str(raw_item), "image_url": None}
    raw_item.setdefault("text", "")
    raw_item.setdefault("image_url", None)
    raw_item.setdefault("timestamp", "")
    raw_item.setdefault("reactions", {})
    raw_item.setdefault("saves", [])
    raw_item.setdefault("comments", [])
    return raw_item


def _profile_pics(container_users):
    profile_pics = {}
    try:
        for u in container_users.read_all_items():
            pic_url = u.get("ProfilePicUrl")
            if pic_url:
                profile_pics[u.get("Username", "")] = pic_url
    except Exception:
        pass
    return profile_pics


def _serialize_item(owner_username, content_index, item, profile_pics, viewer_id):
    likers = (item.get("reactions") or {}).get(LIKE_EMOJI, []) or []
    saves = item.get("saves", []) or []
    comments = item.get("comments", []) or []
    return {
        "owner_username": owner_username,
        "content_index": content_index,
        "text": item.get("text", ""),
        "image_url": item.get("image_url"),
        "timestamp": item.get("timestamp", ""),
        "profile_pic_url": profile_pics.get(owner_username, ""),
        "likes": len(likers),
        "liked_by_me": bool(viewer_id) and viewer_id in likers,
        "saves": len(saves),
        "saved_by_me": bool(viewer_id) and viewer_id in saves,
        "comments": comments,
        "comments_count": len(comments),
    }


def list_posts(viewer_id=None):
    """All posts from every user, newest first (feeds the Community page)."""
    container_posts, container_users = _get_containers()
    profile_pics = _profile_pics(container_users)

    try:
        docs = list(container_posts.read_all_items())
    except Exception as e:
        raise PostsError(f"Error reading posts: {e}")

    all_posts = []
    for doc in docs:
        owner_username = doc.get("Username", "")
        content = doc.get("Content", [])
        if not isinstance(content, list):
            continue
        for idx, raw_item in enumerate(content):
            item = _normalize_item(raw_item)
            all_posts.append(_serialize_item(owner_username, idx, item, profile_pics, viewer_id))

    all_posts.sort(key=lambda p: p["timestamp"], reverse=True)
    return all_posts


def create_post(username, text, image_bytes=None, image_filename=None):
    username = (username or "").strip()
    text = (text or "").strip()
    if not username:
        raise PostsError("A name is required to post.")
    if not text and not image_bytes:
        raise PostsError("Post cannot be empty.")

    container_posts, _ = _get_containers()

    image_url = None
    if image_bytes:
        storage_conn = get_secret("AZURE_STORAGE_CONNECTION_STRING")
        if not storage_conn:
            raise PostsError("Storage connection not configured.")
        try:
            blob_service_client = BlobServiceClient.from_connection_string(storage_conn)
            file_name = f"{username}_{datetime.datetime.now().timestamp()}_{image_filename or 'image'}"
            blob_client = blob_service_client.get_blob_client(container=IMAGES_CONTAINER_NAME, blob=file_name)
            blob_client.upload_blob(image_bytes, overwrite=True)
            image_url = blob_client.url
        except Exception as e:
            raise PostsError(f"Error uploading image: {e}")

    post_item = {
        "text": text,
        "image_url": image_url,
        "timestamp": datetime.datetime.now().isoformat(),
        "reactions": {},
        "saves": [],
        "comments": [],
    }

    try:
        user_doc = container_posts.read_item(item=username, partition_key=username)
        content = user_doc.get("Content", [])
        if not isinstance(content, list):
            content = []
        content.append(post_item)
        user_doc["Content"] = content
        container_posts.upsert_item(body=user_doc)
        content_index = len(content) - 1
    except exceptions.CosmosResourceNotFoundError:
        new_doc = {"id": username, "Username": username, "Content": [post_item]}
        container_posts.create_item(body=new_doc)
        content_index = 0
    except Exception as e:
        raise PostsError(f"Error saving post: {e}")

    return _serialize_item(username, content_index, post_item, {}, username)


def _load_item(container_posts, owner_username, content_index):
    try:
        doc = container_posts.read_item(item=owner_username, partition_key=owner_username)
    except exceptions.CosmosResourceNotFoundError:
        raise PostsError("Post not found.")
    except Exception as e:
        raise PostsError(f"Error loading post: {e}")

    content = doc.get("Content", [])
    if content_index < 0 or content_index >= len(content):
        raise PostsError("Post not found.")
    item = _normalize_item(content[content_index])
    return doc, content, item


def toggle_like(owner_username, content_index, reactor_id):
    reactor_id = (reactor_id or "").strip()
    if not reactor_id:
        raise PostsError("A name is required to react.")

    container_posts, _ = _get_containers()
    doc, content, item = _load_item(container_posts, owner_username, content_index)

    likers = item["reactions"].get(LIKE_EMOJI, [])
    if reactor_id in likers:
        likers.remove(reactor_id)
        liked = False
    else:
        likers.append(reactor_id)
        liked = True
    if likers:
        item["reactions"][LIKE_EMOJI] = likers
    else:
        item["reactions"].pop(LIKE_EMOJI, None)

    content[content_index] = item
    doc["Content"] = content
    try:
        container_posts.upsert_item(body=doc)
    except Exception as e:
        raise PostsError(f"Error saving reaction: {e}")

    return {"liked_by_me": liked, "likes": len(likers)}


def toggle_save(owner_username, content_index, reactor_id):
    reactor_id = (reactor_id or "").strip()
    if not reactor_id:
        raise PostsError("A name is required to save posts.")

    container_posts, _ = _get_containers()
    doc, content, item = _load_item(container_posts, owner_username, content_index)

    saves = item["saves"]
    if reactor_id in saves:
        saves.remove(reactor_id)
        saved = False
    else:
        saves.append(reactor_id)
        saved = True
    item["saves"] = saves

    content[content_index] = item
    doc["Content"] = content
    try:
        container_posts.upsert_item(body=doc)
    except Exception as e:
        raise PostsError(f"Error saving bookmark: {e}")

    return {"saved_by_me": saved, "saves": len(saves)}


def add_comment(owner_username, content_index, author, text):
    author = (author or "").strip()
    text = (text or "").strip()
    if not author:
        raise PostsError("A name is required to comment.")
    if not text:
        raise PostsError("Comment cannot be empty.")

    container_posts, _ = _get_containers()
    doc, content, item = _load_item(container_posts, owner_username, content_index)

    comment = {
        "author": author,
        "text": text,
        "timestamp": datetime.datetime.now().isoformat(),
    }
    item["comments"].append(comment)
    content[content_index] = item
    doc["Content"] = content
    try:
        container_posts.upsert_item(body=doc)
    except Exception as e:
        raise PostsError(f"Error saving comment: {e}")

    return {"comment": comment, "comments_count": len(item["comments"])}


def delete_post(owner_username, content_index, requester_username):
    if (requester_username or "").strip() != (owner_username or "").strip():
        raise PostsError("You can only delete your own posts.")

    container_posts, _ = _get_containers()
    try:
        doc = container_posts.read_item(item=owner_username, partition_key=owner_username)
    except exceptions.CosmosResourceNotFoundError:
        raise PostsError("Post not found.")
    except Exception as e:
        raise PostsError(f"Error loading post: {e}")

    content = doc.get("Content", [])
    if content_index < 0 or content_index >= len(content):
        raise PostsError("Post not found.")

    content.pop(content_index)
    doc["Content"] = content
    try:
        container_posts.upsert_item(body=doc)
    except Exception as e:
        raise PostsError(f"Error deleting post: {e}")

    return True


def get_user_posts(username):
    """Powers the 'Your Posts' tab: every post by this exact identity
    (account username, or the name a guest typed), newest first."""
    username = (username or "").strip()
    if not username:
        return []

    container_posts, container_users = _get_containers()
    profile_pics = _profile_pics(container_users)

    try:
        doc = container_posts.read_item(item=username, partition_key=username)
    except exceptions.CosmosResourceNotFoundError:
        return []
    except Exception as e:
        raise PostsError(f"Error loading posts: {e}")

    content = doc.get("Content", [])
    posts = []
    for idx, raw_item in enumerate(content):
        item = _normalize_item(raw_item)
        posts.append(_serialize_item(username, idx, item, profile_pics, username))

    posts.sort(key=lambda p: p["timestamp"], reverse=True)
    return posts


def get_saved_posts(reactor_id):
    """Powers the 'Saved' tab: every post (by anyone) this identity bookmarked."""
    reactor_id = (reactor_id or "").strip()
    if not reactor_id:
        return []
    all_posts = list_posts(viewer_id=reactor_id)
    return [p for p in all_posts if p["saved_by_me"]]