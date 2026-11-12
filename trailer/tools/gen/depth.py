#!/usr/bin/env python3
"""Carte de profondeur d'un plan au sol : Depth Anything V2 Small (Apache-2.0) via transformers.

Usage : depth.py ENTREE.png SORTIE.png [--size 3072x1728] [--input-height 756] [--threads 3]

Sortie : PNG 16 bits en niveaux de gris à la taille demandée (celle du plan agrandi).
Convention : BLANC = PRÈS, NOIR = LOIN (profondeur inverse relative, normalisée par plan
entre les centiles 0,5 % et 99,5 %). Ce n'est pas une distance métrique.
"""
import argparse, os, time
import numpy as np
import torch, torch.nn.functional as F
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

GEN = os.environ.get('GEN', '/tmp/claude-0/-home-user-kitduvoyageur-1783951966810/01a3ca9d-48c3-50c5-8d53-c0cbef7f3fab/scratchpad/gen')
MODEL = f'{GEN}/models/depth-anything-v2-small-hf'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--size', default='3072x1728')
    ap.add_argument('--input-height', type=int, default=756, help='hauteur vue par le réseau (multiple de 14)')
    ap.add_argument('--threads', type=int, default=3)
    a = ap.parse_args()
    torch.set_num_threads(a.threads)
    W, H = map(int, a.size.lower().split('x'))
    t = time.time()
    img = Image.open(a.src).convert('RGB')
    proc = AutoImageProcessor.from_pretrained(MODEL)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL).eval()
    ih = a.input_height // 14 * 14
    iw = int(round(img.width * ih / img.height / 14)) * 14
    inp = proc(images=img.resize((iw, ih), Image.BICUBIC), return_tensors='pt',
               do_resize=False)
    with torch.inference_mode():
        d = model(**inp).predicted_depth  # (1, h, w), profondeur inverse relative
    d = F.interpolate(d[:, None], size=(H, W), mode='bicubic', align_corners=False)[0, 0].numpy()
    lo, hi = np.percentile(d, 0.5), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
    Image.fromarray((d * 65535 + 0.5).astype(np.uint16)).save(a.dst)
    print(f'depth {a.src} -> {a.dst} {W}x{H} net={iw}x{ih} {time.time() - t:.1f}s')


if __name__ == '__main__':
    main()
