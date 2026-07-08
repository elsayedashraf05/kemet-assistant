"""
Trip Planner Service
---------------------
منقول من src/trip_planner.py (نسخة Streamlit القديمة). نفس منطق الداتا بالظبط:
- فلترة المدن/المحافظات (CITY_SYNONYMS + REGION_FALLBACK) على نفس ملفات الـ CSV.
- اختيار الفنادق/المطاعم/المعالم حسب الميزانية والاهتمامات.
- بناء خطة يوم بيوم.

الفرق الأساسي عن النسخة القديمة:
1) مفيش st.* خالص - كل حاجة كانت بتتكتب في st.session_state دلوقتي بترجع كـ dict
   عادي من build_plan()، والـ route (routes/trip_planner.py) هو اللي يحولها JSON.
2) بدل الاستدعاء المباشر لـ Gemini في _optional_ai_summary القديمة، دلوقتي بنعدي
   على app.services.chatbot_service (نفس نظام الـ RAG اللي شغال في صفحة الشات):
   - retrieve_relevant_chunks() تجيب أقرب أجزاء من نفس الداتا ليك (Azure data lake)
     بتاعة الفنادق/المطاعم/المتاحف/الآثار المرتبطة بمدن الرحلة.
   - _call_gemini() هو نفس الموديل المستخدم في الشات (مفيش تكرار كود Gemini).
   - detect_text_direction() عشان نعرف الرد rtl ولا ltr زي الشات بالظبط.
   بالإضافة لسؤال-وجواب حر عن الخطة (ask_about_plan) بيستخدم نفس الـ RAG، فبقى
   الـ trip planner والـ chatbot بيشربوا من نفس مصدر المعرفة.
"""
import datetime
import io
import json
import re
import threading
import time

import pandas as pd
from azure.cosmos import CosmosClient, PartitionKey, exceptions
from azure.storage.blob import BlobServiceClient

from app.config import Config
from app.utils import get_secret
from app.services import chatbot_service

MODEL_ID = chatbot_service.MODELS["Flash"]

DATABASE_NAME = "kemetcosmos"
TRIP_PLANS_CONTAINER_NAME = "TripPlans"

# All data now lives in the "silver" container's "_csv_exports/" folder
# (confirmed in the Azure portal — the old "sourcedatalake" container is no
# longer where this data lives). chatbot_service.py's RAG index reads the
# exact same container/folder, so the trip planner and the chat assistant
# are guaranteed to be looking at the same data.
CONTAINER_NAME = "silver"
CSV_EXPORTS_PREFIX = "_csv_exports/"

# Internal key (used throughout this file) -> actual blob filename under
# _csv_exports/. A couple of these were renamed during the migration
# (restaurants_gmaps.csv -> kemet_restaurants_data.csv), so if a category
# comes back oddly empty after this change, it likely means that file's
# *columns* changed too, not just its name/location — see the row-extraction
# functions below (_retrieve_dataset_content), which assume the old column
# names for anything other than Ancient Sites.
_BLOB_FILENAMES = {
    "Egypt_All_Governorates_Hotels.csv": "egypt_all_governorates_hotels.csv",
    "restaurants_gmaps.csv": "kemet_restaurants_data.csv",
    "Ancient_Sites_En.csv": "ancient_sites_en.csv",
    "monuments_en.csv": "monuments_en.csv",
    "museums_en.csv": "museums_en.csv",
}


class TripPlannerError(Exception):
    pass


# ───────────────────────── Static reference data (shown by /options) ─────────────────────────

INTERESTS = {
    "History": ["Ancient_Sites_En.csv", "monuments_en.csv", "museums_en.csv"],
    "Beaches": ["Egypt_All_Governorates_Hotels.csv"],
    "Food": ["restaurants_gmaps.csv"],
    "Adventure": ["Ancient_Sites_En.csv"],
    "Shopping": ["restaurants_gmaps.csv"],
    "Culture": ["museums_en.csv", "collections_en.csv", "periods_en.csv"],
    "Nightlife": ["restaurants_gmaps.csv", "Egypt_All_Governorates_Hotels.csv"],
    "Museums": ["museums_en.csv", "collections_en.csv"],
    "Religious Heritage": ["monuments_en.csv", "Ancient_Sites_En.csv"],
    "Relaxation": ["Egypt_All_Governorates_Hotels.csv"],
}

