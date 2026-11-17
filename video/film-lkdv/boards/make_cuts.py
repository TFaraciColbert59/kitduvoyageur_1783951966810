#!/usr/bin/env python3
"""Découpes d'interface réelle pour le film v7 (assets/cut/).

Chaque fichier est un rectangle EXACT d'une capture réelle (assets/app/, 1206 × 2622) : aucun
pixel retouché, aucun redimensionnement (qualité JPEG 95). Les fonds flous (bg-*.jpg) sont des
photos de l'app floutées ici une fois pour toutes (jamais une capture d'interface).
Lancer : python3 boards/make_cuts.py"""
import os
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = os.path.join(ROOT, "assets", "app")
OUT = os.path.join(ROOT, "assets", "cut")

# nom : (capture, (x0, y0, x1, y1)) en pixels de la capture
CUTS = {
    # 04 · la bulle réelle du message à Camille (rien de la liste des conversations)
    "msg-bulle": ("messagerie-w", (288, 1983, 1160, 2180)),
    "msg-camille": ("messagerie-w", (36, 1594, 472, 1730)),
    # 18 · la trace partagée « Mon repérage — Bavella »
    "msg-bavella": ("messagerie-camille", (406, 1783, 1160, 2266)),
    "msg-camille2": ("messagerie-camille", (36, 1594, 472, 1730)),
    # 03 · l'en-tête du carnet des Hautes Fagnes et ses trois voyageurs (sans le bandeau « Chamonix »)
    "carnet-entete": ("carnet-ouvert", (37, 160, 1167, 632)),
    "carnet-voyageurs": ("carnet-ouvert", (100, 650, 680, 830)),
    # 03 / 14 · les 4 médias du carnet (vignettes de l'onglet Médias, heure comprise)
    "media-1": ("carnet-photos", (57, 498, 403, 845)),
    "media-2": ("carnet-photos", (430, 498, 775, 845)),
    "media-3": ("carnet-photos", (802, 498, 1147, 845)),
    "media-4": ("carnet-photos", (57, 872, 403, 1217)),
    "media-titre": ("carnet-photos", (70, 410, 700, 470)),
    # 08 · le sac : en-tête, anneau 2,9 kg, et les lignes du détail
    "sac-entete": ("compas-sac", (62, 425, 1147, 515)),
    "sac-anneau": ("compas-sac", (62, 600, 440, 975)),
    "sac-l1": ("compas-sac", (440, 562, 1130, 628)),
    "sac-l2": ("compas-sac", (440, 630, 1130, 696)),
    "sac-l3": ("compas-sac", (440, 698, 1130, 764)),
    "sac-l4": ("compas-sac", (440, 766, 1130, 832)),
    "sac-l5": ("compas-sac", (440, 834, 1130, 900)),
    # 09 · le tiroir budget réel
    "budget": ("compas-budget", (40, 415, 1170, 985)),
    # 11 · la météo réelle (MET Norway)
    "meteo": ("compas-meteo", (25, 230, 1180, 1330)),
    # 13 · l'en-tête de la story
    "story-lea": ("carnet-stories", (40, 80, 560, 200)),
    # 15 · les prochains départs du club
    "club-departs": ("club-sorties", (20, 480, 1190, 1185)),
    # 17 · la carte du club « Explorateurs du Japon » (sans la ligne « 0 sortie ce mois »)
    "club-japon": ("clubs", (67, 1192, 587, 1590)),
    "club-japon-amis": ("clubs", (95, 1675, 560, 1775)),
    # 21 · le profil (empreinte) et la carte de ses massifs
    "compte-entete": ("compte", (37, 145, 1167, 775)),
    "compte-carte": ("compte", (30, 1670, 1176, 2380)),
}
BLURS = {  # fonds flous (photos de l'app, pas d'interface)
    "bg-flou-paysage": ("assets/img/lkdv-bg-landscape.webp", 28),
    "bg-flou-feu": ("assets/app/carnet-stories.jpg", 40),
    "bg-flou-matin": ("assets/img/community-morning.jpg", 30),
    "bg-flou-rando": ("assets/img/adventure-hiking.jpg", 30),
    "bg-flou-lac": ("assets/img/adventure-kayak.jpg", 30),
}


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    for name, (src, box) in CUTS.items():
        if only and name not in only:
            continue
        im = Image.open(os.path.join(APP, src + ".jpg")).convert("RGB")
        im.crop(box).save(os.path.join(OUT, name + ".jpg"), quality=95)
    for name, (src, r) in BLURS.items():
        if only and name not in only:
            continue
        im = Image.open(os.path.join(ROOT, src)).convert("RGB")
        if im.height > im.width:  # portrait : on prend la bande centrale au format 16:9
            h = im.width * 9 // 16
            y = (im.height - h) // 2
            im = im.crop((0, y, im.width, y + h))
        im = im.resize((960, 540), Image.LANCZOS).filter(ImageFilter.GaussianBlur(r / 2))
        im.save(os.path.join(OUT, name + ".jpg"), quality=90)
    print("ok", len(CUTS), "découpes,", len(BLURS), "fonds")


if __name__ == "__main__":
    main()
