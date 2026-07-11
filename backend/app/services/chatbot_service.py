"""
Chatbot Service - KEMET AI Assistant
منقول من src/chatbot.py (نسخة Streamlit القديمة) لنفس منطق الـ RAG + Web Search + Chat،
بس بدل st.cache_resource / st.cache_data / st.session_state (اللي مش موجودين في Flask)
بنستخدم كاش بسيط في الذاكرة بـ TTL + threading.Lock، بنفس نمط الـ *_service.py الباقية
في المشروع (museums_service.py, monuments_service.py...).
"""
import io
import re
import time
import threading

import pandas as pd
from azure.storage.blob import BlobServiceClient
from google import genai
from google.genai import types
from ddgs import DDGS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import Config

# ⚠️ اتشالت sentence-transformers/torch خالص من هنا. كانت بتسبب مشاكل تثبيت/DLL
# على ويندوز (WinError 1114) عند بعض المستخدمين، وأصلاً تقيلة زيادة عن اللزوم هنا
# لأن الراوتر (detect_relevant_sources) أصلاً بيضيّق البحث لملف واحد أو اتنين قبل
# أي similarity search. استبدلناها بـ TF-IDF على مستوى الحروف (char n-grams) من
# scikit-learn: بتشتغل كويس مع عربي وإنجليزي مع بعض من غير احتياج لموديل embeddings
# منفصل، ومفيش أي تبعيات تقيلة أو DLL native معقدة.

# ── إعدادات ومفاتيح ──
GEMINI_API_KEY = getattr(Config, "GEMINI_API_KEY", None)
AZURE_CONNECTION_STRING = getattr(Config, "AZURE_DATALAKE_CONNECTION_STRING", None)
# الداتا كلها اتنقلت لـ container اسمه "silver"، وجوه الـ container ده بس
# الفولدر "_csv_exports/" فيه النسخ النضيفة (flat CSV) بتاعة كل داتاسيت -
# باقي الفولدرات في نفس الـ container (زي الفولدرات الخام بتاعة كل داتاسيت،
# أو "_dq_report_silver") مش داتا نصيّة نقدر نعمل عليها RAG، فبنقصر البحث
# على "_csv_exports/" بس (شوف _build_azure_chunks تحت).
CONTAINER_NAME = "silver"
CSV_EXPORTS_PREFIX = "_csv_exports/"

# ── إعدادات RAG ──
ROWS_PER_CHUNK = 12
CHARS_PER_CHUNK = 800
TOP_K_CHUNKS = 4
TFIDF_NGRAM_RANGE = (3, 5)  # char n-grams: بيمسك تشابه جزئي في الكلمات حتى مع اختلاف الصياغة
CHUNKS_TTL_SECONDS = 3600  # زي ttl=3600 اللي كان على st.cache_data قبل كدا

MODELS = {
    "Flash": "gemini-2.5-flash",
    "Flash Lite": "gemini-2.5-flash-lite",
}
MODES = ["Chat", "Web Search", "Data"]

FILE_KEYWORDS = {
    f"{CSV_EXPORTS_PREFIX}egypt_all_governorates_hotels.csv": [
        "فندق", "فنادق", "إقامة", "منتجع", "hotel", "hotels", "resort", "stay"
    ],
    f"{CSV_EXPORTS_PREFIX}kemet_restaurants_data.csv": [
        "مطعم", "مطاعم", "أكل", "طعام", "كافيه", "كافيهات",
        "restaurant", "restaurants", "food", "cafe", "eat"
    ],
    f"{CSV_EXPORTS_PREFIX}museums_en.csv": [
        "متحف", "متاحف", "museum", "museums"
    ],
    f"{CSV_EXPORTS_PREFIX}monuments_en.csv": [
        "أثر", "آثار", "معبد", "معابد", "monument", "monuments", "temple"
    ],
    f"{CSV_EXPORTS_PREFIX}ancient_sites_en.csv": [
        "موقع أثري", "مواقع أثرية", "site", "sites", "ancient site"
    ],
    f"{CSV_EXPORTS_PREFIX}collections_en.csv": [
        "مجموعة", "مجموعات", "قطعة أثرية", "collection", "collections", "artifact"
    ],
    f"{CSV_EXPORTS_PREFIX}periods_en.csv": [
        "عصر", "عصور", "فترة تاريخية", "period", "periods", "dynasty", "dynasties"
    ],
    f"{CSV_EXPORTS_PREFIX}mota_tourism_statistics.csv": [
        "احصائيات", "احصائية", "سياحة", "statistics", "tourism data", "visitor numbers"
    ],
    f"{CSV_EXPORTS_PREFIX}kemet_beaches_data.csv": [
        "شاطئ", "شواطئ", "بحر", "beach", "beaches", "coast", "shore"
    ],
    f"{CSV_EXPORTS_PREFIX}egymonuments_tickets.csv": [
        "تذكرة", "تذاكر", "سعر الدخول", "ticket", "tickets", "entry fee", "admission"
    ],
}

