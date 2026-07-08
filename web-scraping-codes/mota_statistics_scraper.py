"""
Scraper for tourism & antiquities statistics section
from mota.gov.eg homepage (السياحة والآثار في أرقام).

Each statistic becomes its own column (English names) in a single-row CSV.
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd

URL = "https://mota.gov.eg/ar"

# Maps Arabic label (as it appears in the page) -> English column name
LABEL_TO_COLUMN = {
    "مركبة سياحية": "tourist_vehicles",
    "محل عاديات وسلع سياحية": "souvenir_shops",
    "شركة سياحة": "tourism_companies",
    "مطعم وكافتيريا سياحي": "tourist_restaurants_cafes",
    "265 فندق عائم ، 1036 فندق ثابت": "hotels_total",
    "360 مركز غوص ، 270 مركز انشطة": "diving_activity_centers",
    "موقع أثري، منهم 139 مفتوح للزيارة": "archaeological_sites",
    "متحف آثار، منهم 33 مفتوح للزيارة": "museums",
}


def scrape_stats():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    response = requests.get(URL, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    items = soup.select(".statistics__wrapper__items__item")

    row = {}

    for item in items:
        try:
            number = item.get("data-number", "").strip()
            label = item.select_one("h3").get_text(strip=True)

            column_name = LABEL_TO_COLUMN.get(label, label)
            row[column_name] = number
        except AttributeError:
            continue

    return row


def main():
    stats = scrape_stats()

    df = pd.DataFrame([stats])
    df.to_csv("mota_tourism_statistics.csv", index=False, encoding="utf-8-sig")

    print(f"Scraped {len(stats)} statistics")
    print(df)


if __name__ == "__main__":
    main()
