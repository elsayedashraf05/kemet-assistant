from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from datetime import datetime, timedelta
import undetected_chromedriver as uc
import pandas as pd
import random
import time
import re

# ================= USD RATE =================
USD_RATE = 49.5  # سعر الدولار مقابل الجنيه - غيّره لو احتجت

# ================= HELPER FUNCTIONS =================
def Hotels_Extraction():
    def parse_price(raw_price):
        """
        Input:  'EGP 2,450'  or  'EGP 2,450.00'
        Returns: (currency_str, price_egp_float, price_usd_float)
        """
        if not raw_price or raw_price == 'No Price':
            return 'No Currency', None, None

        currency_match = re.match(r'^([A-Za-z$€£]+)', raw_price.strip())
        currency = currency_match.group(1) if currency_match else 'Unknown'

        number_match = re.search(r'[\d,\.]+', raw_price)
        if number_match:
            price_str = number_match.group().replace(',', '')
            try:
                price_val = float(price_str)
            except:
                price_val = None
        else:
            price_val = None

        if price_val is not None and currency == 'EGP':
            price_usd = round(price_val / USD_RATE, 2)
        else:
            price_usd = None

        return currency, price_val, price_usd


    def parse_rating(raw_rating):
        """
        Input:  'Scored 8.1 | 8.1 | Very Good | 2,294 reviews'
        Returns: (score_float, label_str, reviews_int)
        """
        if not raw_rating or raw_rating == 'No Rating':
            return None, None, None

        score_match = re.search(r'\b(\d+\.\d+)\b', raw_rating)
        score = float(score_match.group(1)) if score_match else None

        reviews_match = re.search(r'([\d,]+)\s*review', raw_rating, re.IGNORECASE)
        reviews = int(reviews_match.group(1).replace(',', '')) if reviews_match else None

        label_match = re.search(
            r'(Exceptional|Superb|Fabulous|Wonderful|Very Good|Good|Pleasant|Fair|Poor)',
            raw_rating, re.IGNORECASE
        )
        label = label_match.group(1) if label_match else None

        return score, label, reviews


    # ================= DATE =================
    today = datetime.now()
    tomorrow = today + timedelta(days=1)

    checkin_year   = today.year
    checkin_month  = today.month
    checkin_day    = today.day
    checkout_year  = tomorrow.year
    checkout_month = tomorrow.month
    checkout_day   = tomorrow.day

    # ================= CITIES =================
    egypt_governorates = [
        "Cairo", "Giza", "Alexandria", "Qalyubia", "Port Said", 
        "Suez", "Ismailia", "Damietta", "Dakahlia", "Sharqia", "Kharbia", 
        "Monufia", "Beheira", "Kafr El Sheikh", "Faiyum", "Beni Suef", 
        "Minya", "Asyut", "Sohag", "Qena", "Luxor", "Aswan", 
        "Red Sea", "New Valley", "Matrouh", "North Sinai", "South Sinai"
    ]

    c = 0
    list_places = []

    # ================= DRIVER =================
    options = Options()
    options.add_argument("--disable-blink-features=AutomationControlled")
    driver = uc.Chrome(options=options, version_main=149)
    wait = WebDriverWait(driver, 15)

    print('🚀 Starting Scraper...')

    # ================= LOOP =================
    for city in egypt_governorates:
        print(f'\n=====================================')
        print(f'🏙️  Now Scraping: {city}')
        print(f'=======================================')

        try:
            url = (
                f'https://www.booking.com/searchresults.html?ss={city}'
                f'&checkin_year={checkin_year}&checkin_month={checkin_month}&checkin_monthday={checkin_day}'
                f'&checkout_year={checkout_year}&checkout_month={checkout_month}&checkout_monthday={checkout_day}'
            )
            driver.get(url)

            if c == 0:
                time.sleep(random.uniform(3, 5))
                ActionChains(driver).move_by_offset(10, 10).click().perform()
                c += 1

            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="property-card"]')))
            places = driver.find_elements(By.CSS_SELECTOR, '[data-testid="property-card"]')
            print(f'--- Found {len(places)} places in {city}. Taking top 15 ---')

            for place in places[:25]:

                try:
                    title = place.find_element(By.CSS_SELECTOR, '[data-testid="title"]').text.strip()
                except:
                    title = 'No Title'

                try:
                    address = place.find_element(By.CSS_SELECTOR, '[data-testid="address-link"]').text.strip()
                except:
                    address = 'No Address'

                # Rating -> 3 columns
                try:
                    rating_raw = place.find_element(By.CSS_SELECTOR, '[data-testid="review-score"]').text.strip().replace('\n', ' | ')
                except:
                    rating_raw = 'No Rating'
                rating_score, rating_label, rating_reviews = parse_rating(rating_raw)

                # Price -> 3 columns
                try:
                    price_raw = place.find_element(By.CSS_SELECTOR, '[data-testid="price-and-discounted-price"]').text.strip()
                except:
                    price_raw = 'No Price'
                price_currency, price_egp, price_usd = parse_price(price_raw)

                try:
                    link = place.find_element(By.CSS_SELECTOR, 'h3 a').get_attribute('href')
                except:
                    link = 'No Link'

                try:
                    image = place.find_element(By.CSS_SELECTOR, '[data-testid="image"]').get_attribute('src')
                except:
                    try:
                        image = place.find_element(By.TAG_NAME, 'img').get_attribute('src')
                    except:
                        image = 'No Image'

                try:
                    room_box = place.find_element(By.CLASS_NAME, 'fff1944c52')
                    clean_room_info = room_box.text.replace('\n', ' | ')
                except:
                    clean_room_info = 'No Room Info'

                if title != 'No Title':
                    list_places.append({
                        'Place_Name'    : title,
                        'Rating_Score'  : rating_score,
                        'city'          : city,
                        'Rating_Reviews': rating_reviews,
                        'Price_EGP'     : price_egp,
                        'Price_USD'     : price_usd,
                        'Address'       : address,
                        'Link'          : link,
                        'Image'         : image,
                        'Room_Info'     : clean_room_info
                    })

            time.sleep(random.uniform(2, 4))

        except Exception as e:
            print(f'Skipping {city} For Error: {e}')
            continue

    driver.quit()

    print(f'\nTotal scraped: {len(list_places)}')

    if len(list_places) > 0:
        df = pd.DataFrame(list_places)
        df.to_csv('Egypt_All_Governorates_Hotels.csv', index=False, encoding='utf-8-sig')
        print('Data saved successfully as Egypt_All_Governorates_Hotels.csv')
        print(df.head())
    else:
        print('No data scraped!')