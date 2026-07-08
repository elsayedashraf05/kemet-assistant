from flask import Blueprint, jsonify, request

from app.services.periods_service import PeriodsDataError, get_fun_facts, get_periods

periods_bp = Blueprint("periods", __name__)


@periods_bp.get("")
def list_periods():
    """
    GET /api/periods
    GET /api/periods?search=kingdom

    Returns the payload the Historical Periods page needs in one call:
    the period records, optionally pre-filtered by name.
    """
    search = request.args.get("search")

    try:
        periods = get_periods(search=search)
    except PeriodsDataError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"periods": periods})


@periods_bp.get("/facts")
def list_facts():
    """
    GET /api/periods/facts

    Returns the "Did You Know?" trivia list shown on the Historical
    Periods page.
    """
    return jsonify({"facts": get_fun_facts()})