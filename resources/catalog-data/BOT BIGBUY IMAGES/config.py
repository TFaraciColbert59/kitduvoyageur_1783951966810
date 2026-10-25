"""
Configuration du bot BigBuy Images - Le Kit du Voyageur
"""
import os

# --- Chemins ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "input", "produits.xlsx")
OUTPUT_DIR = os.path.join(BASE_DIR, "Output")
REPORTS_DIR = os.path.join(BASE_DIR, "Reports")
LOGS_DIR = os.path.join(BASE_DIR, "logs")
CHECKPOINT_FILE = os.path.join(LOGS_DIR, "checkpoint.json")

# --- Colonnes attendues dans le fichier Excel ---
COL_PRODUIT = "Produit"
COL_MARQUE = "Marque"
COL_CATEGORIE = "Catégorie"
COL_SOUS_CATEGORIE = "Sous-catégorie"
COL_SKU = "SKU / Réf BigBuy"
COL_URL = "URL BigBuy"

# --- Comportement navigateur ---
HEADLESS = False              # Cloudflare détecte souvent le headless -> on garde Chrome visible
CHROME_VERSION_MAIN = 150     # A ajuster selon la version de Chrome installee (chrome://settings/help)
PAGE_TIMEOUT = 30000          # ms
DELAY_PRODUIT = 2             # secondes entre 2 produits (anti-detection)
DELAY_APRES_CHARGEMENT = 3    # secondes d'attente apres chargement de page (JS/Cloudflare)

# --- Sélecteurs CSS (page produit BigBuy) ---
SELECTORS_IMAGES = [
    ".styles_thumbnails__zAz_5 img",
    ".styles_selectedImage__nAY4d img",
]

SELECTORS_VARIANTS = [
    "[class*='colorSwatch']",
    "[class*='variantOption']",
    "[data-testid*='variant']",
    "[data-testid*='swatch']",
    "select[class*='option']",
]

# --- Téléchargement images ---
MIN_IMAGE_SIZE_BYTES = 2000    # ignore les images trop petites (probablement des placeholders)
IMAGE_TIMEOUT = 15             # secondes pour le telechargement HTTP