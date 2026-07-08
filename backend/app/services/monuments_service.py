"""
Monuments data service.

Update: the source blob is back to the plain export at
silver/_csv_exports/monuments_en.csv, with columns:
    id, place_name, government, description, open, close, image_url, map

Notes on the mapping:
  * `government` (the cleaned governorate, e.g. "Cairo") is used for
    `location`/filtering — same as before, matches how hotels/restaurants
    filter by governorate too.
  * There's no ticket-pricing data in this export at all (no
    tickets_price_* columns), so the old "FOREIGNERS / EGYPTIANS" price
    block is gone. `desc` (from `description`) is now the primary body
    text the frontend renders instead.
  * `hours` is built directly from the single `open`/`close` columns
    (no summer/winter split in this export).
  * `maps_url` (from `map`) is included the same way as before so the
    card can still show a "Directions" button if/when that column is
    populated — in the current export it's empty for every row, so the
    button just won't render for now.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from threading import Lock

import pandas as pd
from azure.storage.blob import BlobServiceClient
import io

from app.config import Config

CONTAINER_NAME = "silver"
BLOB_NAME = "_csv_exports/monuments_en.csv"
CACHE_TTL_SECONDS = 15 * 60  # matches the effective lifetime st.cache_data had per session

FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600"


class MonumentsDataError(Exception):
    """Raised when the monuments dataset can't be loaded."""


def strip_html(text):
    if not isinstance(text, str):
        return text
    clean = re.sub(r"<[^>]+>", "", text)
    for ent, rep in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')]:
        clean = clean.replace(ent, rep)
    return clean.strip()


@dataclass
class _TTLCache:
    ttl_seconds: int
    _value: list | None = field(default=None, init=False)
    _expires_at: float = field(default=0.0, init=False)
    _lock: Lock = field(default_factory=Lock, init=False)

    def get_or_set(self, factory):
        with self._lock:
            now = time.time()
            if self._value is not None and now < self._expires_at:
                return self._value
            value = factory()
            self._value = value
            self._expires_at = now + self.ttl_seconds
            return value


_cache = _TTLCache(ttl_seconds=CACHE_TTL_SECONDS)


def _fetch_dataframe() -> pd.DataFrame:
    connection_string = Config.AZURE_DATALAKE_CONNECTION_STRING
    if not connection_string:
        raise MonumentsDataError(
            "Connection details not found. Set AZURE_DATALAKE_CONNECTION_STRING "
            "as an environment variable (.env locally, or your host's secret/variable settings)."
        )

    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
        stream = blob_client.download_blob()
        df = pd.read_csv(io.BytesIO(stream.readall()))
    except Exception as exc:  # noqa: BLE001 - surfaced to the API caller as a 502
        raise MonumentsDataError(f"Error loading data: {exc}") from exc

    df.columns = df.columns.str.strip()
    for col in ["place_name", "government", "description"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: strip_html(x) if pd.notna(x) else x)
    return df


def _build_hours(open_time, close_time) -> str:
    if pd.notna(open_time) and pd.notna(close_time):
        return f"{open_time} \u2013 {close_time}"
    return "Not Available"


def _build_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for _, row in df.iterrows():
        name = strip_html(str(row.get("place_name", "")))
        location = strip_html(str(row.get("government", ""))) if pd.notna(row.get("government")) else ""
        desc = strip_html(str(row.get("description", ""))) if pd.notna(row.get("description")) else ""
        img = (
            str(row.get("image_url", "")).strip()
            if pd.notna(row.get("image_url"))
            else FALLBACK_IMAGE
        )
        hours = _build_hours(row.get("open"), row.get("close"))
        map_value = row.get("map")
        maps_url = str(map_value).strip() if pd.notna(map_value) else None
        records.append(
            {
                "name": name,
                "location": location,
                "desc": desc,
                "img": img,
                "hours": hours,
                "maps_url": maps_url,
            }
        )
    return records


def _load_records() -> list[dict]:
    df = _fetch_dataframe()
    return _build_records(df)


def get_monuments(location: str | None = None, search: str | None = None) -> list[dict]:
    """Return monument records, optionally filtered server-side.

    The React page currently filters client-side (same UX as the old
    vanilla-JS Streamlit widget), but the filters are supported here too
    so the frontend can move filtering server-side later without any
    backend changes.
    """
    records = _cache.get_or_set(_load_records)

    if location and location != "All Locations":
        records = [r for r in records if r["location"] == location]
    if search:
        q = search.lower()
        records = [r for r in records if q in r["location"].lower() or q in r["name"].lower()]
    return records


def get_locations() -> list[str]:
    records = _cache.get_or_set(_load_records)
    unique_locations = sorted({r["location"] for r in records if r["location"]})
    return ["All Locations"] + unique_locations