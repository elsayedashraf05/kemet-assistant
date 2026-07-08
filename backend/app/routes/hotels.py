from flask import Blueprint, jsonify, request

from app.services.hotels_service import get_hotels, get_cities, HotelsDataError

hotels_bp = Blueprint("hotels", __name__)


@hotels_bp.route("", methods=["GET"])
def list_hotels():
    """
    GET /api/hotels?city=Cairo&search=nile&min_rating=8&max_price=5000
    نفس الفلاتر اللي كانت في الـ JS جوه iframe الـ Streamlit، دلوقتي على السيرفر.
    """
    city = request.args.get("city")
    search = request.args.get("search")
    min_rating = float(request.args.get("min_rating", 0))
    max_price_raw = request.args.get("max_price")
    max_price = float(max_price_raw) if max_price_raw else None

    try:
        hotels = get_hotels(city=city, search=search, min_rating=min_rating, max_price=max_price)
        return jsonify({"count": len(hotels), "results": hotels})
    except HotelsDataError as e:
        return jsonify({"error": str(e)}), 502


@hotels_bp.route("/cities", methods=["GET"])
def list_cities():
    """GET /api/hotels/cities -> بترجع قائمة المدن لملء الـ <select> في الفرونت."""
    try:
        return jsonify({"cities": get_cities()})
    except HotelsDataError as e:
        return jsonify({"error": str(e)}), 502
