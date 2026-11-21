#!/usr/bin/env python3
"""Inventaire des vidéos Google Flow (Omni Flash 1.2) du trailer LKDV.

Lit les .mp4 de flow/clips/, les identifie par leur première image contre
assets/footage/*.png, les rattache aux fiches de flow/FEUILLE-DE-ROUTE.md,
puis écrit : copies exactes par plan (flow/clips/plans/), planches JPEG
(qa/snapshots/flow/), inventaire JSON (flow/inventaire.json) et rapport
(qa/FLOW-INVENTAIRE.md). Aucun fichier d'origine n'est modifié.

Tous les chemins par défaut sont relatifs au dossier trailer/ (deux niveaux
au-dessus de ce script). ffmpeg et ffprobe doivent être dans le PATH.

Usage : python3 tools/flow/inventaire.py [--trailer DIR] [--no-copy] [--no-sheets]
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections import deque
from datetime import datetime
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHONE_PLANS = {"P07", "P12", "P13", "P16", "P17", "P25", "P29", "P31", "P36", "P48", "P51"}
DEC_W, DEC_H = 960, 540        # décodage des images conservées
MOT_W, MOT_H = 160, 90         # décodage pour le mouvement
ID_W, ID_H = 64, 36            # comparaison d'identification
SHEET_LIMIT = 350_000          # octets
# Seuils indicatifs (écart moyen 0-255 entre images consécutives, 160x90)
FROZEN = 0.5
NEAR_FROZEN = 1.0
SLOWMO_MED = 1.5
SLOWMO_CV = 0.35
DUR_TOL = 0.25                 # s
UNMATCHED = 30                 # écart d'identification au-delà duquel rien n'est reconnu


def rel(p, base):
    return os.path.relpath(p, base)


# ---------------------------------------------------------------- feuille de route
def parse_roadmap(path):
    fiches = []
    cur = None
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        m = re.match(r"^### (P\d+(?: \+ P\d+)?) — (.+)$", line)
        if m:
            cur = {"fiche": m.group(1), "titre": m.group(2).strip(),
                   "plans": re.findall(r"P\d+", m.group(1))}
            fiches.append(cur)
            continue
        if cur and line.startswith("- [") and "**Durée :**" in line:
            img = re.search(r"\*\*Image(?: de début)? :\*\* `([^`]+)`", line)
            fin = re.search(r"\*\*Image de fin :\*\* `([^`]+)`", line)
            dur = re.search(r"\*\*Durée :\*\* (\d+(?:[.,]\d+)?) s", line)
            fic = re.search(r"\*\*Fichier :\*\* `([^`]+)`", line)
            cur["image"] = Path(img.group(1)).stem
            cur["image_fin"] = Path(fin.group(1)).stem if fin else None
            cur["duree_demandee"] = float(dur.group(1).replace(",", "."))
            cur["fichier_attendu"] = fic.group(1)
    return fiches


# ---------------------------------------------------------------- sondes
def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def frac(s):
    try:
        n, d = s.split("/")
        return float(Fraction(int(n), int(d))) if int(d) else 0.0
    except Exception:
        return 0.0


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
         "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = [s for s in j["streams"] if s["codec_type"] == "audio"]
    fmt = j["format"]
    return {
        "codec": v.get("codec_name"), "profil": v.get("profile"),
        "pix_fmt": v.get("pix_fmt"),
        "largeur": v.get("width"), "hauteur": v.get("height"),
        "r_frame_rate": v.get("r_frame_rate"), "avg_frame_rate": v.get("avg_frame_rate"),
        "cadence": round(frac(v.get("avg_frame_rate", "0/1")), 4),
        "images_comptees": int(v.get("nb_read_frames", 0) or 0),
        "images_entete": int(v.get("nb_frames", 0) or 0),
        "duree_video": round(float(v.get("duration", 0) or 0), 4),
        "duree_conteneur": round(float(fmt.get("duration", 0) or 0), 4),
        "debit_video_kbps": round(int(v.get("bit_rate", 0) or 0) / 1000),
        "debit_total_kbps": round(int(fmt.get("bit_rate", 0) or 0) / 1000),
        "son": ({"codec": a[0].get("codec_name"), "frequence": int(a[0].get("sample_rate", 0)),
                 "canaux": a[0].get("channels"),
                 "debit_kbps": round(int(a[0].get("bit_rate", 0) or 0) / 1000)} if a else None),
        "poids_octets": int(fmt.get("size", 0)),
    }


# ---------------------------------------------------------------- décodage
def decode(path, n_expected, keep_idx):
    """Décode toutes les images. Rend (mouvement gris 160x90 [N,H,W], dict idx->RGB 960x540)."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:v:0", "-fps_mode", "passthrough",
           "-vf", f"scale={DEC_W}:{DEC_H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    size = DEC_W * DEC_H * 3
    small, kept, i = [], {}, 0
    keep = set(keep_idx)
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        fr = np.frombuffer(buf, np.uint8).reshape(DEC_H, DEC_W, 3)
        if i in keep:
            kept[i] = fr.copy()
        # 960x540 -> 160x90 par moyenne de blocs 6x6
        g = fr.astype(np.float32).reshape(MOT_H, 6, MOT_W, 6, 3).mean(axis=(1, 3))
        small.append(g)
        i += 1
    p.wait()
    return np.stack(small), kept, i


