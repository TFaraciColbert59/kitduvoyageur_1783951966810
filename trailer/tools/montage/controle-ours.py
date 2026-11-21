#!/usr/bin/env python3
"""Contrôle d'un ours rendu par tools/montage/build-ours.mjs.

    python3 tools/montage/controle-ours.py [qa/tmp/ours/manifeste.json]

Mesures (ffprobe, coupes détectées par différence d'images, images gelées, blackdetect, ebur128), planches
qa/snapshots/ours-<v>/coupes-N.jpg et film.jpg, puis qa/OURS-<V>.md. ffmpeg/ffprobe pris dans le PATH.
Chemins relatifs à trailer/.
"""
import json, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

TRAILER = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
man_path = os.path.join(TRAILER, sys.argv[1] if len(sys.argv) > 1 else "qa/tmp/ours/manifeste.json")
M = json.load(open(man_path))
grid = json.load(open(os.path.join(TRAILER, json.load(open(os.path.join(TRAILER, M["edl"])))["temps_musique"])))
OUT = os.path.join(TRAILER, M["sortie"])
V = M["version"]
SNAP = os.path.join(TRAILER, "qa/snapshots", f"ours-{V}")
os.makedirs(SNAP, exist_ok=True)
W, H = 320, 180
TOTAL = M["images_total"]
plans = M["plans"]
# v6 et suivantes (motion design) : les bandes du cadre 2,39:1 (138 px en haut et en bas, encre verte) ne doivent compter
# ni comme du noir ni dans les différences d'images : les mesures portent sur la fenêtre centrale 1920×804.
BANDES = bool(M.get("surcouches"))
CROP = "crop=1920:804:0:138," if BANDES else ""


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def font(sz):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


# ---- ffprobe ----
pr = json.loads(sh(["ffprobe", "-v", "error", "-count_frames", "-show_entries",
                    "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,duration,pix_fmt,sample_rate,bit_rate",
                    "-show_entries", "format=duration", "-of", "json", OUT]).stdout)
vs = next(s for s in pr["streams"] if s["codec_type"] == "video")
au = next(s for s in pr["streams"] if s["codec_type"] == "audio")
probe = {"images": int(vs["nb_read_frames"]), "cadence": vs["r_frame_rate"], "taille": f'{vs["width"]}×{vs["height"]}',
         "codec": vs["codec_name"], "pix_fmt": vs["pix_fmt"], "duree_video": float(vs["duration"]),
         "duree_son": float(au["duration"]), "son": f'{au["codec_name"]} {au["sample_rate"]} Hz {int(au.get("bit_rate", 0)) // 1000} kb/s',
         "duree_format": float(pr["format"]["duration"])}

# ---- images réduites ----
HM = 134 if BANDES else H  # fenêtre 1920×804 réduite sans déformation
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", OUT, "-vf", f"{CROP}scale={W}:{HM}:flags=area", "-f", "rawvideo",
                      "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, HM, W, 3)
