import time
import re
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def kemet_beaches_scraper():
    places_to_scrape = [
        # The Mediterranean & North Coast
        "Ageeba Beach, Marsa Matrouh", "Cleopatra Beach, Marsa Matrouh",
        "Rommel Beach, Marsa Matrouh", "Gharam Beach, Marsa Matrouh",
        "Almaza Bay Beach, North Coast", "Marassi Beach, North Coast",
        "Hacienda White Beach, North Coast", "Mamoura Beach, Alexandria",
        "Montazah Beach, Alexandria", "Citadel of Qaitbay Waterfront, Alexandria",

        # South Sinai
        "Ras Mohammed National Park, Sharm El Sheikh", "Naama Bay Beach, Sharm El Sheikh",
        "Shark's Bay Beach, Sharm El Sheikh", "Ras Um Sid Beach, Sharm El Sheikh",
        "Terrazzina Beach, Sharm El Sheikh", "Nabq Nature Reserve, Sharm El Sheikh",
        "Blue Hole, Dahab", "Three Pools, Dahab", "Laguna Beach, Dahab",
        "Eel Garden Reef, Dahab", "Lighthouse Dive Site, Dahab",
        "Ras Abu Galum Reserve, Nuweiba", "Castle Zaman Private Beach, Nuweiba",
        "Fjord Bay, Taba", "Pharoah's Island, Taba",

        # The Red Sea
        "Mahmya Island, Hurghada", "Giftun Island National Park, Hurghada",
        "Orange Bay, Hurghada", "Makadi Bay Water World, Hurghada",
        "Sahl Hasheesh Beach, Hurghada", "Zeytouna Beach, El Gouna",
        "Mangroovy Beach, El Gouna", "Sliders Cable Park, El Gouna",
        "Soma Bay, Safaga", "Sharm El Naga Resort Beach, Safaga",
        "Abu Nuhas Shipwreck Dive Site, Red Sea",

        # The Deep Red Sea South
        "Sharm El Luli, Marsa Alam", "Abu Dabbab Beach, Marsa Alam",
        "Wadi El Gemal National Park Coast, Marsa Alam", "Satayah Dolphin Reef, Marsa Alam",
        "Marsa Mubarak, Marsa Alam", "Nayzak Beach, Marsa Alam",
        "Samadai Reef, Marsa Alam", "Hamata Islands, Marsa Alam",
        "El Quseir Fort Beach area, El Quseir",

        # Unique Inland & River Water Activities
        "Magic Lake, Wadi El Rayan, Fayoum", "Wadi El Rayan Waterfalls, Fayoum",
        "Lake Qarun Waterfront, Fayoum", "Elephantine Island Felucca Sailing, Aswan",
        "Burullus Lake, Kafr El Sheikh",
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

        dogs_allowed = "Yes" if "dog" in description.lower() else "N/A"

        try:
            address = driver.find_element(By.CSS_SELECTOR, "button[data-item-id='address']").get_attribute("aria-label")
            address = address.replace("Address:", "").strip() if address else "N/A"
        except:
            address = "N/A"

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
            "Rating": rating,
            "Description": description,
            "Dogs_Allowed": dogs_allowed,
            "Address": address,
            "Photo_URL": photo_url,
            "Maps_URL": maps_url,
        })

        time.sleep(2)

    driver.quit()

    df = pd.DataFrame(results)
    df.to_csv("kemet_beaches_data.csv", index=False, encoding="utf-8-sig")
    df.head(10)