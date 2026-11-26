#!/usr/bin/env python3
"""Carte de caractère de STORM II, mesure par mesure (sound-designer). Mesuré, non écouté.

Pour chaque mesure du morceau (grille mesurée : temps 0,437965 s, m40 = 71,4914 s) :
- percussions : énergie de la composante percussive (séparation harmonique / percussive par filtres médians,
  façon Fitzgerald 2010 : médiane le long du temps = tenu, médiane le long des fréquences = percussif) ;
- tenu : énergie de la composante harmonique (nappes, accords, notes tenues) ;
- grosse caisse : somme du flux spectral positif 30–150 Hz ;
- grave (30–150 Hz), brillance (centroïde spectral, énergie 4–11 kHz), largeur stéréo (énergie côté / milieu, dB) ;
- auto-similarité : cosinus entre mesures sur un profil (chroma 12 + 24 bandes log-mel), et répétitions (≥ 0,97) ;
- classe : « doux et ample », « qui monte », « plein et percussif », « apaisé » (règles écrites plus bas).
Sorties : qa/tmp/carte-morceau.json, qa/snapshots/musique-v6/carte-morceau.png.
Usage : python3 tools/audio/carte-morceau.py   (ffmpeg dans le PATH)
"""
import json, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

TRAILER = Path(__file__).resolve().parents[2]
MP3 = TRAILER / 'assets' / 'audio' / 'storm-ii.mp3'
OUT_JSON = TRAILER / 'qa' / 'tmp' / 'carte-morceau.json'
OUT_PNG = TRAILER / 'qa' / 'snapshots' / 'musique-v6' / 'carte-morceau.png'
SR, NFFT, HOP = 22050, 2048, 512
BEAT, M40 = 0.437965, 71.4914
BAR = 4 * BEAT
FONTS = ['/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def bar_start(n):
    return M40 + (n - 40) * BAR


def read_stereo():
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(MP3), '-ar', str(SR), '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def stft(x):
    n = 1 + (len(x) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    return np.abs(np.fft.rfft(x[idx] * np.hanning(NFFT), axis=1))  # (frames, bins)


def median_filter(a, k, axis):
    """Filtre médian 1D de taille impaire k le long d'un axe, par blocs (pas de scipy)."""
    a = np.moveaxis(a, axis, -1)
    pad = k // 2
    ap = np.pad(a, [(0, 0)] * (a.ndim - 1) + [(pad, pad)], mode='edge')
    out = np.empty_like(a)
    step = 64
    for s in range(0, a.shape[0], step):
        w = np.lib.stride_tricks.sliding_window_view(ap[s:s + step], k, axis=-1)
        out[s:s + step] = np.median(w, axis=-1)
    return np.moveaxis(out, -1, axis)


def main():
    x = read_stereo()
    mid, side = x.mean(axis=1), (x[:, 0] - x[:, 1]) / 2
    S = stft(mid)
    Ss = stft(side)
    f = np.fft.rfftfreq(NFFT, 1 / SR)
    tf = (np.arange(S.shape[0]) * HOP + NFFT / 2) / SR
    # séparation tenu / percussif (masques souples)
    H = median_filter(S, 17, axis=0)   # le long du temps (≈ 0,4 s)
    P = median_filter(S, 17, axis=1)   # le long des fréquences
    eps = 1e-10
    Mh = H ** 2 / (H ** 2 + P ** 2 + eps)
    Ph, Pp = (S * Mh) ** 2, (S * (1 - Mh)) ** 2
    pw = S ** 2
    lo = (f >= 30) & (f < 150)
    hi = (f >= 4000) & (f < 11000)
    lm = np.log1p(100 * S[:, lo])
    kickflux = np.concatenate([[0], np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)])
    # profil timbre / harmonie : chroma 12 (80–2000 Hz) + 24 bandes log
    sel = (f >= 80) & (f <= 2000)
    pc = (np.round(12 * np.log2(f[sel] / 440)).astype(int) + 9) % 12
    edges = np.geomspace(40, 11000, 25)
    nbars = int(np.floor((len(mid) / SR - bar_start(-1)) / BAR))
    rows, prof = [], []
    db = lambda v: float(10 * np.log10(v + 1e-14))
    for k in range(nbars):
        n = k - 1
        a, b = bar_start(n), bar_start(n + 1)
        s = (tf >= a) & (tf < b)
        if not s.any():
            continue
        tot = pw[s].sum(axis=1).mean()
        harm = Ph[s].sum(axis=1).mean()
        perc = Pp[s].sum(axis=1).mean()
        side_e = (Ss[s] ** 2).sum(axis=1).mean()
        cen = float((pw[s] * f).sum() / (pw[s].sum() + eps))
        ch = np.array([pw[s][:, sel][:, pc == c].sum() for c in range(12)])
        ch = ch / (ch.sum() + eps)
        bands = np.array([pw[s][:, (f >= edges[i]) & (f < edges[i + 1])].sum() for i in range(24)])
        bands = np.log10(bands + 1e-9)
        bands = bands - bands.mean()
        prof.append(np.concatenate([ch * 3, bands / (np.linalg.norm(bands) + eps)]))
        rows.append({'bar': n, 't': round(a, 3), 'total_db': round(db(tot), 1), 'tenu_db': round(db(harm), 1), 'percu_db': round(db(perc), 1),
                     'tenu_moins_percu_db': round(db(harm) - db(perc), 1), 'kick': round(float(kickflux[s].mean()), 2),
                     'grave_db': round(db(pw[s][:, lo].sum(axis=1).mean()), 1), 'brillance_db': round(db(pw[s][:, hi].sum(axis=1).mean()), 1),
                     'centroide_hz': round(cen), 'largeur_db': round(db(side_e) - db(tot), 1)})
    prof = np.array(prof)
    pn = prof / (np.linalg.norm(prof, axis=1, keepdims=True) + eps)
    sim = pn @ pn.T
    # classes : seuils relatifs à la médiane du morceau (écrits ici, donc discutables)
    tot = np.array([r['total_db'] for r in rows]); per = np.array([r['percu_db'] for r in rows]); ten = np.array([r['tenu_db'] for r in rows])
    kick = np.array([r['kick'] for r in rows]); wid = np.array([r['largeur_db'] for r in rows]); gr = np.array([r['grave_db'] for r in rows])
    kick_hi = np.percentile(kick, 60)
    for i, r in enumerate(rows):
        trend = tot[min(len(rows) - 1, i + 2)] - tot[max(0, i - 2)]
        full = tot[i] >= np.percentile(tot, 65) and kick[i] >= kick_hi
        ample = (ten[i] - per[i]) >= np.percentile(ten - per, 50) and wid[i] >= np.percentile(wid, 40) and kick[i] < kick_hi and tot[i] >= np.percentile(tot, 25)
        if full:
            c = 'plein et percussif'
        elif ample:
            c = 'doux et ample'
        elif trend >= 1.5 or (i + 1 < len(rows) and kick[i] < kick_hi and tot[min(len(rows) - 1, i + 1)] - tot[i] > 2.5):
            c = 'qui monte'
        else:
            c = 'apaisé' if tot[i] < np.percentile(tot, 50) else 'qui monte'
        r['classe'] = c
        sims = [(j, float(sim[i, j])) for j in range(len(rows)) if abs(j - i) >= 1]
        r['repetitions'] = [rows[j]['bar'] for j, v in sorted(sims, key=lambda z: -z[1]) if v >= 0.97][:12]
        r['plus_proche'] = max(sims, key=lambda z: z[1])
        r['plus_proche'] = {'bar': rows[r['plus_proche'][0]]['bar'], 'cos': round(r['plus_proche'][1], 3)}
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({'note': 'Mesuré, non écouté (tools/audio/carte-morceau.py).', 'beat': BEAT, 'm40': M40,
                                    'mesures': rows, 'similarite': np.round(sim, 3).tolist()}, ensure_ascii=False, indent=1))
    planche(rows, sim)
    for r in rows:
        print(f"m{r['bar']:3d} {r['t']:7.2f}  tot {r['total_db']:6.1f} tenu {r['tenu_db']:6.1f} perc {r['percu_db']:6.1f} t-p {r['tenu_moins_percu_db']:5.1f} "
              f"kick {r['kick']:6.2f} grave {r['grave_db']:6.1f} brill {r['brillance_db']:6.1f} larg {r['largeur_db']:5.1f}  {r['classe']:18s} ~m{r['plus_proche']['bar']} {r['plus_proche']['cos']}")


