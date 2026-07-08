from flask import Blueprint, jsonify

from app.services.muslim_service import (
    MuslimDataError,
    force_refresh_prayer_times,
    get_mosques,
    get_phrases,
    get_prayer_times,
)

muslim_bp = Blueprint("muslim", __name__)


@muslim_bp.get("/prayer-times")
def prayer_times():
    """
    GET /api/muslim/prayer-times

    Returns today's prayer times for all supported Egyptian cities:
    { times: { "Cairo": { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha }, ... }, updatedAt }
    Cached ~daily server-side since timings don't change intraday.
    """
    try:
        return jsonify(get_prayer_times())
    except MuslimDataError as exc:
        return jsonify({"error": str(exc)}), 502


@muslim_bp.post("/prayer-times/refresh")
def refresh_prayer_times():
    """
    POST /api/muslim/prayer-times/refresh

    Bypasses the cache and re-fetches from Aladhan. Used by the
    frontend's manual "Refresh Prayer Times" button.
    """
    try:
        return jsonify(force_refresh_prayer_times())
    except MuslimDataError as exc:
        return jsonify({"error": str(exc)}), 502


@muslim_bp.get("/mosques")
def mosques():
    """GET /api/muslim/mosques — Egypt's historic mosques (static reference data)."""
    return jsonify({"mosques": get_mosques()})


@muslim_bp.get("/phrases")
def phrases():
    """GET /api/muslim/phrases — common Islamic social phrases with translations."""
    return jsonify({"phrases": get_phrases()})
