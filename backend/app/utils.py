import os
from flask import current_app


def get_secret(key: str):
    """
    نفس فكرة utils.get_secret في مشروع Streamlit:
    - محلياً: بتتقرأ من متغيرات البيئة (.env عن طريق python-dotenv في run.py)
    - في الإنتاج: من environment variables حقيقية على السيرفر (Render/Railway/...)
    """
    # أولاً نحاول من إعدادات Flask (Config)، بعدين من الـ environment مباشرة كـ fallback
    value = current_app.config.get(key) or os.environ.get(key)
    return value
