"""
Dashboard Service
------------------
Weather (open-meteo) and currency (open-er-api) stay exactly as before: live data,
cached in memory for REFRESH_INTERVAL seconds.

The old hand-typed "static stats" (tourist arrivals by year, top nationalities) are
gone. Everything tourism-related below is now real KEMET Gold-layer data, loaded from
the CSV exports in `data/` (see the data engineering pipeline notebooks —
03_gold_transformation / weekly export cell). Two things are intentionally kept as
constants because they were never tourism-catalog data to begin with and have no
Gold-layer equivalent: emergency phone numbers and the useful-apps list. They're still
served only from the backend, never hardcoded in the frontend.

Every Gold getter below degrades to an empty/zeroed value instead of raising, so one
missing or half-written CSV only blanks a single chart instead of 500-ing the whole
/summary route (which also carries live weather/currency that have nothing to do with
the Gold export).
"""
import io
import logging
import os
import time

import pandas as pd
import requests

logger = logging.getLogger(__name__)

CITIES = {
    "Alexandria":      {"lat": 31.2001, "lon": 29.9187},
    "Aswan":           {"lat": 24.0889, "lon": 32.8998},
    "Cairo":           {"lat": 30.0444, "lon": 31.2357},
    "Dahab":           {"lat": 28.5010, "lon": 34.5160},
    "Fayoum":          {"lat": 29.3099, "lon": 30.8418},
    "Giza":            {"lat": 30.0131, "lon": 31.2089},
    "Hurghada":        {"lat": 27.2579, "lon": 33.8116},
    "Luxor":           {"lat": 25.6872, "lon": 32.6396},
    "Saint Catherine": {"lat": 28.5647, "lon": 33.9513},
    "Sharm El Sheikh":  {"lat": 27.9158, "lon": 34.3299},
}

REFRESH_INTERVAL = 300  # 5 minutes, same as before

_cache = {"weather": None, "weather_ts": 0, "currency": None, "currency_ts": 0}


# =========================================================================================
# LIVE WEATHER — unchanged
# =========================================================================================
def _fetch_weather_for_city(lat, lon):
    try:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&current=temperature_2m,relative_humidity_2m"
        )
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            current = r.json()["current"]
            return current.get("temperature_2m"), current.get("relative_humidity_2m")
    except Exception:
        pass
    return None, None


def get_live_weather(force_refresh: bool = False):
    """Returns a list of {city, temperature, humidity} for all CITIES."""
    now = time.time()
    if not force_refresh and _cache["weather"] is not None and (now - _cache["weather_ts"] < REFRESH_INTERVAL):
        return _cache["weather"]

    results = []
    for city, coords in CITIES.items():
        temp, hum = _fetch_weather_for_city(coords["lat"], coords["lon"])
        results.append({"city": city, "temperature": temp, "humidity": hum})

    _cache["weather"] = results
    _cache["weather_ts"] = now
    return results


# =========================================================================================
# LIVE CURRENCY — unchanged
# =========================================================================================
def get_live_currency(force_refresh: bool = False):
    """Returns EGP rates for USD/EUR/GBP/SAR/AED, or None if the API failed."""
    now = time.time()
    if not force_refresh and _cache["currency"] is not None and (now - _cache["currency_ts"] < REFRESH_INTERVAL):
        return _cache["currency"]

    try:
        r = requests.get("https://open.er-api.com/v6/latest/USD", timeout=5)
        if r.status_code == 200:
            rates = r.json().get("rates", {})
            egp, eur, gbp, sar, aed = (
                rates.get("EGP"), rates.get("EUR"), rates.get("GBP"),
                rates.get("SAR"), rates.get("AED"),
            )
            if all([egp, eur, gbp, sar, aed]):
                result = {
                    "USD": round(egp, 2),
                    "EUR": round(egp / eur, 2),
                    "GBP": round(egp / gbp, 2),
                    "SAR": round(egp / sar, 2),
                    "AED": round(egp / aed, 2),
                }
                _cache["currency"] = result
                _cache["currency_ts"] = now
                return result
    except Exception:
        pass

    return _cache["currency"]  # last known value (or None) if the API is down right now


