from flask import Blueprint, jsonify, request

from app.services.chatbot_service import get_reply, MODELS, MODES

chatbot_bp = Blueprint("chatbot", __name__)


@chatbot_bp.route("", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    mode = data.get("mode", "Chat")
    model_choice = data.get("model", "Flash")

    if not message:
        return jsonify({"error": "message is required"}), 400
    if mode not in MODES:
        mode = "Chat"
    if model_choice not in MODELS:
        model_choice = "Flash"

    # مفتاح الـ rate limit: IP بتاع العميل (بديل بسيط لـ st.session_state لأن الـ API stateless)
    rate_limit_key = request.headers.get("X-Forwarded-For", request.remote_addr) or "global"

    reply, direction, error_code = get_reply(
        message, mode=mode, model_choice=model_choice, rate_limit_key=rate_limit_key
    )

    # بنرجع 200 حتى مع رسائل الخطأ المتوقعة (rate limit / quota) عشان الفرونت يعرضها
    # كرسالة شات عادية من الـ assistant بدل ما يتعامل معاها كـ network error.
    return jsonify({
        "reply": reply,
        "direction": direction,
        "mode": mode,
        "model": model_choice,
        "error_code": error_code,
    })


@chatbot_bp.route("/options", methods=["GET"])
def options():
    return jsonify({"modes": MODES, "models": list(MODELS.keys())})