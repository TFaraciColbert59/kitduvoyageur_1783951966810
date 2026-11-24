# Prépare les images ChatGPT v2 (../film-planif/assets/gen2/NN-*.png, 1024×1536) pour « Jusqu'où ».
# Recadrage 9:16 avec 10 % de marge pour les mouvements de caméra (1188×2112), agrandissement Lanczos,
# léger accent de netteté. Pas d'étalonnage : le look pellicule est déjà dans les images.
# Une image absente est remplacée par une image d'attente marquée (fichier .attente) : le rendu final vérifie qu'il n'en reste pas.
import glob, os, re, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, '..', 'film-planif', 'assets', 'gen2')
OUT = os.path.join(ROOT, 'assets', 'prep'); os.makedirs(OUT, exist_ok=True)
W, H = 1188, 2112
NAMES = {1: 'jusquou', 2: 'irais-tu', 3: 'si', 4: 'rien', 5: 'ne', 6: 'manquait', 7: 'bus-aube', 8: 'catamaran',
         9: 'refuge-fenetre', 10: 'source', 11: 'meteo-porte-tente', 12: 'passeport-hublot', 13: 'sac-plongee',
         14: 'trois-tasses', 15: 'tente-nuit', 16: 'mere-cuisine', 17: 'guanaco', 18: 'condor-ombre', 19: 'torres-aube'}
# Cadrage par image : fx/fy = point de cadrage (0 = gauche/haut, 0,5 = centre), zoom >= 1.
CAD = json.load(open(os.path.join(ROOT, 'tools', 'cadrage.json'))) if os.path.exists(os.path.join(ROOT, 'tools', 'cadrage.json')) else {}
found = {}
for f in glob.glob(os.path.join(GEN, '*')):
    m = re.match(r'(\d{2})-', os.path.basename(f))
    if m and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')): found[int(m.group(1))] = f
for n in range(1, 20):
    out = os.path.join(OUT, f'{n:02d}.jpg'); ph = out + '.attente'
    if n in found:
        im = Image.open(found[n]).convert('RGB'); w, h = im.size; c = CAD.get(f'{n:02d}', {})
        s = max(W / w, H / h) * c.get('zoom', 1.0)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        L = int(round((im.width - W) * c.get('fx', 0.5))); T = int(round((im.height - H) * c.get('fy', 0.5)))
        im = im.crop((L, T, L + W, T + H)).filter(ImageFilter.UnsharpMask(radius=1.4, percent=35, threshold=3))
        im.save(out, quality=94)
        if os.path.exists(ph): os.remove(ph)
        print(f'{n:02d} ok {os.path.basename(found[n])} ({w}×{h}, ×{s:.2f})')
    else:
        g = np.linspace(0, 1, H)[:, None, None]
        a = (np.array([20, 40, 32]) * (1 - g) + np.array([6, 18, 12]) * g) * np.ones((1, W, 1))
        im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im)
        d.rectangle((60, 60, W - 60, H - 60), outline=(208, 160, 112), width=4)
        d.text((100, 120), f'IMAGE {n:02d} — EN ATTENTE\n{NAMES[n]}', fill=(208, 160, 112), font=ImageFont.load_default(size=56))
        im.save(out, quality=90); open(ph, 'w').write('attente'); print(f'{n:02d} ATTENTE')
