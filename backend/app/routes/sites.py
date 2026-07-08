from flask import Blueprint, jsonify, request

from app.services.sites_service import (
    SitesDataError,
    get_locations,
    get_sites,
)

sites_bp = Blueprint("sites", __name__)


@sites_bp.get("")
def list_sites():
    """
    GET /api/sites
    GET /api/sites?location=Giza&search=temple

    Returns the location list for the filter dropdown and every site
    (optionally pre-filtered). No more separate "featured" site — everything
    shows up together in one list now.
    """
    location = request.args.get("location")
    search = request.args.get("search")

    try:
        sites = get_sites(location=location, search=search)
        locations = get_locations()
    except SitesDataError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify(
        {
            "locations": locations,
            "sites": sites,
        }
    )