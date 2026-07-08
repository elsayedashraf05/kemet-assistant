from flask import Blueprint, jsonify, request

from app.services.museums_service import (
    FEATURED_GEM,
    MuseumsDataError,
    get_locations,
    get_museums,
)

museums_bp = Blueprint("museums", __name__)


@museums_bp.get("")
def list_museums():
    """
    GET /api/museums
    GET /api/museums?location=Cairo&search=egyptian

    Returns the full payload the Museums page needs in one call:
    the featured GEM block, the location list (for the filter dropdown),
    and the museum records themselves (optionally pre-filtered).
    """
    location = request.args.get("location")
    search = request.args.get("search")

    try:
        museums = get_museums(location=location, search=search)
        locations = get_locations()
    except MuseumsDataError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(
        {
            "featured": FEATURED_GEM,
            "locations": locations,
            "museums": museums,
        }
    )
