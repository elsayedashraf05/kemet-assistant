from flask import Blueprint, jsonify, request

from app.services.restaurants_service import (
    get_restaurants, get_governorates, get_cuisines, get_featured, RestaurantsDataError
)

restaurants_bp = Blueprint("restaurants", __name__)


@restaurants_bp.route("", methods=["GET"])
def list_restaurants():
    governorate = request.args.get("governorate")
    cuisine = request.args.get("cuisine")
    search = request.args.get("search")
    min_rating = float(request.args.get("min_rating", 0))

    try:
        restaurants = get_restaurants(
            governorate=governorate, cuisine=cuisine, search=search, min_rating=min_rating
        )
        return jsonify({"count": len(restaurants), "results": restaurants})
    except RestaurantsDataError as e:
        return jsonify({"error": str(e)}), 502


@restaurants_bp.route("/featured", methods=["GET"])
def featured():
    try:
        result = get_featured()
        return jsonify({"restaurant": result})
    except RestaurantsDataError as e:
        return jsonify({"error": str(e)}), 502


@restaurants_bp.route("/governorates", methods=["GET"])
def governorates():
    try:
        return jsonify({"governorates": get_governorates()})
    except RestaurantsDataError as e:
        return jsonify({"error": str(e)}), 502


@restaurants_bp.route("/cuisines", methods=["GET"])
def cuisines():
    try:
        return jsonify({"cuisines": get_cuisines()})
    except RestaurantsDataError as e:
        return jsonify({"error": str(e)}), 502