BUDGETS = {
    "Budget": {"daily": 1600, "hotel": "Value stays", "label": "Smart and local"},
    "Comfort": {"daily": 3200, "hotel": "Highly rated mid-range hotels", "label": "Balanced comfort"},
    "Luxury": {"daily": 6500, "hotel": "Premium stays and private transfers", "label": "Premium escape"},
}

TRANSPORT_NOTES = {
    "Public transport": "Use metro where available in Cairo, trains between major Nile cities, and short taxis for final legs.",
    "Ride-hailing": "Use Uber/Careem in major cities and confirm pickup points near busy attractions.",
    "Private driver": "Best for multi-stop sightseeing days, families, accessibility needs, and early starts.",
    "Walking + taxis": "Walk compact heritage areas, then use taxis or ride-hailing between neighborhoods.",
}

DEFAULT_PREFERENCES = {
    "destination": "", "cities": [], "days": 5, "budget": "Comfort",
    "interests": ["History", "Food", "Culture"], "travel_style": "Couple",
    "transport": "Ride-hailing", "accessibility": "",
    # "pace" no longer has a UI control (the Relaxed/Balanced/Packed step was
    # removed), but the day-builder's evening text still references it, so it
    # keeps a fixed internal default instead of exposing a selector for it.
    "pace": "Balanced",
    "num_hotels": 6, "num_restaurants": 6,
}


def get_options():
    """كل الداتا الثابتة اللي الفرونت محتاجها عشان يبني الـ wizard من غير ما يكررها."""
    return {
        "governorates": get_available_governorates(),
        "interests": [{"name": i} for i in INTERESTS.keys()],
        "budgets": [{"name": b, **v} for b, v in BUDGETS.items()],
        "travel_styles": [{"name": s} for s in ["Solo", "Couple", "Family", "Friends"]],
        "transport_modes": [{"name": t, "note": n} for t, n in TRANSPORT_NOTES.items()],
        "defaults": DEFAULT_PREFERENCES,
    }


# ───────────────────────── CSV loading (in-memory cache, TTL like chatbot_service) ─────────────────────────

_csv_cache = {}
_csv_lock = threading.Lock()
CSV_TTL_SECONDS = 1800


def _fetch_csv_from_blob(container, blob_name):
    connection_string = getattr(Config, "AZURE_DATALAKE_CONNECTION_STRING", None)
    if not connection_string:
        return pd.DataFrame()
    try:
        client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = client.get_blob_client(container=container, blob=blob_name)
        stream = blob_client.download_blob()
        return pd.read_csv(io.BytesIO(stream.readall()))
    except Exception:
        # Same graceful-degradation approach as the rest of the file: a
        # missing/renamed blob shouldn't crash the whole itinerary, it just
        # means that category comes back empty and the planner falls back
        # to generic placeholders for it.
        return pd.DataFrame()


def _load_csv(name):
    now = time.time()
    with _csv_lock:
        cached = _csv_cache.get(name)
        if cached and (now - cached["at"] < CSV_TTL_SECONDS):
            return cached["df"]

    blob_name = CSV_EXPORTS_PREFIX + _BLOB_FILENAMES.get(name, name)
    df = _fetch_csv_from_blob(CONTAINER_NAME, blob_name)

    with _csv_lock:
        _csv_cache[name] = {"df": df, "at": now}
    return df


_GOVERNORATE_TTL_SECONDS = 1800
_governorate_cache = {"value": None, "at": 0.0}
_governorate_lock = threading.Lock()


