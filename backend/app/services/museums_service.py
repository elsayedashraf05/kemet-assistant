"""
Museums data service.

This is a straight port of the data-loading / cleaning logic that used
to live inside `museums.py` (the Streamlit page). The differences:

  * st.cache_data  -> a tiny manual TTL cache (see `_TTLCache`), since
                       there's no Streamlit runtime to cache against.
  * st.error/st.stop -> raises `MuseumsDataError`, which the Flask route
                       turns into a proper JSON error response.

Update: the source file changed location/schema. It now lives at
silver/_csv_exports/museums_en.csv with columns:
    id, place_name, government, description, open, close, image_url, map

Notably there's no ticket-price column anymore, so museum records no
longer include a `price` field at all (the featured GEM block below is
a separate, hand-curated static entry and is unaffected by this).
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
BLOB_NAME = "_csv_exports/museums_en.csv"
CACHE_TTL_SECONDS = 15 * 60  # matches the effective lifetime st.cache_data had per session

FALLBACK_IMG = "https://images.unsplash.com/photo-1600577916048-804c9191e36c?w=600"


class MuseumsDataError(Exception):
    """Raised when the museums dataset can't be loaded."""


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
        raise MuseumsDataError(
            "Connection details not found. Set AZURE_DATALAKE_CONNECTION_STRING "
            "as an environment variable (.env locally, or your host's secret/variable settings)."
        )

    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=CONTAINER_NAME, blob=BLOB_NAME)
        stream = blob_client.download_blob()
        df = pd.read_csv(io.BytesIO(stream.readall()))
    except Exception as exc:  # noqa: BLE001 - surfaced to the API caller as a 502
        raise MuseumsDataError(f"Error loading data: {exc}") from exc

    df.columns = df.columns.str.strip()
    for col in ["description", "place_name", "government"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: strip_html(x) if pd.notna(x) else x)
    return df


def _build_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for _, row in df.iterrows():
        name = strip_html(str(row.get("place_name", "")))
        location = strip_html(str(row.get("government", "")))
        full_desc = strip_html(str(row.get("description", ""))) if pd.notna(row.get("description")) else ""
        first_para = next((line.strip() for line in full_desc.split("\n") if line.strip()), full_desc)
        img = (
            str(row.get("image_url", ""))
            if pd.notna(row.get("image_url"))
            else FALLBACK_IMG
        )
        hours = (
            f"{row.get('open', '')} \u2013 {row.get('close', '')}"
            if pd.notna(row.get("open")) and pd.notna(row.get("close"))
            else "Not Available"
        )
        maps_url = str(row.get("map", "")) if pd.notna(row.get("map")) else None
        records.append(
            {
                "name": name,
                "location": location,
                "desc": first_para,
                "img": img,
                "hours": hours,
                "maps_url": maps_url,
            }
        )
    return records


def _load_records() -> list[dict]:
    df = _fetch_dataframe()
    return _build_records(df)


def get_museums(location: str | None = None, search: str | None = None) -> list[dict]:
    """Return museum records, optionally filtered server-side.

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
        records = [r for r in records if q in r["name"].lower()]
    return records


def get_locations() -> list[str]:
    records = _cache.get_or_set(_load_records)
    unique_locations = sorted({r["location"] for r in records if r["location"]})
    return ["All Locations"] + unique_locations


# ── Featured museum: Grand Egyptian Museum (GEM) — same static block that
#    lived inline in museums.py, verified via gem.eg / tickets.gem.eg ──
FEATURED_GEM = {
    "name": "Grand Egyptian Museum",
    "subtitle": "GEM",
    "location": "Giza",
    "images": [
        "https://commons.wikimedia.org/wiki/Special:FilePath/GEM%2C%20December%2022nd%2C%202025%2C%20by%20Dyolf77%2C%20ZVE07609.jpg?width=900",
        "https://commons.wikimedia.org/wiki/Special:FilePath/GEM%2C%20December%2022nd%2C%202025%2C%20by%20Dyolf77%2C%20ZVE07616.jpg?width=900",
        "https://commons.wikimedia.org/wiki/Special:FilePath/Grand%20Staircase%20(GEM).jpg?width=900",
        "https://commons.wikimedia.org/wiki/Special:FilePath/GEM%20staircase%20at%20night%20with%20visitors%202025.jpg?width=900",
        "https://commons.wikimedia.org/wiki/Special:FilePath/75%20Tonnen%20wiegt%20die%20Kolossalstatue%20des%20Ramses%20II%20im%20Gro%C3%9Fen%20%C3%84gyptischen%20Museum.%2001.jpg?width=900",
        "https://commons.wikimedia.org/wiki/Special:FilePath/Temple%20fragment%2C%20Grand%20Staircase%20in%20Grand%20Egyptian%20Museum.jpg?width=900",
    ],
    "description": (
        "The world's largest museum dedicated to a single civilisation, standing minutes from the "
        "Giza Pyramids. Standard admission covers all 12 chronological galleries, the Grand Staircase, "
        "the complete Tutankhamun collection (5,000+ artefacts shown together for the first time), and "
        "King Khufu's Solar Boat."
    ),
    "hours": "Galleries: 9:00 AM \u2013 6:00 PM daily (until 9:00 PM Wed & Sat) \u00b7 Complex opens 8:30 AM",
    "booking_note": "Timed-entry, online booking only \u2014 no on-site ticket sales",
    "prices": [
        {"label": "Foreign Adult", "value": "1,450 EGP"},
        {"label": "Student / Child", "value": "730 EGP"},
        {"label": "Egyptian", "value": "200 EGP"},
    ],
    "booking_url": "https://tickets.gem.eg/",
    "maps_url": "https://maps.app.goo.gl/MjoEi1p6BVofkA7dA",
    "price_note": (
        "Prices checked against tickets.gem.eg on 2 Jul 2026 \u2014 the site doesn't expose a public "
        "price feed, so please always confirm the final total on tickets.gem.eg before booking."
    ),
}