# =========================================================================================
# GOLD-LAYER DATA — loaded once per process, cached in memory for the process lifetime.
#
# Two ways to point this at your data:
#
# 1) Azure Blob / ADLS Gen2 (kemetstorage account, "gold" container, "_csv_exports"
#    folder — matches the weekly export notebook). Set AZURE_STORAGE_CONNECTION_STRING
#    on Railway and this reads straight from there. GOLD_CONTAINER / GOLD_BLOB_PREFIX
#    let you point at a different container/folder without touching code.
#
# 2) Local folder fallback (no connection string set) — reads GOLD_DATA_DIR/{table}.csv
#    off local disk, same as before. Handy for local dev without Azure creds.
#
# Needs `azure-storage-blob` in requirements.txt when using option 1.
# =========================================================================================
AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
GOLD_CONTAINER = os.environ.get("GOLD_CONTAINER", "gold")
GOLD_BLOB_PREFIX = os.environ.get("GOLD_BLOB_PREFIX", "_csv_exports")

GOLD_DATA_DIR = os.environ.get(
    "GOLD_DATA_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"),
)

_gold_cache: dict[str, pd.DataFrame] = {}
_blob_service_client = None  # lazily created, reused across requests


def _get_blob_service_client():
    global _blob_service_client
    if _blob_service_client is None:
        from azure.storage.blob import BlobServiceClient  # imported lazily so local
        # dev without azure-storage-blob installed doesn't need it at all.
        _blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    return _blob_service_client


def _read_gold_csv_from_azure(table: str) -> pd.DataFrame:
    blob_path = f"{GOLD_BLOB_PREFIX}/{table}.csv"
    client = _get_blob_service_client().get_blob_client(container=GOLD_CONTAINER, blob=blob_path)
    raw = client.download_blob().readall()
    return pd.read_csv(io.BytesIO(raw))


def _load_gold(table: str) -> pd.DataFrame:
    """Loads a Gold CSV once per process and keeps it in memory — no per-request
    download/disk read. Never raises: a missing or unreadable table just logs a
    warning and serves empty, so it degrades that one chart instead of crashing
    /summary. Call POST /reload after a fresh weekly export to pick it up without
    a redeploy."""
    if table not in _gold_cache:
        try:
            if AZURE_STORAGE_CONNECTION_STRING:
                _gold_cache[table] = _read_gold_csv_from_azure(table)
            else:
                path = os.path.join(GOLD_DATA_DIR, f"{table}.csv")
                _gold_cache[table] = pd.read_csv(path)
        except Exception as exc:
            source = (
                f"azure://{GOLD_CONTAINER}/{GOLD_BLOB_PREFIX}/{table}.csv"
                if AZURE_STORAGE_CONNECTION_STRING
                else os.path.join(GOLD_DATA_DIR, f"{table}.csv")
            )
            logger.warning("Gold table '%s' unavailable at %s (%s) — serving empty.", table, source, exc)
            _gold_cache[table] = pd.DataFrame()
    return _gold_cache[table]


def _reload_gold_cache():
    """Call this after dropping a fresh weekly export in, instead of restarting the
    process — clears the in-memory cache so the next request re-reads the CSVs."""
    _gold_cache.clear()


def get_highlights() -> dict:
    """Headline counts for the KPI strip under the hero."""
    attractions = _load_gold("fact_attractions")
    hotels = _load_gold("fact_hotels")
    restaurants = _load_gold("fact_restaurants")
    beaches = _load_gold("fact_beaches")
    governorates = _load_gold("dim_governorate")
    return {
        "attractions": int(len(attractions)),
        "hotels": int(len(hotels)),
        "restaurants": int(len(restaurants)),
        "beaches": int(len(beaches)),
        "governorates": int(governorates["governorate_key"].nunique()) if "governorate_key" in governorates.columns else 0,
    }


def get_attractions_by_governorate() -> list[dict]:
    """Powers the 'Explore Egypt by Region' bar chart."""
    attractions, governorates = _load_gold("fact_attractions"), _load_gold("dim_governorate")
    if attractions.empty or governorates.empty:
        return []
    df = attractions.merge(governorates, on="governorate_key", how="left")
    counts = (
        df.dropna(subset=["governorate_name"])
        .groupby("governorate_name").size()
        .sort_values(ascending=False)
    )
    return [{"governorate": name, "count": int(count)} for name, count in counts.items()]


def get_attraction_types() -> list[dict]:
    """Powers the 'What Awaits You' donut chart (Ancient Sites / Monuments / Museums)."""
    attractions, types = _load_gold("fact_attractions"), _load_gold("dim_attraction_type")
    if attractions.empty or types.empty:
        return []
    df = attractions.merge(types, on="type_key", how="left")
    counts = df["type_name"].value_counts()
    return [{"type": name, "count": int(count)} for name, count in counts.items()]


def get_top_cuisines(limit: int = 8) -> list[dict]:
    """Powers the 'Flavors of Egypt' bar chart."""
    restaurants, cuisines = _load_gold("fact_restaurants"), _load_gold("dim_cuisine")
    if restaurants.empty or cuisines.empty:
        return []
    df = restaurants.merge(cuisines, on="cuisine_key", how="left")
    counts = df["cuisine_name"].value_counts().head(limit)
    return [{"cuisine": name, "count": int(count)} for name, count in counts.items()]


