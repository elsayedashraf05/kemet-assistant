import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import time

def periods():
    options = Options()
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    # options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    all_periods = []

    driver.get("https://egymonuments.gov.eg/en/historical-periods")
    # Waiting for the collection links to load
    wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#cd-timeline a")))
    i = 1
    while True:
        try:
            # press the next site link
            try:
                site_link = wait.until(EC.element_to_be_clickable(
                (By.XPATH, f'//*[@id="cd-timeline"]/inners-period-listing/div[{i}]/a/div[2]/a')
                ))
                site_link.click()
                i += 1
            except:
                break

            # collect the data
            period_name = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'div.mainPageTitle'))).text
            period_from_to = driver.find_element(By.CSS_SELECTOR, 
                'div.relative.descriptionImageCont.periodFromTo > div.dateFromToCont'
            ).text
            period_description = driver.find_element(By.CSS_SELECTOR, 
                'div.relative.descriptionImageCont.periodFromTo > div.DescriptionSection > div.periodTxtCont > div.txtSection'
            ).text
            try:
                img_elem = driver.find_element(By.CSS_SELECTOR,
                    'div.relative.descriptionImageCont.periodFromTo > div.DescriptionSection > div.periodImgCont > img'
                )
                place_photo = img_elem.get_attribute("src")
            except:
                place_photo = ""
            all_periods.append({
                "collection": period_name,
                "location": period_from_to,
                "Description": period_description,
                "photo_url": place_photo
            })

            # previous page
            driver.back()
            wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#cd-timeline a")))


        except Exception as e:
            print("Finished — no more items.")
            break

    print(f"Total periods: {len(all_periods)}")
    df = pd.DataFrame(all_periods)
    df.rename(columns={"location": "from_to"}, inplace=True)
    df.to_csv('periods_en.csv', index=False)