# ── اتجاه الكتابة (RTL/LTR) عشان الفرونت يعرض الفقاعة صح ──
_ARABIC_RE = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]')
_LATIN_RE = re.compile(r'[A-Za-z]')


def detect_text_direction(text):
    if not text:
        return "ltr"
    arabic_count = len(_ARABIC_RE.findall(text))
    latin_count = len(_LATIN_RE.findall(text))
    return "rtl" if arabic_count >= latin_count else "ltr"


def _chunk_dataframe(df, source_name):
    chunks = []
    for i in range(0, len(df), ROWS_PER_CHUNK):
        part = df.iloc[i:i + ROWS_PER_CHUNK]
        text = f"[المصدر: {source_name} | صفوف {i}-{i + len(part) - 1}]\n" + part.to_string(index=False)
        chunks.append({"source": source_name, "text": text})
    return chunks


def _chunk_text(text, source_name):
    chunks = []
    for i in range(0, len(text), CHARS_PER_CHUNK):
        piece = text[i:i + CHARS_PER_CHUNK]
        chunks.append({
            "source": source_name,
            "text": f"[المصدر: {source_name} | جزء {i // CHARS_PER_CHUNK + 1}]\n{piece}"
        })
    return chunks


def _build_azure_chunks():
    try:
        blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        container = blob_service.get_container_client(CONTAINER_NAME)
        all_chunks = []
        # name_starts_with restricts this to the clean, flat CSV exports —
        # the "silver" container also holds raw per-dataset folders and a
        # "_dq_report_silver" data-quality report folder that aren't useful
        # (or even readable as tabular data) for the RAG index.
        for blob in container.list_blobs(name_starts_with=CSV_EXPORTS_PREFIX):
            if not blob.name.endswith(('.csv', '.xlsx', '.xls', '.txt', '.md')):
                continue
            data = container.get_blob_client(blob).download_blob().readall()
            if blob.name.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(data))
                all_chunks.extend(_chunk_dataframe(df, blob.name))
            elif blob.name.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(data))
                all_chunks.extend(_chunk_dataframe(df, blob.name))
            elif blob.name.endswith(('.txt', '.md')):
                all_chunks.extend(_chunk_text(data.decode('utf-8'), blob.name))
        return all_chunks
    except Exception as e:
        return [{"source": "__error__", "text": f"Error: {e}"}]


# ── كاش الـ chunks + TF-IDF matrix في الذاكرة (بديل st.cache_data + st.cache_resource) ──
_chunks_cache = {"chunks": None, "matrix": None, "vectorizer": None, "built_at": 0.0}
_chunks_lock = threading.Lock()


def _build_chunk_index(force=False):
    now = time.time()
    with _chunks_lock:
        fresh = (
            not force
            and _chunks_cache["chunks"] is not None
            and (now - _chunks_cache["built_at"] < CHUNKS_TTL_SECONDS)
        )
        if fresh:
            return _chunks_cache["chunks"], _chunks_cache["matrix"], _chunks_cache["vectorizer"]

        chunks = _build_azure_chunks()
        if not chunks or chunks[0]["source"] == "__error__":
            _chunks_cache.update(chunks=chunks, matrix=None, vectorizer=None, built_at=now)
            return chunks, None, None

        texts = [c["text"] for c in chunks]
        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=TFIDF_NGRAM_RANGE, min_df=1)
        matrix = vectorizer.fit_transform(texts)
        _chunks_cache.update(chunks=chunks, matrix=matrix, vectorizer=vectorizer, built_at=now)
        return chunks, matrix, vectorizer


