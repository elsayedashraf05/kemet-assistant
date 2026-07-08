"""
Dashboard Service
------------------
نفس منطق src/dashboard.py الأصلي بالظبط:
- الطقس: بيانات حية من open-meteo (نفس الـ API، نفس المدن)
- أسعار العملات: بيانات حية من open-er-api (نفس الـ API، نفس الحسابات)
- الإحصائيات (أعداد السائحين، الجنسيات، الطوارئ، التطبيقات): كانت أرقام
  ثابتة مكتوبة داخل الكود في dashboard.py نفسه (مفيش أي API حكومي حي
  متاح لها)، فهي هنا لسه constants، لكن بتتقرأ من الـ backend بس، مش
  مكتوبة جوه الفرونت خالص.

فيه كاش بسيط بالذاكرة (5 دقايق) لتفادي ضرب الـ API الخارجي في كل
request، بنفس فكرة REFRESH_INTERVAL في الكود الأصلي.
"""
import time

import requests

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

REFRESH_INTERVAL = 300  # 5 دقايق، زي الكود الأصلي بالظبط

_cache = {"weather": None, "weather_ts": 0, "currency": None, "currency_ts": 0}


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

    return _cache["currency"]  # يرجّع آخر قيمة معروفة (أو None) لو الـ API فشل دلوقتي


def get_static_stats():
    """
    نفس الأرقام اللي كانت مكتوبة جوه الـ HTML في dashboard.py الأصلي
    (مفيش API حكومي حي لها)، لكن بترجع من الـ backend بس، مش من الفرونت.
    """
    return {
        "tourists_2025": {"value": "19M", "change": "+21% vs 2024"},
        "ytd_2026": {"value": "6.1M", "period": "Jan–Apr 2026", "change": "+7% vs 2025"},
        "top_nationalities": {"value": "10+", "top": "Russia"},
        "target_2026": {"value": "21M", "label": "Gov. Goal"},
        "arrivals_by_year": [
            {"year": 2016, "millions": 5.4},
            {"year": 2017, "millions": 8.3},
            {"year": 2018, "millions": 11.3},
            {"year": 2019, "millions": 13.0},
            {"year": 2020, "millions": 3.7},
            {"year": 2021, "millions": 8.0},
            {"year": 2022, "millions": 12.0},
            {"year": 2023, "millions": 14.9},
            {"year": 2024, "millions": 15.7},
            {"year": 2025, "millions": 19.0},
        ],
        "nationalities": [
            {"name": "Russia", "percent": 15},
            {"name": "Germany", "percent": 13},
            {"name": "UK", "percent": 9},
            {"name": "Saudi Arabia", "percent": 8},
            {"name": "Italy", "percent": 6},
            {"name": "Poland", "percent": 6},
            {"name": "Czech Rep.", "percent": 3},
            {"name": "Spain", "percent": 3},
            {"name": "USA", "percent": 2.5},
            {"name": "France", "percent": 2.5},
        ],
        "emergency": {
            "tourist_police": "126",
            "ambulance": "123",
            "fire": "180",
            "embassy_hotline": "+20 2 2797 3300",
            "general_emergency": "123",
        },
        "useful_apps": [
            {"name": "Uber / Careem", "url": "https://www.uber.com", "emoji": "🚗"},
            {"name": "Talabat", "url": "https://www.talabat.com", "emoji": "🍔"},
            {"name": "Vezeeta", "url": "https://www.vezeeta.com", "emoji": "🏥"},
            {"name": "Google Maps", "url": "https://maps.google.com", "emoji": "🗺️"},
        ],
    }
