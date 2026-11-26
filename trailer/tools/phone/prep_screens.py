#!/usr/bin/env python3
"""Copies des captures 1290x2796 a 645x1398 pour le film (l'ecran ne depasse pas ~450 px a l'image).
Usage : python3 -I prep_screens.py dossier_captures dossier_sortie nom1 nom2 ..."""
import os, sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for n in sys.argv[3:]:
    im = Image.open(os.path.join(src, n + '.png')).convert('RGB')
    assert im.size == (1290, 2796), (n, im.size)
    im = im.resize((645, 1398), Image.LANCZOS)
    p = os.path.join(out, n + '.png')
    im.save(p, optimize=True)
    print(n, os.path.getsize(p))
