import undetected_chromedriver as uc
import time
import re

URL = "https://www.bigbuy.eu/fr/shop/product/XXXXXXXXX"

options = uc.ChromeOptions()
options.add_argument("--window-size=1366,768")
options.add_argument("--lang=fr-FR")
driver = uc.Chrome(options=options, version_main=150, use_subprocess=True)

print("Ouverture :", URL)
driver.get(URL)
time.sleep(4)

html = driver.page_source

# Cherche tout ce qui contient "color", "coloris", "variant", "swatch", "option"
mots_cles = ["color", "coloris", "variant", "swatch", "option"]
for mot in mots_cles:
    occurrences = re.findall(r'class="[^"]*' + mot + r'[^"]*"', html, re.IGNORECASE)
    uniq = list(set(occurrences))
    print(f"\n=== classes contenant '{mot}' ({len(uniq)} uniques) ===")
    for o in uniq[:15]:
        print(" ", o)

input("\nAppuie sur Entree pour fermer...")
driver.quit()