#!/usr/bin/env python3
"""Preuves et mesures de l'incrustation vidéo (après tools/incrustation/incruste.py).

    python3 tools/incrustation/preuves.py [p29.mp4 …]

Par plan monté (champ « plans » de plans.json) : planche avant/après de 6 images (avant-apres), agrandissement du
téléphone à pleine résolution sur 3 images début/geste/fin (zoom), bande serrée une image sur 2 autour du geste
(bande). JPEG ≤ 400 Ko dans qa/snapshots/incrustation-video/. Mesures (tools/incrustation/suivi/mesures.json) :
déplacement des coins lissés d'une image à la suivante (moyen, max) et tremblement (dérivée seconde, moyenne et
max), vert restant après incrustation (vert pur strict dans l'écran élargi de 40 px ; score de vert > moitié du niveau dans l'écran), écart
source/sortie hors de la zone du téléphone (écran suivi élargi de 30 px) sur les images montées, et hors plages.
"""
import json, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import incruste as I  # noqa: E402

SNAP = os.path.join(I.TRAILER, "qa/snapshots/incrustation-video")
os.makedirs(SNAP, exist_ok=True)
GESTE = {"P07": 43, "P09": 81, "P12": 31, "P13": 30, "P15": 103, "P16": 24, "P17": 26, "P25": 19, "P29": 30,
         "P31": 55, "P36": 6, "P48": 50, "P49": 29, "P51": 28}


def font(sz):
    for f in ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def label(im, txt, sz=22):
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 12 + sz * 0.55 * len(txt), sz + 10], fill=(0, 0, 0))
    d.text((6, 4), txt, fill=(255, 255, 255), font=font(sz))
    return im


def save_jpg(im, path, maxkb=400):
    q = 88
    while True:
        im.save(path, quality=q)
        if os.path.getsize(path) <= maxkb * 1024 or q <= 40:
            return
        q -= 6


def plan_ranges(cfg):
    out = []
    for p in cfg["plans"]:
        m = re.match(r"(P\d+) \((\d+)–(\d+)\)", p)
        out.append((m.group(1), int(m.group(2)), int(m.group(3))))
    return out


def phone_box(quads, frames, pad=40, aspect=None):
    Q = np.concatenate([quads[f] for f in frames])
    x0, y0 = Q.min(0) - pad
    x1, y1 = Q.max(0) + pad
    return (int(max(0, x0)), int(max(0, y0)), int(min(I.W, x1)), int(min(I.H, y1)))


