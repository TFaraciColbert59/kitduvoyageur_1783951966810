#!/usr/bin/env python3
"""Contrôle du montage musical v3 (qa/mix-v3.wav). Mesuré, non écouté.

- ffprobe (format, échantillons) ; ebur128 (intégré, LRA, crête vraie) ; crête vraie après AAC 320 kb/s (-aac_pns 0) ;
- début : niveau du silence, instants où le niveau (RMS 50 ms) passe −50 puis −30 dBFS, premières attaques ;
- fin : instant où le niveau retombe sous −60 dBFS ;
- chaque raccord : continuité de la grille (attaques mesurées des 6 temps avant / après vs grille attendue),
  saut d'échantillon (clic), niveau avant / après ;
- planches PNG dans qa/snapshots/musique-v3/ ; mesures dans qa/tmp/audit-v3.json et dans le champ `mesures`
  de qa/mix-v3.beats.json.

Les outils ffmpeg/ffprobe sont appelés par leur nom (mettre leur dossier dans le PATH).
Usage : python3 tools/audio/audit-v3.py [--no-aac]
"""
import json, subprocess, sys, tempfile, re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

TRAILER = Path(__file__).resolve().parents[2]
QA = TRAILER / 'qa'
MIX = QA / 'mix-v3.wav'
BEATS = QA / 'mix-v3.beats.json'
SNAP = QA / 'snapshots' / 'musique-v3'
TMP = QA / 'tmp'
SR = 48000


def sh(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, check=True, **kw)


