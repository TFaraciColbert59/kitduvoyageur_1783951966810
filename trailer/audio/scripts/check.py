#!/usr/bin/env python3
"""Contrôles de la maquette : durée, seam de boucle, silences, clipping, synchro des attaques."""
import sys, subprocess, re, json
import numpy as np
import scipy.signal as ss
from scipy.io import wavfile
import subprocess, tempfile, os

SR = 48000
path = sys.argv[1]
tmpf = tempfile.mktemp(suffix='.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-c:a', 'pcm_f32le', tmpf], check=True)
sr, x = wavfile.read(tmpf)
os.remove(tmpf)
x = x.astype(np.float64)
N = len(x)
print('samples', N, 'sr', sr, 'channels', x.shape[1])
db = lambda v: 20 * np.log10(max(v, 1e-12))
print('sample peak dBFS: %.2f' % db(np.max(np.abs(x))), ' samples >= 0.9999 FS:', int(np.sum(np.abs(x) >= 0.9999)))

# seam
a, b = x[-int(0.05 * SR):], x[:int(0.05 * SR)]
print('boucle : x[N-1]=%s  x[0]=%s  saut=%.2e (%.1f dBFS)' % (x[-1], x[0], np.max(np.abs(x[0] - x[-1])), db(np.max(np.abs(x[0] - x[-1])))))
cat = np.concatenate([a, b])
d = np.abs(np.diff(cat, axis=0))
print('plus grand écart d\'échantillons consécutifs sur 50 ms|jonction|50 ms : %.2e (%.1f dBFS) ; à la jonction : %.2e (%.1f dBFS)' % (d.max(), db(d.max()), d[len(a) - 1].max(), db(d[len(a) - 1].max())))
print('  écart max dans le corps (60 s, ref) : %.2e (%.1f dBFS)' % (np.abs(np.diff(x, axis=0)).max(), db(np.abs(np.diff(x, axis=0)).max())))
# sans les 3 ms de garde : écart brut entre les échantillons voisins du centre du garde

# silences
for t0, t1 in ((11.5, 12.0), (37.0, 37.5), (45.5, 46.0), (54.0, 54.5)):
    s = x[int(t0 * SR):int(t1 * SR)]
    print('silence %.1f-%.1f : crête %.1f dBFS, RMS %.1f dBFS' % (t0, t1, db(np.max(np.abs(s))), db(np.sqrt(np.mean(s ** 2)))))

# onsets
mono = x.mean(axis=1)
hpf = ss.sosfilt(ss.butter(2, 120, 'high', fs=SR, output='sos'), mono)
E = hpf ** 2
c = np.concatenate([[0], np.cumsum(E)])
def win(a, b):
    a, b = max(a, 0), min(b, N)
    return (c[b] - c[a]) / max(b - a, 1)

def onset(tg, span=0.08):
    """Attaque = pic de montée de l'enveloppe (1 ms) en dB, affiné au 1er instant à 25 % du pic local."""
    w = int(0.001 * SR)
    env = np.sqrt(np.convolve(E, np.ones(w) / w, 'same')) + 1e-6
    le = 20 * np.log10(env)
    lo, hi = int((tg - span) * SR), int((tg + span) * SR)
    rise = le[lo + w:hi + w] - le[lo:hi]
    bi = lo + int(np.argmax(rise))
    pk = env[bi:bi + int(0.008 * SR)].max()
    j = bi + int(np.argmax(env[bi:bi + int(0.008 * SR)] >= 0.25 * pk))
    return j / SR, float(rise.max())

res = []
for tg, nm in ((1.5, 'impact 0:01,5'), (2.25, 'impact sec 0:02,25'), (6.0, 'CHOC 1 0:06'), (12.0, 'CHOC 2 0:12'), (46.0, 'CHOC 3 0:46'),
               (3.0, 'signature piano 0:03'), (52.0, 'signature piano 0:52'), (37.5, 'coup sec 0:37,5'), (54.5, 'ping 0:54,5')):
    t, r = onset(tg, 0.03)
    res.append((nm, tg, t, (t - tg) * 1000))
    print('attaque %-22s grille %.3f  mesuré %.4f  écart %+.1f ms' % (nm, tg, t, (t - tg) * 1000))
print('écart max |impacts| : %.1f ms' % max(abs(r[3]) for r in res[:5]))
# début/fin réels des silences (premier/dernier échantillon non nul autour)
for t0, t1 in ((11.5, 12.0), (37.0, 37.5), (45.5, 46.0), (54.0, 54.5)):
    lo, hi = int((t0 - 0.05) * SR), int((t1 + 0.05) * SR)
    seg = np.abs(x[lo:hi]).max(axis=1)
    nz = np.where(seg > 10 ** (-70 / 20))[0]
    gap = np.where(np.diff(nz) > 100)[0]
    # plus long trou sous -70 dBFS
    if len(gap):
        k = gap[np.argmax(np.diff(nz)[gap])]
        s0, s1 = (nz[k] + lo) / SR, (nz[k + 1] + lo) / SR
        print('trou < -70 dBFS : %.4f -> %.4f s (durée %.4f s) ; grille %.1f -> %.1f ; début %+.1f ms fin %+.1f ms' % (s0, s1, s1 - s0, t0, t1, (s0 - t0) * 1000, (s1 - t1) * 1000))
# profil seconde par seconde
prof = [db(np.sqrt(np.mean(x[i * SR:(i + 1) * SR] ** 2))) for i in range(60)]
print('RMS par seconde (dBFS):')
print(' '.join('%d:%.0f' % (i, p) for i, p in enumerate(prof)))
