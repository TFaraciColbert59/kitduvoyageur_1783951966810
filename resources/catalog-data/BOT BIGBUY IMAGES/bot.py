"""
BOT IMAGES BIGBUY - Le Kit du Voyageur (Selenium / undetected_chromedriver)
"""
import os
import re
import json
import time
import logging
import requests
from datetime import datetime
from urllib.parse import urlparse, unquote

import pandas as pd
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException

import config

# ------------------------------------------------------------------ #
#  Logging
# ------------------------------------------------------------------ #
def setup_logging():
    os.makedirs(config.LOGS_DIR, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(
                os.path.join(config.LOGS_DIR, "bot.log"), encoding="utf-8"
            ),
        ],
    )
    return logging.getLogger(__name__)


log = setup_logging()


# ------------------------------------------------------------------ #
#  Checkpoint
# ------------------------------------------------------------------ #
def load_checkpoint():
    if os.path.exists(config.CHECKPOINT_FILE):
        with open(config.CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_checkpoint(checkpoint):
    os.makedirs(config.LOGS_DIR, exist_ok=True)
    with open(config.CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, ensure_ascii=False, indent=2)


# ------------------------------------------------------------------ #
#  Navigateur
# ------------------------------------------------------------------ #
def create_driver():
    options = uc.ChromeOptions()
    options.add_argument("--window-size=1366,768")
    options.add_argument("--lang=fr-FR")
    options.add_argument("--no-first-run")
    options.add_argument("--password-store=basic")
    if config.HEADLESS:
        options.add_argument("--headless=new")
    driver = uc.Chrome(
        options=options,
        version_main=config.CHROME_VERSION_MAIN,
        use_subprocess=True,
    )
    driver.set_page_load_timeout(config.PAGE_TIMEOUT / 1000)
    return driver



# ------------------------------------------------------------------ #
#  Extraction
# ------------------------------------------------------------------ #
def extract_images(driver):
    """Retourne la liste des URLs d'images (dédupliquées, en conservant l'ordre)."""
    urls = []
    for sel in config.SELECTORS_IMAGES:
        try:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
        except WebDriverException:
            continue
        for el in elems:
            src = el.get_attribute("src")
            if src and src not in urls:
                urls.append(src)
    return urls


def extract_variants(driver):
    """Retourne la liste des libellés de variantes couleur détectées (peut être vide)."""
    variants = []
    for sel in config.SELECTORS_VARIANTS:
        try:
            elems = driver.find_elements(By.CSS_SELECTOR, sel)
        except WebDriverException:
            continue
        for el in elems:
            label = (
                el.get_attribute("title")
                or el.get_attribute("aria-label")
                or el.text
            )
            if label:
                label = label.strip()
                if label and label not in variants:
                    variants.append(label)
    return variants


def is_challenge_page(driver):
    html = driver.page_source.lower()
    return "cloudflare" in html and "captcha" in html and "styles_mediacontainer" not in html


# ------------------------------------------------------------------ #
#  Téléchargement image
# ------------------------------------------------------------------ #
def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "_", name)
    return name.strip()[:120]


def download_image(url, dest_path, session):
    try:
        resp = session.get(url, timeout=config.IMAGE_TIMEOUT)
        if resp.status_code == 200 and len(resp.content) >= config.MIN_IMAGE_SIZE_BYTES:
            with open(dest_path, "wb") as f:
                f.write(resp.content)
            return True
        return False
    except requests.RequestException:
        return False


def guess_extension(url):
    path = urlparse(url).path
    ext = os.path.splitext(unquote(path))[1]
    return ext if ext else ".jpg"


# ------------------------------------------------------------------ #
#  Traitement d'un produit
# ------------------------------------------------------------------ #
def process_product(driver, session, produit, sku, url):
    driver.get(url)
    time.sleep(config.DELAY_APRES_CHARGEMENT)

    if is_challenge_page(driver):
        log.warning("   Page de challenge Cloudflare detectee - nouvel essai...")
        time.sleep(5)
        driver.refresh()
        time.sleep(config.DELAY_APRES_CHARGEMENT)

    images = extract_images(driver)
    variants = extract_variants(driver)

    ok, skip, err = 0, 0, 0
    if images:
        folder_name = sanitize_filename(f"{sku}_{produit}") if sku else sanitize_filename(produit)
        dest_folder = os.path.join(config.OUTPUT_DIR, folder_name)
        os.makedirs(dest_folder, exist_ok=True)

        for i, img_url in enumerate(images, start=1):
            ext = guess_extension(img_url)
            dest_path = os.path.join(dest_folder, f"{i:02d}{ext}")
            if os.path.exists(dest_path):
                skip += 1
                continue
            if download_image(img_url, dest_path, session):
                ok += 1
            else:
                err += 1

    return {
        "images_trouvees": len(images),
        "variantes": variants,
        "ok": ok,
        "skip": skip,
        "err": err,
    }


