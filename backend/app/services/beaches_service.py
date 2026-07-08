"""
Beaches Service
----------------
نفس منطق hotels_service.py بالظبط (نفس طريقة الاتصال بـ Azure Blob،
نفس أسلوب الـ cache والـ HotelsDataError) لكن للداتا بتاعة الشواطئ
(kemet_beaches_data.csv) بدل الفنادق.
"""
import io
import re
from functools import lru_cache

import pandas as pd
from azure.storage.blob import BlobServiceClient

from app.utils import get_secret

# لو الكونتينر/الاسم مختلف عندك، غيّرهم هنا بس - الباقي كله شغال زي ما هو.
CONTAINER_NAME = "silver"
BLOB_NAME = "_csv_exports/kemet_beaches_data.csv"


def upscale_photo_url(url: str) -> str:
    """
    صور الشواطئ جايه من Google (googleusercontent.com) بروابط فيها
    حجم محدد زي =w408-h306-k-no وده جودة واطية للعرض الكبير.
    بنستبدل جزء الحجم بحجم أعلى (w1200-h900) من غير ما نلمس باقي الرابط،
    بالظبط زي فكرة upscale_image في hotels_service.py.
    """
    if not isinstance(url, str) or "googleusercontent.com" not in url:
        return url
    return re.sub(r"=w\d+-h\d+(-k-no)?", "=w1200-h900-k-no", url)


class BeachesDataError(Exception):
    """بترفع لما الاتصال بـ Azure يفشل أو الداتا متبقاش موجودة."""
    pass


@lru_cache(maxsize=1)
def _load_raw_dataframe() -> pd.DataFrame:
    """
    تحميل الـ CSV من Azure Blob Storage مرة واحدة وتخزينه في الذاكرة.
    لإعادة التحميل يدوياً استخدم _load_raw_dataframe.cache_clear()
    """
    connection_string = get_secret("AZURE_DATALAKE_CONNECTION_STRING")
    if not connection_string:
        raise BeachesDataError(
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
        raise BeachesDataError(f"Error loading beaches data from Azure: {e}")


def _dataframe_to_records(df: pd.DataFrame) -> list[dict]:
    df = df[df["photo_url"].notna() & (df["photo_url"].str.strip() != "")]

    records = []
    for _, row in df.iterrows():
        rating = float(row["rating"]) if pd.notna(row.get("rating")) else 0
        records.append({
            "id": str(row.get("id", "")).strip(),
            "name": str(row.get("name", "")).strip(),
            "government": str(row.get("government", "")).strip() if pd.notna(row.get("government")) else "",
            "rating": rating,
            "photo_url": upscale_photo_url(str(row.get("photo_url", "")).strip()),
            "maps_url": str(row.get("maps_url", "")).strip() if pd.notna(row.get("maps_url")) else "#",
        })
    return records


def get_governments() -> list[str]:
    df = _load_raw_dataframe()
    return ["All"] + sorted(df["government"].dropna().unique().tolist())


def get_beaches(government: str | None = None, search: str | None = None,
                min_rating: float = 0) -> list[dict]:
    """
    فلاتر البحث بتتنفذ في الـ backend بحيث الفرونت يبعت query params بس
    (?government=Red+Sea&search=dahab&min_rating=4.5), زي نفس فكرة get_hotels.
    """
    df = _load_raw_dataframe()
    records = _dataframe_to_records(df)

    def matches(r):
        if government and government != "All" and r["government"] != government:
            return False
        if search and search.lower() not in r["name"].lower() and search.lower() not in r["government"].lower():
            return False
        if r["rating"] < min_rating:
            return False
        return True

    return sorted([r for r in records if matches(r)], key=lambda r: r["rating"], reverse=True)
