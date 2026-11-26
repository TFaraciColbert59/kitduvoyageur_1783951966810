#!/usr/bin/env python3
"""Raccords et sections de STORM II, temps par temps (sound-designer). Mesuré, non écouté.

- énergie par temps (tout, grave 30–150 Hz, aigu 4–11 kHz) sur des fenêtres du morceau ;
- chroma (12 classes de hauteur, 80–2000 Hz) par mesure, tonalité estimée (profils Krumhansl) ;
- similarité harmonique des mesures de part et d'autre de chaque vrai collage.

Usage : python3 tools/audio/audit-raccords.py
"""
import json, subprocess
from pathlib import Path
import numpy as np

TRAILER = Path(__file__).resolve().parents[2]
AUDIO = TRAILER / 'assets' / 'audio'
SR, NFFT, HOP = 22050, 4096, 512
NOTES = ['do', 'do#', 'ré', 'ré#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si']
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def read_mono(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-af', 'pan=mono|c0=0.5*c0+0.5*c1', '-ar', str(SR), '-f', 'f32le', '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


x = read_mono(AUDIO / 'storm-ii.mp3')
beats = np.array(json.loads((AUDIO / 'storm-ii.beats.json').read_text())['beatTimes'])
n = 1 + (len(x) - NFFT) // HOP
idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
P = np.abs(np.fft.rfft(x[idx] * np.hanning(NFFT), axis=1)) ** 2
f = np.fft.rfftfreq(NFFT, 1 / SR)
tf = np.arange(n) * HOP / SR + NFFT / 2 / SR
sel = (f >= 80) & (f <= 2000)
pc = (np.round(12 * np.log2(f[sel] / 440)).astype(int) + 9) % 12  # 0 = do
C = np.zeros((n, 12))
for k in range(12):
    C[:, k] = P[:, sel][:, pc == k].sum(axis=1)
lo = P[:, (f >= 30) & (f < 150)].sum(axis=1)
hi = P[:, (f >= 4000) & (f < 11000)].sum(axis=1)
al = P.sum(axis=1)
db = lambda v: 10 * np.log10(v + 1e-12)


def chroma(a, b):
    s = (tf >= a) & (tf < b)
    v = C[s].mean(axis=0)
    return v / (np.linalg.norm(v) + 1e-12)


def key(v):
    best = None
    for r in range(12):
        for name, prof in (('majeur', MAJ), ('mineur', MIN)):
            c = np.corrcoef(v, np.roll(prof, r))[0, 1]
            if best is None or c > best[0]:
                best = (c, f'{NOTES[r]} {name}')
    return best


def bar_t(k):
    return beats[k] if k < len(beats) else beats[-1] + (k - len(beats) + 1) * 0.4383


print('== Énergie par temps (dB relatifs), fenêtres clés ==')
for a, b, lab in [(68.0, 73.5, 'entrée drop 1'), (97.8, 101.5, 'fin drop 1'), (111.7, 115.4, 'entrée reprise'), (118.8, 129.6, 'montée vers drop 2 + impact'),
                  (152.0, 160.9, 'fin drop 2 → outro'), (139.8, 143.4, 'milieu drop 2 (point d\'entrée 33,48)')]:
    print(f'-- {lab} --')
    for k in np.where((beats >= a) & (beats < b))[0]:
        s = (tf >= beats[k]) & (tf < (beats[k + 1] if k + 1 < len(beats) else beats[k] + .44))
        mark = '|' if k % 4 == 3 else ' '
        print(f'{mark} {k:3d} {beats[k]:7.3f}  tout {db(al[s].mean()):5.1f}  grave {db(lo[s].mean()):5.1f}  aigu {db(hi[s].mean()):5.1f}')

print('\n== Tonalité estimée par section (chroma 80–2000 Hz, Krumhansl) ==')
secs = [(66.085, 71.495, 'fin montée (film 0–5,41)'), (71.495, 99.565, 'drop 1'), (99.565, 113.55, 'pont'), (113.55, 127.545, 'reprise'),
        (120.545, 127.545, 'montée utilisée (film 51–58)'), (127.545, 141.565, 'drop 2, 1re moitié'), (141.565, 155.555, 'drop 2, 2e moitié'),
        (155.555, 166.0, 'outro'), (155.555, 159.085, 'outro utilisée (film 47,47–51)')]
keys = {}
for a, b, lab in secs:
    c, k = key(chroma(a, b))
    keys[lab] = (k, round(float(c), 2))
    top = np.argsort(chroma(a, b))[::-1][:4]
    print(f'{lab:32s} {k:12s} r={c:.2f}  classes dominantes : {", ".join(NOTES[t] for t in top)}')

# chroma par mesure : drop 1 et drop 2 (16 mesures chacun)
d1 = [163 + 4 * m for m in range(16)]
d2 = [291 + 4 * m for m in range(16)]
B1 = np.array([chroma(bar_t(k), bar_t(k + 4)) for k in d1])
B2 = np.array([chroma(bar_t(k), bar_t(k + 4)) for k in d2])
print('\n== Similarité harmonique mesure à mesure (cosinus) ==')
print('drop 1 mesure m vs drop 2 mesure m :', ' '.join(f'{float(B1[m] @ B2[m]):.2f}' for m in range(16)))
print('drop 1 m vs drop 1 m+8 :', ' '.join(f'{float(B1[m] @ B1[m + 8]):.2f}' for m in range(8)))

print('\n== Vrais collages : la mesure qui suit dans le film vs celle qui suit dans le morceau ==')
def cos(a, b): return float(a @ b)
pairs = [
    ('33,48 s : fin drop 1 (99,565) → drop 2 m9 (141,565)', (97.812, 99.565), (141.565, 143.32), (99.565, 101.28)),
    ('51,00 s : outro m2 (159,085) → reprise m5 (120,545)', (157.34, 159.085), (120.545, 122.33), (159.085, 160.84)),
]
for lab, before, after, natural in pairs:
    cb, ca, cn = chroma(*before), chroma(*after), chroma(*natural)
    print(f'{lab}\n   avant/après (film) {cos(cb, ca):.2f}   avant/suite naturelle {cos(cb, cn):.2f}   tonalités : {key(cb)[1]} → {key(ca)[1]} (naturel : {key(cn)[1]})')

# candidats pour 51,00 → 58,00 : 4 mesures finissant sur 127,545, ou toute fenêtre de 4 mesures, vue depuis la fin de l'outro utilisée
print('\n== Candidats de 4 mesures pour 51,00–58,00 (avant l\'impact du drop 2) ==')
cb = chroma(157.34, 159.085)
dr = chroma(127.545, 129.31)
for k0 in range(195, 292, 4):
    if k0 % 4 != 3:
        continue
    a, b = bar_t(k0), bar_t(k0 + 16)
    s0 = (tf >= a) & (tf < bar_t(k0 + 4))
    s3 = (tf >= bar_t(k0 + 12)) & (tf < b)
    first, last = chroma(a, bar_t(k0 + 4)), chroma(bar_t(k0 + 12), b)
    print(f'{k0:3d} {a:7.2f}–{b:7.2f}  entrée {db(al[s0].mean()):5.1f} dB grave {db(lo[s0].mean()):5.1f} | sortie {db(al[s3].mean()):5.1f} grave {db(lo[s3].mean()):5.1f}'
          f'  harm. outro→entrée {cos(cb, first):.2f}  sortie→drop2 {cos(last, dr):.2f}')
ref = (155.555, 159.085)
s = (tf >= ref[0]) & (tf < ref[1])
print(f'outro utilisée : {db(al[s].mean()):5.1f} dB, grave {db(lo[s].mean()):5.1f}')

print('\n== Montage v2 : collages proposés (harmonie et niveau, mesure avant / mesure après) ==')
def lvl(a, b):
    s = (tf >= a) & (tf < b)
    return db(al[s].mean()), db(lo[s].mean()), db(hi[s].mean())
v2 = [
    ('31,69 s (P31) : drop 1 m15 → pré-drop m71', (96.02, 97.775), (125.755, 127.545), (97.775, 99.565)),
    ('33,48 s (P33) : pré-drop m71 → drop 2 m80', (125.755, 127.545), (141.565, 143.32), (127.545, 129.305)),
    ('51,00 s (P49) : outro m89 → pont m62', (157.335, 159.085), (110.035, 111.765), (159.085, 160.845)),
    ('54,51 s (P52) : pont m63 → reprise m70', (111.765, 113.545), (124.055, 125.805), (113.545, 115.295)),
    ('v1 51,00 s : outro m89 → reprise m68', (157.335, 159.085), (120.545, 122.335), (159.085, 160.845)),
    ('v1 33,48 s : drop 1 m55 → drop 2 m80', (97.775, 99.565), (141.565, 143.32), (99.565, 101.285)),
]
for lab, before, after, natural in v2:
    cb, ca, cn = chroma(*before), chroma(*after), chroma(*natural)
    la, lb = lvl(*before), lvl(*after)
    print(f'{lab}\n   harmonie avant/après {cos(cb, ca):.2f} (suite naturelle {cos(cb, cn):.2f}) ; niveau {la[0]:.1f} → {lb[0]:.1f} dB, grave {la[1]:.1f} → {lb[1]:.1f}, aigu {la[2]:.1f} → {lb[2]:.1f}')

print('\n== Attaque grave précise (pas 2,9 ms) autour des premiers temps utilisés ==')
H2 = 64
def kick_onset(t):
    a = int((t - 0.08) * SR); b = int((t + 0.08) * SR)
    seg = x[a:b]
    m = 1 + (len(seg) - 1024) // H2
    ii = np.arange(1024)[None, :] + H2 * np.arange(m)[:, None]
    Q = np.abs(np.fft.rfft(seg[ii] * np.hanning(1024), axis=1)) ** 2
    ff = np.fft.rfftfreq(1024, 1 / SR)
    e = np.log10(Q[:, (ff >= 30) & (ff < 150)].sum(axis=1) + 1e-9)
    d = np.diff(e)
    k = int(np.argmax(d))
    return (a + (k + 1) * H2 + 512) / SR, float(d[k])
for t in [71.495, 97.775, 99.565, 110.03, 113.545, 120.545, 124.055, 125.805, 127.545, 141.565, 155.555, 159.085]:
    o, s = kick_onset(t)
    print(f'{t:8.3f} → attaque {o:8.3f} (écart {1000 * (o - t):+.0f} ms, force {s:.2f})')