def detect_relevant_sources(query):
    q = query.lower()
    matched = [
        source for source, keywords in FILE_KEYWORDS.items()
        if any(kw.lower() in q for kw in keywords)
    ]
    return matched or None


def retrieve_relevant_chunks(query, top_k=TOP_K_CHUNKS):
    chunks, matrix, vectorizer = _build_chunk_index()
    if not chunks:
        return "No data files found."
    if matrix is None:
        return chunks[0]["text"]  # رسالة الخطأ

    relevant_sources = detect_relevant_sources(query)
    if relevant_sources:
        keep_idx = [i for i, c in enumerate(chunks) if c["source"] in relevant_sources]
        if keep_idx:
            search_chunks = [chunks[i] for i in keep_idx]
            search_matrix = matrix[keep_idx]
        else:
            search_chunks, search_matrix = chunks, matrix
    else:
        search_chunks, search_matrix = chunks, matrix

    query_vec = vectorizer.transform([query])
    sims = cosine_similarity(query_vec, search_matrix).flatten()
    top_idx = sims.argsort()[::-1][:top_k]

    selected = [search_chunks[i]["text"] for i in top_idx]
    return "\n\n---\n\n".join(selected)


def search_web(query, max_results=5):
    backends_to_try = ["lite", "html", "auto"]
    last_error = None

    for backend in backends_to_try:
        for attempt in range(2):
            try:
                with DDGS(timeout=10) as ddgs:
                    results = list(ddgs.text(query, max_results=max_results, backend=backend))
                if results:
                    context = ""
                    for r in results:
                        title = r.get('title', '')
                        body = r.get('body', '')
                        context += f"- {title}: {body}\n"
                    return context
                time.sleep(1.5)
            except Exception as e:
                last_error = e
                time.sleep(1.5)

    return f"Search error: تعذر الوصول لنتائج البحث حالياً (rate limit من DuckDuckGo). {f'({last_error})' if last_error else ''}"


# ── rate limiting بسيط لكل عميل (بديل st.session_state.last_api_call_time) ──
MIN_SECONDS_BETWEEN_REQUESTS = 4
_last_call_by_key = {}
_last_call_lock = threading.Lock()


def _check_rate_limit(key):
    now = time.time()
    with _last_call_lock:
        last = _last_call_by_key.get(key, 0)
        if now - last < MIN_SECONDS_BETWEEN_REQUESTS:
            return False
        _last_call_by_key[key] = now
        return True


def _call_gemini(**kwargs):
    client_ai = genai.Client(api_key=GEMINI_API_KEY)
    try:
        return client_ai.models.generate_content(**kwargs)
    except Exception as e:
        msg = str(e)
        if "429" in msg and "day" not in msg.lower():
            time.sleep(4)
            return client_ai.models.generate_content(**kwargs)
        raise


def _format_error(err, model_choice):
    if "429" in err:
        is_daily = "day" in err.lower() or "rpd" in err.lower()
        if is_daily:
            return (
                "وصلنا لحد الطلبات **اليومي** المجاني بتاع الموديل ده 🙏\n\n"
                "الحد ده بيتصفّر الساعة 12 بالليل بتوقيت المحيط الهادئ (تقريبًا 10 الصبح "
                "بتوقيت مصر). ملحوظة مهمة: الكوتة دي متقسمة على **كل اللي بيستخدموا نفس "
                "الـ API key** (مش انت بس). جرب:\n"
                "- تستخدم **Web Search** أو **Chat** بدل Data لحد ما الكوتة تترجع\n"
                f"- لو المودل الحالي **{model_choice}**، جرب تحول لـ **Flash**\n"
                "- كل واحد في الفريق يعمله API key خاص بيه من [Google AI Studio](https://aistudio.google.com/apikey)"
            )
        return (
            "وصلنا لحد الطلبات **في الدقيقة** المجاني بتاع الموديل ده 🙏\n\n"
            "جربت أعيد المحاولة تلقائيًا مرة، بس لسه بيرفض. جرب:\n"
            "- تستنى ثواني وتحاول تاني\n"
            "- تستخدم **Web Search** بدل Data (context أصغر)\n"
            f"- لو المودل الحالي **{model_choice}**، جرب **Flash**"
        )
    if "API_KEY" in err or "401" in err:
        return "Invalid API key. Please check your Gemini API key."
    if "404" in err:
        return f"Model **{model_choice}** is not available on your current plan."
    return f"Something went wrong: {err}"


