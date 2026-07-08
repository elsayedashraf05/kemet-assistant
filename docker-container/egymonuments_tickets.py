import pandas as pd
import re
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException, TimeoutException

def egymonuments_tickets():
    options = Options()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    # options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    all_sites = []

    driver.get("https://egymonuments.com/locations")

    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#portfolio > div > div > div:nth-child(1)")))
    time.sleep(1)

    i = 1
    while True:
        try:
            item = driver.find_element(By.CSS_SELECTOR, f"#portfolio > div > div > div:nth-child({i})")
        except NoSuchElementException:
            print("Finished — no more items.")
            break

        try:
            place_name = item.find_element(By.CSS_SELECTOR, "div.p-2.w-100").text.strip()
        except NoSuchElementException:
            place_name = ""

        try:
            place_location = item.find_element(By.CSS_SELECTOR, "div.itemlocation").text.strip()
        except NoSuchElementException:
            place_location = ""

        try:
            figure = item.find_element(By.TAG_NAME, "figure")
            style = figure.get_attribute("style") or ""
            match = re.search(r"url\(['\"]?(.*?)['\"]?\)", style)
            photo_url = match.group(1) if match else ""
        except NoSuchElementException:
            photo_url = ""

        try:
            detail_link = item.find_element(By.TAG_NAME, "a").get_attribute("href")
        except NoSuchElementException:
            detail_link = ""

        print(i, "-", place_name, "|", place_location, "|", detail_link)

        all_sites.append({
            "place_name": place_name,
            "place_location": place_location,
            "photo_url": photo_url,
            "detail_link": detail_link,
        })

        i += 1

    print("all_sites:", len(all_sites))

    df = pd.DataFrame(all_sites)

    def extract_prices(container_selector):
        rows_out = []
        rows = driver.find_elements(By.CSS_SELECTOR, f"{container_selector} table tbody tr")
        for r in rows:
            tds = r.find_elements(By.TAG_NAME, "td")
            if len(tds) == 2:
                label = tds[0].text.strip()
                value = tds[1].text.strip().replace("\n", " ")
                if label:
                    rows_out.append(f"{label}: {value}")
        return "\n".join(rows_out)


    for idx, row in df.iterrows():
        link = row["detail_link"]
        if not link:
            continue

        print(f"[{idx + 1}/{len(df)}] Opening: {row['place_name']}")
        driver.get(link)

        try:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#pills-OtherNationality")))
            tickets_price_other = extract_prices("#pills-OtherNationality") or "Free"
        except (NoSuchElementException, TimeoutException):
            tickets_price_other = "Free"

        tickets_price_egyptian = "Not Available"
        try:
            egy_tab_btn = driver.find_element(By.CSS_SELECTOR, "#pills-Egyption-tab")
            driver.execute_script("arguments[0].click();", egy_tab_btn)
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "#pills-Egyption")))
            tickets_price_egyptian = extract_prices("#pills-Egyption") or "Free"
        except NoSuchElementException:
            tickets_price_egyptian = "Not Available"

        try:
            hours_div = driver.find_element(By.XPATH, "//h3[contains(., 'OPENING HOURS')]/parent::div")
            opening_hours = hours_div.text.replace("OPENING HOURS", "").strip()
        except NoSuchElementException:
            opening_hours = "Not Available"

        try:
            booking_link = driver.find_element(By.CSS_SELECTOR, "a.btn-get-download").get_attribute("href")
        except NoSuchElementException:
            booking_link = ""

        # ---------- FREE ENTRY POLICY ----------
        free_entry_policy = "Not Available"
        try:
            cards = driver.find_elements(By.CSS_SELECTOR, "div.card.sdSlider")
            for card in cards:
                title_elem = card.find_element(By.CSS_SELECTOR, "h4.card-title")
                title_txt = driver.execute_script("return arguments[0].textContent;", title_elem).strip()
                if "FREE ENTRY POLICY" in title_txt.upper():
                    text_elem = card.find_element(By.CSS_SELECTOR, "p.card-text")
                    free_entry_policy = driver.execute_script("return arguments[0].textContent;", text_elem).strip()
                    break
        except NoSuchElementException:
            pass

        df.at[idx, "tickets_price_other_nationality"] = tickets_price_other
        df.at[idx, "tickets_price_egyptian"] = tickets_price_egyptian
        df.at[idx, "opening_hours"] = opening_hours
        df.at[idx, "booking_link"] = booking_link
        df.at[idx, "free_entry_policy"] = free_entry_policy

    driver.quit()
    print("Done.")

    df.to_csv("egymonuments_tickets.csv", index=False)
    #import csv into df
    df = pd.read_csv("egymonuments_tickets.csv")
    from selenium.webdriver.support import expected_conditions as EC

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    for idx, row in df.iterrows():
        query = f"{row['place_name']}, {row['place_location']}, Egypt"
        print("Searching Maps for:", query)

        driver.get("https://www.google.com/maps/search/" + query.replace(" ", "+") + "?hl=en")

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

        df.at[idx, "on_map"] = driver.current_url

    driver.quit()
    df.to_csv("egymonuments_tickets.csv", index=False)