def luma(rgb):
    rgb = rgb.astype(np.float32)
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def to_small(img_rgb, w, h):
    return np.asarray(Image.fromarray(img_rgb).resize((w, h), Image.BOX)).astype(np.float32)


def ncc(a, b):
    a = luma(a); b = luma(b)
    a = a - a.mean(); b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d else 0.0


# ---------------------------------------------------------------- écran vert
def green_mask(rgb):
    r, g, b = (rgb[..., k].astype(np.int16) for k in range(3))
    return (g > 100) & (g - r > 60) & (g - b > 60)


def largest_component(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    best, best_n = None, 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)]); seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; q.append((yy, xx))
        if len(pts) > best_n:
            best_n, best = len(pts), pts
    return best, best_n


def green_stats(rgb):
    """Mesure sur une image 960x540 (réduite à 480x270 pour la composante)."""
    m_full = green_mask(rgb)
    area = float(m_full.mean() * 100)
    m = m_full.reshape(270, 2, 480, 2).mean(axis=(1, 3)) >= 0.5
    pts, n = largest_component(m)
    if not pts or n < 4:
        return {"surface_pct": round(area, 3), "boite": None, "non_vert_dans_boite_pct": None,
                "composante_pct": 0.0}
    arr = np.array(pts)
    y0, x0 = arr.min(0); y1, x1 = arr.max(0)
    box = m[y0:y1 + 1, x0:x1 + 1]
    # boîte en coordonnées normalisées (0-1) de l'image
    return {"surface_pct": round(area, 3),
            "composante_pct": round(n / m.size * 100, 3),
            "boite": [round(x0 / 480, 4), round(y0 / 270, 4), round((x1 + 1) / 480, 4), round((y1 + 1) / 270, 4)],
            "non_vert_dans_boite_pct": round(float((~box).mean() * 100), 1)}


# ---------------------------------------------------------------- planches
def font(size):
    for f in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            pass
    return ImageFont.load_default()


def make_sheet(out, title_lines, top, grid, side_lines=None, gap=8):
    """top : 3 (image RGB, légende) en haut, puis panneau de texte side_lines ; grid : 12 (image RGB, légende)."""
    tw = 640; th = 360; lab = 30
    W = 4 * tw + 5 * gap
    sw, sh = tw, th
    title_h = 36 * len(title_lines) + gap
    H = title_h + gap + 4 * (th + lab + gap)
    im = Image.new("RGB", (W, H), (18, 18, 18))
    d = ImageDraw.Draw(im)
    ft, fl = font(28), font(22)
    for k, t in enumerate(title_lines):
        d.text((gap, gap + 36 * k), t, fill=(240, 240, 240), font=ft)
    y = title_h + gap
    for k, (img, cap) in enumerate(top):
        x = gap + k * (sw + gap)
        if img is not None:
            im.paste(Image.fromarray(img).resize((sw, sh), Image.LANCZOS), (x, y))
        d.text((x, y + sh + 3), cap, fill=(230, 200, 120), font=fl)
    x = gap + 3 * (sw + gap)
    for k, t in enumerate(side_lines or []):
        d.text((x + 10, y + 6 + 30 * k), t, fill=(210, 210, 210), font=fl)
    y += sh + lab + gap
    for k, (img, cap) in enumerate(grid):
        r, c = divmod(k, 4)
        x = gap + c * (tw + gap); yy = y + r * (th + lab + gap)
        im.paste(Image.fromarray(img).resize((tw, th), Image.LANCZOS), (x, yy))
        d.text((x, yy + th + 3), cap, fill=(200, 200, 200), font=fl)
    for q in range(85, 19, -5):
        im.save(out, "JPEG", quality=q, optimize=True, progressive=True)
        if out.stat().st_size <= SHEET_LIMIT:
            return q, out.stat().st_size
    return q, out.stat().st_size


