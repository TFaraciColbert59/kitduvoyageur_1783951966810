#!/usr/bin/env python3
"""Écusson du LKDV ONE : remplace l'écusson sans lettres (rendu ChatGPT) par le vrai écusson.

Le dessin vient du rendu à plat du VRAI modèle 3D (assets/ref/lkdv-one-45-0.png, écusson de face,
montagne blanche + lettres LKDV), redressé par homographie en une texture carrée.

  locate : carré sombre à motif clair sur le vert olive, autour d'un point approché (--near x,y),
           4 coins ajustés sur les bords (droites fittées, intersections) ; --corners c.json pour forcer.
  apply  : texture posée par homographie, niveaux noir/blanc pris sur l'écusson du plan (lumière),
           flou accordé à la netteté du bord, grain accordé au bruit du tissu autour, bord adouci.

Usage :
  python3 -I badge.py apply <image> <sortie.png> --near x,y [--corners c.json] [--json out.json]
  python3 -I badge.py selftest <dossier>   (vérité terrain sur les rendus de référence)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'phone'))
import phonekey as K  # noqa: E402

REF = os.path.join(HERE, '..', '..', 'assets', 'ref')
TEX = 256


def lum(img):
    return img @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(A, float))
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def bilinear(img, x, y):
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    a, b = img[y0, x0], img[y0, x0 + 1]
    c, d = img[y0 + 1, x0], img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def locate(img, near, radius=90):
    """Coins TL,TR,BR,BL de l'écusson sombre le plus proche de `near`."""
    h, w, _ = img.shape
    cx, cy = near
    x0, y0 = int(max(0, cx - radius)), int(max(0, cy - radius))
    x1, y1 = int(min(w, cx + radius)), int(min(h, cy + radius))
    roi = img[y0:y1, x0:x1]
    L = lum(roi)
    score = np.clip((0.30 - L) / 0.25, 0, 1)  # sombre = écusson (le tissu olive est plus clair)
    dark = score > 0.5
    # le motif clair (montagne, lettres) est à l'intérieur : on bouche les trous
    comp = K.largest_component(dark)
    solid = K.fill_holes(comp)
    pts = K.boundary_points(score, comp)
    # seuls les bords extérieurs : proches du contour du masque plein
    edge = solid & ~np.asarray(Image.fromarray(solid.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5))).astype(bool)
    ex = np.asarray(Image.fromarray(edge.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    xi = np.clip(pts[:, 0].astype(int), 0, ex.shape[1] - 1)
    yi = np.clip(pts[:, 1].astype(int), 0, ex.shape[0] - 1)
    pts = pts[ex[yi, xi]]
    hull = K.convex_hull(pts)
    q = K.order_corners(K.quad_from_hull(hull), portrait=False)
    for band in (8.0, 4.0, 2.0, 1.2):
        q, used = K.refine(pts, q, radius_frac=0.15, band=band)
    return q + np.array([x0, y0]), used


def rectify(img, corners, size=TEX):
    """Texture carrée size×size de l'écusson délimité par corners."""
    Hm = homography([(0, 0), (size, 0), (size, size), (0, size)], corners)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64) + 0.5
    P = np.stack([xx, yy, np.ones_like(xx)], -1) @ Hm.T
    return bilinear(img, P[..., 0] / P[..., 2] - 0.5, P[..., 1] / P[..., 2] - 0.5)


def reference_texture():
    ref = K.load(os.path.join(REF, 'lkdv-one-45-0.png'))
    c, _ = locate(ref, (768, 484), radius=70)
    return rectify(ref, c), c


def edge_sigma(img, corners):
    """Netteté du bord de l'écusson (sigma px) : largeur 10-90 % de la transition sombre/clair."""
    L = lum(img)
    ws = []
    for i in range(4):
        a, b = corners[i], corners[(i + 1) % 4]
        d = (b - a) / np.linalg.norm(b - a)
        n = np.array([d[1], -d[0]])
        for t in np.linspace(0.3, 0.7, 7):
            p0 = a + (b - a) * t
            ks = np.linspace(-5, 5, 41)
            prof = np.array([bilinear(L[..., None], np.array(p0[0] + n[0] * k), np.array(p0[1] + n[1] * k))[0] for k in ks])
            lo, hi = prof.min(), prof.max()
            if hi - lo < 0.05:
                continue
            s = (prof - lo) / (hi - lo)
            if s[0] > s[-1]:
                s = s[::-1]
            x10 = np.interp(0.1, s, ks)
            x90 = np.interp(0.9, s, ks)
            ws.append(abs(x90 - x10))
    w = float(np.median(ws)) if ws else 1.5
    return max(0.0, (w - 0.5) / 2.2)


def apply(img, corners, tex, seed=7):
    h, w, _ = img.shape
    corners = np.asarray(corners, float)
    S = tex.shape[0]
    Hm = homography(corners, [(0, 0), (S, 0), (S, S), (0, S)])  # image -> texture
    x0, y0 = np.floor(corners.min(0) - 4).astype(int)
    x1, y1 = np.ceil(corners.max(0) + 4).astype(int)
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float64) + 0.5
    P = np.stack([xx, yy, np.ones_like(xx)], -1) @ Hm.T
    u, v = P[..., 0] / P[..., 2], P[..., 1] / P[..., 2]
    # suréchantillonnage léger : moyenne de 4 sous-pixels (anticrénelage)
    acc = np.zeros(u.shape + (3,))
    cov = np.zeros(u.shape)
    for dx in (-0.25, 0.25):
        for dy in (-0.25, 0.25):
            Q = np.stack([xx + dx, yy + dy, np.ones_like(xx)], -1) @ Hm.T
            uu, vv = Q[..., 0] / Q[..., 2], Q[..., 1] / Q[..., 2]
            inside = (uu >= 0) & (uu < S) & (vv >= 0) & (vv < S)
            acc += bilinear(tex, uu - 0.5, vv - 0.5) * inside[..., None]
            cov += inside
    col = acc / np.maximum(cov, 1)[..., None]
    alpha = cov / 4.0
    patch = img[y0:y1, x0:x1]
    # lumière du plan : niveaux sombre/clair de l'écusson d'origine -> niveaux de la texture
    inner = alpha > 0.99
    Lp = lum(patch)[inner]
    Lt = lum(col)[inner]
    pd, pl = np.percentile(Lp, 20), np.percentile(Lp, 99.5)
    td, tl = np.percentile(Lt, 20), np.percentile(Lt, 99.5)
    darkcol = np.median(patch[inner][Lp <= pd + 0.02], 0)
    k = (pl - pd) / max(1e-3, tl - td)
    col = darkcol + (col - np.median(col[inner][Lt <= td + 0.02], 0)) * k
    # netteté et grain du plan
    sig = edge_sigma(img, corners)
    if sig > 0.15:
        im = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sig))
        col = np.asarray(im).astype(np.float32) / 255
    ring = patch[~(alpha > 0.01)]
    grain = float(np.std(ring - np.asarray(Image.fromarray((patch * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[~(alpha > 0.01)] / 255)) if len(ring) else 0.0
    rng = np.random.default_rng(seed)
    col = col + rng.normal(0, min(grain, 0.04), col.shape)
    a = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(0.4, sig)))).astype(np.float32)[..., None] / 255
    out = img.copy()
    out[y0:y1, x0:x1] = patch * (1 - a) + np.clip(col, 0, 1) * a
    return out, {'edgeSigmaPx': round(sig, 2), 'grain': round(grain, 4), 'gain': round(float(k), 3)}