def read(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def ebur(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-filter_complex',
                          'ebur128=peak=true:framelog=info', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = err[err.rfind('Summary:'):]
    num = lambda rx: float(re.search(rx, s).group(1))
    frames = [(float(a), float(b)) for a, b in re.findall(r't:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+|-inf)', err) if b != '-inf']
    return {'integrated': num(r'I:\s+(-?[\d.]+) LUFS'), 'lra': num(r'LRA:\s+(-?[\d.]+) LU'),
            'truePeak': num(r'Peak:\s+(-?[\d.]+|-inf) dBFS')}, frames


def db(v):
    return 20 * np.log10(np.maximum(v, 1e-12))


def rms_curve(m, win=0.05, hop=0.005):
    w, h = int(win * SR), int(hop * SR)
    c = np.concatenate([[0], np.cumsum(m * m)])
    starts = np.arange(0, len(m) - w, h)
    return (starts + w / 2) / SR, 10 * np.log10(np.maximum((c[starts + w] - c[starts]) / w, 1e-24))


FONTS = ['/System/Library/Fonts/Supplementary/Arial.ttf', '/Library/Fonts/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']  # polices système (accents), sinon police par défaut


def font(size):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


# ── attaques (flux spectral, toutes bandes) ───────────────────────────────────────────────────────
NFFT, HOP = 1024, 128


def onset_env(m, lo=0, hi=SR / 2):
    n = 1 + (len(m) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    mag = np.abs(np.fft.rfft(m[idx] * np.hanning(NFFT), axis=1))
    f = np.fft.rfftfreq(NFFT, 1 / SR)
    sel = (f >= lo) & (f < hi)
    lm = np.log1p(1000 * mag[:, sel])
    flux = np.concatenate([[0], np.maximum(0, np.diff(lm, axis=0)).sum(axis=1)])
    t = np.arange(n) * HOP / SR + NFFT / 2 / SR - HOP / SR / 2
    return t, flux


def attack_near(t_env, env, t, w=0.05):
    """Attaque la plus forte à ±w s de t : instant du maximum de flux (s), et sa force relative à la médiane locale."""
    sel = (t_env >= t - w) & (t_env <= t + w)
    if not sel.any():
        return None, 0
    i = np.argmax(env[sel])
    loc = (t_env >= t - 0.6) & (t_env <= t + 0.6)
    return float(t_env[sel][i]), float(env[sel][i] / (np.median(env[loc]) + 1e-9))


def main():
    beats = json.loads(BEATS.read_text())
    grid = np.array([b['t'] for b in beats['beats']])
    T = beats['beatSec']
    segs = beats['segments']
    joins = beats['joins']
    out = {'ffmpeg': sh(['ffmpeg', '-version']).stdout.split('\n')[0].split(' Copyright')[0],
           'ffprobe': sh(['ffprobe', '-version']).stdout.split('\n')[0].split(' Copyright')[0]}

    # 1. format
    p = json.loads(sh(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(MIX)]).stdout)
    a = p['streams'][0]
    out['format'] = {'codec': a['codec_name'], 'sample_rate': int(a['sample_rate']), 'channels': a['channels'],
                     'bits': int(a.get('bits_per_sample') or 0), 'samples': int(a['duration_ts']), 'duration': float(a['duration'])}

    # 2. sonie
    loud, frames = ebur(MIX)
    out['ebur128'] = loud
    if '--no-aac' not in sys.argv:
        with tempfile.TemporaryDirectory() as d:
            for name, extra in [('aac320_pns0', ['-aac_pns', '0']), ('aac320_defaut', [])]:
                f = Path(d) / f'{name}.m4a'
                sh(['ffmpeg', '-v', 'error', '-y', '-i', str(MIX), '-c:a', 'aac', '-b:a', '320k', *extra, str(f)])
                l2, _ = ebur(f)
                y = read(f)
                out[name] = {**l2, 'samplePeakDb': float(db(np.abs(y).max()))}

    x = read(MIX)
    m = x.mean(axis=1)
    out['samplePeakDb'] = float(db(np.abs(x).max()))

    # 3. début / fin
    tc, lc = rms_curve(m)
    tpk, lpk = rms_curve(m, 0.01, 0.001)
    a0 = segs[0]['film'][0]
    sil = x[: int(a0 * SR)]
    out['debut'] = {
        'silence_jusqua_s': a0,
        'silence_peak_dbfs': float(db(np.abs(sil).max())) if np.abs(sil).max() > 0 else '-inf (zéro numérique)',
        'silence_rms_dbfs': float(10 * np.log10(np.mean(sil ** 2))) if np.mean(sil ** 2) > 0 else '-inf (zéro numérique)',
        'premier_echantillon_non_nul_s': float(np.argmax(np.abs(m) > 0) / SR),
        'rms50ms_passe_-50dBFS_s': float(tc[np.argmax(lc > -50)]),
        'rms50ms_passe_-30dBFS_s': float(tc[np.argmax(lc > -30)]),
        'rms50ms_passe_-20dBFS_s': float(tc[np.argmax(lc > -20)]),
    }
    te, env = onset_env(m)
    # attaques du début (0,5–12 s) : le RMS 10 ms monte d'au moins 8 dB en 40 ms au-dessus de −70 dBFS
    on, k = [], 40
    for i in range(k, len(lpk)):
        if 0.5 < tpk[i] < 12 and lpk[i] > -70 and lpk[i] - lpk[i - k] >= 8 and (not on or tpk[i] - on[-1][0] > 0.25):
            j = i + int(np.argmax(lpk[i:i + 40]))
            on.append((float(tpk[i]), float(lpk[j])))
    out['debut']['attaques_0.5_12s'] = [{'t': round(t, 4), 'rms10ms_pic_dbfs': round(v, 1),
                                         'temps_grille_le_plus_proche': round(float(grid[np.argmin(np.abs(grid - t))]), 4),
                                         'ecart_ms': round(1000 * (t - float(grid[np.argmin(np.abs(grid - t))])), 1)} for t, v in on]
    last = tc[np.where(lc > -60)[0][-1]]
    lastpk = tpk[np.where(lpk > -60)[0][-1]]
    out['fin'] = {'rms50ms_sous_-60dBFS_apres_s': float(last), 'rms10ms_sous_-60dBFS_apres_s': float(lastpk),
                  'peak_dernieres_100ms_dbfs': float(db(np.abs(x[-int(0.1 * SR):]).max())),
                  'dernier_echantillon': float(np.abs(x[-1]).max())}

    # grosse caisse : attaque à 50 % de la montée de l'enveloppe 30–150 Hz (1 ms), même méthode que la mesure de la grille
    X = np.fft.rfft(m); fq = np.fft.rfftfreq(len(m), 1 / SR); X[(fq < 30) | (fq > 150)] = 0
    low = np.fft.irfft(X, len(m)); h = 48; nl = len(low) // h
    el = np.sqrt((low[: nl * h].reshape(nl, h) ** 2).mean(axis=1)); tl = (np.arange(nl) + 0.5) * h / SR
    def kick(g, w=0.06):
        i0, i1 = int((g - w) * SR / h), int((g + w) * SR / h)
        s_ = el[i0:i1]; p_ = int(np.argmax(s_))
        if 20 * np.log10(s_[p_] + 1e-12) < -32 or p_ == 0:
            return None
        base = np.percentile(s_[:p_], 10)
        if s_[p_] < 4 * base:
            return None
        thr = base + 0.5 * (s_[p_] - base)
        return float(tl[i0 + int(np.where(s_[: p_ + 1] >= thr)[0][0])])

    # 4. raccords
    rows = []
    for j in joins:
        t = j['t']
        exp_b = grid[(grid > t - 6.5 * T) & (grid < t + 6.5 * T)]
        dev = []
        for g in exp_b:
            ta, s = attack_near(te, env, g, 0.06)
            if ta is not None and s > 2.0:
                dev.append((g, 1000 * (ta - g), s))
        before = [d for g, d, s in dev if g < t - 1e-4]
        after = [d for g, d, s in dev if g >= t - 1e-4]
        at_j = [d for g, d, s in dev if abs(g - t) < 1e-4]
        kd = [(g, 1000 * (kt - g)) for g in exp_b for kt in [kick(g)] if kt is not None]
        kb = [d_ for g, d_ in kd if g < t - 1e-4]; ka = [d_ for g, d_ in kd if g >= t - 1e-4]
        # clic : plus grand saut d'échantillon dans la fenêtre du fondu (±40 ms) vs centile 99,9 du voisinage
        i0 = int(t * SR)
        win = x[i0 - int(0.045 * SR): i0 + int(0.005 * SR)]
        nb = np.concatenate([x[i0 - int(0.3 * SR): i0 - int(0.05 * SR)], x[i0 + int(0.01 * SR): i0 + int(0.3 * SR)]])
        dw = np.abs(np.diff(win, axis=0)).max()
        dn = np.percentile(np.abs(np.diff(nb, axis=0)), 99.9)
        dnb = np.percentile(np.abs(np.diff(x[i0 - int(0.3 * SR): i0 - int(0.05 * SR)], axis=0)), 99.9)
        dna = np.percentile(np.abs(np.diff(x[i0 + int(0.01 * SR): i0 + int(0.3 * SR)], axis=0)), 99.9)
        # énergie > 8 kHz par tranches de 2 ms : pic dans la fenêtre du fondu vs médiane du voisinage
        hp = np.diff(m)  # dérivée = passe-haut grossier
        def e2(a, b):
            s = hp[a:b]
            n = len(s) // 96
            return 10 * np.log10((s[: n * 96].reshape(n, 96) ** 2).mean(axis=1) + 1e-24)
        ew = e2(i0 - int(0.045 * SR), i0 + int(0.005 * SR)).max()
        en = np.median(np.concatenate([e2(i0 - int(0.3 * SR), i0 - int(0.05 * SR)), e2(i0 + int(0.01 * SR), i0 + int(0.3 * SR))]))
        r = lambda a_, b_: float(10 * np.log10(np.mean(m[int(a_ * SR): int(b_ * SR)] ** 2) + 1e-24))
        rows.append({
            'join': f"{j['from']}→{j['to']}", 't': t, 'frame24': j['frame'], 'songOut': j['songOut'], 'songIn': j['songIn'],
            'grille_avant_ms_mediane': round(float(np.median(before)), 1) if before else None, 'n_avant': len(before),
            'grille_apres_ms_mediane': round(float(np.median(after)), 1) if after else None, 'n_apres': len(after),
            'attaque_au_raccord_ms': round(float(at_j[0]), 1) if at_j else None,
            'continuite_ms': round(float(np.median(after) - np.median(before)), 1) if before and after else None,
            'gc_avant_ms': [round(v, 1) for v in kb], 'gc_apres_ms': [round(v, 1) for v in ka],
            'gc_continuite_ms': round(float(np.median(ka) - np.median(kb)), 1) if kb and ka else None,
            'saut_ratio_vs_max_cotes': round(float(dw / max(dnb, dna)), 2),
            'saut_max_fenetre': round(float(dw), 4), 'saut_p999_voisinage': round(float(dn), 4), 'saut_ratio': round(float(dw / dn), 2),
            'hf_2ms_pic_fenetre_vs_mediane_db': round(float(ew - en), 1),
            'rms_avant_0.5s_dbfs': round(r(t - 0.5, t - 0.035), 1), 'rms_apres_0.5s_dbfs': round(r(t, t + 0.5), 1),
        })
    out['raccords'] = rows

    # grille sur tout le film : écart médian attaque / temps attendu, par segment
    seg_rows = []
    for s in segs:
        gs = grid[(grid >= s['film'][0] + 0.02) & (grid < s['film'][1] - 0.02)]
        d = []
        for g in gs:
            ta, st = attack_near(te, env, g, 0.06)
            if ta is not None and st > 2.0:
                d.append(1000 * (ta - g))
        kk = [1000 * (kt - g) for g in gs for kt in [kick(g)] if kt is not None]
        seg_rows.append({'segment': s['id'], 'temps': int(len(gs)), 'avec_attaque': len(d),
                         'gc_n': len(kk), 'gc_ecart_median_ms': round(float(np.median(kk)), 1) if kk else None,
                         'gc_mad_ms': round(float(np.median(np.abs(np.array(kk) - np.median(kk)))), 1) if kk else None,
                         'ecart_median_ms': round(float(np.median(d)), 1) if d else None,
                         'ecart_p90_abs_ms': round(float(np.percentile(np.abs(d), 90)), 1) if d else None})
    out['grille_par_segment'] = seg_rows

    # niveau par section (LUFS momentané moyen, ebur128)
    fr = np.array(frames)
    sec = []
    for s in segs:
        sel = (fr[:, 0] >= s['film'][0] + 0.4) & (fr[:, 0] <= s['film'][1])
        sec.append({'segment': s['id'], 'M_moyen_LUFS': round(float(fr[sel, 1].mean()), 1) if sel.any() else None,
                    'M_max_LUFS': round(float(fr[sel, 1].max()), 1) if sel.any() else None})
    out['niveau_par_segment'] = sec

    TMP.mkdir(parents=True, exist_ok=True)
    (TMP / 'audit-v3.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
    beats['mesures'] = {'outil': out['ffmpeg'], 'ebur128': out['ebur128'], 'debut': out['debut'], 'fin': out['fin'],
                        'raccords': out['raccords'], 'note': 'Mesuré, non écouté (tools/audio/audit-v3.py).'}
    BEATS.write_text(json.dumps(beats, indent=1, ensure_ascii=False) + '\n')

    # 5. planches
    SNAP.mkdir(parents=True, exist_ok=True)
    planche(x, m, beats, fr, out)
    for k, j in enumerate(joins):
        zoom(x, m, j['t'], 0.15, beats, f"raccord-{k + 1}-{j['from']}{j['to']}-{j['t']:.3f}s.png",
             f"Raccord {k + 1} {j['from']}>{j['to']} à {j['t']:.4f} s (image {j['frame']} à 24 i/s) — morceau {j['songOut']:.3f} > {j['songIn']:.3f} s", window=(j['t'] - 0.033 - (0.12 if j['to'] == 'H' else 0), j['t'] - 0.008))
    zoom(x, m, 1.5, 1.5, beats, 'debut-0-3s.png', 'Début 0–3 s (silence, fondu d\'entrée cubique 2 s, premier temps fort)', db_env=True)
    zoom(x, m, 58.5, 1.5, beats, 'fin-57-60s.png', 'Fin 57–60 s (roulement, impact à 58,000 s, queue exponentielle)', db_env=True)
    print(json.dumps({k: v for k, v in out.items() if k not in ('grille_par_segment',)}, indent=1, ensure_ascii=False))
    print(json.dumps(out['grille_par_segment'], ensure_ascii=False))


SEC_COL = {'silence': (40, 40, 40), 'intro': (60, 90, 140), 'montee+drop1': (170, 90, 40), 'respiration': (60, 130, 90),
           'reprise+drop2': (180, 60, 60), 'pre-impact': (150, 120, 40), 'queue': (90, 90, 120)}


def spectro(m, a, b, W, H):
    seg = m[int(a * SR): int(b * SR)]
    N = 2048
    hop = max(64, (len(seg) - N) // (W * 2))
    n = 1 + (len(seg) - N) // hop
    idx = np.arange(N)[None, :] + hop * np.arange(n)[:, None]
    P = np.abs(np.fft.rfft(seg[idx] * np.hanning(N), axis=1)) ** 2
    f = np.fft.rfftfreq(N, 1 / SR)
    fl = np.geomspace(30, 20000, H)
    bi = np.clip(np.searchsorted(f, fl), 0, len(f) - 1)
    A = 10 * np.log10(P[:, bi] + 1e-14).T[::-1]
    nz = A[A > -130]
    top = np.percentile(nz, 99.7) if nz.size else 0
    A = np.clip((A - (top - 75)) / 75, 0, 1)
    rgb = np.stack([np.clip(A * 1.6, 0, 1), np.clip(A * 1.6 - 0.6, 0, 1) ** 0.8, np.clip(A * 3 - 2, 0, 1)], -1)
    return Image.fromarray((rgb * 255).astype(np.uint8)).resize((W, H))


def planche(x, m, beats, fr, out):
    W, L = 2400, 70
    pw = W - L - 20
    H = 1100
    im = Image.new('RGB', (W, H), (16, 16, 20))
    d = ImageDraw.Draw(im)
    F, Fs, Fb = font(18), font(14), font(24)
    X = lambda t: int(L + t / 60 * pw)
    d.text((L, 10), 'Montage musical v3 — qa/mix-v3.wav (60,000 s, 24 i/s = 1 440 images). Mesuré, non écouté. ' +
           f"{out['ebur128']['integrated']} LUFS, crête vraie {out['ebur128']['truePeak']} dBTP, LRA {out['ebur128']['lra']} LU ({out['ffmpeg']})", fill=(230, 230, 230), font=Fb)
    # sections
    y0 = 50
    for s in beats['segments']:
        c = SEC_COL.get(s['section'], (80, 80, 80))
        d.rectangle([X(s['film'][0]), y0, X(s['film'][1]), y0 + 40], fill=c)
        d.text((X(s['film'][0]) + 4, y0 + 2), f"{s['id']} {s['section']}", fill=(255, 255, 255), font=F)
        d.text((X(s['film'][0]) + 4, y0 + 22), f"m{s['songBars'][0]}–m{s['songBars'][1]} ({s['song'][0]:.2f} s)", fill=(230, 230, 230), font=Fs)
    a0 = beats['segments'][0]['film'][0]
    d.rectangle([X(0), y0, X(a0), y0 + 40], fill=SEC_COL['silence'])
    # forme d'onde (min/max par colonne, échelle linéaire) + enveloppe dB
    wy, wh = 110, 260
    d.rectangle([L, wy, L + pw, wy + wh], outline=(70, 70, 70))
    n = len(m)
    for c in range(pw):
        a, b = int(c / pw * n), int((c + 1) / pw * n)
        lo, hi = x[a:b].min(), x[a:b].max()
        d.line([(L + c, wy + wh / 2 - hi * wh / 2), (L + c, wy + wh / 2 - lo * wh / 2)], fill=(120, 190, 255))
    # sonie momentanée
    ly, lh = 390, 160
    d.rectangle([L, ly, L + pw, ly + lh], outline=(70, 70, 70))
    for v in (-10, -20, -30, -40):
        yy = ly + (-v - 5) / 40 * lh
        d.line([(L, yy), (L + pw, yy)], fill=(50, 50, 50))
        d.text((8, yy - 8), f'{v}', fill=(160, 160, 160), font=Fs)
    d.text((L + 4, ly + 2), 'LUFS momentané (400 ms)', fill=(200, 200, 200), font=Fs)
    pts = [(X(t), ly + min(lh, max(0, (-v - 5) / 40 * lh))) for t, v in fr]
    d.line(pts, fill=(255, 210, 90), width=2)
    # spectrogramme
    sy, shh = 570, 380
    im.paste(spectro(m, 0, 60, pw, shh), (L, sy))
    for f_, lab in [(100, '100'), (1000, '1k'), (10000, '10k')]:
        yy = sy + shh - np.log(f_ / 30) / np.log(20000 / 30) * shh
        d.text((10, yy - 8), lab, fill=(180, 180, 180), font=Fs)
    # grille, raccords, moments clés
    for b in beats['beats']:
        xx = X(b['t'])
        if b['downbeat']:
            d.line([(xx, wy + wh), (xx, wy + wh + 12)], fill=(200, 200, 200), width=1)
        else:
            d.line([(xx, wy + wh), (xx, wy + wh + 5)], fill=(110, 110, 110))
    for j in beats['joins']:
        xx = X(j['t'])
        for yy in range(y0, sy + shh, 12):
            d.line([(xx, yy), (xx, yy + 6)], fill=(255, 60, 60), width=2)
        d.text((xx + 3, sy + shh + 4), f"{j['from']}>{j['to']} {j['t']:.3f} s / im. {j['frame']}", fill=(255, 110, 110), font=Fs)
    ky = sy + shh + 26
    for k_i, k in enumerate(beats['keyMoments']):
        xx = X(k['t'])
        d.line([(xx, wy), (xx, wy + wh)], fill=(255, 230, 60), width=1)
        d.text((xx + 2, ky + (k_i % 4) * 18), f"{k['id']} {k['t']:.2f} s / {k['frame']}", fill=(255, 230, 60), font=Fs)
    for t in range(0, 61, 5):
        d.line([(X(t), sy + shh), (X(t), sy + shh + 4)], fill=(255, 255, 255))
        d.text((X(t) - 10, H - 26), f'{t} s · {t * 24}', fill=(220, 220, 220), font=Fs)
    im.save(SNAP / 'planche-60s.png')


def zoom(x, m, c, half, beats, name, title, window=None, db_env=False):
    W, H = 1600, 640
    L = 70
    pw = W - L - 20
    a, b = c - half, c + half
    im = Image.new('RGB', (W, H), (16, 16, 20))
    d = ImageDraw.Draw(im)
    F, Fs = font(20), font(14)
    X = lambda t: L + (t - a) / (b - a) * pw
    d.text((L, 8), title + '  — mesuré, non écouté', fill=(235, 235, 235), font=F)
    ia, ib = max(0, int(a * SR)), min(len(m), int(b * SR))
    seg = x[ia:ib]
    for ch, (yc, col) in enumerate([(150, (120, 190, 255)), (320, (140, 230, 160))]):
        d.rectangle([L, yc - 75, L + pw, yc + 75], outline=(60, 60, 60))
        d.text((8, yc - 8), 'G' if ch == 0 else 'D', fill=(200, 200, 200), font=Fs)
        mx = max(1e-6, np.abs(seg).max())
        n = len(seg)
        for k in range(pw):
            s0, s1 = int(k / pw * n), max(int(k / pw * n) + 1, int((k + 1) / pw * n))
            lo, hi = seg[s0:s1, ch].min(), seg[s0:s1, ch].max()
            d.line([(L + k, yc - hi / mx * 72), (L + k, yc - lo / mx * 72)], fill=col)
        d.text((L + pw - 170, yc - 72), f'échelle ±{mx:.3f}', fill=(150, 150, 150), font=Fs)
    if db_env:
        tc, lc = rms_curve(m[ia:ib], 0.01, 0.002)
        tc = tc + ia / SR
        yb, hb = 420, 110
        d.rectangle([L, yb, L + pw, yb + hb], outline=(60, 60, 60))
        for v in (-20, -40, -60, -80):
            yy = yb + (-v) / 100 * hb
            d.line([(L, yy), (L + pw, yy)], fill=(45, 45, 45))
            d.text((10, yy - 8), f'{v}', fill=(160, 160, 160), font=Fs)
        pts = [(X(t), yb + min(hb, -v / 100 * hb)) for t, v in zip(tc, lc)]
        d.line(pts, fill=(255, 210, 90), width=2)
        d.text((L + 4, yb + 2), 'RMS 10 ms (dBFS)', fill=(200, 200, 200), font=Fs)
    else:
        im.paste(spectro(m, a, b, pw, 120), (L, 420))
    if window:
        d.rectangle([X(window[0]), 70, X(window[1]), 400], outline=(255, 120, 60), width=2)
        d.text((X(window[0]), 402), 'fondu enchaîné', fill=(255, 140, 80), font=Fs)
    for bt in beats['beats']:
        if a <= bt['t'] <= b:
            xx = X(bt['t'])
            d.line([(xx, 60), (xx, 560)], fill=(255, 60, 60) if bt['join'] else ((230, 230, 230) if bt['downbeat'] else (130, 130, 130)), width=2 if bt['downbeat'] else 1)
            d.text((xx + 3, 565), f"{bt['t']:.3f} s / im. {bt['frame']}" + (' (1er temps)' if bt['downbeat'] else ''), fill=(220, 220, 220), font=Fs)
    for k in beats['keyMoments']:
        if a <= k['t'] <= b:
            d.text((X(k['t']) + 3, 585), k['id'], fill=(255, 230, 60), font=Fs)
    step = 0.05 if half <= 0.2 else 0.5
    t = np.ceil(a / step) * step
    while t <= b:
        d.text((X(t) - 14, H - 24), f'{t:.2f}', fill=(170, 170, 170), font=Fs)
        d.line([(X(t), 555), (X(t), 560)], fill=(200, 200, 200))
        t += step
    im.save(SNAP / name)


if __name__ == '__main__':
    main()
