#!/usr/bin/env python3
"""Agrandissement local d'un plan au sol : Real-ESRGAN (BSD-3-Clause, poids x2plus ou x4plus)
en tuiles sur CPU, puis mélange avec un agrandissement Lanczos pour garder le grain et éviter
l'aspect « plastique ».

Usage (python du venv hors dépôt) :
  upscale.py ENTREE.png SORTIE.png --size 3072x1728 [--model x2|x4] [--mix 0.55] [--grain 0.012]
            [--tile 256] [--threads 3]

--mix   part de Real-ESRGAN dans l'image finale (0 = Lanczos pur, 1 = Real-ESRGAN pur).
--grain écart-type d'un grain gaussien fin (fraction de 255) rajouté après mélange.
L'architecture RRDBNet est réécrite ici (identique à celle de BasicSR) pour ne pas dépendre
du paquet basicsr.
"""
import argparse, os, sys, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image

GEN = os.environ.get('GEN', '/tmp/claude-0/-home-user-kitduvoyageur-1783951966810/01a3ca9d-48c3-50c5-8d53-c0cbef7f3fab/scratchpad/gen')
WEIGHTS = {'x2': (f'{GEN}/models/esrgan/RealESRGAN_x2plus.pth', 2),
           'x4': (f'{GEN}/models/esrgan/RealESRGAN_x4plus.pth', 4)}


class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1); s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)

    def forward(s, x):
        x1 = s.lrelu(s.conv1(x)); x2 = s.lrelu(s.conv2(torch.cat((x, x1), 1)))
        x3 = s.lrelu(s.conv3(torch.cat((x, x1, x2), 1))); x4 = s.lrelu(s.conv4(torch.cat((x, x1, x2, x3), 1)))
        return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class RRDB(nn.Module):
    def __init__(s, nf, gc=32):
        super().__init__(); s.rdb1 = RDB(nf, gc); s.rdb2 = RDB(nf, gc); s.rdb3 = RDB(nf, gc)

    def forward(s, x):
        return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(s, scale=4, nf=64, nb=23, gc=32):
        super().__init__(); s.scale = scale
        cin = 3 * (4 if scale == 2 else 16 if scale == 1 else 1)
        s.conv_first = nn.Conv2d(cin, nf, 3, 1, 1)
        s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1); s.lrelu = nn.LeakyReLU(0.2, True)

    def forward(s, x):
        f = F.pixel_unshuffle(x, 2) if s.scale == 2 else F.pixel_unshuffle(x, 4) if s.scale == 1 else x
        f = s.conv_first(f); f = f + s.conv_body(s.body(f))
        f = s.lrelu(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest')))
        f = s.lrelu(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.lrelu(s.conv_hr(f)))


def esrgan(img, model, scale, tile, pad=16):
    x = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255.).permute(2, 0, 1)[None]
    _, _, h, w = x.shape
    out = torch.zeros(1, 3, h * scale, w * scale)
    for y0 in range(0, h, tile):
        for x0 in range(0, w, tile):
            y1, x1 = min(y0 + tile, h), min(x0 + tile, w)
            ya, xa, yb, xb = max(y0 - pad, 0), max(x0 - pad, 0), min(y1 + pad, h), min(x1 + pad, w)
            with torch.inference_mode():
                o = model(x[:, :, ya:yb, xa:xb])
            oy, ox = (y0 - ya) * scale, (x0 - xa) * scale
            out[:, :, y0 * scale:y1 * scale, x0 * scale:x1 * scale] = o[:, :, oy:oy + (y1 - y0) * scale, ox:ox + (x1 - x0) * scale]
    a = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255. + 0.5).astype(np.uint8)
    return Image.fromarray(a)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--size', default='3072x1728'); ap.add_argument('--model', default='x2', choices=list(WEIGHTS))
    ap.add_argument('--mix', type=float, default=0.55); ap.add_argument('--grain', type=float, default=0.012)
    ap.add_argument('--tile', type=int, default=256); ap.add_argument('--threads', type=int, default=3)
    ap.add_argument('--seed', type=int, default=1783)
    a = ap.parse_args()
    torch.set_num_threads(a.threads)
    W, H = map(int, a.size.lower().split('x'))
    src = Image.open(a.src).convert('RGB')
    t = time.time()
    lz = np.asarray(src.resize((W, H), Image.LANCZOS), dtype=np.float32)
    if a.mix > 0:
        path, scale = WEIGHTS[a.model]
        net = RRDBNet(scale=scale)
        sd = torch.load(path, map_location='cpu', weights_only=True)
        net.load_state_dict(sd.get('params_ema', sd.get('params', sd)), strict=True); net.eval()
        up = esrgan(src, net, scale, a.tile)
        es = np.asarray(up.resize((W, H), Image.LANCZOS), dtype=np.float32)
        out = a.mix * es + (1 - a.mix) * lz
    else:
        out = lz
    if a.grain > 0:
        rng = np.random.default_rng(a.seed)
        g = rng.standard_normal((H, W, 1)).astype(np.float32) * (a.grain * 255.)
        out = out + g  # grain de luminance, identique sur les trois canaux
    Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(a.dst, optimize=False, compress_level=6)
    print(f'upscale {a.src} -> {a.dst} {W}x{H} model={a.model} mix={a.mix} grain={a.grain} {time.time() - t:.1f}s')


if __name__ == '__main__':
    main()
