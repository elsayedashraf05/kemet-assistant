from flask import Blueprint, jsonify, request

from app.services import dashboard_service

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/summary", methods=["GET"])
def summary():
    """
    نداء واحد بيرجع كل حاجة محتاجاها صفحة Dashboard:
    الطقس الحي، أسعار العملات الحية، والإحصائيات الثابتة.
    """
    force = request.args.get("refresh") == "true"
    weather = dashboard_service.get_live_weather(force_refresh=force)
    currency = dashboard_service.get_live_currency(force_refresh=force)
    stats = dashboard_service.get_static_stats()
    return jsonify({"weather": weather, "currency": currency, "stats": stats})


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
