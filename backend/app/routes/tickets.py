from flask import Blueprint, jsonify, request

from app.services.tickets_service import (
    TicketsDataError,
    get_exchange_rates,
    get_locations,
    get_tickets,
)

tickets_bp = Blueprint("tickets", __name__)


@tickets_bp.get("")
def list_tickets():
    """
    GET /api/tickets
    GET /api/tickets?location=Luxor
    GET /api/tickets?search=temple

    Returns the payload the Tickets page needs in one call: the ticket
    records (in raw EGP), optionally pre-filtered by name/location, plus
    the list of locations for the filter pills.
    """
    location = request.args.get("location")
    search = request.args.get("search")

    try:
        tickets = get_tickets(location=location, search=search)
        locations = get_locations()
    except TicketsDataError as exc:
        return jsonify({"error": str(exc)}), 502

    return jsonify({"tickets": tickets, "locations": locations})


@tickets_bp.get("/exchange-rates")
def exchange_rates():
    """
    GET /api/tickets/exchange-rates

    Returns live EGP -> USD/EUR conversion rates (cached hourly server-side),
    with a `live` flag so the frontend can note when it's showing the
    fallback rate instead.
    """
    return jsonify(get_exchange_rates())
