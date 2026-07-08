"""
Restaurants Service
--------------------
بيقرأ kemet_restaurants_data.csv من silver/_csv_exports/ على Azure Blob Storage.

تحديث: الملف الجديد بقى بأعمدة مختلفة عن اللي كانت قبل كده:
id, name, category, cuisine, rating, phone_number, government, photo_url, maps, is_non_egypt_address

القواعد المتبعة (زي ما اتفقنا):
- عمود Description متسحبش خالص، مش موجود في الرد النهائي أصلاً (والداتا الجديدة مفيهاش العمود ده أصلاً).
- أي حقل فاضي/N/A/NaN/صفر بيترجع None بدل ما يترجع نص فاضي أو "N/A" -
  عشان الفرونت يقدر يخفي الجزء ده من الكارت بسهولة.
- عمود "government" بيرجع كـ governorate مباشرة (مفيش استخراج regex محتاج دلوقتي
  لأن العمود بقى نضيف من غير كلمة "Governorate" في الآخر).
- الصفوف اللي عنوانها برّه مصر (is_non_egypt_address = True) بتتشال، لأن الموقع مخصص لمصر.
- "الأعلى تقييماً" (featured) بيتحسب ديناميكياً من الداتا نفسها، مش قيمة ثابتة مكتوبة في الكود.
"""
import io
from functools import lru_cache

import pandas as pd
from azure.storage.blob import BlobServiceClient

from app.utils import get_secret

CONTAINER_NAME = "silver"
BLOB_NAME = "_csv_exports/kemet_restaurants_data.csv"

FALLBACK_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"


class RestaurantsDataError(Exception):
    pass


def _clean(value):
    """يرجّع None لأي قيمة فاضية/NaN/N/A، وإلا النص متنضف."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text = str(value).strip()
    if not text or text.upper() == "N/A":
        return None
    return text


def _clean_phone(value):
    """phone_number جاي رقم صحيح من الداتا (0 يعني معندوش رقم متسجل)."""
    if value is None or pd.isna(value):
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return _clean(value)
    if number == 0:
        return None
    return f"+{number}"


@lru_cache(maxsize=1)
def _load_raw_dataframe() -> pd.DataFrame:
    connection_string = get_secret("AZURE_DATALAKE_CONNECTION_STRING")
    if not connection_string:
        raise RestaurantsDataError(
            "AZURE_DATALAKE_CONNECTION_STRING غير موجود في الـ environment variables."
        )
    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
        stream = blob_client.download_blob()
        df = pd.read_csv(io.BytesIO(stream.readall()))
        df.columns = df.columns.str.strip()
        # نشيل أي مطعم عنوانه خارج مصر خالص - الموقع مخصص لمصر بس
        if "is_non_egypt_address" in df.columns:
            df = df[df["is_non_egypt_address"] != True]  # noqa: E712
        return df
    except Exception as e:
        raise RestaurantsDataError(f"Error loading restaurants data from Azure: {e}")


def _row_to_record(row) -> dict:
    rating_raw = row.get("rating")
    rating = float(rating_raw) if pd.notna(rating_raw) else None

    return {
        "name": _clean(row.get("name")),
        "category": _clean(row.get("category")),
        "cuisine": _clean(row.get("cuisine")),
        "rating": rating,
        "phone": _clean_phone(row.get("phone_number")),
        "governorate": _clean(row.get("government")),
        "photo_url": _clean(row.get("photo_url")) or FALLBACK_IMAGE,
        "maps_url": _clean(row.get("maps")),
    }


def _all_records() -> list[dict]:
    df = _load_raw_dataframe()
    records = [_row_to_record(row) for _, row in df.iterrows()]
    return [r for r in records if r["name"]]  # لازم يبقى على الأقل ليه اسم


def get_governorates() -> list[str]:
    records = _all_records()
    govs = sorted({r["governorate"] for r in records if r["governorate"]})
    return ["All Governorates"] + govs


def get_cuisines() -> list[str]:
    records = _all_records()
    cuisines = sorted({r["cuisine"] for r in records if r["cuisine"]})
    return ["All Cuisines"] + cuisines


def get_featured() -> dict | None:
    """أعلى مطعم تقييماً في الداتا كلها (محسوب ديناميكياً)."""
    records = [r for r in _all_records() if r["rating"] is not None]
    if not records:
        return None
    return max(records, key=lambda r: r["rating"])


def get_restaurants(governorate: str | None = None, cuisine: str | None = None,
                     search: str | None = None, min_rating: float = 0) -> list[dict]:
    records = _all_records()

    def matches(r):
        if governorate and governorate != "All Governorates" and r["governorate"] != governorate:
            return False
        if cuisine and cuisine != "All Cuisines" and r["cuisine"] != cuisine:
            return False
        if search and search.lower() not in r["name"].lower():
            return False
        if r["rating"] is not None and r["rating"] < min_rating:
            return False
        if r["rating"] is None and min_rating > 0:
            return False
        return True

    return [r for r in records if matches(r)]