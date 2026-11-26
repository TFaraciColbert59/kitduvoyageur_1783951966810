# Cartes de profondeur des images préparées (assets/prep/NN.jpg) avec Depth Anything V2 (Base).
# Sortie : assets/depth/NN.png (16 bits, 1 = proche, 0 = loin), même taille que l'image préparée.
# Lancer avec l'environnement qui a torch + transformers (venv du scratchpad).
import os, sys, glob
import numpy as np, torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(ROOT, 'assets', 'prep'); OUT = os.path.join(ROOT, 'assets', 'depth'); os.makedirs(OUT, exist_ok=True)
name = 'depth-anything/Depth-Anything-V2-Base-hf'
proc = AutoImageProcessor.from_pretrained(name); model = AutoModelForDepthEstimation.from_pretrained(name).eval()
torch.set_num_threads(os.cpu_count())
only = set(sys.argv[1:])
for f in sorted(glob.glob(os.path.join(IN, '[0-9][0-9].jpg'))):
    n = os.path.basename(f)[:2]
    if only and n not in only: continue
    im = Image.open(f).convert('RGB')
    with torch.no_grad():
        x = proc(images=im, return_tensors='pt')
        d = model(**x).predicted_depth            # disparité relative : grand = proche
        d = torch.nn.functional.interpolate(d[:, None], size=im.size[::-1], mode='bicubic', align_corners=False)[0, 0].numpy()
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo + 1e-6), 0, 1)
    Image.fromarray((d * 65535).astype(np.uint16)).save(os.path.join(OUT, f'{n}.png'))
    print(n, 'ok', flush=True)
