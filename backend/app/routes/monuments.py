from flask import Blueprint, jsonify, request

from app.services.monuments_service import (
    MonumentsDataError,
    get_locations,
    get_monuments,
)

monuments_bp = Blueprint("monuments", __name__)


@monuments_bp.get("")
def list_monuments():
    """
    GET /api/monuments
    GET /api/monuments?location=Luxor&search=temple

    Returns the payload the Monuments page needs in one call: the location
    list (for the filter dropdown) and the monument records themselves
    (optionally pre-filtered).
    """
    location = request.args.get("location")
    search = request.args.get("search")

    try:
        monuments = get_monuments(location=location, search=search)
        locations = get_locations()
    except MonumentsDataError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(
        {
            "locations": locations,
            "monuments": monuments,
        }
    )