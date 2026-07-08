"""
Trip Planner Routes
--------------------
بديل src/trip_planner.py (Streamlit wizard) بس دلوقتي الـ wizard نفسه (خطوة
1-5: destination -> style -> interests -> requirements -> result) بقى منطق
فرونت (React، صفحة TripPlanner.tsx) والـ backend هنا مسؤوليته بس: يبني الخطة
ويحفظها. الـ token_required نفسه المستخدم في routes/account.py.
"""
from flask import Blueprint, jsonify, request

from app.routes.account import token_required
from app.services import trip_planner_service
from app.services.trip_planner_service import TripPlannerError

trip_planner_bp = Blueprint("trip_planner", __name__)


def _optional_username():
    """زي token_required بس من غير ما يرفض الطلب لو مفيش توكن - مفيد لـ
    /generate و /ask اللي المفروض تشتغل حتى لضيف مش عامل تسجيل دخول."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        import jwt
        from flask import current_app
        payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        return payload.get("username")
    except Exception:
        return None


@trip_planner_bp.route("/options", methods=["GET"])
def options():
    """الداتا الثابتة (مدن، اهتمامات، ميزانيات، مواصلات) عشان الفرونت يبني الـ wizard."""
    return jsonify(trip_planner_service.get_options())


@trip_planner_bp.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True, silent=True) or {}
    try:
        plan = trip_planner_service.build_plan(data)
    except TripPlannerError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Could not generate itinerary: {e}"}), 502

    plan["username"] = _optional_username()
    return jsonify({"plan": plan})


@trip_planner_bp.route("/ask", methods=["POST"])
def ask():
    """سؤال حر عن الرحلة (أو عن مصر بشكل عام) مبني على نفس الـ RAG بتاع الشات.
    دي نقطة الربط الصريحة بين الـ trip planner والـ chatbot RAG system."""
    data = request.get_json(force=True, silent=True) or {}
    question = data.get("question", "")
    plan = data.get("plan")
    rate_key = _optional_username() or request.remote_addr or "trip-planner"

    reply, direction, error_code = trip_planner_service.ask_about_plan(question, plan, rate_limit_key=rate_key)
    status = 200 if error_code in (None, "rate_limited") else 502
    return jsonify({"reply": reply, "direction": direction, "error": error_code}), status


@trip_planner_bp.route("/save", methods=["POST"])
@token_required
def save():
    data = request.get_json(force=True, silent=True) or {}
    preferences = data.get("preferences")
    plan = data.get("plan")
    if not plan:
        return jsonify({"error": "Missing itinerary to save."}), 400
    try:
        result = trip_planner_service.save_plan(request.username, preferences, plan)
    except TripPlannerError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify(result)


@trip_planner_bp.route("/plans", methods=["GET"])
@token_required
def plans():
    try:
        items = trip_planner_service.list_plans(request.username)
    except TripPlannerError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"plans": items})


@trip_planner_bp.route("/plans/<plan_id>", methods=["GET"])
@token_required
def plan_detail(plan_id):
    try:
        doc = trip_planner_service.get_plan(request.username, plan_id)
    except TripPlannerError as e:
        return jsonify({"error": str(e)}), 502
    if doc is None:
        return jsonify({"error": "Plan not found."}), 404
    return jsonify({"plan": doc})


@trip_planner_bp.route("/plans/<plan_id>", methods=["DELETE"])
@token_required
def plan_delete(plan_id):
    try:
        success, message = trip_planner_service.delete_plan(request.username, plan_id)
    except TripPlannerError as e:
        return jsonify({"error": str(e)}), 502
    if not success:
        return jsonify({"error": message}), 404
    return jsonify({"message": message})