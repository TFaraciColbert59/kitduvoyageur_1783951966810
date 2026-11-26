#!/usr/bin/env python3
"""Détection de l'écran de téléphone (vert #00FF00, ou blanc uni en repli) sur une plaque.

Sorties (dans <dossier>) :
  <nom>.screen.json  coins TL, TR, BR, BL au sous-pixel (ordre de l'écran tenu droit),
                     rayon des coins, lumière ambiante, netteté (flou en px), alertes.
  <nom>.keyed.png    la plaque RGBA, écran percé (alpha doux), débordement vert neutralisé.

Méthode : masque de chrominance -> pixels de bord -> 4 côtés ajustés par moindres carrés
(sur les bords, pas sur les coins arrondis) -> coins = intersections des droites.
Surcharge manuelle : --corners fichier.json ({"corners": [[x,y]x4]}) remplace la détection.

Usage : python3 -I phonekey.py plaque.png dossier [--mode green|white] [--corners c.json]
Dépendances : numpy, Pillow (présents sur la machine).
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255.0


def screen_score(img, mode):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    if mode == 'green':
        return g - np.maximum(r, b)  # ~1 sur le vert pur, <0.15 ailleurs
    # blanc uni : lumineux ET peu saturé
    lum = img.mean(-1)
    sat = img.max(-1) - img.min(-1)
    return np.clip((lum - 0.70) / 0.20, 0, 1) * np.clip(1 - sat / 0.25, 0, 1)


def largest_component(mask):
    """Plus grande composante 4-connexe (balayage à pile, sans scipy)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    best, best_n, cur = 0, 0, 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        cur += 1
        stack = [(y0, x0)]
        lab[y0, x0] = cur
        n = 0
        while stack:
            y, x = stack.pop()
            n += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur
                    stack.append((yy, xx))
        if n > best_n:
            best, best_n = cur, n
    return lab == best


def fill_holes(mask):
    """Bouche les trous (doigts à l'intérieur) : tout ce qui n'est pas relié au bord par du fond."""
    outside = largest_component_from_border(~mask)
    return ~outside


def largest_component_from_border(bg):
    h, w = bg.shape
    seen = np.zeros_like(bg)
    stack = [(y, x) for y in (0, h - 1) for x in range(w) if bg[y, x]]
    stack += [(y, x) for x in (0, w - 1) for y in range(h) if bg[y, x]]
    for y, x in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < h and 0 <= xx < w and bg[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                stack.append((yy, xx))
    return seen


def boundary_points(score, mask):
    """Points de bord au sous-pixel : passage de score à 0.5 le long de x et de y."""
    s = np.clip(score / max(1e-6, np.percentile(score[mask], 90)), 0, 1)
    pts = []
    # transitions horizontales
    a, b = s[:, :-1], s[:, 1:]
    cross = (a - 0.5) * (b - 0.5) < 0
    ys, xs = np.nonzero(cross)
    t = (0.5 - a[ys, xs]) / (b[ys, xs] - a[ys, xs])
    pts.append(np.stack([xs + t + 0.5, ys + 0.5], 1))
    a, b = s[:-1, :], s[1:, :]
    cross = (a - 0.5) * (b - 0.5) < 0
    ys, xs = np.nonzero(cross)
    t = (0.5 - a[ys, xs]) / (b[ys, xs] - a[ys, xs])
    pts.append(np.stack([xs + 0.5, ys + t + 0.5], 1))
    return np.concatenate(pts, 0)


def convex_hull(p):
    p = sorted(map(tuple, p))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in p:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    return np.array(lo[:-1] + up[:-1])


def quad_from_hull(h):
    """Quadrilatère d'aire maximale dont les sommets sont des sommets de l'enveloppe (vectorisé)."""
    n = len(h)
    best, bq = -1.0, None
    idx = np.arange(n)
    for i in range(n):
        for k in range(i + 2, n - (1 if i == 0 else 0)):
            d = h[k] - h[i]
            cr = d[0] * (h[:, 1] - h[i, 1]) - d[1] * (h[:, 0] - h[i, 0])
            left = (idx > i) & (idx < k)
            right = ~left & (idx != i) & (idx != k)
            if not left.any() or not right.any():
                continue
            j = int(np.argmax(np.where(left, np.abs(cr), -1)))
            l = int(np.argmax(np.where(right, np.abs(cr), -1)))
            a = 0.5 * (abs(cr[j]) + abs(cr[l]))
            if a > best:
                best, bq = a, np.array([h[i], h[j], h[k], h[l]])
    return bq


def cross2(a, b):
    return a[0] * b[1] - a[1] * b[0]


def fit_line(pts):
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c)
    d = vt[0]
    return c, d


