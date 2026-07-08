"""
Ancient Sites data service — same pattern as `museums_service.py`:

  * st.cache_data  -> a tiny manual TTL cache (see `_TTLCache`)
  * st.error/st.stop -> raises `SitesDataError`, turned into a 502 JSON response

Data source (updated): container `silver`, blob `_csv_exports/ancient_sites_en.csv`
(confirmed in the Azure portal — the old `sourcedatalake/Ancient_Sites_En.csv`
blob no longer exists; storage was reorganized into `silver/_csv_exports/`).

Schema also changed with the new file. Old -> new column mapping:
  place_location  -> government
  place_description-> description
  photo_url        -> image_url
  start_from/end_at-> open/close
  on_map           -> map
  (tickets_price column removed entirely — the new source has no pricing
  data at all, so all price-related parsing/curation from the old service
  has been dropped. The API no longer returns price/prices/price_note.)
"""
from __future__ import annotations

import io
import re
import time
from dataclasses import dataclass, field
from threading import Lock

import pandas as pd
from azure.storage.blob import BlobServiceClient

from app.config import Config

CONTAINER_NAME = "silver"
BLOB_NAME = "_csv_exports/ancient_sites_en.csv"
CACHE_TTL_SECONDS = 15 * 60

class SitesDataError(Exception):
    """Raised when the ancient-sites dataset can't be loaded."""


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
        raise SitesDataError(
            "Connection details not found. Set AZURE_DATALAKE_CONNECTION_STRING "
            "as an environment variable (.env locally, or your host's secret/variable settings)."
        )

    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
        stream = blob_client.download_blob()
        df = pd.read_csv(io.BytesIO(stream.readall()))
    except Exception as exc:  # noqa: BLE001 - surfaced to the API caller as a 502
        raise SitesDataError(f"Error loading data: {exc}") from exc

    df.columns = df.columns.str.strip()
    for col in ["description", "place_name", "government"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: strip_html(x) if pd.notna(x) else x)
    return df


def _record_from_row(row, full_description: bool = False) -> dict:
    name = strip_html(str(row.get("place_name", "")))
    location = strip_html(str(row.get("government", "")))
    full_desc = strip_html(str(row.get("description", ""))) if pd.notna(row.get("description")) else ""
    if full_description:
        desc = full_desc
    else:
        desc = next((line.strip() for line in full_desc.split("\n") if line.strip()), full_desc)
    img = (
        str(row.get("image_url", ""))
        if pd.notna(row.get("image_url"))
        else "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600"
    )
    open_time = row.get("open")
    close_time = row.get("close")
    hours = f"{open_time} \u2013 {close_time}" if pd.notna(open_time) and pd.notna(close_time) else "Not Available"
    maps_url = str(row.get("map", "")) if pd.notna(row.get("map")) else None

    return {
        "name": name,
        "location": location,
        "desc": desc,
        "full_desc": full_desc,
        "img": img,
        "hours": hours,
        "maps_url": maps_url,
    }


def _load_dataframe_cached() -> pd.DataFrame:
    return _cache.get_or_set(_fetch_dataframe)


def get_sites(location: str | None = None, search: str | None = None) -> list[dict]:
    """All sites, optionally filtered.

    Filtering is supported server-side too, mirroring museums_service, but
    the frontend currently filters client-side for instant results.
    """
    df = _load_dataframe_cached()
    records = [_record_from_row(row) for _, row in df.iterrows()]

    if location and location != "All Locations":
        records = [r for r in records if r["location"] == location]
    if search:
        q = search.lower()
        records = [r for r in records if q in r["name"].lower()]
    return records


def get_locations() -> list[str]:
    df = _load_dataframe_cached()
    locations = {strip_html(str(loc)) for loc in df["government"].dropna()}
    return ["All Locations"] + sorted(locations)