def get_available_governorates() -> list[str]:
    """Union of every location-ish value across the datasets — this is what
    the wizard's searchable city/governorate picker offers, instead of a
    hardcoded list of 11 cities with stock photos."""
    now = time.time()
    with _governorate_lock:
        if _governorate_cache["value"] is not None and (now - _governorate_cache["at"] < _GOVERNORATE_TTL_SECONDS):
            return _governorate_cache["value"]

    names = set()

    def _collect(df, columns):
        if df.empty:
            return
        for col in columns:
            if col in df.columns:
                names.update(_clean(v, 60) for v in df[col].dropna())

    _collect(_load_csv("Egypt_All_Governorates_Hotels.csv"), ["governorate", "city"])
    _collect(_load_csv("restaurants_gmaps.csv"), ["governorate", "city"])
    _collect(_load_csv("Ancient_Sites_En.csv"), ["government"])
    _collect(_load_csv("monuments_en.csv"), ["location"])
    _collect(_load_csv("museums_en.csv"), ["location"])

    names.discard("")
    result = sorted(names, key=str.lower)

    with _governorate_lock:
        _governorate_cache["value"] = result
        _governorate_cache["at"] = now
    return result


def _clean(value, limit=220):
    import html
    text = html.unescape(str(value or "")).strip()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    fixes = {"â€™": "'", "â€œ": '"', "â€\u008c": '"', "â€“": "-", "Â°C": "C", "&amp;": "&"}
    for bad, good in fixes.items():
        text = text.replace(bad, good)
    return text[:limit].rstrip()


def clean_hours(text):
    return re.sub(r"<[^>]+>", "", text).strip()


# Governorate/region groupings used when a dataset only has governorate-level
# rows and a requested city has no governorate of its own.
CITY_SYNONYMS = {
    "sharm el sheikh": ["south sinai"],
    "dahab": ["south sinai"],
    "saint catherine": ["south sinai"],
    "hurghada": ["red sea"],
    "fayoum": ["faiyum"],
    "luxor": ["karnak"],
}
REGION_FALLBACK = {
    "sharm el sheikh": ["red sea", "south sinai"],
    "dahab": ["red sea", "south sinai"],
    "saint catherine": ["red sea", "south sinai"],
    "hurghada": ["red sea"],
    "matrouh": ["alexandria"],
}


def _norm(text):
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _match_mask(df, city_columns, terms):
    mask = pd.Series(False, index=df.index)
    if not terms:
        return mask
    for col in city_columns:
        if col in df.columns:
            values = df[col].fillna("").astype(str).map(_norm)
            for term in terms:
                if not term:
                    continue
                mask = mask | values.str.contains(re.escape(term), case=False, na=False)
    return mask


def _filter_city(df, city_columns, cities, destination, allow_region_fallback=True):
    """Returns (filtered_df, matched_exactly: bool)."""
    if df.empty:
        return df, True

    search_terms = [_norm(c) for c in cities if str(c).strip()]
    if destination and destination.strip():
        search_terms.append(_norm(destination))
    search_terms = [t for t in search_terms if t]

    if not search_terms:
        return df, True

    mask = _match_mask(df, city_columns, search_terms)
    filtered = df[mask]
    if not filtered.empty:
        return filtered, True

    synonym_terms = set()
    for term in search_terms:
        synonym_terms.update(CITY_SYNONYMS.get(term, []))
    if synonym_terms:
        mask = _match_mask(df, city_columns, synonym_terms)
        filtered = df[mask]
        if not filtered.empty:
            return filtered, True

    if allow_region_fallback:
        region_terms = set()
        for term in search_terms:
            region_terms.update(REGION_FALLBACK.get(term, []))
        if region_terms:
            mask = _match_mask(df, city_columns, region_terms)
            filtered = df[mask]
            if not filtered.empty:
                return filtered, False

    return pd.DataFrame(columns=df.columns), False


ATTRACTION_FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?w=600",
    "https://images.unsplash.com/photo-1553913861-c0fddf2619ee?w=600",
    "https://images.unsplash.com/photo-1539768942893-daf53e448371?w=600",
    "https://images.unsplash.com/photo-1560184611-ff3e53f00e8f?w=600",
    "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600",
    "https://images.unsplash.com/photo-1590133324192-1919d34a2b0e?w=600",
    "https://images.unsplash.com/photo-1591116237842-e2c5ab7a6d6b?w=600",
]