def run(name):
    cfg = I.CFG[name]
    data = json.load(open(os.path.join(I.SUIVI, name.replace(".mp4", ".json"))))
    sm = {int(k): np.array(v["lisse"]) for k, v in data["images"].items()}
    gl = {int(k): v["niveau_vert"] for k, v in data["images"].items()}
    want = I.frames_in(cfg)
    keep = lambda f: f in want or f % 3 == 0
    src = {f: im for f, im in enumerate(I.read_frames(os.path.join(I.SRC_DIR, name))) if keep(f)}
    out = {f: im for f, im in enumerate(I.read_frames(os.path.join(I.OUT_DIR, name))) if keep(f)}
    ns, no = I.probe_frames(os.path.join(I.SRC_DIR, name)), I.probe_frames(os.path.join(I.OUT_DIR, name))
    assert ns == no, (ns, no)
    res = {"source": name, "images_source": ns, "images_sortie": no, "plans": {}}
    # hors plages : différence (réencodage seul)
    hors = [f for f in src if f not in want]
    if hors:
        dd = [np.abs(src[f].astype(np.int16) - out[f].astype(np.int16)) for f in hors]
        res["hors_plages"] = {"images": len(hors), "ecart_moyen": round(float(np.mean([d.mean() for d in dd])), 3),
                              "ecart_max": int(max(d.max() for d in dd))}
    for plan, a, b in plan_ranges(cfg):
        fr = list(range(a, b + 1))
        C = np.array([sm[f] for f in fr])
        d1 = np.linalg.norm(np.diff(C, axis=0), axis=2)
        d2 = np.linalg.norm(np.diff(C, n=2, axis=0), axis=2)
        Craw = np.array([data["images"][str(f)]["brut"] for f in fr])
        resid = np.linalg.norm(Craw - C, axis=2)
        strict, loose, outside, outside_max, zone_px = [], [], [], [], []
        for f in fr:
            q = sm[f]
            box = (0, 0, I.W, I.H)
            if not cfg.get("bas_impose"):
                inner = I.polymask(q, box, grow=-2.0) > 0.5
            else:  # P17 : seulement la partie visible
                inner = I.polymask(q, box, grow=-2.0) > 0.5
            o = out[f].astype(np.int16)
            S = o[..., 1] - np.maximum(o[..., 0], o[..., 2])
            pure = (o[..., 1] > o[..., 0] + 90) & (o[..., 1] > o[..., 2] + 90) & (o[..., 1] > 180)
            phone = I.polymask(q, box, grow=40.0) > 0  # téléphone entier : attrape aussi un écran mal posé
            strict.append(int((pure & phone).sum()))
            loose.append(float(((S > 0.5 * gl[f]) & inner).sum() / max(1, inner.sum())))
            zone = I.polymask(q, box, grow=30.0) > 0
            dif = np.abs(src[f].astype(np.int16) - out[f].astype(np.int16)).max(2)
            outside.append(float(dif[~zone].mean()))
            outside_max.append(int(np.percentile(dif[~zone], 99.9)))
            zone_px.append(int(zone.sum()))
        res["plans"][plan] = {
            "images": [a, b],
            "deplacement_coins_px": {"moyen": round(float(d1.mean()), 2), "max": round(float(d1.max()), 2)},
            "tremblement_px": {"moyen": round(float(d2.mean()), 3), "max": round(float(d2.max()), 3)},
            "ecart_brut_lisse_px": {"moyen": round(float(resid.mean()), 2), "max": round(float(resid.max()), 2)},
            "vert_pur_restant_px": {"total": int(sum(strict)), "max_image": int(max(strict))},
            "score_vert_restant_part": round(float(max(loose)), 5),
            "hors_zone": {"ecart_moyen": round(float(np.mean(outside)), 3), "p999_max": int(max(outside_max))},
        }
        P = plan.lower()
        # planche avant / après (6 images)
        six = [int(round(a + (b - a) * k / 5)) for k in range(6)]
        cw, ch = 480, 270
        sheet = Image.new("RGB", (cw * 6, ch * 2 + 4), (20, 20, 20))
        for k, f in enumerate(six):
            sheet.paste(label(Image.fromarray(src[f]).resize((cw, ch), Image.LANCZOS), f"{plan} n°{f} avant", 18), (k * cw, 0))
            sheet.paste(label(Image.fromarray(out[f]).resize((cw, ch), Image.LANCZOS), f"n°{f} après", 18), (k * cw, ch + 4))
        save_jpg(sheet, os.path.join(SNAP, f"{P}-avant-apres.jpg"))
        # agrandissement : début, geste, fin
        g = min(b, max(a, GESTE.get(plan, (a + b) // 2)))
        trio = [a, g, b]
        box = phone_box(sm, trio)
        crops = [label(Image.fromarray(out[f][box[1]:box[3], box[0]:box[2]]), f"{plan} n°{f}") for f in trio]
        hh = crops[0].height
        if hh > 1000:
            crops = [c.resize((round(c.width * 1000 / hh), 1000), Image.LANCZOS) for c in crops]
        zz = Image.new("RGB", (sum(c.width for c in crops) + 8, crops[0].height), (20, 20, 20))
        x = 0
        for c in crops:
            zz.paste(c, (x, 0))
            x += c.width + 4
        save_jpg(zz, os.path.join(SNAP, f"{P}-zoom.jpg"))
        # bande serrée (une image sur 2 autour du geste)
        bf = [f for f in range(g - 8, g + 9, 2) if a - 8 <= f <= b + 8 and f in sm]
        box = phone_box(sm, bf, pad=30)
        tiles = [label(Image.fromarray(out[f][box[1]:box[3], box[0]:box[2]]), f"n°{f}", 16) for f in bf]
        th = min(420, tiles[0].height)
        tiles = [t.resize((max(1, round(t.width * th / t.height)), th), Image.LANCZOS) for t in tiles]
        band = Image.new("RGB", (sum(t.width for t in tiles) + 3 * len(tiles), th), (20, 20, 20))
        x = 0
        for t in tiles:
            band.paste(t, (x, 0))
            x += t.width + 3
        if band.width > 3600:
            band = band.resize((3600, round(band.height * 3600 / band.width)), Image.LANCZOS)
        save_jpg(band, os.path.join(SNAP, f"{P}-bande.jpg"))
    return res


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")] or [k for k in I.CFG if not k.startswith("_")]
    mp = os.path.join(I.SUIVI, "mesures.json")
    allm = json.load(open(mp)) if os.path.exists(mp) else {}
    for n in names:
        allm[n] = run(n)
        print(json.dumps(allm[n], ensure_ascii=False))
    json.dump(allm, open(mp, "w"), indent=1, ensure_ascii=False)