def intersect(l1, l2):
    (c1, d1), (c2, d2) = l1, l2
    A = np.array([d1, -d2]).T
    t = np.linalg.solve(A, c2 - c1)
    return c1 + t[0] * d1


def order_corners(q, portrait=True):
    """TL, TR, BR, BL dans le sens de l'écran : le côté long est vertical (portrait)."""
    c = q.mean(0)
    ang = np.arctan2(q[:, 1] - c[1], q[:, 0] - c[0])
    q = q[np.argsort(ang)]  # sens horaire (y vers le bas) à partir d'environ -180°
    # le plus haut-gauche (min x+y) devient TL
    k = int(np.argmin(q[:, 0] + q[:, 1]))
    q = np.roll(q, -k, 0)
    # portrait : TL->TR doit être le côté court
    if portrait and np.linalg.norm(q[1] - q[0]) > np.linalg.norm(q[3] - q[0]):
        q = q[[3, 0, 1, 2]]
    return q


def refine(points, quad, radius_frac=0.12, band=6.0):
    """Ajuste chaque côté sur les points de bord proches de lui, hors zone des coins arrondis."""
    lines, used = [], []
    for i in range(4):
        a, b = quad[i], quad[(i + 1) % 4]
        d = b - a
        L = np.linalg.norm(d)
        d = d / L
        nrm = np.array([-d[1], d[0]])
        rel = points - a
        t = rel @ d
        dist = np.abs(rel @ nrm)
        sel = (dist < band) & (t > radius_frac * L) & (t < (1 - radius_frac) * L)
        p = points[sel]
        if len(p) < 10:
            lines.append((a, d))
            used.append(0)
            continue
        c, dd = fit_line(p)
        # deuxième passe robuste
        res = np.abs((p - c) @ np.array([-dd[1], dd[0]]))
        keep = res < max(1.0, 2.5 * np.median(res) + 0.3)
        c, dd = fit_line(p[keep])
        lines.append((c, dd))
        used.append(int(keep.sum()))
    corners = np.array([intersect(lines[(i - 1) % 4], lines[i]) for i in range(4)])
    return corners, used


def corner_radius(mask, corners):
    """Rayon des coins : surface manquante du masque près d'un coin = (4 - pi) r^2 / 4."""
    h, w = mask.shape
    radii = []
    for i in range(4):
        c = corners[i]
        e1 = corners[(i + 1) % 4] - c
        e2 = corners[(i - 1) % 4] - c
        s = 0.15
        # parallélogramme de coin, échantillonné
        u, v = np.meshgrid(np.linspace(0, s, 60), np.linspace(0, s, 60))
        P = c + u[..., None] * e1 + v[..., None] * e2
        xi, yi = P[..., 0].astype(int), P[..., 1].astype(int)
        inside = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
        if inside.mean() < 0.95:
            continue
        missing = 1 - mask[yi, xi].mean()
        area = abs(cross2(e1 * s, e2 * s)) * missing
        radii.append(math.sqrt(max(0, area) * 4 / (4 - math.pi)))
    return float(np.median(radii)) if radii else None


