#!/usr/bin/env python3
"""Plaques d'essai 1920×1080 avec vérité terrain : téléphone noir, écran vert #00FF00 mat
(ou blanc) aux coins arrondis, pouce couleur peau qui recouvre le bas de l'écran, fond flou.

Rendu projectif exact (homographie téléphone -> image, suréchantillonné 3×), puis flou de
mise au point et grain. La vérité terrain = projection des coins « vifs » de l'écran
(intersection des côtés tangents), la même définition que la détection.
Ce n'est pas un rendu three.js (choix de budget) : la perspective est exacte, l'éclairage simplifié.

Usage : python3 -I make_plates.py <dossier>
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

W, H, SS = 1920, 1080, 3
# Téléphone en mm (repère local) : corps 75×160, écran 69×150 décalé de 3/5, rayon écran 7.
BODY = (0, 0, 75, 160, 10)
SCREEN = (3, 5, 72, 155, 7)


def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    Hm = vt[-1].reshape(3, 3)
    return Hm / Hm[2, 2]


def apply(Hm, p):
    p = np.asarray(p, float)
    q = np.c_[p, np.ones(len(p))] @ Hm.T
    return q[:, :2] / q[:, 2:3]


def rrect(x, y, r):
    x0, y0, x1, y1, rad = r
    cx = np.clip(x, x0 + rad, x1 - rad)
    cy = np.clip(y, y0 + rad, y1 - rad)
    return ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) & (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)


def background(seed, base, accents):
    rng = np.random.default_rng(seed)
    w, h = W // 4, H // 4
    yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
    img = np.zeros((h, w, 3))
    for c in range(3):
        img[..., c] = base[0][c] * (1 - yy) + base[1][c] * yy
    for _ in range(40):
        cx, cy, rad = rng.random(), rng.random(), 0.02 + rng.random() * 0.06
        col = np.array(accents[rng.integers(len(accents))])
        m = np.clip(1 - np.hypot(xx - cx, (yy - cy) * h / w) / rad, 0, 1) ** 0.6
        img = img * (1 - 0.6 * m[..., None]) + col * 0.6 * m[..., None]
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((W * SS, H * SS), Image.BICUBIC)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(18))).astype(np.float32) / 255


def render(name, body_quad, mode, seed, base, accents, thumb, strap=None, focus=0.8, outdir='.'):
    Hm = homography([(0, 0), (75, 0), (75, 160), (0, 160)], np.array(body_quad, float) * SS)
    Hi = np.linalg.inv(Hm)
    img = background(seed, base, accents)
    yy, xx = np.mgrid[0 : H * SS, 0 : W * SS].astype(np.float32)
    P = np.stack([xx + 0.5, yy + 0.5, np.ones_like(xx)], -1) @ Hi.T
    lx, ly = P[..., 0] / P[..., 2], P[..., 1] / P[..., 2]
    if strap is not None:  # bretelle sombre derrière le téléphone (repère local)
        sm = (lx > -40) & (lx < 115) & (ly > -400) & (ly < 560) & (np.abs(lx - 37.5 - (ly - 80) * 0.05) < 55)
        img[sm] = img[sm] * 0.25 + np.array(strap) * 0.75
    body = rrect(lx, ly, BODY)
    shade = 0.05 + 0.04 * (ly / 160)
    img[body] = np.stack([shade, shade, shade * 1.1], -1)[body]
    scr = rrect(lx, ly, SCREEN)
    col = np.array([0, 1, 0]) if mode == 'green' else np.array([0.97, 0.97, 0.96])
    img[scr] = col
    # pouce : ellipse couleur peau, inclinée, qui couvre le bas de l'écran
    if thumb:
        tx, ty, ra, rb, ang = thumb
        c, s = np.cos(ang), np.sin(ang)
        u = (lx - tx) * c + (ly - ty) * s
        v = -(lx - tx) * s + (ly - ty) * c
        d = (u / ra) ** 2 + (v / rb) ** 2
        th = d <= 1
        skin = np.array([0.86, 0.64, 0.52])
        light = (0.75 + 0.35 * np.clip(1 - d, 0, 1) ** 0.5)[..., None]
        img[th] = np.clip(skin * light, 0, 1)[th]
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
    if focus > 0:
        im = im.filter(ImageFilter.GaussianBlur(focus))
    a = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(seed + 1)
    a = np.clip(a + rng.normal(0, 2.2, a.shape), 0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(outdir, name + '.png'))
    truth = apply(Hm, [(3, 5), (72, 5), (72, 155), (3, 155)]) / SS
    return {'plate': name + '.png', 'mode': mode, 'truthCorners': truth.round(3).tolist(),
            'truthRadiusMmLocal': 7, 'focusSigmaPx': focus}


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    warm = ([(0.18, 0.13, 0.10), (0.42, 0.30, 0.20)], [(0.95, 0.70, 0.35), (0.25, 0.35, 0.60), (0.9, 0.85, 0.7)])
    truths = []
    # 1. presque de face (img07) : ~40 % de la hauteur, inclinaison 10° et rotation 5°
    q1 = [(838, 318), (1052, 330), (1068, 770), (822, 776)]
    truths.append(render('front', q1, 'green', 11, *warm, thumb=(54, 152, 24, 13, -0.5), focus=0.7, outdir=outdir))
    truths.append(render('front-white', q1, 'white', 11, *warm, thumb=(54, 152, 24, 13, -0.5), focus=0.7, outdir=outdir))
    # 2. à plat, vu en plongée, forte perspective (img42)
    linen = ([(0.82, 0.80, 0.76), (0.66, 0.62, 0.56)], [(0.95, 0.93, 0.9), (0.42, 0.52, 0.42), (0.9, 0.75, 0.5)])
    q2 = [(860, 300), (1110, 320), (1230, 880), (700, 850)]
    truths.append(render('flat', q2, 'green', 23, *linen, thumb=None, focus=1.1, outdir=outdir))
    # 3. très gros plan : seuls les deux coins du haut sont visibles (img43)
    q3 = [(420, 380), (1560, 420), (1700, 2900), (300, 2880)]
    truths.append(render('macro', q3, 'green', 37, *warm, thumb=(44, 40, 20, 13, 0.3), focus=1.6, outdir=outdir))
    # 4. petit écran lointain sur une bretelle (img18)
    dawn = ([(0.55, 0.62, 0.75), (0.35, 0.33, 0.30)], [(1.0, 0.85, 0.6), (0.6, 0.7, 0.85), (0.3, 0.35, 0.25)])
    q4 = [(1180, 520), (1252, 512), (1262, 668), (1188, 676)]
    truths.append(render('strap', q4, 'green', 41, *dawn, thumb=None, strap=(0.24, 0.27, 0.12), focus=0.6, outdir=outdir))
    json.dump(truths, open(os.path.join(outdir, 'truth.json'), 'w'), indent=2)
    print('plaques :', ', '.join(t['plate'] for t in truths))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
