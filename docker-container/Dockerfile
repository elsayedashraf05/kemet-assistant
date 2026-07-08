# استخدام نسخة بايثون رسمية وخفيفة
FROM python:3.10-slim

# تثبيت متصفح كروم والـ WebDriver لأنك تستخدم سيلينيوم (مهم جداً للـ Scraping)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# تحديد مسار العمل داخل الكونتينر
WORKDIR /app

# نسخ ملف المكتبات وتثبيتها
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ باقي ملفات المشروع بالكامل إلى داخل الكونتينر
COPY . .

# الأمر الذي سيتم تشغيله عند بدء الحاوية
CMD ["python", "main.py"]