COL = {'doux et ample': (70, 160, 200), 'qui monte': (220, 170, 60), 'plein et percussif': (210, 60, 60), 'apaisé': (90, 150, 100)}


def planche(rows, sim):
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    n = len(rows)
    W, L, cw = 2400, 160, 0
    cw = (W - L - 30) / n
    H = 1500
    im = Image.new('RGB', (W, H), (16, 16, 20))
    d = ImageDraw.Draw(im)
    F, Fs, Fb = font(17), font(13), font(24)
    d.text((L, 10), 'STORM II — carte de caractère, mesure par mesure (173 s, 136,997 BPM). Mesuré, non écouté.', fill=(235, 235, 235), font=Fb)
    X = lambda i: L + i * cw
    # bande de classes
    y = 50
    d.text((10, y + 8), 'classe', fill=(220, 220, 220), font=F)
    for i, r in enumerate(rows):
        d.rectangle([X(i), y, X(i + 1) - 1, y + 34], fill=COL[r['classe']])
    lx = L
    for k, c in COL.items():
        d.rectangle([lx, y + 40, lx + 18, y + 56], fill=c); d.text((lx + 24, y + 40), k, fill=(220, 220, 220), font=Fs); lx += 200
    # courbes
    series = [('total (dB)', 'total_db', (230, 230, 230)), ('tenu (dB)', 'tenu_db', (90, 180, 230)), ('percussif (dB)', 'percu_db', (230, 90, 90)),
              ('grave (dB)', 'grave_db', (200, 140, 255)), ('brillance (dB)', 'brillance_db', (250, 220, 100)), ('largeur côté/milieu (dB)', 'largeur_db', (120, 220, 150)),
              ('grosse caisse (flux)', 'kick', (255, 140, 60))]
    y = 120
    hh = 120
    for name, key, col in series:
        v = np.array([r[key] for r in rows], dtype=float)
        lo, hi = np.percentile(v, 2), np.percentile(v, 98)
        d.rectangle([L, y, W - 30, y + hh], outline=(60, 60, 60))
        d.text((10, y + 4), name, fill=col, font=Fs)
        d.text((10, y + 22), f'{lo:.0f} … {hi:.0f}', fill=(150, 150, 150), font=Fs)
        pts = [(X(i) + cw / 2, y + hh - (min(max(vi, lo), hi) - lo) / (hi - lo + 1e-9) * hh) for i, vi in enumerate(v)]
        d.line(pts, fill=col, width=2)
        y += hh + 8
    # repères de mesures et sections connues
    for i, r in enumerate(rows):
        if r['bar'] % 4 == 0:
            d.line([(X(i), 50), (X(i), y)], fill=(70, 70, 70))
            d.text((X(i) + 2, y + 2), f"m{r['bar']}", fill=(200, 200, 200), font=Fs)
            d.text((X(i) + 2, y + 18), f"{r['t']:.0f}s", fill=(140, 140, 140), font=Fs)
    # matrice d'auto-similarité
    y += 44
    size = H - y - 20
    S = np.clip((sim - 0.8) / 0.2, 0, 1)
    img = Image.fromarray((np.stack([S * 255, S * 200, S * 90], -1)).astype(np.uint8)).resize((size, size), Image.NEAREST)
    im.paste(img, (L, y))
    d.text((L + size + 20, y), 'Auto-similarité (cosinus chroma + timbre, 0,8 → 1) :', fill=(230, 230, 230), font=F)
    d.text((L + size + 20, y + 24), 'un carré clair hors diagonale = des mesures qui se répètent.', fill=(200, 200, 200), font=Fs)
    for k in range(0, n, 8):
        d.text((L + k / n * size, y + size + 2), f"m{rows[k]['bar']}", fill=(160, 160, 160), font=Fs)
        d.text((L - 50, y + k / n * size), f"m{rows[k]['bar']}", fill=(160, 160, 160), font=Fs)
    im.save(OUT_PNG)


if __name__ == '__main__':
    main()