def get_reply(user_input, mode="Chat", model_choice="Flash", rate_limit_key="global"):
    """
    نقطة الدخول الوحيدة اللي الـ route بينادي عليها.
    بترجع (reply_text, direction, error_code_or_None)
    """
    if not GEMINI_API_KEY or not AZURE_CONNECTION_STRING:
        return (
            "⚠️ الإعدادات ناقصة على السيرفر (GEMINI_API_KEY / AZURE_DATALAKE_CONNECTION_STRING).",
            "rtl",
            "config_error",
        )

    if not _check_rate_limit(rate_limit_key):
        wait_reply = "استنى شوية ثواني بين كل سؤال والتاني عشان نتجنب حد الـ rate limit 🙏"
        return wait_reply, detect_text_direction(wait_reply), "rate_limited"

    model_id = MODELS.get(model_choice, MODELS["Flash"])

    try:
        # الداتا المسترجعة (Data mode) أو نتايج البحث (Web Search) غالبًا بتكون
        # عربي أو خليط عربي/إنجليزي، وده كان بيخلي Gemini يرد بالعربي حتى لو
        # سؤال المستخدم كان بالإنجليزي. تعليمة زي "رد بنفس لغة السؤال" مش كفاية
        # قوية أحيانًا لأن الموديل بيتأثر بلغة الـ context الغالبة. فبدل ما
        # نسيبله يحلل هو، بنحدد لغة سؤال المستخدم إحنا (عربي/إنجليزي) على نفس
        # منطق detect_text_direction، وبنديله أمر صريح ومباشر بيه.
        target_language = "Arabic" if detect_text_direction(user_input) == "rtl" else "English"
        LANGUAGE_INSTRUCTION = (
            f"CRITICAL INSTRUCTION — HIGHEST PRIORITY: You must write your ENTIRE reply "
            f"in {target_language} ONLY, from the first word to the last. This overrides "
            f"the language of any reference data, search results, or context shown below "
            f"— even if all of it is written in a different language, translate the "
            f"relevant information and answer in {target_language}. Do not mix languages."
        )

        if mode == "Data":
            relevant_context = retrieve_relevant_chunks(user_input)
            prompt = f"""You are KEMET, an intelligent Egypt tourism assistant.
{LANGUAGE_INSTRUCTION}

Answer the user's question based on the following relevant excerpts from the data
(these are the most relevant sections retrieved for this specific question, not the full dataset).

Relevant data:
{relevant_context}

{LANGUAGE_INSTRUCTION}

Question: {user_input}"""
            response = _call_gemini(model=model_id, contents=prompt)
            reply = response.text

        elif mode == "Web Search":
            web_context = search_web(user_input)
            prompt = f"""You are KEMET, a helpful AI assistant.
{LANGUAGE_INSTRUCTION}

Answer the user's question based on these web search results.
If the results don't contain the answer, say so honestly.

Search Results:
{web_context}

{LANGUAGE_INSTRUCTION}

Question: {user_input}"""
            response = _call_gemini(model=model_id, contents=prompt)
            reply = response.text

        else:  # Chat
            response = _call_gemini(
                model=model_id,
                contents=f"You are KEMET, an AI guide for Egypt tourism. {LANGUAGE_INSTRUCTION} {user_input}",
                config=types.GenerateContentConfig(tools=[{"google_search": {}}]),
            )
            reply = response.text

    except Exception as e:
        reply = _format_error(str(e), model_choice)
        return reply, detect_text_direction(reply), "api_error"

    return reply, detect_text_direction(reply), None