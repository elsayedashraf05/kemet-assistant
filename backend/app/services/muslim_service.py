"""
Muslim travel service — prayer times (Aladhan API), Egypt's historic
mosques, and common Islamic social phrases.

Mirrors tickets_service.py's caching style: prayer times only need
refreshing once a day (they don't change intraday), so they're cached
with the same _TTLCache pattern. Mosques and phrases are static
reference data (verified against Wikipedia / Discover Islamic Art /
government sources, ported from the original muslim.py) — no I/O, so
no cache needed for those.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock

import requests

ALADHAN_METHOD = 5  # Egyptian General Authority of Survey calculation method
PRAYER_REFRESH_SECONDS = 24 * 60 * 60  # prayer times only change once a day

PRAYER_CITIES = {
    "Alexandria":      {"lat": 31.2001, "lon": 29.9187},
    "Cairo":           {"lat": 30.0444, "lon": 31.2357},
    "Giza":            {"lat": 30.0131, "lon": 31.2089},
    "Luxor":           {"lat": 25.6872, "lon": 32.6396},
    "Aswan":           {"lat": 24.0889, "lon": 32.8998},
    "Hurghada":        {"lat": 27.2579, "lon": 33.8116},
    "Sharm El Sheikh": {"lat": 27.9158, "lon": 34.3299},
    "Dahab":           {"lat": 28.5010, "lon": 34.5160},
    "Fayoum":          {"lat": 29.3099, "lon": 30.8418},
    "Saint Catherine": {"lat": 28.5647, "lon": 33.9513},
}

PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]


class MuslimDataError(Exception):
    """Raised when prayer time data can't be loaded from Aladhan."""


def _to_12h(t24: str) -> str:
    """Convert HH:MM (24h) to hh:MM AM/PM."""
    try:
        h, m = map(int, t24.split(":"))
        period = "AM" if h < 12 else "PM"
        h12 = h % 12 or 12
        return f"{h12}:{m:02d} {period}"
    except Exception:
        return t24


def _fetch_city_timings(lat: float, lon: float) -> dict | None:
    today = datetime.now().strftime("%d-%m-%Y")
    url = f"https://api.aladhan.com/v1/timings/{today}"
    try:
        resp = requests.get(
            url,
            params={"latitude": lat, "longitude": lon, "method": ALADHAN_METHOD},
            timeout=8,
        )
        resp.raise_for_status()
        timings = resp.json()["data"]["timings"]
        return {name: _to_12h(timings.get(name, "--")) for name in PRAYER_ORDER}
    except Exception:
        return None


@dataclass
class _TTLCache:
    ttl_seconds: int
    _value: object | None = field(default=None, init=False)
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

    def invalidate(self):
        with self._lock:
            self._value = None
            self._expires_at = 0.0


_prayer_cache = _TTLCache(ttl_seconds=PRAYER_REFRESH_SECONDS)