RESTAURANT_IMAGES = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600",
    "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=600",
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=600",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600",
    "https://images.unsplash.com/photo-1574936145840-28808d77a0b6?w=600",
    "https://images.unsplash.com/photo-1505826759037-1a69cb502211?w=600",
    "https://images.unsplash.com/photo-1525640788966-69bdb028aa73?w=600",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600",
]

HOTEL_FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600",
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600",
]


def _is_valid_image_url(url):
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    if not re.match(r"^https?://[^\s]+\.[a-zA-Z]{2,}", url):
        return False
    if url.lower() in {"nan", "none", "n/a", "no image", "-"}:
        return False
    return True


def _safe_image(url, name, fallback_pool):
    if _is_valid_image_url(url):
        return url.strip()
    idx = abs(hash(name or "")) % len(fallback_pool)
    return fallback_pool[idx]


def _records_from_attractions(df, name_col, city_col, desc_col, img_col, price_col, limit=12):
    records = []
    if df.empty or name_col not in df.columns:
        return records
    for _, row in df.head(limit).iterrows():
        name = _clean(row.get(name_col), 90)
        raw_img = row.get(img_col) if img_col in df.columns else ""
        records.append({
            "name": name,
            "city": _clean(row.get(city_col), 60) if city_col in df.columns else "Egypt",
            "desc": _clean(row.get(desc_col), 260) if desc_col in df.columns else "",
            "url": _safe_image(str(raw_img) if pd.notna(raw_img) else "", name, ATTRACTION_FALLBACK_IMAGES),
            "price": _clean(row.get(price_col), 150) if price_col in df.columns else "N/A",
        })
    return records


# ───────────────────────── Dataset retrieval (structured picks) ─────────────────────────

