"""
Beaches Route
-------------
Endpoints:
    GET /api/beaches            -> list beaches (search + filters)
    GET /api/beaches/governments -> list of governments for the filter dropdown/chips
"""
from flask import Blueprint, jsonify, request

from app.services.beaches_service import (
    BeachesDataError,
    get_beaches,
    get_governments,
)

beaches_bp = Blueprint("beaches", __name__, url_prefix="/api/beaches")


@beaches_bp.route("", methods=["GET"])
def list_beaches():
    government = request.args.get("government")
    search = request.args.get("search")
    min_rating = request.args.get("min_rating", default=0, type=float)

    try:
        data = get_beaches(government=government, search=search, min_rating=min_rating)
        return jsonify({"success": True, "count": len(data), "data": data})
    except BeachesDataError as e:
        return jsonify({"success": False, "error": str(e)}), 502


@beaches_bp.route("/governments", methods=["GET"])
def list_governments():
    try:
        return jsonify({"success": True, "data": get_governments()})
    except BeachesDataError as e:
        return jsonify({"success": False, "error": str(e)}), 502