def save(a, p):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(p)


def selftest(outdir):
    """Vérité terrain : rendu 3/4 (lkdv-one-45-40) ; on efface les lettres, on repasse la chaîne,
    on compare au rendu d'origine dans l'écusson."""
    os.makedirs(outdir, exist_ok=True)
    tex, tc = reference_texture()
    save(tex, os.path.join(outdir, 'texture-ecusson.png'))
    orig = K.load(os.path.join(REF, 'lkdv-one-45-40.png'))
    # point approché de l'écusson dans la vue 3/4 (repéré à l'œil sur le rendu, puis ajusté)
    near = tuple(json.load(open(os.path.join(HERE, 'ref-near.json')))['lkdv-one-45-40'])
    c, used = locate(orig, near)
    # « sans lettres » simulé : la moitié basse de l'écusson repeinte de son noir
    S = 64
    Hm = homography([(0, 0), (S, 0), (S, S), (0, S)], c)
    Hi = np.linalg.inv(Hm)
    h, w, _ = orig.shape
    x0, y0 = np.floor(c.min(0)).astype(int)
    x1, y1 = np.ceil(c.max(0)).astype(int)
    yy, xx = np.mgrid[y0:y1, x0:x1] + 0.5
    P = np.stack([xx, yy, np.ones_like(xx)], -1) @ Hi.T
    u, v = P[..., 0] / P[..., 2], P[..., 1] / P[..., 2]
    zone = (u > 0.12 * S) & (u < 0.88 * S) & (v > 0.62 * S) & (v < 0.9 * S)
    sim = orig.copy()
    patch = sim[y0:y1, x0:x1]
    darkv = np.median(patch[(lum(patch) < 0.15)], 0)
    patch[zone] = darkv
    save(sim, os.path.join(outdir, 'gt-sans-lettres.png'))
    c2, _ = locate(sim, near)
    res, info = apply(sim, c2, tex)
    save(res, os.path.join(outdir, 'gt-repare.png'))
    box = (slice(y0 - 2, y1 + 2), slice(x0 - 2, x1 + 2))
    e_before = float(np.abs(sim[box] - orig[box]).mean() * 255)
    e_after = float(np.abs(res[box] - orig[box]).mean() * 255)
    cerr = np.linalg.norm(c2 - c, axis=1).round(3).tolist()
    rep = {'corners_ref': c.round(2).tolist(), 'corners_sans_lettres': c2.round(2).tolist(), 'ecart_coins_px': cerr,
           'erreur_moyenne_avant_0_255': round(e_before, 2), 'erreur_moyenne_apres_0_255': round(e_after, 2), **info}
    # planche avant / après (agrandie)
    crops = [Image.open(os.path.join(outdir, n)).crop((x0 - 30, y0 - 30, x1 + 30, y1 + 30)) for n in ('gt-sans-lettres.png', 'gt-repare.png')]
    crops.append(Image.fromarray((orig * 255).astype(np.uint8)).crop((x0 - 30, y0 - 30, x1 + 30, y1 + 30)))
    cw, ch = crops[0].size
    sheet = Image.new('RGB', (cw * 3 * 4, ch * 4))
    for i, cr in enumerate(crops):
        sheet.paste(cr.resize((cw * 4, ch * 4), Image.NEAREST), (i * cw * 4, 0))
    sheet.save(os.path.join(outdir, 'gt-planche.jpg'), quality=88)
    json.dump(rep, open(os.path.join(outdir, 'selftest.json'), 'w'), indent=2)
    print(json.dumps(rep, ensure_ascii=False))


def main(argv):
    if argv[0] == 'selftest':
        return selftest(argv[1])
    if argv[0] == 'apply':
        src, dst = argv[1], argv[2]
        img = K.load(src)
        if '--corners' in argv:
            c = np.array(json.load(open(argv[argv.index('--corners') + 1]))['corners'], float)
            used = 'manuel'
        else:
            near = tuple(float(v) for v in argv[argv.index('--near') + 1].split(','))
            c, used = locate(img, near)
        tex, _ = reference_texture()
        out, info = apply(img, c, tex)
        save(out, dst)
        rep = {'image': os.path.basename(src), 'corners': c.round(2).tolist(), 'edgePointsUsed': used, **info}
        if '--json' in argv:
            json.dump(rep, open(argv[argv.index('--json') + 1], 'w'), indent=2)
        print(json.dumps(rep, ensure_ascii=False))
        return 0
    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