def edge_blur(score, points, corners):
    """Largeur 10-90 % du bord de l'écran, convertie en sigma gaussien (px)."""
    s = np.clip(score / max(1e-6, np.percentile(score[score > 0.3], 90) if (score > 0.3).any() else 1), 0, 1)
    h, w = s.shape
    widths = []
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        d = (b - a) / np.linalg.norm(b - a)
        nrm = np.array([d[1], -d[0]])  # vers l'extérieur (sens horaire, y vers le bas)
        for t in np.linspace(0.3, 0.7, 9):
            p0 = a + (b - a) * t
            prof = []
            for k in np.linspace(-8, 8, 65):
                q = p0 + nrm * k
                x, y = int(round(q[0])), int(round(q[1]))
                prof.append(s[y, x] if 0 <= x < w and 0 <= y < h else np.nan)
            prof = np.array(prof)
            if np.isnan(prof).any() or prof[0] < 0.8 or prof[-1] > 0.2:
                continue
            xs = np.linspace(-8, 8, 65)
            x10 = np.interp(0.9, prof[::-1], xs[::-1])
            x90 = np.interp(0.1, prof[::-1], xs[::-1])
            widths.append(abs(x90 - x10))
    if not widths:
        return None
    wd = float(np.median(widths))
    # largeur 10-90 % -> sigma, étalonné sur les plaques d'essai (vérité terrain, écart < 0.1 px)
    return max(0.0, (wd - 0.5) / 2.2)


def ambient(img, mask, corners):
    """Couleur et niveau moyens dans un anneau autour du téléphone (hors écran)."""
    h, w = mask.shape
    c = corners.mean(0)
    size = np.linalg.norm(corners[2] - corners[0])
    yy, xx = np.mgrid[0:h:4, 0:w:4]
    d = np.hypot(xx - c[0], yy - c[1])
    ring = (d > 0.6 * size) & (d < 1.4 * size) & ~mask[::4, ::4]
    px = img[::4, ::4][ring]
    if len(px) == 0:
        px = img.reshape(-1, 3)
    col = px.mean(0)
    lum = float(0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2])
    return [float(x) for x in col], lum


