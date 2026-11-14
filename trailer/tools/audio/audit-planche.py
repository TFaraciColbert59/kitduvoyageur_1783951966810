#!/usr/bin/env python3
"""Planche de contrôle du son (sound-designer) : qa/snapshots/son/calage.png + mesures des moments forts.
Mesuré, non écouté. FFmpeg 6.1.1 (ebur128) + numpy + Pillow.

Usage : python3 tools/audio/audit-planche.py [--json qa/tmp/audit-moments.json]
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

TR = Path(__file__).resolve().parents[2]
QA = TR / 'qa'
FILES = {
    'mix-v1': QA / 'mix-v1.wav', 'mix-v2': QA / 'mix-v2.wav',
    'lit-v1': TR / 'assets/audio/storm-ii-montage-60s.wav', 'lit-v2': TR / 'assets/audio/storm-ii-montage-60s-v2.wav',
}
SR = 48000
MARKS = [(325, 'drop 1'), (2009, 'drop 2'), (2848, 'outro'), (3060, 'montée'), (3480, 'impact')]
MOMENTS = [(166, 'descente'), (325, 'P06 drop 1'), (482, 'P08 œil'), (1034, 'P17 Commander'), (1191, 'P20 clac'), (1507, 'P26 Seceda ★'),
           (1612, 'P27 Tre Cime ★'), (1822, 'P30 Sorapis ★'), (1927, 'P31 déclic'), (2009, 'P33 drop 2'), (2063, 'P34 pierre'), (2297, 'P38 Tofana ★'),
           (2429, 'P40 lac doré ★'), (2560, 'P42 épingle ★'), (2640, 'P43 Giau ★'), (2718, 'P44 bras levés'), (2848, 'P46 bivouac'),
           (3060, 'P49 publie'), (3113, 'P50 bivouac ★'), (3271, 'P52 remontée'), (3376, 'P53 orbite'), (3480, 'P54 logo')]
JOINS = [(5.41, 'v1'), (31.69, 'v2'), (33.48, 'v1 v2'), (47.47, 'v1'), (51.0, 'v1 v2'), (54.51, 'v2'), (58.0, 'v1')]


def read(path, sr=SR):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-af', 'pan=mono|c0=0.5*c0+0.5*c1', '-ar', str(sr), '-f', 'f32le', '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).astype(np.float64)


def ebur(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-filter_complex', 'ebur128=framelog=info', '-f', 'null', '-'],
                       capture_output=True, text=True)
    t, M, S = [], [], []
    for line in r.stderr.split('\n'):
        m = re.search(r't:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)\s+S:\s*(-?[\d.]+|-inf)', line)
        if m:
            t.append(float(m.group(1))); M.append(float(m.group(2).replace('-inf', '-70'))); S.append(float(m.group(3).replace('-inf', '-70')))
    return np.array(t), np.array(M), np.array(S)


def at(t, v, x):
    return float(v[np.argmin(np.abs(t - x))])


def dip(x, tj):
    """Creux : RMS minimum sur 10 ms dans ±30 ms du raccord, comparé au RMS des 200 ms autour (dB)."""
    a = int((tj - 0.1) * SR); b = int((tj + 0.1) * SR)
    ref = np.sqrt(np.mean(x[a:b] ** 2)) + 1e-12
    w = int(0.01 * SR)
    best = 1e9
    for s in range(int((tj - 0.03) * SR), int((tj + 0.03) * SR) - w, int(0.002 * SR)):
        best = min(best, np.sqrt(np.mean(x[s:s + w] ** 2)))
    return 20 * np.log10(best / ref + 1e-12)


def main():
    out = {'ffmpeg': subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.split(' Copyright')[0]}
    L = {k: ebur(p) for k, p in FILES.items()}
    X = {k: read(p) for k, p in FILES.items()}
    rows = []
    for f, lab in MOMENTS:
        s = f / 60
        r = {'frame': f, 'moment': lab}
        for k in FILES:
            t, M, S = L[k]
            # M à +0,4 s (fenêtre qui contient le moment), S à +1,5 s, et variation de M sur ±1 s
            r[k] = {'M': at(t, M, s + 0.4), 'S': at(t, S, s + 1.5), 'dM': at(t, M, s + 0.5) - at(t, M, s - 0.5)}
        rows.append(r)
    out['moments'] = rows
    out['joins'] = []
    for tj, which in JOINS:
        r = {'t': tj, 'versions': which}
        for k in ('lit-v1', 'lit-v2'):
            t, M, S = L[k]
            r[k] = {'dip_db': dip(X[k], tj), 'M_before': at(t, M, tj - 0.05), 'M_after': at(t, M, tj + 0.45)}
        out['joins'].append(r)
    js = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
    if js:
        Path(js).write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"{'image':>5} {'moment':16s} | lit v1 M / S / ΔM | lit v2 M / S / ΔM | mix v1 S | mix v2 S")
    for r in rows:
        a, b = r['lit-v1'], r['lit-v2']
        print(f"{r['frame']:5d} {r['moment']:16s} | {a['M']:6.1f} {a['S']:6.1f} {a['dM']:+5.1f} | {b['M']:6.1f} {b['S']:6.1f} {b['dM']:+5.1f} | {r['mix-v1']['S']:6.1f} | {r['mix-v2']['S']:6.1f}")
    print('\nraccord | creux 10 ms v1 / v2 (dB) | M avant → après v1 | v2')
    for r in out['joins']:
        a, b = r['lit-v1'], r['lit-v2']
        print(f"{r['t']:6.2f} {r['versions']:6s} | {a['dip_db']:6.1f} / {b['dip_db']:6.1f} | {a['M_before']:6.1f} → {a['M_after']:6.1f} | {b['M_before']:6.1f} → {b['M_after']:6.1f}")

    # ── Planche ──
    W, H = 1600, 900
    img = Image.new('RGB', (W, H), (16, 22, 19))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
        small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
    except OSError:
        font = small = ImageFont.load_default()
    d.text((16, 8), 'Son du trailer LKDV : calage musique / image (mesuré, non écouté — FFmpeg 6.1.1 ebur128)', fill=(240, 240, 230), font=font)
    d.text((16, 26), 'Courbes : volume momentané (400 ms) du MIX — gris = v1, vert = v2. Bandeau : enveloppe RMS 50 ms du lit v2. Tirets verts : collages ajoutés en v2. Traits fins en haut : 54 coupes. '
           'Lignes : repères 325/2009/2848/3060/3480.', fill=(190, 190, 180), font=small)
    x0, x1, y0, y1 = 50, W - 20, 60, 430
    X_ = lambda s: x0 + (x1 - x0) * s / 60
    Y_ = lambda lu: y1 - (y1 - y0) * (np.clip(lu, -40, -5) + 40) / 35
    # enveloppe du lit v2 (RMS 50 ms)
    e = X['lit-v2']; w = int(0.05 * SR); n = len(e) // w
    env = 20 * np.log10(np.sqrt((e[:n * w].reshape(n, w) ** 2).mean(axis=1)) + 1e-9)
    for i in range(n):
        xx = X_(i * 0.05); hh = (np.clip(env[i], -30, -3) + 30) / 27 * 60
        d.line([(xx, y1 + 70 - hh / 2), (xx, y1 + 70 + hh / 2)], fill=(70, 100, 80))
    for lu in (-30, -20, -14, -10):
        d.line([(x0, Y_(lu)), (x1, Y_(lu))], fill=(45, 55, 50)); d.text((8, Y_(lu) - 7), f'{lu}', fill=(140, 140, 130), font=small)
    for s in range(0, 61, 5):
        d.text((X_(s) - 6, y1 + 108), f'{s}s', fill=(160, 160, 150), font=small)
    shots = json.loads((TR / 'film/shots.json').read_text())['shots']
    for sh in shots:
        xx = X_(sh['startFrame'] / 60); d.line([(xx, y0 - 6), (xx, y0 + 4)], fill=(200, 200, 190))
    for f, lab in MARKS:
        xx = X_(f / 60); d.line([(xx, y0), (xx, y1 + 100)], fill=(214, 160, 60), width=2)
        d.text((xx + 3, y0 + 2), f'{lab} {f}', fill=(230, 180, 80), font=small)
    for tj, which in JOINS:
        if 'v2' in which and 'v1' not in which:
            xx = X_(tj)
            for yy in range(y0, y1 + 100, 8):
                d.line([(xx, yy), (xx, yy + 4)], fill=(120, 200, 140), width=1)
    for k, col in (('mix-v1', (120, 120, 120)), ('mix-v2', (120, 220, 150))):
        t, M, S = L[k]
        pts = [(X_(tt - 0.2), Y_(m)) for tt, m in zip(t, M) if tt >= 0.4]
        d.line(pts, fill=col, width=2 if k == 'mix-v2' else 1)
    for i, (f, lab) in enumerate(MOMENTS):
        xx = X_(f / 60); yy = y1 + 2 + (i % 3) * 13
        d.line([(xx, y1 - 4), (xx, y1 + 4)], fill=(250, 250, 250))
        d.text((xx + 2, y1 - 30 - (i % 4) * 12), lab, fill=(235, 235, 225), font=small)
    # spectrogrammes ±1,2 s autour de chaque raccord, lit v1 (rangée 1) et lit v2 (rangée 2)
    top = 585; ph = 135; pw = (W - 40 - 6 * 8) // 7
    d.text((16, top - 20), 'Spectrogrammes ±1,2 s (30 Hz–12 kHz, log) autour des raccords. Rangée haute : lit v1. Rangée basse : lit v2. Trait orange : instant du raccord.',
           fill=(190, 190, 180), font=small)
    N, Hp = 2048, 256
    edges = np.geomspace(30, 12000, ph + 1)
    for ci, (tj, which) in enumerate(JOINS):
        for ri, k in enumerate(('lit-v1', 'lit-v2')):
            px = 20 + ci * (pw + 8); py = top + ri * (ph + 26)
            seg = X[k][int((tj - 1.2) * SR):int((tj + 1.2) * SR)]
            m = 1 + (len(seg) - N) // Hp
            ii = np.arange(N)[None, :] + Hp * np.arange(m)[:, None]
            P = np.abs(np.fft.rfft(seg[ii] * np.hanning(N), axis=1)) ** 2
            f = np.fft.rfftfreq(N, 1 / SR)
            Sg = np.zeros((m, ph))
            for b in range(ph):
                sel = (f >= edges[b]) & (f < edges[b + 1])
                Sg[:, b] = P[:, sel].mean(axis=1) if sel.any() else P[:, np.argmin(np.abs(f - edges[b]))]
            D = 10 * np.log10(Sg + 1e-12); D = np.clip((D - (D.max() - 75)) / 75, 0, 1)
            cols = np.linspace(0, m - 1, pw).astype(int)
            A = D[cols].T[::-1]
            rgb = np.stack([A ** 1.6 * 255, A * 210, 40 + A * 30], -1).astype(np.uint8)
            img.paste(Image.fromarray(rgb), (px, py))
            d.line([(px + pw // 2, py), (px + pw // 2, py + ph)], fill=(255, 150, 40))
            active = ('v1' in which) if ri == 0 else ('v2' in which)
            lab = f"{'v1' if ri == 0 else 'v2'} {tj:.2f} s" + ('' if active else ' (continu)')
            dd = out['joins'][ci][k]['dip_db']
            d.text((px, py + ph + 2), f'{lab} · creux {dd:.1f} dB', fill=(235, 235, 225) if active else (150, 150, 140), font=small)
    p = QA / 'snapshots' / 'son' / 'calage.png'
    p.parent.mkdir(parents=True, exist_ok=True)
    img.quantize(colors=96, method=Image.Quantize.MEDIANCUT).save(p, optimize=True)
    print(f'\n{p} : {p.stat().st_size // 1024} Ko')


if __name__ == '__main__':
    main()
