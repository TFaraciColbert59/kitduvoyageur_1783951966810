# -*- coding: utf-8 -*-
"""Diagnostic v3 : avec undetected-chromedriver pour contourner l'anti-bot."""

import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

URL = "https://www.bigbuy.eu/fr/shop/product/lanterne-led-pour-la-tete-tm-electron_776399"

options = uc.ChromeOptions()
# On NE met PAS de headless pour ce test - on veut voir si le captcha apparait
driver = uc.Chrome(options=options, version_main=150)

print(f"Ouverture : {URL}")
driver.get(URL)
time.sleep(5)

print("\n=== TITRE ===")
print(driver.title)

print("\n=== Est-ce une page de challenge/captcha ? ===")
src = driver.page_source.lower()
for kw in ["cloudflare", "captcha", "checking your browser", "just a moment", "datadome", "access denied"]:
    if kw in src:
        print(f"  -> DETECTE : '{kw}'")

for sel in ["#onetrust-accept-btn-handler", "button[class*='disagree']"]:
    try:
        btn = driver.find_element(By.CSS_SELECTOR, sel)
        if btn.is_displayed():
            btn.click()
            time.sleep(1)
    except Exception:
        pass

print("\n=== Conteneur mediaContainer ===")
try:
    el = driver.find_element(By.CSS_SELECTOR, "[class*='mediaContainer']")
    print(el.get_attribute("outerHTML")[:2500])
except Exception as e:
    print("Non trouve:", e)

print("\n=== background-image des divs styles_image ===")
els = driver.find_elements(By.CSS_SELECTOR, "[class*='styles_image']")
print(f"Nombre trouve : {len(els)}")
for i, el in enumerate(els):
    bg = driver.execute_script("return window.getComputedStyle(arguments[0]).backgroundImage;", el)
    print(f"  [{i}] bg={bg[:150]}")

input("\nAppuie sur Entree pour fermer (regarde si un captcha est visible dans Chrome)...")
driver.quit()