def get_hotel_price_tiers() -> list[dict]:
    """Powers the 'Hotels by Budget' breakdown (Budget / Mid-range / Luxury)."""
    order = ["Budget", "Mid-range", "Luxury"]
    hotels, tiers = _load_gold("fact_hotels"), _load_gold("dim_price_tier")
    if hotels.empty or tiers.empty:
        return [{"tier": tier, "count": 0} for tier in order]
    df = hotels.merge(tiers, on="tier_key", how="left")
    counts = df["tier_name"].value_counts()
    return [{"tier": tier, "count": int(counts.get(tier, 0))} for tier in order]


def get_beach_ratings_by_governorate(limit: int = 8) -> list[dict]:
    """Powers the 'Best-Rated Beaches' bar chart."""
    beaches, governorates = _load_gold("fact_beaches"), _load_gold("dim_governorate")
    if beaches.empty or governorates.empty:
        return []
    df = beaches.merge(governorates, on="governorate_key", how="left")
    avg = (
        df.dropna(subset=["governorate_name"])
        .groupby("governorate_name")["rating"].mean()
        .sort_values(ascending=False)
        .head(limit)
    )
    return [{"governorate": name, "rating": round(float(rating), 2)} for name, rating in avg.items()]


def get_historical_timeline() -> list[dict]:
    """Powers the '5,000 Years of History' timeline strip. start_year/end_year are
    signed (negative = BC) — already parsed this way in Silver, no conversion needed."""
    df = _load_gold("ref_historical_timeline")
    if df.empty:
        return []
    df = df.sort_values("start_year")
    out = []
    for _, row in df.iterrows():
        if pd.isna(row.get("start_year")) or pd.isna(row.get("end_year")):
            continue
        out.append({
            "period": row["collection"],
            "start_year": int(row["start_year"]),
            "end_year": int(row["end_year"]),
            "duration_years": int(row["duration_years"]),
        })
    return out


def get_national_stats() -> dict | None:
    """Powers the 'Egypt at a Glance' stat row. Returns None (frontend hides the
    section) rather than raising if the snapshot table isn't there yet."""
    df = _load_gold("fact_national_stats")
    if df.empty:
        return None
    row = df.iloc[0]
    return {
        "archaeological_sites": int(row["archaeological_sites"]),
        "museums": int(row["museums"]),
        "hotels_total": int(row["hotels_total"]),
        "diving_activity_centers": int(row["diving_activity_centers"]),
        "tourism_companies": int(row["tourism_companies"]),
        "souvenir_shops": int(row["souvenir_shops"]),
        "tourist_restaurants_cafes": int(row["tourist_restaurants_cafes"]),
        "tourist_vehicles": int(row["tourist_vehicles"]),
        "snapshot_date": str(row["snapshot_date"]),
    }


def get_kemet_data_bundle() -> dict:
    """One call, every piece of Gold-derived content the dashboard needs — keeps the
    route handler in dashboard.py a thin pass-through instead of assembling this itself."""
    return {
        "highlights": get_highlights(),
        "attractions_by_governorate": get_attractions_by_governorate(),
        "attraction_types": get_attraction_types(),
        "top_cuisines": get_top_cuisines(),
        "hotel_price_tiers": get_hotel_price_tiers(),
        "beach_ratings_by_governorate": get_beach_ratings_by_governorate(),
        "historical_timeline": get_historical_timeline(),
        "national_stats": get_national_stats(),
    }


# =========================================================================================
# STATIC REFERENCE DATA — genuinely not tourism-catalog data (phone numbers, app links),
# so there's no Gold table for these and none is needed. Kept here, still served only
# from the backend (never hardcoded in the frontend). `icon` is a lucide-react icon
# name — no emoji, the frontend maps this to a real icon component.
# =========================================================================================
EMERGENCY_INFO = {
    "tourist_police": "126",
    "ambulance": "123",
    "fire": "180",
    "embassy_hotline": "+20 2 2797 3300",
    "general_emergency": "123",
}

USEFUL_APPS = [
    {"name": "Uber / Careem", "url": "https://www.uber.com", "icon": "car"},
    {"name": "Talabat", "url": "https://www.talabat.com", "icon": "utensils"},
    {"name": "Vezeeta", "url": "https://www.vezeeta.com", "icon": "heart-pulse"},
    {"name": "Google Maps", "url": "https://maps.google.com", "icon": "map"},
]