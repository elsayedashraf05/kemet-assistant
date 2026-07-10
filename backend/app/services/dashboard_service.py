"""
Dashboard Service
------------------
- الطقس: بيانات حية من open-meteo API.
- أسعار العملات: بيانات حية من open-er-api API.
- أعداد السائحين حسب السنة (arrivals_by_year): بيانات حية من
  World Bank Open Data API (indicator ST.INT.ARVL) - مفيش API key مطلوب.
  ملحوظة مهمة: بيانات البنك الدولي عادةً بتتأخر سنة أو اتنين (يعني ممكن
  آخر سنة متاحة تكون 2023 أو 2024 مش 2025/2026)، وده حد طبيعي لأي مصدر
  إحصائي رسمي دولي، مش قصور في الكود.
- باقي الإحصائيات (نسب الجنسيات، أرقام الطوارئ، التطبيقات المفيدة):
  دي **مفيش لها أي API حي متاح فعلاً**:
    * نسب الجنسيات التفصيلية بتتنشر من الجهاز المركزي للتعبئة العامة
      والإحصاء (CAPMAS) في تقارير PDF دورية مش عن طريق API.
    * أرقام الطوارئ أرقام حكومية ثابتة، مش "بيانات" بتتغير علشان
      تحتاج API حي.
    * قائمة التطبيقات المفيدة قايمة توصيات مُنسّقة يدويًا، مش بيانات.
  فهي لسه constants، لكن بتتقرأ من الـ backend فقط عبر الـ API endpoint
  (مش مكتوبة جوه الفرونت)، وده أقصى حاجة ممكنة بدون مصدر حي حقيقي.

فيه كاش بسيط بالذاكرة لتفادي ضرب الـ APIs الخارجية في كل request.
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

REFRESH_INTERVAL = 300  # 5 دقايق - مناسب لبيانات زي الطقس والعملة اللي بتتغير كتير

WORLD_BANK_ARRIVALS_URL = (
    "https://api.worldbank.org/v2/country/EG/indicator/ST.INT.ARVL"
    "?format=json&per_page=20&mrnev=12"
)
ARRIVALS_REFRESH_INTERVAL = 6 * 60 * 60  # 6 ساعات - بيانات سنوية مفيش داعي تتحدث كل 5 دقايق

# لو الـ World Bank API وقع في أول request بعد ما السيرفر يشتغل (مفيش cache
# قديم نرجع له)، بنرجع آخر أرقام رسمية معروفة بدل ما نرجّع صفحة فاضية.
ARRIVALS_FALLBACK = [
    {"year": 2016, "millions": 5.4},
    {"year": 2017, "millions": 8.3},
    {"year": 2018, "millions": 11.3},
    {"year": 2019, "millions": 13.0},
    {"year": 2020, "millions": 3.7},
    {"year": 2021, "millions": 8.0},
    {"year": 2022, "millions": 12.0},
]

_cache = {
    "weather": None, "weather_ts": 0,
    "currency": None, "currency_ts": 0,
    "arrivals": None, "arrivals_ts": 0,
}


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


def get_live_arrivals(force_refresh: bool = False):
    """
    أعداد السائحين الوافدين لمصر سنة بسنة، حية من World Bank Open Data API
    (indicator ST.INT.ARVL) - مفيش API key مطلوب.

    ملحوظة: البنك الدولي بينشر بيانات السياحة بتأخير (عادةً سنة أو اتنين)،
    فمتوقع إن آخر سنة راجعة تكون 2023 أو 2024 مش أحدث سنة فعليًا. ده سلوك
    طبيعي للمصدر نفسه، مش خطأ في الكود.
    """
    now = time.time()
    if not force_refresh and _cache["arrivals"] is not None and (now - _cache["arrivals_ts"] < ARRIVALS_REFRESH_INTERVAL):
        return _cache["arrivals"]

    try:
        r = requests.get(WORLD_BANK_ARRIVALS_URL, timeout=8)
        if r.status_code == 200:
            payload = r.json()
            rows = payload[1] if isinstance(payload, list) and len(payload) > 1 and payload[1] else []
            results = []
            for row in rows:
                year, value = row.get("date"), row.get("value")
                if year and value is not None:
                    results.append({"year": int(year), "millions": round(value / 1_000_000, 1)})
            results.sort(key=lambda x: x["year"])
            if results:
                _cache["arrivals"] = results
                _cache["arrivals_ts"] = now
                return results
    except Exception:
        pass

    # لو الطلب فشل: رجّع آخر كاش معروف، أو الأرقام الاحتياطية لو دي أول مرة
    return _cache["arrivals"] or ARRIVALS_FALLBACK


def get_static_stats():
    """
    إحصائيات مفيش لها مصدر API حي متاح فعلاً (راجع شرح الأسباب في أعلى
    الملف): نسب الجنسيات، أرقام الطوارئ، والتطبيقات المفيدة. بترجع من
    الـ backend فقط عبر الـ API endpoint، مش مكتوبة جوه الفرونت.
    """
    return {
        "tourists_2025": {"value": "19M", "change": "+21% vs 2024"},
        "ytd_2026": {"value": "6.1M", "period": "Jan–Apr 2026", "change": "+7% vs 2025"},
        "top_nationalities": {"value": "10+", "top": "Russia"},
        "target_2026": {"value": "21M", "label": "Gov. Goal"},
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
            {"name": "Uber", "url": "https://www.uber.com", "emoji": "🚗"},
            {"name": "Talabat", "url": "https://www.talabat.com", "emoji": "🍔"},
            {"name": "Vezeeta", "url": "https://www.vezeeta.com", "emoji": "🏥"},
            {"name": "Google Maps", "url": "https://maps.google.com", "emoji": "🗺️"},
        ],
    }