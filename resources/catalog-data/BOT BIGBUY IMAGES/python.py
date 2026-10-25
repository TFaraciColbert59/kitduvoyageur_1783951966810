# -*- coding: utf-8 -*-
# ─── Chemins ───────────────────────────────────────────────────────────────────
from pathlib import Path

EXCEL_INPUT     = Path("input/produits.xlsx")
OUTPUT_DIR      = Path("output/IMAGES_PRODUITS")
CHECKPOINT_FILE = Path("logs/checkpoint.json")
RAPPORT_FILE    = Path("reports/rapport_images.xlsx")
ERREURS_FILE    = Path("logs/erreurs.xlsx")
LOG_FILE        = Path("logs/bot.log")

# ─── Délais (secondes) ─────────────────────────────────────────────────────────
DELAY_PRODUIT = 2.5     # pause entre deux produits
DELAY_VARIANT = 1.5     # pause entre deux variantes
DELAY_LOAD    = 3.0     # attente chargement page

# ─── HTTP ──────────────────────────────────────────────────────────────────────
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
PAGE_TIMEOUT = 35_000   # ms (Playwright)
IMG_TIMEOUT  = 20       # secondes (requests)

# ─── Colonnes Excel (ton fichier) ──────────────────────────────────────────────
COL_NUM      = "#"
COL_PRODUIT  = "Produit"
COL_CAT      = "Catégorie"
COL_SOUS_CAT = "Sous-catégorie"
COL_SKU      = "SKU / Réf BigBuy"
COL_URL      = "URL BigBuy"
COL_NOTE     = "Note vérification"
COL_MARQUE   = "Marque"

# Seules les lignes avec ce marqueur seront traitées
URL_OK_MARKER = "URL vérifiée BigBuy"

# ─── Sélecteurs CSS BigBuy (ordre de priorité) ────────────────────────────────
SELECTORS_IMAGES = [
    ".slick-slide:not(.slick-cloned) img",
    ".swiper-slide:not(.swiper-slide-duplicate) img",
    ".product-image-photo",
    "#product-images-main img",
    ".gallery-placeholder img",
    ".fotorama__img",
    "img.lazyload[data-src]",
    ".product-gallery img",
    "[data-image-role='main'] img",
    "figure.product-image img",
    "img[src*='bigbuy']",
]

SELECTORS_VARIANTS = [
    ".product-options-wrapper .swatch-option",
    ".color-swatches a",
    "[data-option-type='color']",
    ".product-colors .color-item",
    ".variant-color-item",
    "[data-attribute-id] .swatch-option",
    ".attribute-color .swatch-option",
    "select.super-attribute-select option:not([value=''])",
    ".js-product-option",
    "[data-variant]",
]