def key_plate(img, score, mode, region=None):
    """Alpha doux + débordement vert neutralisé (bords, doigts)."""
    if mode == 'green':
        t0, t1 = 0.10, 0.45
    else:
        t0, t1 = 0.10, 0.55
    alpha = 1 - np.clip((score - t0) / (t1 - t0), 0, 1)
    out = img.copy()
    # démélange des bords : C = a·F + (1-a)·K  ->  F = (C - (1-a)·K) / a  (frange verte des doigts)
    K = np.array([0.0, 1.0, 0.0] if mode == 'green' else [0.97, 0.97, 0.96], np.float32)
    edge = (alpha > 0.04) & (alpha < 0.98)
    a = np.maximum(alpha[edge], 0.04)[:, None]
    out[edge] = np.clip((img[edge] - (1 - a) * K) / a, 0, 1)
    if mode == 'green':
        r, g, b = out[..., 0], out[..., 1], out[..., 2]
        limit = np.maximum(r, b) * 1.02 + 0.01
        # frange (bord du masque, alpha partiel ou voisin) : dé-vert plus fort, moyenne de r et b
        fringe = np.asarray(Image.fromarray(((alpha < 0.995) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
        limit = np.where(fringe, np.minimum(limit, (r + b) * 0.55 + 0.01), limit)
        spill = np.clip(g - limit, 0, None)
        if region is not None:  # seulement près de l'écran : les verts de la scène (veste, plaid) restent
            spill = spill * region
        out[..., 1] = g - spill
        # compense la perte de luminance du dé-vert sur la peau
        out[..., 0] = np.clip(r + spill * 0.25, 0, 1)
        out[..., 2] = np.clip(b + spill * 0.25, 0, 1)
    rgba = np.concatenate([out, alpha[..., None]], -1)
    return rgba, alpha


def main(argv):
    src, outdir = argv[0], argv[1]
    mode = 'green'
    manual = None
    if '--mode' in argv:
        mode = argv[argv.index('--mode') + 1]
    if '--corners' in argv:
        manual = json.load(open(argv[argv.index('--corners') + 1]))['corners']
    name = os.path.splitext(os.path.basename(src))[0]
    os.makedirs(outdir, exist_ok=True)
    img = load(src)
    h, w, _ = img.shape
    score = screen_score(img, mode)
    thr = 0.35 if mode == 'green' else 0.5
    raw = score > thr
    alerts = []
    if raw.sum() < 500:
        alerts.append('ecran-introuvable')
        json.dump({'plate': src, 'mode': mode, 'ok': False, 'alerts': alerts}, open(os.path.join(outdir, name + '.screen.json'), 'w'), indent=2)
        print(name, 'ÉCHEC : écran introuvable')
        return 2
    # composante principale à basse résolution (rapide), puis remontée
    f = 4
    small = raw[::f, ::f]
    comp = largest_component(small)
    comp = np.kron(comp, np.ones((f, f), bool))[:h, :w]
    near = np.zeros_like(raw)
    near[: comp.shape[0], : comp.shape[1]] = comp
    grow = np.asarray(Image.fromarray(near.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
    mask = raw & grow
    solid = fill_holes(mask)
    pts = boundary_points(score, mask)
    # garde les bords contre le cadre noir du téléphone (pas les bords autour des doigts)
    lum = (img @ np.array([0.2126, 0.7152, 0.0722], np.float32))
    dark = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))) < 60
    xi = np.clip(pts[:, 0].astype(int), 0, w - 1)
    yi = np.clip(pts[:, 1].astype(int), 0, h - 1)
    bez = pts[dark[yi, xi]]
    if len(bez) > 50:
        pts = bez
    else:
        alerts.append('cadre-noir-non-vu')
    hull = convex_hull(pts[:: max(1, len(pts) // 8000)])
    if manual is not None:
        corners = np.array(manual, float)
        used = 'manuel'
    else:
        framecut = bool(solid[0, :].any() or solid[-1, :].any() or solid[:, 0].any() or solid[:, -1].any())
        q = quad_from_hull(hull)
        q = order_corners(q, portrait=not framecut)
        corners = q
        for band in (40.0, 20.0, 10.0, 5.0, 2.5):
            corners, used = refine(pts, corners, band=band)
        if framecut and used[2] < 10 and min(used[0], used[1], used[3]) >= 10:
            # bas de l'écran hors cadre : on prolonge les côtés fittés selon le format 1290×2796
            top = np.linalg.norm(corners[1] - corners[0])
            L = top * 2796 / 1290
            dl = corners[3] - corners[0]
            dr = corners[2] - corners[1]
            corners[3] = corners[0] + dl / np.linalg.norm(dl) * L
            corners[2] = corners[1] + dr / np.linalg.norm(dr) * L
            alerts.append('coins-extrapoles:BR,BL (format de l’écran, perspective ignorée)')
    # écran coupé par le cadre ?
    cut = [i for i, c in enumerate(corners) if not (0 <= c[0] < w and 0 <= c[1] < h)]
    if solid[0, :].any() or solid[-1, :].any() or solid[:, 0].any() or solid[:, -1].any():
        alerts.append('ecran-coupe-par-le-cadre')
    if cut:
        alerts.append('coins-hors-cadre:' + ','.join('TL TR BR BL'.split()[i] for i in cut))
    if manual is None and isinstance(used, list) and min(used) < 30:
        alerts.append('cote-peu-visible:' + ','.join(str(u) for u in used))
    radius = corner_radius(solid, corners)
    blur = edge_blur(score, pts, corners)
    amb, lum = ambient(img, solid, corners)
    near_screen = np.asarray(Image.fromarray(solid.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.GaussianBlur(8))).astype(np.float32) / 255
    rgba, alpha = key_plate(img, score, mode, near_screen)
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(outdir, name + '.keyed.png'))
    res = {
        'plate': os.path.basename(src),
        'size': [w, h],
        'mode': mode,
        'ok': True,
        'corners': [[round(float(x), 3), round(float(y), 3)] for x, y in corners],
        'cornerOrder': 'TL,TR,BR,BL (écran en portrait)',
        'edgePointsUsed': used,
        'cornerRadiusPx': None if radius is None else round(radius, 2),
        'focusBlurSigmaPx': None if blur is None else round(blur, 2),
        'ambient': {'rgb': [round(x, 4) for x in amb], 'luminance': round(lum, 4)},
        'alerts': alerts,
    }
    json.dump(res, open(os.path.join(outdir, name + '.screen.json'), 'w'), indent=2, ensure_ascii=False)
    print(name, json.dumps({k: res[k] for k in ('corners', 'cornerRadiusPx', 'focusBlurSigmaPx', 'alerts')}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
