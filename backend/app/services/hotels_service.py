"""
Hotels Service
--------------
هنا بالظبط نفس المنطق اللي كان موجود في src/hotels.py بتاع Streamlit
(strip_html, load_data, بناء الـ records) لكن من غير أي استدعاء لـ st.*
عشان يبقى قابل للاستخدام من أي مكان (Flask routes، سكريبت، تيست...).

تحديث: الداتا بقت جاية من ملف تاني (silver/_csv_exports/egypt_all_governorates_hotels.csv)
وبأعمدة مختلفة عن اللي كانت قبل كده (id, name, rating_score, city, reviews, price, usd, link, image).
"""
import io
import re
from functools import lru_cache

import pandas as pd
from azure.storage.blob import BlobServiceClient

from app.utils import get_secret

CONTAINER_NAME = "silver"
BLOB_NAME = "_csv_exports/egypt_all_governorates_hotels.csv"


def upscale_image(url: str) -> str:
    """
    صور Booking.com (بتاعة bstatic.com) بتيجي بروابط فيها حجم محدد
    زي square60, square100, square240... وده بيدّي جودة واطية.
    نفس السيرفر بيدعم أحجام أكبر بكتير لنفس الصورة، فبس بنستبدل جزء الحجم
    في الرابط بحجم أعلى (max1024x768) من غير ما نلمس أي حاجة تانية.
    """
    if not isinstance(url, str) or "bstatic.com" not in url:
        return url
    return re.sub(r"/(square\d+|max\d+x?\d*)/", "/max1024x768/", url)


def strip_html(text):
    if not isinstance(text, str):
        return text
    clean = re.sub(r"<[^>]+>", "", text)
    for ent, rep in [
        ("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
        ("&gt;", ">"), ("&quot;", '"'),
    ]:
        clean = clean.replace(ent, rep)
    return clean.strip()


class HotelsDataError(Exception):
    """بترفع لما الاتصال بـ Azure يفشل أو الداتا متبقاش موجودة."""
    pass


@lru_cache(maxsize=1)
def _load_raw_dataframe() -> pd.DataFrame:
    """
    تحميل الـ CSV من Azure Blob Storage مرة واحدة وتخزينه في الذاكرة
    (نفس فكرة @st.cache_data في الكود الأصلي).
    لإعادة التحميل يدوياً استخدم _load_raw_dataframe.cache_clear()
    """
    connection_string = get_secret("AZURE_DATALAKE_CONNECTION_STRING")
    if not connection_string:
        raise HotelsDataError(
            "AZURE_DATALAKE_CONNECTION_STRING غير موجود في الـ environment variables."
        )

    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
        stream = blob_client.download_blob()
        df = pd.read_csv(io.BytesIO(stream.readall()))
        df.columns = df.columns.str.strip()
        return df
    except Exception as e:
        raise HotelsDataError(f"Error loading data from Azure: {e}")


def _dataframe_to_records(df: pd.DataFrame) -> list[dict]:
    # الأعمدة الجديدة: id, name, rating_score, city, reviews, price, usd, link, image
    df = df[df["image"].notna() & (df["image"].astype(str).str.strip() != "No Image")]

    records = []
    for _, row in df.iterrows():
        rating = float(row["rating_score"]) if pd.notna(row.get("rating_score")) else 0
        records.append({
            "id": str(row.get("id", "")).strip(),
            "name": strip_html(str(row.get("name", ""))),
            "city": str(row.get("city", "")).strip() if pd.notna(row.get("city")) else "",
            "img": upscale_image(str(row.get("image", "")).strip()),
            "link": str(row.get("link", "")).strip() if pd.notna(row.get("link")) else "#",
            "rating": rating,
            # عمود مساعد للفرونت: نفس منطق getStars() اللي كان في الـ JS بتاع الكارت
            "rating_label": _rating_label(rating),
            # لازم يبقى integer دايماً (مش 2.0)
            "reviews": int(row["reviews"]) if pd.notna(row.get("reviews")) else 0,
            "price_egp": float(row["price"]) if pd.notna(row.get("price")) else 0,
            "price_usd": float(row["usd"]) if pd.notna(row.get("usd")) else 0,
        })
    return records


def _rating_label(rating: float) -> str:
    if rating >= 9:
        return "Superb"
    if rating >= 8:
        return "Excellent"
    if rating >= 7:
        return "Good"
    if rating >= 6:
        return "Pleasant"
    return "Rated"


def get_cities() -> list[str]:
    df = _load_raw_dataframe()
    return ["All Cities"] + sorted(df["city"].dropna().unique().tolist())


def get_hotels(city: str | None = None, search: str | None = None,
                min_rating: float = 0, max_price: float | None = None) -> list[dict]:
    """
    نفس فلاتر الـ JS اللي كانت شغالة جوه الـ iframe في الكود الأصلي،
    لكن دلوقتي بتتنفذ في الـ backend عشان الفرونت يبعت query params بس.
    """
    df = _load_raw_dataframe()
    records = _dataframe_to_records(df)

    def matches(r):
        if city and city != "All Cities" and r["city"] != city:
            return False
        if search and search.lower() not in r["city"].lower() and search.lower() not in r["name"].lower():
            return False
        if r["rating"] < min_rating:
            return False
        if max_price is not None and r["price_egp"] not in (0,) and r["price_egp"] > max_price:
            return False
        return True

    return [r for r in records if matches(r)]