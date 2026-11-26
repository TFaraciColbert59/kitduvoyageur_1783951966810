#!/usr/bin/env python3
"""Planches du mix v5 → qa/snapshots/son-v5/
  film-60s.png  : trois pistes empilées (musique, habillage, effets) : forme d'onde (crête et RMS 10 ms) et spectrogramme
                  (30 Hz–18 kHz, échelle log), sections du film, nom de chaque effet à sa place.
  accents.png   : 4 accents (clac de la boucle, pied sur la pierre, réception du saut, coup du logo) : l'image du film au geste
                  à côté de la forme d'onde (mix et piste du son) sur ±12 images, une graduation par image, pic mesuré.
Lit qa/mix-v5*.wav, qa/tmp/sfx-v5-placements.json, livraison/LKDV-ours-v5.mp4 (images). python3 + numpy + Pillow, FFmpeg.
Mesuré, non écouté."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

T = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
Q = os.path.join(T, 'qa'); OUT = os.path.join(Q, 'snapshots', 'son-v5'); os.makedirs(OUT, exist_ok=True)
SR, FPS = 48000, 24

def font(sz):
    for f in ('/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
F12, F14, F18, F24 = font(12), font(14), font(18), font(24)

def rd(f):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.float32).reshape(-1, 2)

def frame(t_frame, path, w):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f"select='eq(n\\,{t_frame})',scale={w}:-2", '-vsync', '0', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                       capture_output=True, check=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(b)).convert('RGB')

tracks = [('musique', rd(os.path.join(Q, 'mix-v5-musique.wav')), (90, 160, 230)),
          ('habillage', rd(os.path.join(Q, 'mix-v5-habillage.wav')), (240, 170, 70)),
          ('effets', rd(os.path.join(Q, 'mix-v5-effets.wav')), (110, 210, 140))]
mix = rd(os.path.join(Q, 'mix-v5.wav'))
P = json.load(open(os.path.join(Q, 'tmp', 'sfx-v5-placements.json')))
cues = P['placed']
SECTIONS = [('cosmos', 0, 126), ('déclic', 126, 294), ('décision', 294, 462), ('départ', 462, 589), ('montagne (drop 1)', 589, 799),
            ('coureur, cycliste (drop 2)', 799, 1093), ('bivouac', 1093, 1261), ('final', 1261, 1387), ('logo', 1387, 1440)]
BG, FG, GRID = (18, 18, 20), (225, 225, 225), (60, 60, 66)

# ── Planche 60 s ─────────────────────────────────────────────────────────────────────────────────────────────────────
W, L, R = 2600, 120, 20
pw = W - L - R
x_of = lambda s: L + s / 60 * pw
WAVE_H, SPEC_H, GAP = 110, 120, 16
LAB_H = 195
H = 70 + 3 * (WAVE_H + SPEC_H + GAP) + LAB_H + 40
img = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(img)
d.text((L, 10), 'Mix v5 — musique, habillage, effets (pistes séparées, même gain commun) · 60,000 s · mesuré, non écouté', fill=FG, font=F24)
y0 = 50
for i, (name, a, b) in enumerate(SECTIONS):
    xa, xb = x_of(a / FPS), x_of(b / FPS)
    d.rectangle([xa, y0, xb, y0 + 18], fill=(40, 40, 48) if i % 2 else (52, 52, 62)); d.text((xa + 4, y0 + 2), name, fill=FG, font=F12)
for s in range(0, 61, 5):
    d.text((x_of(s) - 8, H - 30), f'{s} s', fill=FG, font=F12)

def spec(x, h):
    m = x.mean(1); n, hop = 2048, 480
    cols = (len(m) - n) // hop
    win = np.hanning(n).astype(np.float32)
    idx = np.arange(n)[None, :] + hop * np.arange(cols)[:, None]
    S = np.abs(np.fft.rfft(m[idx] * win, axis=1)) ** 2
    fr = np.fft.rfftfreq(n, 1 / SR)
    edges = np.geomspace(30, 18000, h + 1)
    out = np.zeros((h, cols), np.float32)
    for k in range(h):
        sel = (fr >= edges[k]) & (fr < edges[k + 1])
        out[h - 1 - k] = S[:, sel].mean(1) if sel.any() else S[:, np.argmin(abs(fr - edges[k]))]
    return 10 * np.log10(out + 1e-14)

y = y0 + 30
for name, x, col in tracks:
    m = np.abs(x).max(1)
    rms = np.sqrt((x ** 2).mean(1))
    d.text((8, y + 8), name, fill=col, font=F18)
    d.rectangle([L, y, L + pw, y + WAVE_H], outline=GRID)
    mid = y + WAVE_H / 2
    for px in range(pw):
        a, b = int(px / pw * len(m)), int((px + 1) / pw * len(m))
        pk, rr = m[a:b].max(), np.sqrt((rms[a:b] ** 2).mean())
        d.line([L + px, mid - pk * WAVE_H / 2, L + px, mid + pk * WAVE_H / 2], fill=tuple(int(c * 0.55) for c in col))
        d.line([L + px, mid - rr * WAVE_H / 2, L + px, mid + rr * WAVE_H / 2], fill=col)
    lv = 20 * np.log10(m.max() + 1e-12)
    d.text((8, y + 32), f'crête {lv:.1f} dBFS', fill=FG, font=F12)
    ys = y + WAVE_H + 2
    S = spec(x, SPEC_H)
    lo, hi = -100, S.max()
    S = np.clip((S - lo) / (hi - lo), 0, 1)
    rgb = (np.stack([S ** 1.6, S ** 0.9, S ** 2.2], -1) * 255).astype(np.uint8)
    sp = Image.fromarray(rgb).resize((pw, SPEC_H))
    img.paste(sp, (L, ys))
    for f in (100, 1000, 10000):
        yy = ys + SPEC_H - 1 - np.log(f / 30) / np.log(18000 / 30) * SPEC_H
        d.text((L - 50, yy - 7), f'{f // 1000} kHz' if f >= 1000 else f'{f} Hz', fill=FG, font=F12)
    y = ys + SPEC_H + GAP
for name, a, b in SECTIONS:
    d.line([x_of(a / FPS), y0, x_of(a / FPS), y], fill=(110, 110, 120))
# Étiquettes des effets, en quinconce sous les pistes, avec un trait vers leur instant.
fam = {'geste': (255, 120, 120), 'matiere': (110, 210, 140), 'raccord': (150, 170, 255)}
rows = [-1e9] * 9
for c in sorted(cues, key=lambda c: c['picS'] if c['align'] == 'peak' else c['debutS']):
    t = c['picS'] if c['align'] == 'peak' else c['debutS']
    xx = x_of(t)
    lab = f"{c['id']} {c['plan']} {c['fichier'].replace('.wav', '')}"
    wlab = d.textlength(lab, font=F12)
    k = next((k for k in range(len(rows)) if rows[k] < xx - 4), len(rows) - 1)
    rows[k] = xx + wlab
    yy = y + 4 + k * 20
    colr = fam.get(c['famille'], FG)
    if c['align'] != 'peak':
        d.line([x_of(c['debutS']), yy + 16, x_of(c['finS']), yy + 16], fill=colr, width=2)
    d.line([xx, y - GAP - SPEC_H - WAVE_H - 2, xx, yy], fill=colr)
    d.text((xx + 2, yy), lab, fill=colr, font=F12)
d.text((W - 1000, 14), 'rouge : gestes · vert : matières et ambiances (trait = durée) · bleu : raccords · creux −4 dB avant le drop 1 sur la piste musique', fill=FG, font=F12)
img.save(os.path.join(OUT, 'film-60s.png'))

# ── Zoom sur 4 accents ───────────────────────────────────────────────────────────────────────────────────────────────
by = {c['id']: c for c in cues}
hab = tracks[1][1]
def peak_time(x, a, b):
    m = x.mean(1)[a:b] ** 2
    w = 240; e = np.convolve(m, np.ones(w) / w, 'same')
    return (a + int(np.argmax(e))) / SR
logo_hit = 33 * 4 * 0.437965
acc = [('Clac de la boucle (P20)', 472, by['G04']['picS'], tracks[2][1], 'effets : clac-boucle-c', 'les deux moitiés se rejoignent : 471 (flou) → 472 (fermée)'),
       ('Pied sur la pierre (P34)', 820, by['G05']['picS'], tracks[2][1], 'effets : appui-pierre', 'chaussure sur le rocher dès la 1re image du plan'),
       ('Réception du saut (P37)', 866, by['G06']['picS'], tracks[2][1], 'effets : reception-rocher', 'le pied avant se pose sur le rocher (p37-2 n°13)'),
       ('Coup du logo (P54)', 1387, peak_time(hab, int((logo_hit - 0.2) * SR), int((logo_hit + 0.3) * SR)), hab, 'habillage : impact-logo', 'le logo apparaît (1re image du plan)')]
film = os.path.join(T, 'livraison', 'LKDV-ours-v5.mp4')
IW, ROWH = 560, 330
W2 = 1900
img2 = Image.new('RGB', (W2, 60 + ROWH * 4), BG); d2 = ImageDraw.Draw(img2)
d2.text((20, 14), 'Calage des 4 accents : image du geste et forme d\'onde (±12 images, une graduation par image) · mesuré, non écouté', fill=FG, font=F24)
for r, (title, fr, pk, stem, stemname, why) in enumerate(acc):
    yt = 60 + r * ROWH
    im = frame(fr, film, IW); img2.paste(im, (20, yt + 26))
    d2.text((20, yt + 4), f'{title} · image {fr} · {why}', fill=FG, font=F18)
    gx, gw, gy, gh = IW + 50, W2 - IW - 80, yt + 30, ROWH - 70
    a, b = (fr - 12) / FPS, (fr + 13) / FPS
    X = lambda s: gx + (s - a) / (b - a) * gw
    for f in range(fr - 12, fr + 14):
        d2.line([X(f / FPS), gy, X(f / FPS), gy + gh], fill=GRID if f != fr else (200, 200, 90))
        if f % 2 == 0: d2.text((X(f / FPS) + 2, gy + gh + 4), str(f), fill=FG, font=F12)
    d2.rectangle([X(fr / FPS), gy, X((fr + 1) / FPS), gy + gh], outline=(200, 200, 90), width=2)
    for x, col, half, lab in ((mix, (200, 200, 200), 0, 'mix v5'), (stem, (255, 120, 120), 1, stemname)):
        cy = gy + gh * (0.27 + 0.5 * half); hh = gh * 0.24
        seg = x[int(a * SR):int(b * SR)].mean(1)
        sc = 1 / (np.abs(seg).max() + 1e-9)
        for px in range(int(gw)):
            i0, i1 = int(px / gw * len(seg)), int((px + 1) / gw * len(seg))
            lo_, hi_ = seg[i0:i1].min(), seg[i0:i1].max()
            d2.line([gx + px, cy - hi_ * sc * hh, gx + px, cy - lo_ * sc * hh], fill=col)
        d2.text((gx + 4, cy - hh), lab, fill=col, font=F14)
    d2.line([X(pk), gy, X(pk), gy + gh], fill=(255, 80, 80), width=2)
    ecart = pk * FPS - (fr + 0.5)
    d2.text((X(pk) + 6, gy + gh - 22), f'pic du son {pk:.3f} s = image {pk * FPS:.2f} (écart au milieu de l\'image {fr} : {ecart:+.2f} image)', fill=(255, 120, 120), font=F14)
img2.save(os.path.join(OUT, 'accents.png'))
print(f'✓ {OUT}/film-60s.png, accents.png')
