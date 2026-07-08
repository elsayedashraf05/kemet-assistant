import logging

# استيراد الدوال من الملفات القديمة والجديدة بناءً على قائمة مشروعك
from Archaeological_Sites import Archaeological_Sites
from egymonuments_tickets import egymonuments_tickets
from Hotels_Extraction import Hotels_Extraction
from kemet_beaches_scraper import kemet_beaches_scraper
from kemet_restaurants_scraper import kemet_restaurants_scraper
from monuments import monuments
from mota_statistics_scraper import mota_statistics_scraper
from Museums import Museums
from periods import periods
from storage_upload import upload_output_dir

# إعدادات الـ Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("main")

# قائمة بجميع السكربتات المطلوب تشغيلها بالتتابع
TASKS = [
    ("Archaeological_Sites", Archaeological_Sites),
    ("egymonuments_tickets", egymonuments_tickets),
    ("Hotels_Extraction", Hotels_Extraction),
    ("kemet_beaches_scraper", kemet_beaches_scraper),
    ("kemet_restaurants_scraper", kemet_restaurants_scraper),
    ("monuments", monuments),
    ("mota_statistics_scraper", mota_statistics_scraper),
    ("Museums", Museums),
    ("periods", periods),
]


def main():
    # تشغيل كل السكربتات واحد تلو الآخر
    for name, task in TASKS:
        log.info("Starting %s ...", name)
        try:
            task()
            log.info("Finished %s successfully.", name)
        except Exception:
            log.exception("%s failed.", name)

    # رفع النتائج بعد الانتهاء من جميع السكربتات
    log.info("Uploading results to Azure Storage ...")
    try:
        upload_output_dir()
        log.info("Upload finished.")
    except Exception:
        log.exception("Upload to Azure Storage failed.")


if __name__ == "__main__":
    main()