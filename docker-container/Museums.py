import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time

def Museums():
    options = Options()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    #options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    all_museums = []

    driver.get("https://egymonuments.gov.eg/en/museums")

    # Waiting for the museum links to load
    wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#cd-museums a")))
    i = 1
    while True:
        try:
            # press the next site link
            try:
                site_link = wait.until(EC.element_to_be_clickable(
                (By.XPATH, f'//*[@id="cd-museums"]/app-egyptian-treasure/div/div[3]/a[{i}]')
                ))
                site_link.click()
                i += 1
            except:
                driver.find_element(By.XPATH, '//*[@id="cd-museums"]/app-egyptian-treasure/div/div[3]/div/button').click()
                continue

            # collect the data
            place_name = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div.mainPageTitle'))).text
            place_location = driver.find_element(By.CSS_SELECTOR, 
                'div.relative.descriptionImageCont > div.DescriptionSection > div > div.itemInfo'
            ).text
            place_description = driver.find_element(By.CSS_SELECTOR, 
                'div.relative.descriptionImageCont > div.DescriptionSection > div > div.txtSection'
            ).text

            try:
                place_photo = driver.find_element(By.CSS_SELECTOR,
                    'body > div.innerMainBgCont > div > div:nth-child(1) > div > div.relative.descriptionImageCont > div.imageCont img'
                ).get_attribute('src')
            except:
                place_photo = ""

            try:
                start_from = driver.find_element(By.CSS_SELECTOR,
                    '#planVisit > div.mapHoursCont > div.openingHoursSec > div:nth-child(2) > div:nth-child(1) > p'
                ).text
                end_at = driver.find_element(By.CSS_SELECTOR,
                    '#planVisit > div.mapHoursCont > div.openingHoursSec > div:nth-child(2) > div:nth-child(2) > p'
                ).text
            except:
                start_from, end_at = "Not Available", "Not Available"

            try:
                tickets_price = driver.find_element(By.CSS_SELECTOR, 'div.ticketPriceDetails > div').text
            except:
                tickets_price = "Free"

            all_museums.append({
                "museum": place_name,
                "location": place_location,
                "Description": place_description,
                "start_from": start_from,
                "end_at": end_at,
                "tickets_price": tickets_price,
                "photo_url": place_photo,
                "on_map": ""
            })

            # return to the main page
            driver.back()
            wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#cd-museums a")))

        except Exception as e:
            print("Finished — no more items.")
            break

    print(f"Total museums: {len(all_museums)}")
    df = pd.DataFrame(all_museums)
    from selenium.webdriver.support import expected_conditions as EC

    for idx, row in df.iterrows():
        query = f"{row['museum']}, {row['location']}, Egypt"
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
    df.to_csv('museums_en.csv', index=False)
