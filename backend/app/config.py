import os


class Config:
    # نفس فكرة utils.get_secret بتاعتك: بياخد القيمة من environment variable
    # (في الإنتاج) أو من .env عن طريق python-dotenv (في التطوير المحلي)
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    AZURE_DATALAKE_CONNECTION_STRING = os.environ.get("AZURE_DATALAKE_CONNECTION_STRING")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    # نفس الأسماء بالظبط اللي كانت مستخدمة في account.py الأصلي
    COSMOS_ENDPOINT = os.environ.get("COSMOS_ENDPOINT")
    COSMOS_KEY = os.environ.get("COSMOS_KEY")
    AZURE_STORAGE_CONNECTION_STRING = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")

    # مفتاح توقيع الـ JWT (بديل الكوكيز اليدوية اللي كانت في cookie_utils.py)
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-change-me")
    JWT_EXPIRES_DAYS = int(os.environ.get("JWT_EXPIRES_DAYS", "30"))

    # دومينات React المسموح لها تنادي على الـ API وقت التطوير والإنتاج
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
