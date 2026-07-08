"""
KEMET Backend - Flask App Factory
"""
from flask import Flask
from flask_cors import CORS
from app.config import Config


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # يسمح لـ React (localhost:5173 وقت التطوير) بمناداة الـ API
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)

    # تسجيل الـ Blueprints (كل صفحة/فيتشر ليها blueprint مستقل)
    from app.routes.hotels import hotels_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.chatbot import chatbot_bp
    from app.routes.account import account_bp
    from app.routes.restaurants import restaurants_bp
    from app.routes.museums import museums_bp
    from app.routes.sites import sites_bp
    from app.routes.monuments import monuments_bp
    from app.routes.periods import periods_bp
    from app.routes.beaches import beaches_bp
    from app.routes.posts import posts_bp
    from app.routes.trip_planner import trip_planner_bp
    from app.routes.tickets import tickets_bp
    from app.routes.muslim import muslim_bp


    app.register_blueprint(hotels_bp, url_prefix="/api/hotels")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(chatbot_bp, url_prefix="/api/chat")
    app.register_blueprint(account_bp, url_prefix="/api/account")
    app.register_blueprint(restaurants_bp, url_prefix="/api/restaurants")
    app.register_blueprint(museums_bp, url_prefix="/api/museums")
    app.register_blueprint(sites_bp, url_prefix="/api/sites")
    app.register_blueprint(monuments_bp, url_prefix="/api/monuments")
    app.register_blueprint(periods_bp, url_prefix="/api/periods")
    app.register_blueprint(beaches_bp, url_prefix="/api/beaches")
    app.register_blueprint(posts_bp, url_prefix="/api/posts")
    app.register_blueprint(trip_planner_bp, url_prefix="/api/trip-planner")
    app.register_blueprint(tickets_bp, url_prefix="/api/tickets")
    app.register_blueprint(muslim_bp, url_prefix="/api/muslim")



    @app.route("/api/health")
    def health():
        return {"status": "ok"}

    return app