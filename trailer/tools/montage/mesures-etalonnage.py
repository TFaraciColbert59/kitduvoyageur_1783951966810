#!/usr/bin/env python3
"""Mesures et preuves de l'étalonnage d'un ours (avant / après).

    python3 tools/montage/mesures-etalonnage.py livraison/LKDV-ours-v3.mp4 livraison/LKDV-ours-v4.mp4 \
        [--manifeste qa/tmp/ours/manifeste.json] [--sortie qa/snapshots/etalonnage-v4] [--sans-planches]

Les deux films doivent avoir le même découpage (lu dans le manifeste de build-ours.mjs). Les images sont décodées
avec la matrice Rec.709 (celle des balises des ours livrés, donc ce que voit un lecteur).

Sorties (dans --sortie) : mesures.json, mesures.md (tableaux repris dans qa/ETALONNAGE-V4.md), et les planches
avant-apres-N.jpg, peaux.jpg, telephones.jpg, p50.jpg (JPEG ≤ 400 Ko).
Mesures par plan (toutes les images, réduites à 480×270) : luminance Y' (Rec.709, 0–255) moyenne et médiane,
1er et 99e centiles, saturation moyenne (HSV), dominante R − B moyenne, % de pixels écrêtés (un canal à 255, ou les
trois à 0) ; par raccord : écarts de luminance moyenne et de dominante entre la dernière image du plan sortant et
la première du plan entrant ; surface proche de #E4501C (ΔE76 Lab < 20) par plan.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

TRAILER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
args = sys.argv[1:]


def opt(name, default):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default


MAN = os.path.join(TRAILER, opt("--manifeste", "qa/tmp/ours/manifeste.json"))
OUTD = os.path.join(TRAILER, opt("--sortie", "qa/snapshots/etalonnage-v4"))
NO_SHEETS = "--sans-planches" in args
args = [a for a in args if a != "--sans-planches"]
AV, AP = (os.path.join(TRAILER, a) for a in args[:2])
os.makedirs(OUTD, exist_ok=True)
M = json.load(open(MAN))
plans = M["plans"]
W, H = 480, 270


def decode(path, w=W, h=H, select=None):
    vf = (f"select='{select}'," if select else "") + f"scale={w}:{h}:flags=area:in_color_matrix=bt709:in_range=tv,format=rgb24"
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", vf] + (["-fps_mode", "passthrough"] if select else []) + ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def luma(a):
    a = a.astype(np.float32)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def sat(a):
    a = a.astype(np.float32)
    mx, mn = a.max(-1), a.min(-1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)


def srgb_to_lab(a):
    c = a.astype(np.float32) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M_ = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M_.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


FORBID = srgb_to_lab(np.array([[0xE4, 0x50, 0x1C]], np.uint8))[0]


def stats(F):
    y = luma(F)
    rb = F[..., 0].astype(np.float32) - F[..., 2].astype(np.float32)
    clip = ((F == 255).any(-1) | (F == 0).all(-1)).mean() * 100
    lab = srgb_to_lab(F[:, ::2, ::2])
    near = (np.sqrt(((lab - FORBID) ** 2).sum(-1)) < 20).mean() * 100
    return {"y_moy": float(y.mean()), "y_med": float(np.median(y)), "p1": float(np.percentile(y, 1)), "p99": float(np.percentile(y, 99)),
            "sat": float(sat(F).mean()), "rb": float(rb.mean()), "ecretes": float(clip), "e4501c": float(near)}


def frame_stats(f):
    return {"y": float(luma(f).mean()), "rb": float(f[..., 0].astype(np.float32).mean() - f[..., 2].astype(np.float32).mean())}


print("décodage…", file=sys.stderr)
A = decode(AV)
B = decode(AP)
assert A.shape == B.shape, (A.shape, B.shape)
res = {"plans": [], "raccords": []}
for p in plans:
    s, e = p["start"], p["end"]
    res["plans"].append({"plan": p["plan"], "section": p["section"], "avant": stats(A[s:e]), "apres": stats(B[s:e])})
for i in range(1, len(plans)):
    c = plans[i]["start"]
    a0, a1 = frame_stats(A[c - 1]), frame_stats(A[c])
    b0, b1 = frame_stats(B[c - 1]), frame_stats(B[c])
    res["raccords"].append({"de": plans[i - 1]["plan"], "vers": plans[i]["plan"], "image": c,
                            "avant": {"dy": a1["y"] - a0["y"], "drb": a1["rb"] - a0["rb"]},
                            "apres": {"dy": b1["y"] - b0["y"], "drb": b1["rb"] - b0["rb"]}})
# dispersion par section (écart type des moyennes de plans)
secs = {}
for r in res["plans"]:
    secs.setdefault(r["section"], []).append(r)
res["sections"] = {k: {"n": len(v),
                       "y_ecart_type": [float(np.std([r[w]["y_moy"] for r in v])) for w in ("avant", "apres")],
                       "rb_ecart_type": [float(np.std([r[w]["rb"] for r in v])) for w in ("avant", "apres")]}
                   for k, v in secs.items()}
json.dump(res, open(os.path.join(OUTD, "mesures.json"), "w"), indent=1, ensure_ascii=False)


def fr(x, k=1):
    return f"{x:.{k}f}".replace(".", ",").replace("-", "−")


L = ["## Mesures par plan (avant → après)\n",
     "Y' Rec.709 sur 0–255, toutes les images du plan. Sat. = saturation HSV moyenne. R−B = dominante (positif = chaud). "
     "Écrêtés = % de pixels avec un canal à 255 ou les trois à 0. #E4501C = % de surface à ΔE76 < 20 de la couleur interdite.\n",
     "| Plan | Y moy. | Y méd. | Noirs p1 | Blancs p99 | Sat. | R−B | Écrêtés % | #E4501C % |", "|---|---|---|---|---|---|---|---|---|"]
for r in res["plans"]:
    a, b = r["avant"], r["apres"]
    L.append(f'| {r["plan"]} | {fr(a["y_moy"])} → {fr(b["y_moy"])} | {fr(a["y_med"])} → {fr(b["y_med"])} | {fr(a["p1"])} → {fr(b["p1"])} | '
             f'{fr(a["p99"])} → {fr(b["p99"])} | {fr(a["sat"], 3)} → {fr(b["sat"], 3)} | {fr(a["rb"])} → {fr(b["rb"])} | '
             f'{fr(a["ecretes"], 2)} → {fr(b["ecretes"], 2)} | {fr(a["e4501c"], 2)} → {fr(b["e4501c"], 2)} |')
L.append("\n## Dispersion à l'intérieur des sections (écart type des moyennes de plans, avant → après)\n")
L.append("| Section | Plans | Luminance | Dominante R−B |")
L.append("|---|---|---|---|")
for k, v in res["sections"].items():
    L.append(f'| {k} | {v["n"]} | {fr(v["y_ecart_type"][0])} → {fr(v["y_ecart_type"][1])} | {fr(v["rb_ecart_type"][0])} → {fr(v["rb_ecart_type"][1])} |')
L.append("\n## Raccords (dernière image du plan sortant → première du plan entrant)\n")
L.append("| Raccord | Image | ΔY avant | ΔY après | Δ(R−B) avant | Δ(R−B) après |")
L.append("|---|---|---|---|---|---|")
for r in res["raccords"]:
    L.append(f'| {r["de"]} → {r["vers"]} | {r["image"]} | {fr(r["avant"]["dy"])} | {fr(r["apres"]["dy"])} | {fr(r["avant"]["drb"])} | {fr(r["apres"]["drb"])} |')
score = lambda d: abs(d["dy"]) + 0.5 * abs(d["drb"])
top = sorted(res["raccords"], key=lambda r: -score(r["apres"]))[:10]
L.append("\n**Les 10 raccords qui sautent encore le plus** (score |ΔY| + ½ |Δ(R−B)|, après) : " +
         " ; ".join(f'{r["de"]} → {r["vers"]} ({fr(score(r["apres"]))}, avant {fr(score(r["avant"]))})' for r in top) + ".")
ma = np.mean([score(r["avant"]) for r in res["raccords"]])
mb = np.mean([score(r["apres"]) for r in res["raccords"]])
L.append(f"\nScore moyen des 49 raccords : {fr(ma)} avant → {fr(mb)} après. "
         f"Écrêtés : au plus {fr(max(r['apres']['ecretes'] for r in res['plans']), 2)} % après (plan le plus touché : "
         f"{max(res['plans'], key=lambda r: r['apres']['ecretes'])['plan']}). Surface proche de #E4501C : au plus "
         f"{fr(max(r['apres']['e4501c'] for r in res['plans']), 2)} % après ({max(res['plans'], key=lambda r: r['apres']['e4501c'])['plan']}), "
         f"{fr(max(r['avant']['e4501c'] for r in res['plans']), 2)} % avant.")
open(os.path.join(OUTD, "mesures.md"), "w").write("\n".join(L) + "\n")
print("\n".join(L[-14:]))
if NO_SHEETS:
    sys.exit(0)


# ---- planches ----
def font(sz):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def label(img, txt, xy, sz=15):
    dr = ImageDraw.Draw(img)
    f = font(sz)
    bb = dr.textbbox(xy, txt, font=f)
    dr.rectangle((bb[0] - 3, bb[1] - 2, bb[2] + 3, bb[3] + 2), fill=(0, 0, 0))
    dr.text(xy, txt, font=f, fill=(255, 255, 255))


def save_jpeg(img, path, limit=400_000):
    for q in (90, 85, 80, 74, 68, 62, 56, 50, 44):
        img.save(path, "JPEG", quality=q, optimize=True)
        if os.path.getsize(path) <= limit:
            return q
    return q


mids = [(p["start"] + p["end"]) // 2 for p in plans]
sel = "+".join(f"eq(n\\,{f})" for f in mids)
FA = decode(AV, 1920, 1080, sel)
FB = decode(AP, 1920, 1080, sel)
idx = {p["plan"]: i for i, p in enumerate(plans)}

# avant / après par section
TW, TH = 400, 225
groups = []
for p in plans:
    if groups and groups[-1][0] == p["section"] and len(groups[-1][1]) < 8:
        groups[-1][1].append(p["plan"])
    else:
        groups.append((p["section"], [p["plan"]]))
# regroupe en planches de ≤ 8 plans
sheets, cur = [], []
for sec, pl in groups:
    if len(cur) + len(pl) > 8 and cur:
        sheets.append(cur)
        cur = []
    cur += [(sec, x) for x in pl]
if cur:
    sheets.append(cur)
for n, sh in enumerate(sheets, 1):
    img = Image.new("RGB", (2 * TW + 30, len(sh) * (TH + 26) + 40), (24, 24, 24))
    label(img, f"Étalonnage v4 — avant (ours v3, gauche) / après (ours v4, droite) — planche {n}/{len(sheets)}", (10, 8))
    for k, (sec, pl) in enumerate(sh):
        i = idx[pl]
        y0 = 36 + k * (TH + 26)
        img.paste(Image.fromarray(FA[i]).resize((TW, TH), Image.LANCZOS), (10, y0 + 22))
        img.paste(Image.fromarray(FB[i]).resize((TW, TH), Image.LANCZOS), (20 + TW, y0 + 22))
        ra = res["plans"][i]
        label(img, f'{pl} · {sec} · image {mids[i]} · Y {fr(ra["avant"]["y_moy"])} → {fr(ra["apres"]["y_moy"])} · R−B {fr(ra["avant"]["rb"])} → {fr(ra["apres"]["rb"])}', (10, y0 + 2), 13)
    save_jpeg(img, os.path.join(OUTD, f"avant-apres-{n}.jpg"))

# peaux de Léa : (centre x, centre y, côté) en pixels 1920×1080, sur l'image du milieu du plan
PEAUX = {"P06": (1015, 150, 300), "P11": (1150, 170, 320), "P16": (985, 590, 340), "P23": (825, 300, 220),
         "P28": (1080, 310, 300), "P29": (960, 250, 380), "P47": (765, 400, 260), "P48": (560, 420, 380)}
S = 230
img = Image.new("RGB", (len(PEAUX) * (S + 8) + 12, 2 * (S + 8) + 70), (24, 24, 24))
label(img, "Peaux de Léa — haut : avant (v3) ; bas : après (v4) ; image du milieu de chaque plan", (10, 8))
for k, (pl, (cx, cy, sz)) in enumerate(PEAUX.items()):
    i = idx[pl]
    box = (cx - sz // 2, cy - sz // 2, cx + sz // 2, cy + sz // 2)
    x0 = 10 + k * (S + 8)
    img.paste(Image.fromarray(FA[i]).crop(box).resize((S, S), Image.LANCZOS), (x0, 56))
    img.paste(Image.fromarray(FB[i]).crop(box).resize((S, S), Image.LANCZOS), (x0, 56 + S + 8))
    label(img, pl, (x0 + 4, 36), 14)
save_jpeg(img, os.path.join(OUTD, "peaux.jpg"))

# écrans de téléphone (après), (x0, y0, x1, y1)
TEL = {"P07": (760, 300, 1140, 1000), "P13": (870, 260, 1290, 1000), "P29": (1100, 520, 1330, 980),
       "P36": (860, 300, 1300, 1000), "P49": (780, 180, 1200, 1000), "P51": (450, 400, 680, 860)}
TH2 = 470
tiles = []
for pl, box in TEL.items():
    i = idx[pl]
    w, h = box[2] - box[0], box[3] - box[1]
    tw = int(TH2 * w / h)
    a = Image.fromarray(FA[i]).crop(box).resize((tw, TH2), Image.LANCZOS)
    b = Image.fromarray(FB[i]).crop(box).resize((tw, TH2), Image.LANCZOS)
    tiles.append((pl, a, b, tw))
tot = sum(t[3] * 2 + 18 for t in tiles) + 10
img = Image.new("RGB", (tot, TH2 + 70), (24, 24, 24))
label(img, "Écrans incrustés — pour chaque plan : avant (v3) | après (v4), agrandis", (10, 8))
x = 10
for pl, a, b, tw in tiles:
    img.paste(a, (x, 50)); img.paste(b, (x + tw + 4, 50))
    label(img, pl, (x + 4, 30), 14)
    x += 2 * tw + 18
save_jpeg(img, os.path.join(OUTD, "telephones.jpg"))

# P50 en grand
i = idx["P50"]
img = Image.new("RGB", (1920 // 2 * 2 + 30, 1080 // 2 + 50), (24, 24, 24))
img.paste(Image.fromarray(FA[i]).resize((960, 540), Image.LANCZOS), (10, 40))
img.paste(Image.fromarray(FB[i]).resize((960, 540), Image.LANCZOS), (20 + 960, 40))
label(img, f"P50 — avant (v3, gauche) / après (v4, droite), image {mids[i]}", (10, 10))
save_jpeg(img, os.path.join(OUTD, "p50.jpg"))
# raccords : les planches de coupes de controle-ours.py pour cette version, recopiées sous le nom raccords-N.jpg
import glob, shutil
for f in sorted(glob.glob(os.path.join(TRAILER, "qa/snapshots", f"ours-{M['version']}", "coupes-*.jpg"))):
    shutil.copy(f, os.path.join(OUTD, os.path.basename(f).replace("coupes-", "raccords-")))
print("planches →", os.path.relpath(OUTD, TRAILER), file=sys.stderr)
