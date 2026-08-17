"""
Réorganise les images déjà téléchargées dans Output/ en Catégorie/Sous-catégorie/Produit.
Ne retélécharge rien - déplace simplement les dossiers existants.
"""
import os
import re
import shutil
import pandas as pd

import config


def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "_", str(name))
    return name.strip()[:120]


def main():
    print(f"Lecture : {config.INPUT_FILE}")
    df = pd.read_excel(config.INPUT_FILE)

    # Construit un index : nom_dossier_attendu -> (categorie, sous_categorie, produit)
    mapping = {}
    for _, row in df.iterrows():
        produit = str(row.get(config.COL_PRODUIT, "")).strip()
        sku = str(row.get(config.COL_SKU, "")).strip()
        cat = str(row.get(config.COL_CATEGORIE, "")).strip()
        sous_cat = str(row.get(config.COL_SOUS_CATEGORIE, "")).strip()

        folder_name = sanitize_filename(f"{sku}_{produit}") if sku and sku != "Voir catégorie" else sanitize_filename(produit)
        mapping[folder_name] = (cat or "Sans_categorie", sous_cat or "Sans_sous_categorie", produit)

    if not os.path.isdir(config.OUTPUT_DIR):
        print(f"Dossier introuvable : {config.OUTPUT_DIR}")
        return

    existants = [
        d for d in os.listdir(config.OUTPUT_DIR)
        if os.path.isdir(os.path.join(config.OUTPUT_DIR, d))
    ]
    print(f"-> {len(existants)} dossier(s) trouve(s) dans Output/\n")

    deplaces, ignores, deja_ok = 0, 0, 0

    for folder_name in existants:
        src = os.path.join(config.OUTPUT_DIR, folder_name)

        # Si le dossier est deja range dans une sous-structure (categorie/sous_cat/produit), on l'ignore
        # (on ne traite que les dossiers directement a la racine de Output/ qui matchent un produit)
        info = mapping.get(folder_name)
        if not info:
            print(f"  [IGNORE] Pas de correspondance Excel pour : {folder_name}")
            ignores += 1
            continue

        cat, sous_cat, produit = info
        cat_folder = sanitize_filename(cat)
        subcat_folder = sanitize_filename(sous_cat)
        dest_dir = os.path.join(config.OUTPUT_DIR, cat_folder, subcat_folder)
        dest = os.path.join(dest_dir, folder_name)

        if os.path.abspath(dest) == os.path.abspath(src):
            deja_ok += 1
            continue

        os.makedirs(dest_dir, exist_ok=True)

        if os.path.exists(dest):
            print(f"  [CONFLIT] Destination existe deja, fusion : {dest}")
            for fichier in os.listdir(src):
                shutil.move(os.path.join(src, fichier), os.path.join(dest, fichier))
            os.rmdir(src)
        else:
            shutil.move(src, dest)

        print(f"  [OK] {folder_name} -> {cat_folder}/{subcat_folder}/")
        deplaces += 1

    print("\n" + "=" * 50)
    print(f"Deplaces      : {deplaces}")
    print(f"Deja en place : {deja_ok}")
    print(f"Ignores       : {ignores}")
    print(f"Dossier final : {config.OUTPUT_DIR}")


if __name__ == "__main__":
    main()