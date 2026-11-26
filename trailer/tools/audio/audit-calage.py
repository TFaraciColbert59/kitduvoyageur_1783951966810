#!/usr/bin/env python3
"""Audit de calage de la musique du trailer (sound-designer). Mesuré, non écouté.

Détection d'attaques indépendante (flux spectral log, numpy seul) sur le MP3 et sur le montage,
comparée aux temps de storm-ii.beats.json ; énergie par mesure sur tout le morceau (sections,
drops) ; phase de la grille par segment du montage.

Usage : python3 tools/audio/audit-calage.py [--montage FICHIER] [--json SORTIE]
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

TRAILER = Path(__file__).resolve().parents[2]
AUDIO = TRAILER / 'assets' / 'audio'
SR = 22050
HOP = 256
NFFT = 1024


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def read_mono(path, sr=SR):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-af', 'pan=mono|c0=0.5*c0+0.5*c1',
                        '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def stft_mag(x):
    n = 1 + (len(x) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    win = np.hanning(NFFT)
    return np.abs(np.fft.rfft(x[idx] * win, axis=1))  # (frames, bins)


def onset_env(mag, fmin=0, fmax=None):
    f = np.fft.rfftfreq(NFFT, 1 / SR)
    sel = (f >= fmin) & (f < (fmax or SR))
    lm = np.log1p(1000 * mag[:, sel])
    flux = np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    # soustraction d'une moyenne glissante (≈ 0,3 s) pour garder les attaques
    k = int(0.3 * SR / HOP)
    loc = np.convolve(flux, np.ones(k) / k, mode='same')
    return np.maximum(0, flux - loc)


def peaks(env, thr_rel=1.5, min_gap_s=0.07):
    """Attaques : maxima locaux > thr_rel × médiane glissante (1 s), espacés de min_gap_s."""
    k = int(1.0 * SR / HOP)
    med = np.array([np.median(env[max(0, i - k // 2):i + k // 2 + 1]) for i in range(0, len(env))]) if len(env) < 20000 else None
    if med is None:
        med = np.full(len(env), np.median(env))
    out = []
    gap = int(min_gap_s * SR / HOP)
    for i in range(1, len(env) - 1):
        if env[i] >= env[i - 1] and env[i] > env[i + 1] and env[i] > thr_rel * (med[i] + 1e-9):
            if out and i - out[-1] < gap:
                if env[i] > env[out[-1]]:
                    out[-1] = i
                continue
            out.append(i)
    t = np.array(out) * HOP / SR + (NFFT / 2) / SR  # centre de la fenêtre
    return t, env[np.array(out, dtype=int)] if out else np.array([])


def nearest(ref, t):
    j = np.searchsorted(ref, t)
    j = np.clip(j, 1, len(ref) - 1)
    a, b = ref[j - 1], ref[j]
    return np.where(np.abs(t - a) < np.abs(t - b), a, b)


def band_db(mag, lo, hi):
    f = np.fft.rfftfreq(NFFT, 1 / SR)
    sel = (f >= lo) & (f < hi)
    return mag[:, sel] ** 2


def main():
    beats_j = json.loads((AUDIO / 'storm-ii.beats.json').read_text())
    beats = np.array(beats_j['beatTimes'])
    out = {'ffmpeg': subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.split('\n')[0].split(' Copyright')[0],
           'bpm_file': beats_j['bpm'], 'beats': len(beats)}

    # 1. Grille : régularité des temps du fichier
    i = np.arange(len(beats))
    T, t0 = np.polyfit(i, beats, 1)
    res = beats - (t0 + T * i)
    d = np.diff(beats)
    out['grid'] = {'period_fit_s': T, 'bpm_fit': 60 / T, 't0': t0, 'resid_ms_rms': 1000 * float(np.sqrt(np.mean(res ** 2))),
                   'resid_ms_max': 1000 * float(np.max(np.abs(res))), 'ioi_ms_min': 1000 * float(d.min()), 'ioi_ms_max': 1000 * float(d.max()),
                   'ioi_ms_median': 1000 * float(np.median(d))}

    # 2. Attaques indépendantes sur le MP3 (toutes bandes et grave < 150 Hz)
    x = read_mono(AUDIO / 'storm-ii.mp3')
    mag = stft_mag(x)
    env = onset_env(mag)
    envk = onset_env(mag, 30, 150)
    tf = np.arange(len(env)) * HOP / SR + (NFFT / 2) / SR
    on_t, on_s = peaks(env)
    kk_t, kk_s = peaks(envk, thr_rel=2.0, min_gap_s=0.2)
    # pour chaque temps du fichier : attaque la plus proche (±60 ms)
    near = nearest(on_t, beats) - beats
    hit = np.abs(near) <= 0.060
    near_k = nearest(kk_t, beats) - beats
    hit_k = np.abs(near_k) <= 0.060
    # autocorrélation de l'enveloppe : période dominante entre 0,3 et 0,6 s
    e = env - env.mean()
    ac = np.correlate(e[:20000], e[:20000], mode='full')[19999:]
    lags = np.arange(len(ac)) * HOP / SR
    w = (lags > 0.3) & (lags < 0.6)
    lag = lags[w][np.argmax(ac[w])]
    # même mesure par section (avec la grille du fichier : phase moyenne des attaques par rapport aux temps)
    def phase_stats(t_on, b):
        dd = nearest(b, t_on) - t_on  # temps - attaque
        dd = dd[np.abs(dd) < 0.12]
        return {'n': int(len(dd)), 'median_ms': float(-1000 * np.median(dd)) if len(dd) else None}
    out['onsets_mp3'] = {
        'count': int(len(on_t)), 'kick_count': int(len(kk_t)),
        'beats_with_onset_60ms_pct': 100 * float(hit.mean()),
        'beats_with_kick_60ms_pct': 100 * float(hit_k.mean()),
        'offset_ms_median_all': 1000 * float(np.median(near[hit])),
        'offset_ms_p90_abs': 1000 * float(np.percentile(np.abs(near[hit]), 90)),
        'offset_ms_median_kick': 1000 * float(np.median(near_k[hit_k])) if hit_k.any() else None,
        'autocorr_period_s': float(lag), 'autocorr_bpm': 60 / float(lag),
    }

    # 3. Énergie par mesure sur tout le morceau (mesure = 4 temps, départ aux indices % 4 == 3)
    p_all = (mag ** 2).sum(axis=1)
    p_lo = band_db(mag, 30, 150).sum(axis=1)
    p_hi = band_db(mag, 4000, 11000).sum(axis=1)
    bars = []
    starts = [k for k in range(len(beats)) if k % 4 == 3]
    for n, k in enumerate(starts):
        a = beats[k]
        b = beats[k + 4] if k + 4 < len(beats) else a + 4 * T
        s = (tf >= a) & (tf < b)
        db = lambda p: float(10 * np.log10(p[s].mean() + 1e-12))
        kicks = int(((kk_t >= a) & (kk_t < b)).sum())
        bars.append({'bar': n, 'beat_index': k, 't': float(a), 'all': db(p_all), 'lo': db(p_lo), 'hi': db(p_hi), 'kicks': kicks})
    out['bars'] = bars
    out['bar_downbeat_of'] = {str(v): int(np.argmin(np.abs(beats - v))) for v in [66.085, 71.495, 99.565, 120.545, 127.545, 129.545, 141.565, 155.555, 159.085]}
    out['bar_downbeat_err_ms'] = {str(v): float(1000 * (beats[np.argmin(np.abs(beats - v))] - v)) for v in [66.085, 71.495, 99.565, 120.545, 127.545, 141.565, 155.555]}

    # 4. Montage : attaques en temps du film vs grille projetée
    mont = Path(arg('--montage', AUDIO / 'storm-ii-montage-60s.wav'))
    segs = [(0.0, 5.41, 66.085), (5.41, 33.48, 71.495), (33.48, 47.47, 141.565), (47.47, 51.0, 155.555), (51.0, 58.0, 120.545), (58.0, 60.0, 127.545)]
    fb = []
    for a, b, s in segs:
        for t in beats:
            if s - 1e-6 <= t < s + (b - a) - 1e-6:
                fb.append(a + t - s)
    fb = np.array(sorted(fb))
    y = read_mono(mont)
    mm = stft_mag(y)
    en = onset_env(mm)
    ont, ons = peaks(en)
    ek = onset_env(mm, 30, 150)
    okt, oks = peaks(ek, thr_rel=2.0, min_gap_s=0.2)
    seg_rows = []
    for a, b, s in segs:
        sel = (ont >= a + 0.05) & (ont < b - 0.05)
        dd = ont[sel] - nearest(fb, ont[sel])
        dd = dd[np.abs(dd) < 0.12]
        selk = (okt >= a + 0.05) & (okt < b - 0.05)
        dk = okt[selk] - nearest(fb, okt[selk])
        dk = dk[np.abs(dk) < 0.12]
        # attaques tombant sur un demi-temps (≈ ±T/2) : signe d'un décalage d'un demi-temps
        dh = ont[sel] - nearest(fb, ont[sel])
        half = float(np.mean(np.abs(np.abs(dh) - T / 2) < 0.04)) if len(dh) else None
        seg_rows.append({'film': [a, b], 'song': s, 'onsets': int(sel.sum()), 'on_grid_40ms_pct': 100 * float(np.mean(np.abs(ont[sel] - nearest(fb, ont[sel])) < 0.04)) if sel.any() else None,
                         'median_offset_ms': 1000 * float(np.median(dd)) if len(dd) else None,
                         'kick_median_offset_ms': 1000 * float(np.median(dk)) if len(dk) else None, 'kicks': int(selk.sum()),
                         'offbeat_pct': 100 * half if half is not None else None})
    out['montage'] = {'file': str(mont), 'film_beats': int(len(fb)), 'segments': seg_rows,
                      'kicks_film': [float(v) for v in okt]}
    # écarts entre temps successifs au passage des raccords (grille continue ?)
    out['montage']['ioi_at_joins_ms'] = {str(j): [float(1000 * v) for v in np.diff(fb[(fb > j - 1.0) & (fb < j + 1.0)])] for j in [5.41, 33.48, 47.47, 51.0, 58.0]}

    js = arg('--json')
    if js:
        Path(js).write_text(json.dumps(out, indent=1))
    o = dict(out)
    o['bars'] = f"{len(bars)} mesures"
    o['montage'] = {k: v for k, v in out['montage'].items() if k != 'kicks_film'}
    print(json.dumps(o, indent=1))
    print('\nmesure  t(s)    tout  grave  aigu  grosses-caisses')
    for r in bars:
        print(f"{r['bar']:3d} {r['t']:7.2f} {r['all']:6.1f} {r['lo']:6.1f} {r['hi']:6.1f} {r['kicks']:3d}")


if __name__ == '__main__':
    main()
