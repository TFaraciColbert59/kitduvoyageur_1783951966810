#!/usr/bin/env python3
"""Preuves de P07 (photo du lac) et de la plongée P09 → qa/snapshots/plongee/ (JPEG ≤ 400 Ko).

    python3 tools/incrustation/preuves_plongee.py

p07-zoom-4.jpg (défilement, toucher, ouverture, photo en grand, pleine résolution), plongee-21.jpg (les 21 images),
raccord-p09-p10.jpg (dernière image de la plongée | p10 n°30 | différence ×8, écart moyen), mouvement.jpg (écart
moyen d'une image à la suivante et zoom par image). Mesures dans tools/incrustation/suivi/plongee-p09.json.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import incruste as I  # noqa: E402
from preuves import label, save_jpg, font  # noqa: E402

SNAP = os.path.join(I.TRAILER, "qa/snapshots/plongee")
os.makedirs(SNAP, exist_ok=True)
T = I.TRAILER

# P07 : 4 instants
want = {28: "défilement", 42: "toucher", 45: "la photo s'ouvre", 56: "photo en grand"}
sm = {int(k): np.array(v["lisse"]) for k, v in json.load(open(os.path.join(I.SUIVI, "p07.json")))["images"].items()}
inc = {f: im for f, im in enumerate(I.read_frames(os.path.join(T, "flow/clips/incrustes/p07.mp4"))) if f in want}
Q = np.concatenate([sm[f] for f in want])
x0, y0 = (Q.min(0) - 40).astype(int)
x1, y1 = (Q.max(0) + 40).astype(int)
x0, y0, x1, y1 = max(0, x0), max(0, y0), min(I.W, x1), min(I.H, y1)
tiles = [label(Image.fromarray(inc[f][y0:y1, x0:x1]), f"P07 n°{f} · {txt}", 20) for f, txt in want.items()]
sheet = Image.new("RGB", (sum(t.width for t in tiles) + 12, tiles[0].height), (20, 20, 20))
x = 0
for t in tiles:
    sheet.paste(t, (x, 0))
    x += t.width + 4
save_jpg(sheet, os.path.join(SNAP, "p07-zoom-4.jpg"))

# plongée
pl = list(I.read_frames(os.path.join(T, "flow/clips/rendus/p09-plongee.mp4")))
assert len(pl) == 27, len(pl)
dive = pl[6:]
cw, ch = 480, 270
sheet = Image.new("RGB", (cw * 7, ch * 3), (20, 20, 20))
for k, fr in enumerate(dive):
    sheet.paste(label(Image.fromarray(fr).resize((cw, ch), Image.LANCZOS), f"P09 {k + 1}/21 (img {k + 6})", 16),
                ((k % 7) * cw, (k // 7) * ch))
save_jpg(sheet, os.path.join(SNAP, "plongee-21.jpg"))

# raccord
p10 = next(fr for f, fr in enumerate(I.read_frames(os.path.join(T, "flow/clips/plans/p10.mp4"))) if f == 30)
last = dive[-1].astype(np.int16)
d = np.abs(last - p10.astype(np.int16))
mean, mx = float(d.mean()), int(d.max())
dimg = Image.fromarray(np.clip(d * 8, 0, 255).astype(np.uint8))
row = [label(Image.fromarray(dive[-1]).resize((960, 540), Image.LANCZOS), "dernière image de la plongée (img 26)"),
       label(Image.fromarray(p10).resize((960, 540), Image.LANCZOS), "p10 n°30 = 1re image de P10"),
       label(dimg.resize((960, 540), Image.LANCZOS), f"différence ×8 : moyenne {mean:.2f}, max {mx}")]
sheet = Image.new("RGB", (960 * 3 + 8, 540), (20, 20, 20))
for i, r in enumerate(row):
    sheet.paste(r, (i * 964, 0))
save_jpg(sheet, os.path.join(SNAP, "raccord-p09-p10.jpg"))

# mouvement image à image (dans la plongée, et la marge comme référence)
small = [np.asarray(Image.fromarray(f).resize((480, 270), Image.BOX), np.float32) for f in pl]
mv = [float(np.abs(small[i] - small[i - 1]).mean()) for i in range(1, len(small))]
meta = json.load(open(os.path.join(I.SUIVI, "plongee-p09.json")))
zooms = [1.0] + [e["zoom"] for e in meta["detail"]]
ratio = [zooms[i] / zooms[i - 1] for i in range(1, len(zooms))]
Wc, Hc = 1400, 420
im = Image.new("RGB", (Wc, Hc), (250, 248, 245))
dr = ImageDraw.Draw(im)
dr.text((20, 10), "Plongée P09 : écart moyen d'une image à la suivante (barres) et zoom image à image (points rouges)", fill=(20, 20, 20), font=font(18))
m = max(mv)
bw = (Wc - 80) / len(mv)
for i, v in enumerate(mv):
    h = v / m * 300
    xx = 50 + i * bw
    col = (150, 150, 150) if i < 6 else (40, 90, 70)
    dr.rectangle([xx, Hc - 40 - h, xx + bw * 0.7, Hc - 40], fill=col)
    dr.text((xx, Hc - 34), str(i + 1), fill=(60, 60, 60), font=font(12))
rm = max(ratio)
for i, r in enumerate(ratio):
    xx = 50 + (i + 6 - 1) * bw + bw * 0.35
    yy = Hc - 40 - (r - 1) / (rm - 1 + 1e-9) * 300
    dr.ellipse([xx - 4, yy - 4, xx + 4, yy + 4], fill=(200, 40, 40))
save_jpg(im, os.path.join(SNAP, "mouvement.jpg"))
meta["mesures"] = {"raccord_ecart_moyen": round(mean, 3), "raccord_ecart_max": mx,
                   "mouvement_image_a_image": [round(v, 2) for v in mv],
                   "zoom_image_a_image": [round(r, 4) for r in ratio]}
json.dump(meta, open(os.path.join(I.SUIVI, "plongee-p09.json"), "w"), indent=1, ensure_ascii=False)
print(json.dumps(meta["mesures"]))