def make_compare(out, imgs, caps):
    w, h = 480, 270
    im = Image.new("RGB", (len(imgs) * (w + 6) + 6, h + 40), (18, 18, 18))
    d = ImageDraw.Draw(im); f = font(18)
    for k, (a, c) in enumerate(zip(imgs, caps)):
        im.paste(Image.fromarray(a).resize((w, h), Image.LANCZOS), (6 + k * (w + 6), 6))
        d.text((6 + k * (w + 6), h + 12), c, fill=(230, 230, 230), font=f)
    im.save(out, "JPEG", quality=80)


# ---------------------------------------------------------------- principal
def main():
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--trailer", default=str(here.parent.parent))
    ap.add_argument("--clips", default="flow/clips")
    ap.add_argument("--footage", default="assets/footage")
    ap.add_argument("--roadmap", default="flow/FEUILLE-DE-ROUTE.md")
    ap.add_argument("--tmp", default="qa/tmp/flow")
    ap.add_argument("--plans", default="flow/clips/plans")
    ap.add_argument("--snapshots", default="qa/snapshots/flow")
    ap.add_argument("--json", default="flow/inventaire.json")
    ap.add_argument("--affectations", default="tools/flow/affectations.json")
    ap.add_argument("--report", default="qa/FLOW-INVENTAIRE.md")
    ap.add_argument("--no-copy", action="store_true")
    ap.add_argument("--no-sheets", action="store_true")
    args = ap.parse_args()

    T = Path(args.trailer).resolve()
    clips_dir = T / args.clips; foot_dir = T / args.footage
    tmp = T / args.tmp; plans_dir = T / args.plans; snap = T / args.snapshots
    for d in (tmp, tmp / "compare", tmp / "frames"):
        d.mkdir(parents=True, exist_ok=True)

    fiches = parse_roadmap(T / args.roadmap)
    by_image = {f["image"]: f for f in fiches}

    # sources
    sources = {}
    for p in sorted(foot_dir.glob("*.png")):
        a = np.asarray(Image.open(p).convert("RGB"))
        sources[p.stem] = {
            "path": p, "full": a,
            "id": to_small(a, ID_W, ID_H),
            "mot": to_small(a, MOT_W, MOT_H),
            "dec": np.asarray(Image.fromarray(a).resize((DEC_W, DEC_H), Image.BOX)),
        }
    print(f"{len(sources)} images sources, {len(fiches)} fiches", file=sys.stderr)

    files = sorted(clips_dir.glob("*.mp4"))
    entries = []
    for p in files:
        st = p.stat()
        e = {"fichier": p.name, "chemin": rel(p, T), "md5": md5(p),
             "date_modif": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
             "date_creation": datetime.fromtimestamp(getattr(st, "st_birthtime", st.st_mtime)).isoformat(timespec="seconds"),
             "_mtime": st.st_mtime, "_btime": getattr(st, "st_birthtime", st.st_mtime)}
        e.update(probe(p))
        entries.append(e)
        print("sonde", p.name, file=sys.stderr)

    # doublons exacts
    groups = {}
    for e in entries:
        groups.setdefault(e["md5"], []).append(e)
    for g in groups.values():
        g.sort(key=lambda e: (" (1)" in e["fichier"], e["_mtime"], e["fichier"]))
        g[0]["doublon_de"] = None
        for e in g[1:]:
            e["doublon_de"] = g[0]["fichier"]

    uniques = [e for e in entries if e["doublon_de"] is None]

    # décodage + mesures par fichier unique
    for e in uniques:
        n = e["images_comptees"]
        grid_idx = sorted(set(int(round(x)) for x in np.linspace(0, n - 1, 12)))
        keep = set(grid_idx) | {0, n - 1}
        small, kept, nd = decode(clips_dir / e["fichier"], n, keep)
        e["images_decodees"] = nd
        last = nd - 1
        if last not in kept:  # sécurité si le compte diffère
            kept[last] = None
        first = kept[0]
        lastf = kept.get(last)
        if lastf is None:
            lastf = np.clip(np.repeat(np.repeat(small[-1], 6, 0), 6, 1), 0, 255).astype(np.uint8)
        e["_first"], e["_last"], e["_kept"], e["_grid"] = first, lastf, kept, [i for i in grid_idx if i < nd]

        # identification
        f_id = to_small(first, ID_W, ID_H)
        scores = []
        for k, s in sources.items():
            mad = float(np.abs(f_id - s["id"]).mean())
            scores.append((mad, ncc(f_id, s["id"]), k))
        scores.sort()
        best, second = scores[0], scores[1]
        ncc_best = max(scores, key=lambda t: t[1])
        e["identification"] = {
            "image": best[2], "ecart": round(best[0], 2), "ncc": round(best[1], 4),
            "deuxieme": second[2], "ecart_deuxieme": round(second[0], 2), "ncc_deuxieme": round(second[1], 4),
            "marge": round(second[0] - best[0], 2),
            "meilleur_ncc": ncc_best[2], "accord_criteres": ncc_best[2] == best[2],
            "top5": [{"image": k, "ecart": round(m, 2), "ncc": round(c, 4)} for m, c, k in scores[:5]],
        }
        # dernière image : plus proche source (utile pour P46)
        l_id = to_small(lastf, ID_W, ID_H)
        ls = sorted((float(np.abs(l_id - s["id"]).mean()), k) for k, s in sources.items())
        e["derniere_image_proche"] = {"image": ls[0][1], "ecart": round(ls[0][0], 2)}

        # mouvement
        gray = luma(small)
        diffs = np.abs(np.diff(gray, axis=0)).mean(axis=(1, 2)) if len(gray) > 1 else np.zeros(1)
        bins = np.array_split(diffs, 24)
        med = float(np.median(diffs)); cv = float(diffs.std() / diffs.mean()) if diffs.mean() else 0
        e["mouvement"] = {"min": round(float(diffs.min()), 3), "mediane": round(med, 3),
                          "max": round(float(diffs.max()), 3), "moyenne": round(float(diffs.mean()), 3),
                          "cv": round(cv, 3),
                          "courbe24": [round(float(b.mean()), 3) for b in bins]}
        src = sources[best[2]]
        f_m = to_small(first, MOT_W, MOT_H); l_m = to_small(lastf, MOT_W, MOT_H)
        e["fidelite_depart"] = round(float(np.abs(f_m - src["mot"]).mean()), 2)
        e["derive_premiere_derniere"] = round(float(np.abs(f_m - l_m).mean()), 2)
        e["luminance"] = {"premiere": round(float(luma(first).mean()), 1),
                          "derniere": round(float(luma(lastf).mean()), 1)}
        e["luminance"]["saut"] = round(e["luminance"]["derniere"] - e["luminance"]["premiere"], 1)
        print("mesure", e["fichier"], best[2], round(best[0], 2), file=sys.stderr)

    # rattachement aux fiches et prises (affectations manuelles prioritaires)
    aff_path = T / args.affectations
    aff = json.loads(aff_path.read_text(encoding="utf-8")) if aff_path.exists() else {}
    for e in uniques:
        a = aff.get(e["fichier"], {})
        idn = e["identification"]
        if a.get("image"):
            img = a["image"]
            e["identification_manuelle"] = True
            e["source"] = img
        elif idn["ecart"] > UNMATCHED:
            img = None
            e["source"] = None
        else:
            img = idn["image"]
            e["source"] = img
        e["note"] = a.get("note")
        if img and img != idn["image"]:
            f_m = to_small(e["_first"], MOT_W, MOT_H)
            e["fidelite_depart"] = round(float(np.abs(f_m - sources[img]["mot"]).mean()), 2)
        f = by_image.get(img)
        e["fiche"] = f["fiche"] if f else None
        e["plan"] = f["plans"][0] if f else None
    takes = {}
    for e in uniques:
        if e["plan"]:
            takes.setdefault(e["plan"], []).append(e)
    for plan, lst in takes.items():
        lst.sort(key=lambda e: (e["_mtime"], e["_btime"], e["fichier"]))
        for k, e in enumerate(lst, 1):
            e["prise"] = k
            num = plan[1:].zfill(2)
            e["nom_plan"] = f"p{num}" + ("" if k == 1 else f"-{k}")
    for e in uniques:
        e.setdefault("prise", None); e.setdefault("nom_plan", None)

    # écran vert
    for e in uniques:
        if e["plan"] not in PHONE_PLANS:
            continue
        src = sources[e["source"]]
        ref = green_stats(src["dec"])
        samples = []
        for i in e["_grid"]:
            st = green_stats(e["_kept"][i]); st["image"] = i
            samples.append(st)
        areas = [s["surface_pct"] for s in samples]
        alerts = []
        ref_a = ref["surface_pct"]
        if min(areas) < 0.25 * ref_a:
            alerts.append(f"vert presque disparu (min {min(areas):.2f} % contre {ref_a:.2f} % à la source)")
        if max(areas) > 1.6 * ref_a:
            alerts.append(f"surface verte gonflée (max {max(areas):.2f} %)")
        if max(areas) > 0 and (max(areas) - min(areas)) / max(max(areas), 1e-6) > 0.5:
            alerts.append(f"surface instable ({min(areas):.2f}–{max(areas):.2f} %)")
        fills = [s["non_vert_dans_boite_pct"] for s in samples if s["non_vert_dans_boite_pct"] is not None]
        ref_fill = ref["non_vert_dans_boite_pct"] or 0
        if fills and max(fills) > ref_fill + 25:
            alerts.append(f"boîte remplie d'autre chose (jusqu'à {max(fills):.0f} % non vert, source {ref_fill:.0f} %)")
        e["ecran_vert"] = {"source": ref, "echantillons": samples, "alertes": alerts}

    # alertes
    fiche_by_plan = {f["plans"][0]: f for f in fiches}
    for e in entries:
        al = []
        if e["cadence"] != 24 or e["r_frame_rate"] != "24/1":
            al.append(f"cadence {e['r_frame_rate']} (moy. {e['avg_frame_rate']})")
        if (e["largeur"], e["hauteur"]) != (1920, 1080):
            al.append(f"taille {e['largeur']}×{e['hauteur']}")
        if e["doublon_de"] is None:
            f = fiche_by_plan.get(e["plan"])
            if f and abs(e["duree_video"] - f["duree_demandee"]) > DUR_TOL:
                al.append(f"durée {e['duree_video']:.2f} s pour {f['duree_demandee']:.0f} s demandées")
            mv = e["mouvement"]
            if mv["mediane"] < FROZEN:
                al.append("figée")
            elif mv["mediane"] < NEAR_FROZEN:
                al.append("quasi figée")
            elif mv["mediane"] < SLOWMO_MED and mv["cv"] < SLOWMO_CV:
                al.append("ralenti probable (mouvement faible et constant)")
            if e.get("ecran_vert", {}).get("alertes"):
                al.append("écran vert : " + " ; ".join(e["ecran_vert"]["alertes"]))
            idn = e["identification"]
            if e.get("identification_manuelle"):
                al.append(f"identification manuelle ({e['source']})")
            elif e["source"] is None:
                al.append(f"aucune image source reconnue (plus proche {idn['image']}, écart {idn['ecart']})")
            elif idn["marge"] < 5 or not idn["accord_criteres"] or idn["ecart"] > 10:
                al.append(f"identification à vérifier (écart {idn['ecart']}, marge {idn['marge']})")
            if e.get("note"):
                al.append(e["note"])
            if f and f.get("image_fin"):
                dl = e["derniere_image_proche"]
                if dl["image"] != f["image_fin"]:
                    al.append(f"dernière image proche de {dl['image']} ({dl['ecart']}) et non de {f['image_fin']}")
                else:
                    e["fin_conforme"] = f"dernière image = {dl['image']} (écart {dl['ecart']})"
        e["alertes"] = al

    # copies exactes
    if not args.no_copy:
        plans_dir.mkdir(parents=True, exist_ok=True)
        for e in uniques:
            if not e["nom_plan"]:
                continue
            dst = plans_dir / f"{e['nom_plan']}.mp4"
            if dst.exists() and md5(dst) == e["md5"]:
                pass
            else:
                shutil.copy2(clips_dir / e["fichier"], dst)
            assert md5(dst) == e["md5"], dst
            e["copie"] = rel(dst, T)

    # planches + comparaisons
    snap.mkdir(parents=True, exist_ok=True)
    for e in uniques:
        idn = e["identification"]
        src_name = e["source"] or idn["image"]
        src = sources[src_name]
        sec = sources[idn["deuxieme"]]
        tag = e["nom_plan"] or ("hors-" + Path(e["fichier"]).stem[:40])
        make_compare(tmp / "compare" / f"{tag}.jpg",
                     [src["dec"], e["_first"], sec["dec"]],
                     [f"source {src_name}", f"1re image {e['fichier'][:38]}",
                      f"2e {idn['deuxieme']} ({idn['ecart_deuxieme']})"])
        if args.no_sheets:
            continue
        fps = e["cadence"] or 24
        n = e["images_decodees"]
        title = [f"{(e['fiche'] or 'hors feuille')}  ·  {tag}  ·  prise {e['prise'] or '-'}  ·  {e['fichier']}",
                 f"{e['duree_video']:.3f} s  ·  {e['r_frame_rate']} i/s (moy. {e['avg_frame_rate']})  ·  {n} images  ·  "
                 f"{e['largeur']}×{e['hauteur']}  ·  source {src_name}"
                 f"{' (manuelle)' if e.get('identification_manuelle') else ''}  ·  id auto {idn['image']} ({idn['ecart']})"
                 f"  ·  mouvement méd. {e['mouvement']['mediane']}"]
        top = [(src["dec"], f"source {src_name}.png"),
               (e["_first"], f"première image · n°0 · 0,000 s"),
               (e["_last"], f"dernière image · n°{n - 1} · {(n - 1) / fps:.3f} s")]
        grid = [(e["_kept"][i], f"n°{i} · {i / fps:.3f} s") for i in e["_grid"]]
        while len(grid) < 12:
            grid.append((np.zeros((DEC_H, DEC_W, 3), np.uint8), "-"))
        mv = e["mouvement"]
        side = [f"mouvement : min {mv['min']} · méd. {mv['mediane']} · max {mv['max']}",
                f"fidélité au départ : {e['fidelite_depart']}",
                f"dérive 1re/dernière : {e['derive_premiere_derniere']}",
                f"luminance : {e['luminance']['premiere']} -> {e['luminance']['derniere']}",
                f"son : {'oui' if e['son'] else 'non'} · {e['debit_video_kbps']} kb/s",
                f"date fichier : {e['date_modif'].replace('T', ' ')}"]
        g = e.get("ecran_vert")
        if g:
            a = [s["surface_pct"] for s in g["echantillons"]]
            side.append(f"vert : source {g['source']['surface_pct']} % · vidéo {min(a)}–{max(a)} %")
        for a in e["alertes"]:
            side.append("! " + (a if len(a) <= 52 else a[:50] + "…"))
        q, size = make_sheet(snap / f"{tag}.jpg", title, top, grid, side[:11])
        e["planche"] = {"chemin": rel(snap / f"{tag}.jpg", T), "qualite_jpeg": q, "octets": size}

    # JSON
    covered = {e["plan"] for e in uniques if e["plan"]}
    missing = [f for f in fiches if f["plans"][0] not in covered]
    extra = [e for e in uniques if not e["plan"]]
    out = {
        "genere_le": datetime.now().isoformat(timespec="seconds"),
        "script": "tools/flow/inventaire.py",
        "seuils": {"fige": FROZEN, "quasi_fige": NEAR_FROZEN, "ralenti_mediane": SLOWMO_MED,
                   "ralenti_cv": SLOWMO_CV, "tolerance_duree_s": DUR_TOL,
                   "unite_ecarts": "écart absolu moyen 0-255 (RGB), images réduites à 160x90 (mouvement, fidélité, dérive) ou 64x36 (identification)",
                   "vert": "g>100, g-r>60, g-b>60 sur 960x540 ; boîte = plus grande composante sur 480x270, coordonnées 0-1"},
        "dossiers": {"clips": args.clips, "sources": args.footage, "copies": args.plans, "planches": args.snapshots},
        "resume": {"fichiers": len(entries), "prises_uniques": len(uniques),
                   "fiches": len(fiches), "fiches_couvertes": len(fiches) - len(missing),
                   "manquants": [f["fiche"] for f in missing],
                   "en_trop": [e["fichier"] for e in extra],
                   "doublons": [{"fichier": e["fichier"], "identique_a": e["doublon_de"]} for e in entries if e["doublon_de"]]},
        "fiches": fiches,
        "fichiers": [{k: v for k, v in e.items() if not k.startswith("_")} for e in entries],
    }
    (T / args.json).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("JSON écrit", T / args.json, file=sys.stderr)
    write_report(T / args.report, out, fiches, entries, uniques, missing, extra, args)
    print("rapport écrit", T / args.report, file=sys.stderr)


