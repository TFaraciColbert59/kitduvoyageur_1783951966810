#!/usr/bin/env python3
"""Planches de preuve du motion design v6 (qa/snapshots/motion-v6/), à partir du film rendu.
python3 motion-lab/v6/preuves-v6.py livraison/LKDV-ours-v6.mp4
Écrit cadre.jpg, cadre-ouverture.jpg, fil-NN.jpg (une image sur deux, recadrées sur le trait, avec l'écart mesuré),
fin.jpg, fin-convergence.jpg, fin-logo-1387.jpg, fin-derniere.jpg. Lit motion-lab/v6/{reglages,geo,track}-v6.json."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); T = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(T, "qa/snapshots/motion-v6"); os.makedirs(OUT, exist_ok=True)
src = os.path.join(T, sys.argv[1]); TMP = os.path.join(HERE, "..", "work", "v6-images"); os.makedirs(TMP, exist_ok=True)
R = json.load(open(os.path.join(HERE, "reglages-v6.json"))); TR = json.load(open(os.path.join(HERE, "track-v6.json")))
if not os.path.exists(os.path.join(TMP, "f1439.jpg")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-q:v", "2", "-start_number", "0", os.path.join(TMP, "f%04d.jpg")], check=True)
F = lambda n: Image.open(os.path.join(TMP, f"f{n:04d}.jpg")).convert("RGB")
def font(sz):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
def lab(im, t, xy=(6, 4), sz=16):
    d = ImageDraw.Draw(im); bb = d.textbbox(xy, t, font=font(sz)); d.rectangle((bb[0]-3, bb[1]-2, bb[2]+3, bb[3]+2), fill=(0, 0, 0)); d.text(xy, t, font=font(sz), fill=(255, 255, 255))
def save(im, name, limit=400_000):
    p = os.path.join(OUT, name)
    for q in (90, 85, 80, 75, 70, 64, 58, 50, 44):
        im.save(p, "JPEG", quality=q, optimize=True)
        if os.path.getsize(p) <= limit: break
    while os.path.getsize(p) > limit:
        im = im.resize((int(im.width * 0.92), int(im.height * 0.92)), Image.LANCZOS); im.save(p, "JPEG", quality=80, optimize=True)
    print(name, os.path.getsize(p) // 1024, "Ko")
def grid(items, cols, w, h, title, name, bg=(20, 20, 20)):
    rows = (len(items) + cols - 1) // cols
    c = Image.new("RGB", (cols * (w + 6) + 6, rows * (h + 6) + 40), bg); lab(c, title, (8, 8), 18)
    for i, (im, t) in enumerate(items):
        im = im.resize((w, h), Image.LANCZOS); lab(im, t, (4, 3), 14); c.paste(im, (6 + (i % cols) * (w + 6), 40 + (i // cols) * (h + 6)))
    save(c, name)
man = json.load(open(os.path.join(T, "qa/tmp/ours/manifeste.json")))
# cadre : une image par plan (milieu) de 0 à 588 + l'ouverture 585–600
items = []
for p in man["plans"]:
    if p["start"] > 588: break
    for n in ([p["start"], (p["start"] + p["end"] - 1) // 2] if p["n"] > 30 else [(p["start"] + p["end"] - 1) // 2]):
        items.append((F(n), f'{p["plan"]} · {n}' + (f' · décalé {p["decalage"]:+d}' if p.get("decalage") else "")))
grid(items, 6, 400, 225, "v6 · cadre 2,39:1 de 0 à 588 (bandes encre verte) : rien d'important ne doit être coupé", "cadre.jpg")
grid([(F(n), str(n)) for n in range(585, 601)], 4, 480, 270, "v6 · ouverture du cadre sur le drop (589), images 585 à 600", "cadre-ouverture.jpg")
# fil : par apparition, une image sur deux, recadrée sur le trait
geo = json.load(open(os.path.join(HERE, "geo-v6.json")))
def bbox(pts, m=90):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs) - m, max(xs) + m, min(ys) - m, max(ys) + m
    w = max(x1 - x0, (y1 - y0) * 16 / 9); h = w * 9 / 16; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w = min(w, 1920); h = min(h, 1080)
    x0 = min(max(cx - w / 2, 0), 1920 - w); y0 = min(max(cy - h / 2, 0), 1080 - h)
    return (int(x0), int(y0), int(x0 + w), int(y0 + h))
apps = [("01", "soleil", R["fil"]["soleil"], None, (900, 420, 1620, 825))]
for i, k in enumerate(["p26", "p35", "p38", "p42"]):
    apps.append((f"{i + 2:02d}", k, R["fil"][k], TR.get(k), bbox(geo[k]["chemin"])))
for num, k, a, tr, box in apps:
    ns = list(range(a["in0"] - 1, a["out1"] + 2, 2))
    ctl = {e["image"]: e for e in tr["controle"]} if tr else {}
    items = []
    for n in ns:
        e = ctl.get(n); t = f"{n}" + (f" · écart méd {e['median']:.1f} / max {e['max']:.1f} px" if e and e["median"] is not None else "")
        items.append((F(n).crop(box), t))
    res = tr["resume"] if tr else None
    title = f"v6 · fil {num} · {k} · images {ns[0]}–{ns[-1]} (une sur deux)" + (f" · suivi : écart médian {res['ecart_median_px']} px, p95 {res['ecart_p95_px']} px, max {res['ecart_max_px']} px" if res else " · écran fixe (ouverture)")
    grid(items, 4, 480, 270, title, f"fil-{num}.jpg")
# fin
grid([(F(n), str(n)) for n in range(1335, 1440, 3)], 6, 320, 180, "v6 · la fin, images 1335 à 1439 (une sur trois) : convergence, fil sur le contour, logo posé à 1387, point du Soleil", "fin.jpg")
for n, nm in ((1376, "fin-convergence.jpg"), (1387, "fin-logo-1387.jpg"), (1439, "fin-derniere.jpg"), (1410, "fin-point-pose-1410.jpg")):
    save(F(n), nm)