if BANDES:  # images entières pour les planches
    raw2 = subprocess.run(["ffmpeg", "-v", "error", "-i", OUT, "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo",
                           "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    G = np.frombuffer(raw2, np.uint8).reshape(-1, H, W, 3)
else:
    G = F
n = F.shape[0]
Ff = F.astype(np.float32)
d = np.zeros(n)
d[1:] = np.abs(Ff[1:] - Ff[:-1]).mean(axis=(1, 2, 3))

expected = [p["start"] for p in plans[1:]]
start_of = {p["start"]: p for p in plans}
cut_rows = []
exact = 0
for i, c in enumerate(expected):
    lo, hi = max(1, c - 3), min(n - 1, c + 3)
    win = [f for f in range(lo, hi + 1)]
    best = max(win, key=lambda f: d[f])
    neigh = [d[f] for f in win if f != c]
    ratio = d[c] / (np.median(neigh) + 1e-6)
    ok = best == c and ratio >= 1.5
    exact += ok
    cut_rows.append({"cut": c, "de": plans[i]["plan"], "vers": plans[i + 1]["plan"], "diff": round(float(d[c]), 2),
                     "ratio": round(float(ratio), 1), "pic": best, "exacte": bool(ok)})

# coupes inattendues : pics forts hors des coupes prévues
unexpected = []
for f in range(2, n - 2):
    if f in expected:
        continue
    loc = np.median(np.r_[d[max(1, f - 4):f], d[f + 1:f + 5]])
    if d[f] > 12 and d[f] > 4 * loc:
        p = next(p for p in plans if p["start"] <= f < p["end"])
        unexpected.append({"image": f, "plan": p["plan"], "diff": round(float(d[f]), 1), "ratio": round(float(d[f] / (loc + 1e-6)), 1)})

# images gelées : différence quasi nulle entre deux images consécutives
frozen = {}
for p in plans:
    fr = [f for f in range(p["start"] + 1, p["end"]) if d[f] < 0.15]
    if fr:
        frozen[p["plan"]] = fr
cut_dupes = [r for r in cut_rows if r["diff"] < 0.5]

# ---- blackdetect / ebur128 ----
bd = subprocess.run(["ffmpeg", "-hide_banner", "-i", OUT, "-vf", f"{CROP}blackdetect=d=0.04:pix_th=0.10", "-an", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)", bd)
eb = subprocess.run(["ffmpeg", "-hide_banner", "-i", OUT, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
summ = eb[eb.rfind("Summary:"):]
lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
lra = float(re.search(r"LRA:\s+(-?[\d.]+) LU", summ).group(1))
tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))


# ---- planches ----
def label(img, txt, xy, sz=15):
    dr = ImageDraw.Draw(img)
    f = font(sz)
    x, y = xy
    bb = dr.textbbox((x, y), txt, font=f)
    dr.rectangle((bb[0] - 3, bb[1] - 2, bb[2] + 3, bb[3] + 2), fill=(0, 0, 0))
    dr.text((x, y), txt, font=f, fill=(255, 255, 255))


def save_jpeg(img, path, limit=400_000):
    for q in (88, 82, 76, 70, 64, 58, 50):
        img.save(path, "JPEG", quality=q, optimize=True)
        if os.path.getsize(path) <= limit:
            return q
    return q


PER = 12
CW, CH = 2 * W + 6, H + 26
sheets = []
for s in range(0, len(cut_rows), PER):
    rows = cut_rows[s:s + PER]
    cols = 2
    nr = (len(rows) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * CW + (cols + 1) * 12, nr * CH + (nr + 1) * 10 + 30), (24, 24, 24))
    label(sheet, f"Ours {V} — coupes {s + 1} à {s + len(rows)} sur {len(cut_rows)} (gauche : dernière image du plan sortant ; droite : première du plan entrant)", (12, 8), 15)
    for k, r in enumerate(rows):
        x0 = 12 + (k % cols) * (CW + 12)
        y0 = 36 + (k // cols) * (CH + 10)
        c = r["cut"]
        sheet.paste(Image.fromarray(G[c - 1]), (x0, y0 + 26))
        sheet.paste(Image.fromarray(G[c]), (x0 + W + 6, y0 + 26))
        mark = "" if r["exacte"] else "  ÉCART"
        label(sheet, f'{r["de"]} → {r["vers"]}   image {c - 1} | {c}{mark}', (x0, y0 + 4), 14)
    path = os.path.join(SNAP, f"coupes-{s // PER + 1}.jpg")
    q = save_jpeg(sheet, path)
    sheets.append((os.path.relpath(path, TRAILER), os.path.getsize(path), q))

bars = [b for b in grid["bars"] if b["frame"] < TOTAL][:34]
cols = 6
nr = (len(bars) + cols - 1) // cols
TW, TH = W, H
film = Image.new("RGB", (cols * TW + (cols + 1) * 8, nr * (TH + 24) + (nr + 1) * 8 + 30), (24, 24, 24))
label(film, f"Ours {V} — début de chaque mesure (temps fort) : mesure · temps · image · section · plan", (8, 8), 15)
for k, b in enumerate(bars):
    f = b["frame"]
    p = next(p for p in plans if p["start"] <= f < p["end"])
    beat_i = next(i for i, x in enumerate(grid["beats"]) if x["frame"] == f)
    x0 = 8 + (k % cols) * (TW + 8)
    y0 = 36 + (k // cols) * (TH + 24 + 8)
    film.paste(Image.fromarray(G[f]), (x0, y0 + 24))
    label(film, f'm{b["bar"]} · t{beat_i} · im {f} · {b["section"]} · {p["plan"]}', (x0, y0 + 3), 13)
fpath = os.path.join(SNAP, "film.jpg")
fq = save_jpeg(film, fpath)
sheets.append((os.path.relpath(fpath, TRAILER), os.path.getsize(fpath), fq))

# ---- rapport ----
res = {"probe": probe, "coupes_prevues": len(expected), "coupes_exactes": exact, "coupes": cut_rows,
       "coupes_inattendues": unexpected, "images_gelees": frozen, "coupes_doublees": cut_dupes,
       "noirs": blacks, "ebur128": {"I": lufs, "LRA": lra, "crete_dBTP": tp}, "planches": sheets}
json.dump(res, open(os.path.join(TRAILER, "qa/tmp/ours/controle.json"), "w"), indent=1, ensure_ascii=False, default=lambda o: o.item() if hasattr(o, "item") else str(o))


def fr(x, k=3):
    return f"{x:.{k}f}".replace(".", ",")


L = []
L.append(f"# Ours {V} — premier montage complet à 24 i/s\n")
L.append(f"Généré par `node tools/montage/build-ours.mjs {M['edl']}` puis `python3 tools/montage/controle-ours.py` "
         f"(ce fichier est réécrit à chaque contrôle). Montage de travail : "
         + ("étalonné (look commun `" + str((M.get('etalonnage') or {}).get('lut')) + "`, corrections plan par plan, grain ; voir `qa/ETALONNAGE-V4.md`), " if M.get("etalonnage") else "pas d'étalonnage, ")
         + f"son = `{M['musique']}` tel quel.\n")
L.append(f"- Film : `{M['sortie']}` · relecture avec repères : `{M['reperes']}` (non versionnés)")
L.append(f"- Planches : `qa/snapshots/ours-{V}/` ({', '.join(os.path.basename(s[0]) for s in sheets)})\n")
L.append("## Plans\n")
L.append("| Plan | Section | Images du film | Durée | Source | Images sources | Vitesse | Remarque |")
L.append("|---|---|---|---|---|---|---|---|")
for p in plans:
    isrc = "—" if not p["images_sources"] else f'{p["images_sources"][0]}–{p["images_sources"][1]}'
    vit = "1" if abs(p["vitesse_reelle"] - 1) < 1e-9 else f'×{fr(p["vitesse_reelle"])}'
    rem = " ; ".join(p["remarques"]) or ""
    if p["provisoire"]:
        rem = "**PROVISOIRE** — " + rem
    L.append(f'| {p["plan"]} | {p["section"]} | {p["start"]}–{p["end"] - 1} | {p["n"]} im · {fr(p["n"] / 24, 3)} s | `{p["source"]}` | {isrc} | {vit} | {rem} |')
prov = [p for p in plans if p["provisoire"]]
L.append("\n## Provisoire\n")
if prov:
    for p in prov:
        L.append(f'- **{p["plan"]}** : ' + " ; ".join(p["remarques"]))
else:
    L.append("- Rien.")
L.append("\n## Mesures\n")
L.append(f'- ffprobe : {probe["images"]} images comptées, {probe["cadence"]} i/s, {probe["taille"]}, {probe["codec"]} {probe["pix_fmt"]} ; '
         f'durée vidéo {fr(probe["duree_video"])} s, durée son {fr(probe["duree_son"])} s ({probe["son"]}), conteneur {fr(probe["duree_format"])} s.')
L.append(f"- Coupes : {exact} sur {len(expected)} détectées à l'image attendue (pic de différence entre images à ±3 images).")
for r in cut_rows:
    if not r["exacte"]:
        L.append(f'  - {r["de"]} → {r["vers"]} (image {r["cut"]}) : pic à l\'image {r["pic"]}, différence {fr(r["diff"], 1)}, rapport {fr(r["ratio"], 1)} au voisinage')
L.append(f"- Images doublées aux coupes (première image du plan = dernière du précédent) : {len(cut_dupes)}.")
if frozen:
    L.append("- Images gelées (deux images consécutives quasi identiques) à l'intérieur d'un plan : " +
             "; ".join(f"{k} ({len(v)} : {', '.join(map(str, v[:8]))}{'…' if len(v) > 8 else ''})" for k, v in frozen.items()) + ".")
else:
    L.append("- Images gelées à l'intérieur des plans : aucune.")
if unexpected:
    L.append("- Sauts francs à l'intérieur d'un plan (hors coupes prévues) : " +
             "; ".join(f'{u["plan"]} image {u["image"]} (diff {fr(u["diff"], 1)}, ×{fr(u["ratio"], 1)})' for u in unexpected) + ".")
else:
    L.append("- Sauts francs à l'intérieur des plans : aucun.")
L.append(("- Mesures d'image (différences, gel, noirs) sur la fenêtre centrale 1920×804 : les bandes 2,39:1 du motion design en sont exclues ; les planches montrent l'image entière.\n" if BANDES else "") + "- blackdetect (0,04 s, seuil 0,10) : " + ("aucune plage noire." if not blacks else
         "; ".join(f"{a}–{b} s ({c} s)" for a, b, c in blacks) + "."))
L.append(f"- ebur128 : {fr(lufs, 1)} LUFS intégré, LRA {fr(lra, 1)} LU, crête vraie {fr(tp, 1)} dBTP.")
L.append("- Planches : " + ", ".join(f"{os.path.basename(s[0])} {s[1] // 1000} Ko" for s in sheets) + ".")
md = os.path.join(TRAILER, "qa", f"OURS-{V.upper()}.md")
keep = ""
if os.path.exists(md):  # la section « Relecture » (écrite à la main) est conservée d'un contrôle à l'autre
    old = open(md).read()
    if "\n## Relecture" in old:
        keep = "\n" + old[old.index("\n## Relecture") + 1:]
open(md, "w").write("\n".join(L) + "\n" + keep)
print(json.dumps({k: v for k, v in res.items() if k != "coupes"}, indent=1, ensure_ascii=False, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
print("coupes (ratio le plus faible) :", sorted(((r["ratio"], r["de"], r["vers"], r["cut"]) for r in cut_rows))[:8])
