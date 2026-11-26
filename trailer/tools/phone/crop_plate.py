#!/usr/bin/env python3
"""Recadre une plaque percée (sortie de phonekey.py) sur la zone qui diffère de l'image source.

Hors de cette boîte, la plaque est identique à l'image du film : le plan dessine l'image d'origine,
puis l'écran, puis cette petite plaque par-dessus (doigts devant). Sortie légère, versionnable.

Usage : python3 -I crop_plate.py source.png dossier_phonekey nom dossier_sortie [--corners c.json]
Écrit <sortie>/<nom>.plate.png et <sortie>/<nom>.json (boîte, coins, rayon, flou, lumière).
"""
import json
import os
import sys

import numpy as np
from PIL import Image


def main(argv):
    src, kdir, name, out = argv[1:5]
    keyed = np.asarray(Image.open(os.path.join(kdir, name + '.keyed.png')).convert('RGBA')).astype(np.int16)
    base = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
    meta = json.load(open(os.path.join(kdir, name + '.screen.json')))
    diff = (keyed[..., 3] < 255) | (np.abs(keyed[..., :3] - base).max(-1) > 1)
    ys, xs = np.nonzero(diff)
    m = 8
    h, w = diff.shape
    x0, y0 = max(0, xs.min() - m), max(0, ys.min() - m)
    x1, y1 = min(w, xs.max() + 1 + m), min(h, ys.max() + 1 + m)
    crop = keyed[y0:y1, x0:x1].astype(np.uint8)
    if '--corners' in argv:  # coins hors cadre : on les impose (ordre TL, TR, BR, BL de l'écran)
        meta['corners'] = json.load(open(argv[argv.index('--corners') + 1]))['corners']
    if '--clear-inside' in argv:  # marques sombres dans l'écran (pas de doigts) : percées aussi
        inset = float(argv[argv.index('--clear-inside') + 1])
        from PIL import ImageDraw
        c = np.array(meta['corners'], dtype=np.float64)
        g = c.mean(0)
        poly = [tuple(p + (g - p) * inset / np.linalg.norm(g - p) - [x0, y0]) for p in c]
        mk = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(mk).polygon(poly, fill=255)
        crop[np.asarray(mk) > 0, 3] = 0
    os.makedirs(out, exist_ok=True)
    Image.fromarray(crop, 'RGBA').save(os.path.join(out, name + '.plate.png'), optimize=True)
    rec = {
        'source': os.path.basename(src),
        'box': [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
        'corners': meta['corners'],
        'radius': meta.get('cornerRadiusPx', 0),
        'blur': meta.get('focusBlurSigmaPx', 0),
        'ambient': meta.get('ambient'),
        'alerts': meta.get('alerts', []),
    }
    json.dump(rec, open(os.path.join(out, name + '.json'), 'w'), indent=1)
    print(name, rec['box'], os.path.getsize(os.path.join(out, name + '.plate.png')), 'octets', rec['alerts'])


if __name__ == '__main__':
    main(sys.argv)
