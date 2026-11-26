# Cuit les lumières réelles d'img39 (positions écran 1920x1080) pour ancrer les tracés de P53.
# Usage : python3 -I tools/bake-img39.py   (depuis trailer/fx-lab/) -> lib/fx/img39-lights.js
import json
import numpy as np
from PIL import Image
a = np.asarray(Image.open("assets/footage/img39.png").convert("RGB"), dtype=np.float32)
H, W, _ = a.shape
lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
warm = a[..., 0] - a[..., 2]  # lumières dorées : rouge > bleu
yy, xx = np.mgrid[0:H, 0:W]
CX, CY, R = 1133, 3585, 3454  # limbe mesuré (revue P3)
inside = (xx - CX) ** 2 + (yy - CY) ** 2 < (R - 12) ** 2
score = np.where(inside & (warm > 25), lum, 0)
# maxima locaux sur une grille de 6 px
cell = 6
pts = []
for y0 in range(0, H - cell, cell):
    for x0 in range(0, W - cell, cell):
        blk = score[y0:y0 + cell, x0:x0 + cell]
        m = blk.max()
        if m > 70:
            j, i = np.unravel_index(blk.argmax(), blk.shape)
            pts.append([int(x0 + i), int(y0 + j), round(float(m) / 255, 3)])
js = ("/* Généré par tools/bake-img39.py — lumières réelles d'img39 (x, y, éclat 0–1), limbe cx 1133, cy 3585, R 3454. */\n"
      "(function(r){var FX=(r.LKDVFX=r.LKDVFX||{});FX.IMG39={limb:{cx:1133,cy:3585,R:3454},lights:" + json.dumps(pts, separators=(",", ":")) + "};})(typeof window!=='undefined'?window:globalThis);\n")
open("lib/fx/img39-lights.js", "w").write(js)
print("points", len(pts), "octets", len(js))