def _retrieve_dataset_content(data):
    cities = data.get("cities", [])
    destination = data.get("destination", "")
    budget = data.get("budget", "Comfort")
    num_hotels = int(data.get("num_hotels", 6))
    num_restaurants = int(data.get("num_restaurants", 6))

    sites_df, _ = _filter_city(_load_csv("Ancient_Sites_En.csv"), ["government", "place_name"], cities, destination)
    monuments_df, _ = _filter_city(_load_csv("monuments_en.csv"), ["location", "monument"], cities, destination)
    museums_df, _ = _filter_city(_load_csv("museums_en.csv"), ["location", "museum"], cities, destination)

    raw_restaurants_df = _load_csv("restaurants_gmaps.csv")
    restaurants_df, restaurants_matched = _filter_city(
        raw_restaurants_df, ["governorate", "original_name", "address", "city", "name"], cities, destination
    )
    restaurants_note = ""
    if restaurants_df.empty and not raw_restaurants_df.empty:
        restaurants_note = "No restaurants found for this city in our dataset yet — showing top-rated picks across Egypt instead."
        restaurants_df = raw_restaurants_df
    elif not restaurants_matched:
        restaurants_note = "Exact-city matches were limited, so this list also includes nearby-region picks."

    raw_hotels_df = _load_csv("Egypt_All_Governorates_Hotels.csv")
    hotels_df, hotels_matched = _filter_city(
        raw_hotels_df, ["city", "Place_Name", "Address", "governorate", "name"], cities, destination
    )
    hotels_note = ""
    if hotels_df.empty and not raw_hotels_df.empty:
        hotels_note = "No hotels found for this city in our dataset yet — showing top-rated picks across Egypt instead."
        hotels_df = raw_hotels_df
    elif not hotels_matched:
        hotels_note = "Exact-city matches were limited, so this list also includes nearby-region picks."

    attraction_pool = []
    if any(i in data["interests"] for i in ["History", "Adventure", "Religious Heritage"]):
        attraction_pool += _records_from_attractions(sites_df, "place_name", "government", "description", "image_url", None, 12)
        attraction_pool += _records_from_attractions(monuments_df, "monument", "location", "Description", "photo_url", "tickets_price", 12)
    if any(i in data["interests"] for i in ["Museums", "Culture", "History"]):
        attraction_pool += _records_from_attractions(museums_df, "museum", "location", "Description", "photo_url", "tickets_price", 10)

    if not attraction_pool:
        attraction_pool += _records_from_attractions(sites_df, "place_name", "government", "description", "image_url", None, 8)

    food = []
    if not restaurants_df.empty:
        backup_rest_df = restaurants_df.copy()
        if "rating" in restaurants_df.columns:
            restaurants_df = restaurants_df.sort_values("rating", ascending=False)
            backup_rest_df = backup_rest_df.sort_values("rating", ascending=False)

        if "price_level" in restaurants_df.columns:
            if budget == "Budget":
                restaurants_df = restaurants_df[restaurants_df["price_level"].fillna("").str.contains(r"💸|E£|Budget", case=False, regex=True) | (restaurants_df["price_level"].isna())]
            elif budget == "Luxury":
                restaurants_df = restaurants_df[restaurants_df["price_level"].fillna("").str.contains(r"\$\$\$|\$\$\$\$|Expensive", case=False, regex=True) | (restaurants_df["price_level"].isna())]

        if restaurants_df.empty:
            restaurants_df = backup_rest_df

        for _, row in restaurants_df.head(max(12, num_restaurants)).iterrows():
            r_name = _clean(row.get("original_name") or row.get("gmaps_name"), 90)
            img_idx = hash(r_name) % len(RESTAURANT_IMAGES)
            food.append({
                "name": r_name,
                "city": _clean(row.get("governorate") or row.get("city"), 60),
                "desc": _clean(row.get("category"), 120),
                "url": RESTAURANT_IMAGES[img_idx],
                "price": _clean(row.get("price_level"), 80) or "Local Pricing",
                "link": _clean(row.get("gmaps_url"), 400),
            })

    if not hotels_df.empty:
        backup_hotels_df = hotels_df.copy()
        if "Price_EGP" in hotels_df.columns:
            if budget == "Budget":
                hotels_df = hotels_df[hotels_df["Price_EGP"] < 3000].sort_values("Rating_Score", ascending=False)
            elif budget == "Comfort":
                hotels_df = hotels_df[(hotels_df["Price_EGP"] >= 3000) & (hotels_df["Price_EGP"] <= 7000)].sort_values("Rating_Score", ascending=False)
            else:
                hotels_df = hotels_df[hotels_df["Price_EGP"] > 7000].sort_values("Rating_Score", ascending=False)
        elif "Rating_Score" in hotels_df.columns:
            hotels_df = hotels_df.sort_values("Rating_Score", ascending=False)

        if hotels_df.empty:
            hotels_df = backup_hotels_df.sort_values("Rating_Score", ascending=False) if "Rating_Score" in backup_hotels_df.columns else backup_hotels_df

    stays = []
    if not hotels_df.empty:
        for _, row in hotels_df.head(max(10, num_hotels)).iterrows():
            price_val = f"EGP {int(row['Price_EGP'])} / night" if "Price_EGP" in row and pd.notna(row["Price_EGP"]) else "Contact for Rates"
            h_name = _clean(row.get("Place_Name"), 90)
            raw_img = row.get("Image")
            stays.append({
                "name": h_name,
                "city": _clean(row.get("city"), 60),
                "desc": f"⭐ {row.get('Rating_Score', 'Rated')} · {clean_hours(str(row.get('Room_Info', 'Value Room')))}",
                "url": _safe_image(str(raw_img) if pd.notna(raw_img) else "", h_name, HOTEL_FALLBACK_IMAGES),
                "price": price_val,
                "link": _clean(row.get("Link"), 400),
            })

    return {
        "attractions": attraction_pool,
        "restaurants": food,
        "hotels": stays,
        "restaurants_note": restaurants_note,
        "hotels_note": hotels_note,
    }


def _weather_note(cities):
    hot = {"Luxor", "Aswan", "Fayoum"}
    coast = {"Alexandria", "Hurghada", "Sharm El Sheikh", "Dahab", "Matrouh"}
    if any(c in hot for c in cities):
        return "Plan temple and desert-heavy days early, keep shaded breaks after lunch, and carry water."
    if any(c in coast for c in cities):
        return "Coastal winds can affect boat excursions; stay updated with tracking software updates."
    return "Check the live dashboard weather before heading out, prioritizing morning walks."


