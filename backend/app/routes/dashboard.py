import os

from flask import Blueprint, jsonify, request

from app.services import dashboard_service

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/summary", methods=["GET"])
def summary():
    """
    One call returns everything the homepage/dashboard needs:
      - weather: live, per city
      - currency: live EGP exchange rates
      - kemet: everything derived from the Gold layer (counts, charts, timeline)
      - emergency / useful_apps: static reference info (no Gold table for these)
    """
    force = request.args.get("refresh") == "true"
    weather = dashboard_service.get_live_weather(force_refresh=force)
    currency = dashboard_service.get_live_currency(force_refresh=force)
    kemet = dashboard_service.get_kemet_data_bundle()
    return jsonify({
        "weather": weather,
        "currency": currency,
        "kemet": kemet,
        "emergency": dashboard_service.EMERGENCY_INFO,
        "useful_apps": dashboard_service.USEFUL_APPS,
    })


@dashboard_bp.route("/weather", methods=["GET"])
def weather():
    force = request.args.get("refresh") == "true"
    return jsonify({"cities": dashboard_service.get_live_weather(force_refresh=force)})


@dashboard_bp.route("/currency", methods=["GET"])
def currency():
    force = request.args.get("refresh") == "true"
    rates = dashboard_service.get_live_currency(force_refresh=force)
    if rates is None:
        return jsonify({"error": "Exchange rate service unavailable."}), 502
    return jsonify(rates)


@dashboard_bp.route("/kemet", methods=["GET"])
def kemet_data():
    """Gold-derived data on its own — useful if the frontend ever wants to refresh the
    charts without re-hitting the live weather/currency APIs too."""
    return jsonify(dashboard_service.get_kemet_data_bundle())


@dashboard_bp.route("/debug/gold", methods=["GET"])
def debug_gold():
    """Diagnostic only — not used by the frontend. Tries loading every Gold table
    fresh and reports exactly why each one succeeded or failed (wrong path, missing
    file, bad columns, etc). Remove this route once the Gold data is confirmed
    working, since it reveals your server's file layout."""
    return jsonify(dashboard_service.get_gold_debug_info())


@dashboard_bp.route("/reload", methods=["POST"])
def reload_gold_cache():
    """Call this after a fresh weekly Gold export lands in Azure (kemetstorage/gold/
    _csv_exports), instead of restarting the whole process. Not exposed to the
    frontend UI — an ops/deploy-script endpoint.

    Guarded by a shared-secret header so it isn't a public, unauthenticated
    cache-buster: set RELOAD_TOKEN in the environment (Railway variables) and pass
    the same value back as the X-Reload-Token header. If RELOAD_TOKEN isn't set, the
    route stays open — set it before this is public.
    """
    expected_token = os.environ.get("RELOAD_TOKEN")
    if expected_token and request.headers.get("X-Reload-Token") != expected_token:
        return jsonify({"error": "Unauthorized."}), 401
    dashboard_service._reload_gold_cache()
    return jsonify({"status": "reloaded"})