# ------------------------------------------------------------------ #
#  Main
# ------------------------------------------------------------------ #
def main():
    log.info("=" * 62)
    log.info("  BOT IMAGES BIGBUY - Le Kit du Voyageur (Selenium)")
    log.info(f"       {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    log.info("=" * 62)

    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    os.makedirs(config.REPORTS_DIR, exist_ok=True)

    log.info(f"Lecture : {config.INPUT_FILE}")
    xls = pd.ExcelFile(config.INPUT_FILE)
    sheet_name = xls.sheet_names[0]
    df = xls.parse(sheet_name)
    log.info(f"   Feuille : {sheet_name}")
    log.info(f"   Colonnes trouvees : {list(df.columns)}")
    log.info(f"   -> {len(df)} produits a traiter")

    checkpoint = load_checkpoint()
    deja_traites = sum(1 for v in checkpoint.values() if v == "done")
    log.info(f"Checkpoint : {deja_traites} produit(s) deja traite(s) avec succes")

    log.info("Lancement du navigateur Chrome...")
    driver = create_driver()
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})

    rapport = []
    total_images_ok = 0
    total_err = 0

    try:
        for idx, row in df.iterrows():
            produit = str(row.get(config.COL_PRODUIT, "")).strip()
            marque = str(row.get(config.COL_MARQUE, "")).strip()
            cat = str(row.get(config.COL_CATEGORIE, "")).strip()
            sous_cat = str(row.get(config.COL_SOUS_CATEGORIE, "")).strip()
            sku = str(row.get(config.COL_SKU, "")).strip()
            url = str(row.get(config.COL_URL, "")).strip()

            log.info("\n" + "-" * 64)
            log.info(f"[{idx + 1}/{len(df)}] {produit}")
            log.info(f"   {cat} > {sous_cat} | SKU: {sku}")

            if not url or url.lower() == "nan":
                log.warning("   Pas d'URL BigBuy - ignore")
                rapport.append({
                    "num": idx + 1, "produit": produit, "marque": marque,
                    "categorie": cat, "sous_categorie": sous_cat, "sku": sku,
                    "coloris": "-", "url": url, "ok": 0, "skip": 0, "err": 0,
                    "statut": "Sans URL",
                })
                continue

            ck_key = sku if (sku and sku != "Voir catégorie") else url
            if checkpoint.get(ck_key) == "done":
                log.info("   Deja traite avec succes - ignore")
                continue

            try:
                result = process_product(driver, session, produit, sku, url)
            except TimeoutException:
                log.error("   Timeout lors du chargement de la page")
                rapport.append({
                    "num": idx + 1, "produit": produit, "marque": marque,
                    "categorie": cat, "sous_categorie": sous_cat, "sku": sku,
                    "coloris": "-", "url": url, "ok": 0, "skip": 0, "err": 1,
                    "statut": "Timeout",
                })
                checkpoint[ck_key] = "error"
                save_checkpoint(checkpoint)
                time.sleep(config.DELAY_PRODUIT)
                continue

            if result["images_trouvees"] == 0:
                log.warning("   Aucune image recuperee")
                rapport.append({
                    "num": idx + 1, "produit": produit, "marque": marque,
                    "categorie": cat, "sous_categorie": sous_cat, "sku": sku,
                    "coloris": "-", "url": url, "ok": 0, "skip": 0, "err": 0,
                    "statut": "Partiel",
                })
                checkpoint[ck_key] = "no_images"
                save_checkpoint(checkpoint)
                time.sleep(config.DELAY_PRODUIT)
                continue

            coloris = ", ".join(result["variantes"]) if result["variantes"] else "-"
            log.info(
                f"   {result['images_trouvees']} image(s) trouvee(s) | "
                f"OK: {result['ok']} | Skip: {result['skip']} | Err: {result['err']} | "
                f"Coloris: {coloris}"
            )

            total_images_ok += result["ok"]
            total_err += result["err"]

            rapport.append({
                "num": idx + 1, "produit": produit, "marque": marque,
                "categorie": cat, "sous_categorie": sous_cat, "sku": sku,
                "coloris": coloris, "url": url,
                "ok": result["ok"], "skip": result["skip"], "err": result["err"],
                "statut": "OK" if result["ok"] > 0 else "Partiel",
            })

            checkpoint[ck_key] = "done" if result["ok"] > 0 else "no_images"
            save_checkpoint(checkpoint)
            time.sleep(config.DELAY_PRODUIT)

    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # --- Rapport Excel ---
    log.info("\n" + "=" * 62)
    rapport_df = pd.DataFrame(rapport)
    rapport_path = os.path.join(config.REPORTS_DIR, "rapport_images.xlsx")
    rapport_df.to_excel(rapport_path, index=False)
    log.info(f"Rapport : {rapport_path}")

    log.info("\nTERMINE")
    log.info(f"   Images telechargees : {total_images_ok}")
    log.info(f"   Lignes en erreur    : {total_err}")
    log.info(f"   Dossier images      : {config.OUTPUT_DIR}")
    log.info(f"   Rapport Excel       : {rapport_path}")
    log.info("=" * 62)


if __name__ == "__main__":
    main()