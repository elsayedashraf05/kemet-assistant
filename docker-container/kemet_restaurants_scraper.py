import time
import re
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def kemet_restaurants_scraper():
    places_to_scrape = [
        # Cairo
        "Zitouni",
        "Zeeyara Restaurant",
        "Cairo Kitchen Zamalek",
        "Mawlay",
        "Cairo Vista Restaurant & Bar",
        "Egyptian Nights",
        "Naguib Mahfouz Cafe",
        "Abou El Sid",
        "Sobhy Kaber",
        "Koshary El Tahrir",
        "Felfela",
        "Andrea Mariouteya",
        "Osmanly",
        "The Grill Cairo",
        "Zooba",
        "Koshary Abou Tarek",
        "El Prince",
        "Al Hamra Street",
        "El Gahsh",
        "Al Agha",
        "Tabkha Space",
        "Al Dahan",
        "Granita",
        "Abou Haidar",
        "Neama",
        "Pyramids Lounge",
        "Khufu's Restaurant",
        "Birdcage",
        "Sequoia",
        "Le Deck by Laurent Peugeot",
        "Sachi",
        "Tamara Lebanese Bistro",
        "Crave",
        "Kazoku",
        "Pier 88",
        "Sofra",
        "Kazaz",
        "Abou Shakra",
        "Kababgy",
        "Fellini",

        # Giza
        "Sapporo Japanese Restaurant",
        "Aspero Restaurant & Lounge",
        "PAVONE Restaurant & Cafe",
        "Cup Hungry Restaurant",
        "The Smokery",
        "Birdcage",
        "Khufu's Restaurant",
        "8 Restaurant",
        "Andrea New Giza",
        "Pier 88",
        "Tabla Luna",
        "Manzoku",
        "L'Asiatique",
        "Mori Sushi",
        "Cilantro",
        "Zooba",
        "Sachi",
        "Left Bank",
        "Mori Sushi Sheikh Zayed",
        "The Tap",
        "Depresso",
        "Kazoku",

        # Alexandria
        "Blue Harbor Rooftop Restaurant Windsor Palace Hotel Alexandria",
        "Sky View Restaurant Le Metropole Hotel",
        "La Alexandria Asian Restaurant & Cafe",
        "Fish Market Alexandria",
        "Santa Lucia",
        "Balbaa Village",
        "Trianon",
        "Jeeda's",
        "Stefano's",
        "Bruno Cafe & Restaurant",
        "Latino Cafe",
        "Kadoura",
        "Laurent",
        "Delices",
        "Athanasiou",
        "Chez Gaby",
        "Sea Gull",
        "Athens Restaurant",
        "Gad",
        "Mister Cook",
        "Gingko",
        "Ginger Alexandria",

        # Luxor / Aswan
        "Nubian Dreams Restaurant & Cafe",
        "1902 Restaurant",
        "The Lantern Room",
        "Sofra Restaurant & Cafe",
        "Al Moudira Restaurant",
        "El Kababgy Luxor",
        "Al-Sahaby Lane Restaurant",
        "Nile View Restaurant",
        "Abo El Sid Luxor",
        "Panorama Restaurant Aswan",
        "Aswan Moon",
        "Makani Cafe",
        "Al Dokka",
        "Bob Marley Moonlight Terrace",

        # Coastal tourism
        "Sharks Bay Umbi",
        "Farsha Mountain Lounge",
        "Hard Rock Cafe Sharm El Sheikh",
        "The House Restaurant Dahab",
        "Ralph's German Bakery Dahab",
        "Moods Restaurant & Beach Club",
        "Fish Market Hurghada",
        "Granada Restaurant & Pub Hurghada",
        "Star Fish Restaurant Hurghada",
        "The Smokery El Gouna",
        "Moods Beach Club El Gouna",
        "Zia Amelia El Gouna",
        "The Dive Bar & Grill El Gouna",
        "Marsa Alam Restaurant",
        "Abu Dabbab Resort Restaurant",
        "Nuweiba Beach Restaurant",
        "Taba Heights Restaurant",
        "Agiba Beach area restaurants",
        "Marsa Matruh seafood restaurants",
    ]

    print(len(places_to_scrape), "places")
    driver = webdriver.Chrome()
    results = []

    for place in places_to_scrape:
        print("Scraping:", place)
        driver.get("https://www.google.com/maps/search/" + place.replace(" ", "+") + "?hl=en")

        try:
            WebDriverWait(driver, 15).until(
                lambda d: d.find_elements(By.CSS_SELECTOR, "h1.DUwDvf")
                or d.find_elements(By.CSS_SELECTOR, "div.Nv2PK")
            )
        except:
            pass

        if driver.find_elements(By.CSS_SELECTOR, "div.Nv2PK"):
            try:
                first_result = driver.find_element(By.CSS_SELECTOR, "div.Nv2PK a.hfpxzc")
                first_result.click()
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "h1.DUwDvf"))
                )
            except:
                pass

        time.sleep(1.5)

        try:
            name = driver.find_element(By.CSS_SELECTOR, "h1.DUwDvf").text
        except:
            name = "N/A"

        try:
            category = driver.find_element(By.CSS_SELECTOR, "button.DkEaL").text
        except:
            category = "N/A"

        try:
            rating = driver.find_element(By.CSS_SELECTOR, "div.F7nice span[aria-hidden='true']").text
        except:
            rating = "N/A"

        try:
            description = driver.find_element(By.CSS_SELECTOR, "div.PYvSYb").text
        except:
            description = "N/A"

        try:
            address = driver.find_element(By.CSS_SELECTOR, "button[data-item-id='address']").get_attribute("aria-label")
            address = address.replace("Address:", "").strip() if address else "N/A"
        except:
            address = "N/A"

        # Phone number (only present for some places)
        try:
            phone_btn = driver.find_element(By.CSS_SELECTOR, "button[data-item-id^='phone:tel:']")
            phone = phone_btn.get_attribute("aria-label")
            phone = phone.replace("Phone:", "").strip() if phone else "N/A"
        except:
            phone = "N/A"

        # Cuisine — Google usually folds this into the category label
        # (e.g. "Italian restaurant", "Seafood restaurant"), so derive it from there.
        if category != "N/A":
            cuisine = re.sub(r"\s*restaurant.*$", "", category, flags=re.IGNORECASE).strip()
            cuisine = cuisine if cuisine else "N/A"
        else:
            cuisine = "N/A"

        # Improved photo extraction
        photo_url = "N/A"
        selectors = [
            "button.aoRNLd img",
            "div.RZ66Rb img",
            "button[jsaction*='heroHeaderImage'] img"
        ]

        for sel in selectors:
            try:
                img = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, sel))
                )

                src = img.get_attribute("src")
                srcset = img.get_attribute("srcset")

                if src:
                    photo_url = src
                    break
                elif srcset:
                    photo_url = srcset.split(",")[-1].split(" ")[0]
                    break

            except:
                continue

        # fallback if selectors fail
        if photo_url == "N/A":
            try:
                imgs = driver.find_elements(By.TAG_NAME, "img")
                for img in imgs:
                    src = img.get_attribute("src")
                    if src and "googleusercontent" in src:
                        photo_url = src
                        break
            except:
                pass

        maps_url = driver.current_url

        results.append({
            "Name": name,
            "Category": category,
            "Cuisine": cuisine,
            "Rating": rating,
            "Phone": phone,
            "Description": description,
            "Address": address,
            "Photo_URL": photo_url,
            "Maps_URL": maps_url,
        })

        time.sleep(2)

    driver.quit()
    df = pd.DataFrame(results)
    df.to_csv("kemet_restaurants_data.csv", index=False, encoding="utf-8-sig")
    df.head(10)