def _load_all_prayer_times() -> dict:
    times = {}
    for city, coords in PRAYER_CITIES.items():
        city_times = _fetch_city_timings(coords["lat"], coords["lon"])
        if city_times:
            times[city] = city_times
    return {
        "times": times,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def get_prayer_times() -> dict:
    """Returns {times: {city: {Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha}}, updatedAt}.

    Cached ~daily since Aladhan's timings for a given day don't change.
    """
    result = _prayer_cache.get_or_set(_load_all_prayer_times)
    if not result["times"]:
        raise MuslimDataError(
            "Could not reach the prayer times service right now. Please try again shortly."
        )
    return result


def force_refresh_prayer_times() -> dict:
    """Bypasses the cache — used by the frontend's manual refresh button."""
    _prayer_cache.invalidate()
    return get_prayer_times()


# ── Static reference data — Egypt's historic mosques ──
# Verified against Wikipedia / Discover Islamic Art / government sources,
# ported directly from the original muslim.py dataset.
EGYPT_MOSQUES = [
    {
        "name": "Al-Azhar Mosque", "city": "Islamic Cairo",
        "year": "Built 970 CE", "builder": "Jawhar al-Siqilli, for the Fatimid Caliphate",
        "style": "Fatimid architecture",
        "desc": "Egypt's founding mosque and seat of Al-Azhar University, the second-oldest continuously "
                "operating university in the world. Its minarets and courtyard were expanded over centuries "
                "by Fatimid, Mamluk and Ottoman rulers.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Cairo%20-%20Islamic%20district%20-%20Al%20Azhar%20Mosque%20and%20University%20front.JPG?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Al-Azhar+Mosque+Cairo+Egypt",
    },
    {
        "name": "Ibn Tulun Mosque", "city": "Islamic Cairo",
        "year": "Built 876 \u2013 879 CE", "builder": "Ahmad ibn Tulun",
        "style": "Abbasid style (Samarra-inspired)",
        "desc": "Cairo's oldest mosque to survive in its original form, famous for its rare spiral minaret "
                "and vast brick-pier courtyard modelled on the Great Mosque of Samarra in Iraq.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Mosque%20of%20Ibn%20Tulun%2000.jpg?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Ibn+Tulun+Mosque+Cairo+Egypt",
    },
    {
        "name": "Sultan Hassan Mosque", "city": "Islamic Cairo",
        "year": "Built 1356 \u2013 1363 CE", "builder": "Commissioned by Sultan an-Nasir Hasan",
        "style": "Mamluk architecture",
        "desc": "One of the largest and most harmoniously proportioned Mamluk monuments in the world, with "
                "a soaring entrance portal and a four-iwan madrasa plan built partly with stone from the pyramids.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Mosque-Madrassa%20of%20Sultan%20Hassan%203.jpg?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Sultan+Hassan+Mosque+Cairo+Egypt",
    },
    {
        "name": "Muhammad Ali Mosque", "city": "Cairo Citadel",
        "year": "Built 1830 \u2013 1848 CE", "builder": "Commissioned by Muhammad Ali Pasha \u00b7 architect Yusuf Boshnak",
        "style": "Ottoman style (modelled on Istanbul's Sultan Ahmed Mosque)",
        "desc": "Known as the \"Alabaster Mosque\" for its alabaster-clad walls, its twin minarets are the "
                "tallest in Egypt and it dominates Cairo's skyline from atop the Citadel.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Mosque%20of%20Muhammad%20Ali%20Pasha%20or%20Alabaster%20Mosque%20-%20Cairo%2C%20Egypt%20-%20July%202008.jpg?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Muhammad+Ali+Mosque+Cairo+Citadel+Egypt",
    },
    {
        "name": "Al-Rifa'i Mosque", "city": "Islamic Cairo",
        "year": "Built 1869 \u2013 1912 CE", "builder": "Commissioned by Khedive Isma'il's mother, Hoshiyar Qadin",
        "style": "Neo-Mamluk architecture",
        "desc": "Built to rival its neighbour, the Sultan Hassan Mosque, it also serves as the royal mausoleum "
                "of Egypt's Muhammad Ali dynasty, including King Farouk.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Al-Rifa%27i%20Mosque%20-%20Cairo.jpg?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Al-Rifai+Mosque+Cairo+Egypt",
    },
    {
        "name": "Amr ibn al-As Mosque", "city": "Fustat, Old Cairo",
        "year": "Built 642 CE", "builder": "Amr ibn al-As",
        "style": "Early Islamic style (much rebuilt over the centuries)",
        "desc": "The very first mosque built in Egypt and in the whole of Africa, founded at the heart of "
                "Fustat \u2014 Egypt's first Islamic capital.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Mosque%20of%20Amr%20ibn%20al-As%20-%20Cairo.jpg?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Amr+ibn+al-As+Mosque+Cairo+Egypt",
    },
    {
        "name": "Abu al-Abbas al-Mursi Mosque", "city": "Anfoushi, Alexandria",
        "year": "Rebuilt 1943 CE (site dates to 1307)", "builder": "Architect Mario Rossi",
        "style": "Andalusian\u2013Ottoman revival style",
        "desc": "A mosque and Sufi shrine overlooking Alexandria's eastern harbour, rebuilt by Italian "
                "architect Mario Rossi in a style that later inspired Abu Dhabi's Sheikh Zayed Grand Mosque.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Abu%20al-Abbas%20al-Mursi%20Mosque01.JPG?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Abu+al-Abbas+al-Mursi+Mosque+Alexandria+Egypt",
    },
    {
        "name": "Qaed Ibrahim Mosque", "city": "Raml Station, Alexandria",
        "year": "Built 1948 CE", "builder": "Architect Mario Rossi",
        "style": "Ottoman\u2013Andalusian revival style",
        "desc": "A downtown Alexandria landmark named after Ibrahim Pasha, and a well-known gathering point "
                "during the 2011 Egyptian revolution.",
        "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Al%20Qaed%20Ibrahim%20Mosque%2C%20Alexandria.JPG?width=800",
        "mapsLink": "https://www.google.com/maps/search/?api=1&query=Al-Qaed+Ibrahim+Mosque+Alexandria+Egypt",
    },
]


def get_mosques() -> list[dict]:
    return EGYPT_MOSQUES


# ── Static reference data — common Islamic social phrases ──
ISLAMIC_PHRASES = [
    {"arabic": "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645", "transliteration": "As-salamu alaykum", "meaning": "Peace be upon you", "occasion": "GREETING"},
    {"arabic": "\u0648\u0639\u0644\u064a\u0643\u0645 \u0627\u0644\u0633\u0644\u0627\u0645", "transliteration": "Wa alaykum as-salam", "meaning": "And upon you peace", "occasion": "REPLY TO GREETING"},
    {"arabic": "\u0628\u0633\u0645 \u0627\u0644\u0644\u0647", "transliteration": "Bismillah", "meaning": "In the name of God", "occasion": "BEFORE EATING / STARTING"},
    {"arabic": "\u0627\u0644\u062d\u0645\u062f \u0644\u0644\u0647", "transliteration": "Alhamdulillah", "meaning": "Praise be to God", "occasion": "GRATITUDE / AFTER EATING"},
    {"arabic": "\u0645\u0627 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647", "transliteration": "Masha'Allah", "meaning": "What God has willed", "occasion": "ADMIRATION / PRAISE"},
    {"arabic": "\u0625\u0646 \u0634\u0627\u0621 \u0627\u0644\u0644\u0647", "transliteration": "Insha'Allah", "meaning": "If God wills it", "occasion": "FUTURE PLANS"},
    {"arabic": "\u062c\u0632\u0627\u0643 \u0627\u0644\u0644\u0647 \u062e\u064a\u0631\u0627\u064b", "transliteration": "Jazakallahu khayran", "meaning": "May God reward you with good", "occasion": "THANK YOU"},
    {"arabic": "\u0635\u062d\u0629 \u0648\u0647\u0646\u0627", "transliteration": "Saha wa hana", "meaning": "Health and happiness", "occasion": "AFTER SOMEONE EATS"},
    {"arabic": "\u064a\u0631\u062d\u0645\u0643 \u0627\u0644\u0644\u0647", "transliteration": "Yarhamuk Allah", "meaning": "May God have mercy on you", "occasion": "AFTER SNEEZING"},
]


def get_phrases() -> list[dict]:
    return ISLAMIC_PHRASES