def write_report(path, out, fiches, entries, uniques, missing, extra, args):
    fiche_by_plan = {f["plans"][0]: f for f in fiches}
    R = out["resume"]
    L = ["# Inventaire des vidéos Flow (Omni Flash 1.2)", "",
         f"Généré par `tools/flow/inventaire.py` le {out['genere_le']} à partir de `{args.clips}/` "
         f"({R['fichiers']} fichiers). Mesures complètes : `{args.json}`. "
         f"Planches : `{args.snapshots}/pNN.jpg`. Copies exactes par plan : `{args.plans}/`.", "",
         f"**{R['fichiers']} fichiers, {R['prises_uniques']} prises uniques, "
         f"{R['fiches_couvertes']} fiches couvertes sur {R['fiches']}.**", "",
         "Écarts : moyenne des écarts absolus RGB (0-255). Identification sur 64×36 (deuxième critère : "
         "corrélation normalisée de la luminance) ; mouvement, fidélité et dérive sur 160×90. "
         f"Seuils indicatifs : figée si mouvement médian < {FROZEN}, quasi figée < {NEAR_FROZEN}, "
         f"ralenti probable si < {SLOWMO_MED} avec variation faible (cv < {SLOWMO_CV}).", "",
         "## Tableau par plan", "",
         "| Plan | Fichier d'origine | Prise | Durée (demandée) | Cadence | Images | Taille | Source · écart (2e · marge) | Mouv. méd. | Alertes |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    order = sorted(uniques, key=lambda e: (int(e["plan"][1:]) if e["plan"] else 999, e["prise"] or 0, e["fichier"]))
    for e in order:
        f = fiche_by_plan.get(e["plan"])
        idn = e["identification"]
        src = e["source"] or "—"
        idtxt = (f"{src} (manuelle ; auto {idn['image']} {idn['ecart']})" if e.get("identification_manuelle")
                 else f"{src} · {idn['ecart']} ({idn['deuxieme']} {idn['ecart_deuxieme']} · {idn['marge']})")
        al = [a for a in e["alertes"]]
        L.append("| {} | `{}` | {} | {:.2f} s ({}) | {} | {} | {}×{} | {} | {} | {} |".format(
            (f["fiche"] if f else "hors feuille"), e["fichier"],
            (e["nom_plan"] or "—"), e["duree_video"], (f"{f['duree_demandee']:.0f} s" if f else "—"),
            e["r_frame_rate"], e["images_comptees"], e["largeur"], e["hauteur"], idtxt,
            e["mouvement"]["mediane"], "<br>".join(al) or "—"))
    L += ["", "## Plans manquants", ""]
    L += [f"- **{f['fiche']}** — {f['titre']} (`{f['image']}.png`, {f['duree_demandee']:.0f} s, `{f['fichier_attendu']}`)" for f in missing] or ["- aucun"]
    L += ["", "## Fichiers en trop (aucune fiche)", ""]
    L += [f"- `{e['fichier']}` (plus proche : {e['identification']['image']}, écart {e['identification']['ecart']})" for e in extra] or ["- aucun"]
    L += ["", "## Doublons exacts (même md5, pas de copie)", ""]
    L += [f"- `{e['fichier']}` = `{e['doublon_de']}` (md5 {e['md5']})" for e in entries if e["doublon_de"]] or ["- aucun"]
    L += ["", "## Plusieurs prises", ""]
    multi = {}
    for e in uniques:
        if e["plan"]:
            multi.setdefault(e["plan"], []).append(e)
    for p, lst in sorted(multi.items(), key=lambda kv: int(kv[0][1:])):
        if len(lst) > 1:
            L.append(f"- **{p}** : " + " ; ".join(f"{e['nom_plan']} = `{e['fichier']}` ({e['date_modif'][11:]}, {e['duree_video']:.2f} s)"
                                               for e in sorted(lst, key=lambda e: e["prise"])))
    L += ["", "## Alertes techniques", ""]

    def section(title, pred):
        rows = [e for e in order if pred(e)]
        L.append(f"**{title}** ({len(rows)})")
        L.append("")
        L.extend(f"- {e['nom_plan'] or e['fichier']} — `{e['fichier']}`" + (f" : {pred(e)}" if isinstance(pred(e), str) else "") for e in rows)
        if not rows:
            L.append("- aucune")
        L.append("")

    section("Cadence ≠ 24 i/s", lambda e: e["r_frame_rate"] != "24/1" or e["avg_frame_rate"] != "24/1")
    section("Taille ≠ 1920×1080", lambda e: (e["largeur"], e["hauteur"]) != (1920, 1080) and f"{e['largeur']}×{e['hauteur']}")
    section("Durée ≠ durée demandée (tolérance ±0,25 s)",
            lambda e: e["plan"] and abs(e["duree_video"] - fiche_by_plan[e["plan"]]["duree_demandee"]) > DUR_TOL
            and f"{e['duree_video']:.2f} s pour {fiche_by_plan[e['plan']]['duree_demandee']:.0f} s")
    section("Figées, quasi figées, ralentis probables",
            lambda e: next((a for a in e["alertes"] if "fig" in a or "ralenti" in a), False)
            and f"{next(a for a in e['alertes'] if 'fig' in a or 'ralenti' in a)} (médiane {e['mouvement']['mediane']}, cv {e['mouvement']['cv']})")
    section("Écrans verts abîmés", lambda e: bool(e.get("ecran_vert", {}).get("alertes")) and " ; ".join(e["ecran_vert"]["alertes"]))
    L += ["## Écrans verts (12 images réparties)", "",
          "| Plan | Source : surface % · non vert dans la boîte % | Vidéo : surface % min–max | Non vert dans la boîte % max | Alertes |",
          "|---|---|---|---|---|"]
    for e in order:
        g = e.get("ecran_vert")
        if not g:
            continue
        a = [s["surface_pct"] for s in g["echantillons"]]
        nv = [s["non_vert_dans_boite_pct"] for s in g["echantillons"] if s["non_vert_dans_boite_pct"] is not None]
        L.append(f"| {e['nom_plan']} | {g['source']['surface_pct']} · {g['source']['non_vert_dans_boite_pct']} | "
                 f"{min(a)}–{max(a)} | {max(nv) if nv else '—'} | {' ; '.join(g['alertes']) or '—'} |")
    aff_path = Path(args.trailer).resolve() / args.affectations
    vv = json.loads(aff_path.read_text(encoding="utf-8")).get("_verifications_visuelles", []) if aff_path.exists() else []
    if vv:
        L += ["", "## Vérifications à l'œil", ""] + [f"- {v}" for v in vv]
    L += ["", "## Son", "",
          "Toutes les prises avec piste audio : " + ", ".join(sorted({f"{e['son']['codec']} {e['son']['frequence']} Hz {e['son']['canaux']} canaux" for e in uniques if e['son']}))
          + f" ({sum(1 for e in uniques if e['son'])}/{len(uniques)} prises).", ""]
    path.write_text("\n".join(L) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