def _tips(data):
    tips = [
        "Book headline attractions and guided tours ahead during peak seasons.",
        "Carry cash for small vendors, local entry tickets, and gratuities.",
        "Dress respectfully when visiting historical or sacred religious monuments.",
    ]
    if data["travel_style"] == "Family":
        tips.append("Incorporate a flexible rest interval in the afternoon for children.")
    return tips


def _source_badges(retrieved):
    badges = []
    if retrieved["attractions"]:
        badges.append("Verified Monuments & Heritage Sites")
    if retrieved["restaurants"]:
        badges.append("Curated Restaurants Ledger")
    if retrieved["hotels"]:
        badges.append("Matching Accommodation Matrix")
    return badges


def _build_days(data, attractions, restaurants, day_notes=None):
    cities = data["cities"] or ["Egypt"]
    days_total = int(data["days"])
    num_cities = len(cities)
    day_notes = day_notes or {}

    days = []
    for day in range(1, days_total + 1):
        city_idx = min((day - 1) * num_cities // days_total, num_cities - 1)
        city = cities[city_idx]

        city_attractions = [a for a in attractions if city.lower() in a["city"].lower()] or attractions
        city_restaurants = [r for r in restaurants if city.lower() in r["city"].lower()] or restaurants

        primary = city_attractions[(day - 1) % len(city_attractions)]
        secondary = city_attractions[day % len(city_attractions)]
        food = city_restaurants[(day - 1) % len(city_restaurants)]

        days.append({
            "day": day,
            "city": city,
            "title": f"{city} highlights",
            "morning": f"Start with {primary['name']}. {primary['desc']}",
            "afternoon": f"Continue to {secondary['name']} for a complementary local stop.",
            "evening": f"Dinner near {food['name']} ({food['desc']}), then keep the evening {data['pace'].lower()}.",
            "ai_note": day_notes.get(str(day), ""),
            "food": food,
            "transport": TRANSPORT_NOTES[data["transport"]],
        })
    return days


# ───────────────────────── RAG integration (shared with chatbot_service) ─────────────────────────

def _rag_query_for_trip(data):
    cities = ", ".join(data.get("cities") or []) or (data.get("destination") or "Egypt")
    interests = ", ".join(data.get("interests") or [])
    return f"{data.get('days', 5)}-day {data.get('budget', 'Comfort')} trip to {cities} focused on {interests}"


def _generate_ai_narrative(data, retrieved):
    """
    بدل الاستدعاء المباشر القديم لـ Gemini، هنا بنستخدم نفس محرك الـ RAG اللي
    الشات بيستخدمه (chatbot_service.retrieve_relevant_chunks) عشان الملخص
    ونبرة كل يوم تتبني على نفس أجزاء الداتا (نفس الفنادق/المطاعم/المعالم) اللي
    اخترناها فعلاً في الخطة، مش نص عام من الموديل لوحده.
    Returns dict: {"summary": str, "day_notes": {"1": str, ...}} - ("" لو فشل).
    """
    if not chatbot_service.GEMINI_API_KEY or not chatbot_service.AZURE_CONNECTION_STRING:
        return {"summary": "", "day_notes": {}}

    query = _rag_query_for_trip(data)
    try:
        rag_context = chatbot_service.retrieve_relevant_chunks(query)
    except Exception:
        rag_context = ""

    picked_names = ", ".join(a["name"] for a in retrieved["attractions"][:4])
    prompt = f"""You are KEMET, an Egypt tourism planning assistant.
Using the dataset excerpts below (retrieved from KEMET's own hotels/restaurants/museums/monuments/sites data),
write a short JSON object with:
- "summary": one premium, warm paragraph (2-3 sentences, no HTML, no markdown) introducing this itinerary.
- "day_notes": an object mapping day numbers ("1", "2", ...) to one short extra sentence of local color or a
  practical nuance for that day. Include one entry per day, for {data.get('days', 5)} days.

Respond with ONLY the JSON object, nothing else - no preamble, no markdown fences.

Traveler preferences: {json.dumps(data, ensure_ascii=False)}
Selected highlights: {picked_names}

Relevant dataset excerpts:
{rag_context}
"""
    try:
        response = chatbot_service._call_gemini(model=MODEL_ID, contents=prompt)
        raw = re.sub(r"```[a-zA-Z]*", "", response.text).replace("```", "").strip()
        parsed = json.loads(raw)
        return {
            "summary": str(parsed.get("summary", "")).strip(),
            "day_notes": {str(k): str(v) for k, v in (parsed.get("day_notes") or {}).items()},
        }
    except Exception:
        return {"summary": "", "day_notes": {}}


def ask_about_plan(question, plan=None, rate_limit_key="trip-planner"):
    """
    سؤال حر عن رحلة معينة (أو عن مصر بشكل عام لو plan=None)، بيستخدم نفس الـ RAG
    اللي الشات بيستخدمه بالظبط. دي نقطة الربط الأساسية بين الـ trip planner
    وصفحة الشات: نفس الداتا، نفس الموديل، نفس منطق كشف اتجاه النص.
    Returns (reply_text, direction, error_code_or_None) - نفس شكل chatbot_service.get_reply.
    """
    if not question or not question.strip():
        return "Please type a question about your trip.", "ltr", "empty_question"

    if not chatbot_service._check_rate_limit(rate_limit_key):
        wait_reply = "Please wait a few seconds between questions to avoid rate limits."
        return wait_reply, chatbot_service.detect_text_direction(wait_reply), "rate_limited"

    try:
        rag_context = chatbot_service.retrieve_relevant_chunks(question)
    except Exception:
        rag_context = "No data files found."

    plan_context = ""
    if plan:
        cities = ", ".join(plan.get("cities", []) or [])
        plan_context = (
            f"The traveler already has a generated {len(plan.get('days', []))}-day itinerary for {cities}, "
            f"budget tier {plan.get('budget_tier', 'Comfort')}. "
            f"Chosen hotels: {', '.join(h['name'] for h in plan.get('hotels', [])[:3])}. "
            f"Chosen restaurants: {', '.join(r['name'] for r in plan.get('restaurants', [])[:3])}."
        )

    prompt = f"""You are KEMET, an Egypt tourism assistant helping a traveler with a trip they are actively planning.
{plan_context}

Answer the traveler's question using the relevant dataset excerpts below when useful. If the excerpts don't
cover it, answer from general Egypt travel knowledge and say so honestly.

Relevant data:
{rag_context}

Question: {question}"""

    try:
        response = chatbot_service._call_gemini(model=MODEL_ID, contents=prompt)
        reply = response.text
    except Exception as e:
        reply = chatbot_service._format_error(str(e), "Flash")
        return reply, chatbot_service.detect_text_direction(reply), "api_error"

    return reply, chatbot_service.detect_text_direction(reply), None


# ───────────────────────── Main entrypoint ─────────────────────────

def build_plan(raw_data):
    data = {**DEFAULT_PREFERENCES, **(raw_data or {})}
    data["cities"] = list(data.get("cities") or [])
    data["interests"] = list(data.get("interests") or DEFAULT_PREFERENCES["interests"])
    if not data["interests"]:
        raise TripPlannerError("Please select at least one interest.")
    if data.get("budget") not in BUDGETS:
        data["budget"] = "Comfort"
    if data.get("transport") not in TRANSPORT_NOTES:
        data["transport"] = "Ride-hailing"
    try:
        data["days"] = max(1, min(30, int(data.get("days", 5))))
    except (TypeError, ValueError):
        data["days"] = 5

    retrieved = _retrieve_dataset_content(data)
    attractions = retrieved["attractions"] or [{
        "name": "Local heritage walk", "city": data.get("destination") or "Egypt",
        "desc": "A flexible exploration block based on your selected area.", "url": "", "price": "Free",
    }]
    restaurants = retrieved["restaurants"] or [{
        "name": "Local Egyptian restaurant", "city": data.get("destination") or "Egypt",
        "desc": "Traditional culinary area.",
        "url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600",
        "price": "Standard Rate", "link": "",
    }]
    hotels = retrieved["hotels"]

    narrative = _generate_ai_narrative(data, retrieved)
    days = _build_days(data, attractions, restaurants, narrative.get("day_notes"))

    daily = BUDGETS[data["budget"]]["daily"]
    low = daily * data["days"]
    high = int(low * (1.35 if data["budget"] != "Luxury" else 1.6))

    return {
        "preferences": data,
        "summary": narrative.get("summary") or (
            f"A balanced {data['days']}-day plan matching your {data['budget'].lower()} choice, "
            f"focusing on {', '.join(data['interests'])}."
        ),
        "budget_tier": data.get("budget", "Comfort"),
        "cities": data["cities"],
        "days": days,
        "budget": {"low": low, "high": high, "daily": daily, "note": "Estimate covers entry tickets, local transport buffers, and dining. Stays vary by season."},
        "attractions": attractions,
        "restaurants": restaurants[:int(data.get("num_restaurants", 6))],
        "hotels": hotels[:int(data.get("num_hotels", 6))],
        "transport": data["transport"],
        "transport_note": TRANSPORT_NOTES[data["transport"]],
        "weather": _weather_note(data["cities"]),
        "tips": _tips(data),
        "accessibility": data.get("accessibility", "").strip(),
        "sources": _source_badges(retrieved),
        "restaurants_note": retrieved.get("restaurants_note", ""),
        "hotels_note": retrieved.get("hotels_note", ""),
        "rag_powered": bool(narrative.get("summary")),
    }


# ───────────────────────── Persistence (Cosmos DB, same pattern as accounts_service) ─────────────────────────

def _get_plans_container():
    endpoint = get_secret("COSMOS_ENDPOINT")
    key = get_secret("COSMOS_KEY")
    if not endpoint or not key:
        raise TripPlannerError("COSMOS_ENDPOINT / COSMOS_KEY غير موجودين في الـ environment.")
    client = CosmosClient(endpoint, key)
    database = client.create_database_if_not_exists(id=DATABASE_NAME)
    return database.create_container_if_not_exists(
        id=TRIP_PLANS_CONTAINER_NAME, partition_key=PartitionKey(path="/Username")
    )


def save_plan(username, preferences, plan):
    if not username:
        raise TripPlannerError("Missing username.")
    container = _get_plans_container()
    plan_id = f"{username}-{datetime.datetime.utcnow().isoformat()}"
    doc = {
        "id": plan_id,
        "Username": username,
        "CreatedAt": datetime.datetime.utcnow().isoformat(),
        "Preferences": preferences,
        "Itinerary": plan,
    }
    try:
        container.create_item(body=doc)
        return {"plan_id": plan_id}
    except Exception as e:
        raise TripPlannerError(f"Error saving plan: {e}")


def list_plans(username):
    container = _get_plans_container()
    try:
        query = "SELECT c.id, c.CreatedAt, c.Preferences FROM c WHERE c.Username = @username ORDER BY c.CreatedAt DESC"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@username", "value": username}],
            enable_cross_partition_query=True,
        ))
        return items
    except Exception as e:
        raise TripPlannerError(f"Error listing plans: {e}")


def get_plan(username, plan_id):
    container = _get_plans_container()
    try:
        doc = container.read_item(item=plan_id, partition_key=username)
    except exceptions.CosmosResourceNotFoundError:
        return None
    except Exception as e:
        raise TripPlannerError(f"Error fetching plan: {e}")
    if doc.get("Username") != username:
        return None
    return doc


def delete_plan(username, plan_id):
    container = _get_plans_container()
    doc = get_plan(username, plan_id)
    if doc is None:
        return False, "Plan not found."
    try:
        container.delete_item(item=plan_id, partition_key=username)
        return True, "Plan deleted."
    except Exception as e:
        return False, f"Error deleting plan: {e}"