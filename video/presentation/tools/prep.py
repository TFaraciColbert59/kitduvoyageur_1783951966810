# Prépare les images ChatGPT de la présentation (assets/gen/NN-*.png, 1024×1536) : recadrage 9:16 avec 10 % de marge
# pour les mouvements de caméra (1188×2112), agrandissement Lanczos, léger accent de netteté.
# Produit aussi une version floue et assombrie (assets/prep/NN-flou.jpg) qui sert de fond derrière le téléphone.
# Une image absente est remplacée par une image d'attente marquée (fichier .attente) : le rendu final vérifie qu'il n'en reste pas.
import glob, os, re, json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'assets', 'gen'); OUT = os.path.join(ROOT, 'assets', 'prep'); os.makedirs(OUT, exist_ok=True)
W, H = 1188, 2112
CADF = os.path.join(ROOT, 'tools', 'cadrage.json')
CAD = json.load(open(CADF)) if os.path.exists(CADF) else {}
found = {}
for f in glob.glob(os.path.join(GEN, '*')):
    m = re.match(r'(\d{2})-', os.path.basename(f))
    if m and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')): found[int(m.group(1))] = f
only = {int(a) for a in sys.argv[1:]}
for n in range(1, 26):
    if only and n not in only: continue
    out = os.path.join(OUT, f'{n:02d}.jpg'); ph = out + '.attente'
    if n in found:
        im = Image.open(found[n]).convert('RGB'); w, h = im.size; c = CAD.get(f'{n:02d}', {})
        s = max(W / w, H / h) * c.get('zoom', 1.0)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        L = int(round((im.width - W) * c.get('fx', 0.5))); T = int(round((im.height - H) * c.get('fy', 0.5)))
        im = im.crop((L, T, L + W, T + H)).filter(ImageFilter.UnsharpMask(radius=1.4, percent=35, threshold=3))
        im.save(out, quality=94)
        if os.path.exists(ph): os.remove(ph)
        print(f'{n:02d} ok {os.path.basename(found[n])}')
    else:
        if os.path.exists(out) and not os.path.exists(ph): continue
        g = np.linspace(0, 1, H)[:, None, None]
        a = (np.array([20, 40, 32]) * (1 - g) + np.array([6, 18, 12]) * g) * np.ones((1, W, 1))
        im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im)
        d.rectangle((60, 60, W - 60, H - 60), outline=(208, 160, 112), width=4)
        d.text((100, 120), f'IMAGE {n:02d} - EN ATTENTE', fill=(208, 160, 112), font=ImageFont.load_default(size=56))
        im.save(out, quality=90); open(ph, 'w').write('attente'); print(f'{n:02d} ATTENTE')
    # fond flou derrière le téléphone (1080×1920 + marge pour un lent travelling)
    b = im.resize((W // 4, H // 4), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9)).resize((W, H), Image.BICUBIC)
    b = ImageEnhance.Brightness(b).enhance(0.62); b = ImageEnhance.Color(b).enhance(0.85)
    b.save(os.path.join(OUT, f'{n:02d}-flou.jpg'), quality=88)
