#!/usr/bin/env python3
"""Mastering : somme des stems, gain commun, limiteur crête circulaire, -14 LUFS, export 24 bits 48 kHz."""
import sys, os, re, subprocess
import numpy as np
import scipy.signal as ss
import scipy.ndimage as nd
from scipy.io import wavfile

SR = 48000
N = 2_880_000


def dB(x):
    return 10 ** (x / 20)


def measure(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind('Summary:'):]
    I = float(re.search(r'I:\s+(-?[\d.]+) LUFS', txt).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', txt).group(1))
    lra = float(re.search(r'LRA:\s+([\d.]+) LU', txt).group(1))
    return I, tp, lra


def limiter_gain(x, ceil_db, look=0.010):
    peak = np.max(np.abs(x), axis=1)
    r = np.minimum(1.0, dB(ceil_db) / np.maximum(peak, 1e-12))
    L = int(look * SR)
    g = nd.minimum_filter1d(r, size=2 * L + 1, mode='wrap')
    win = np.hanning(2 * L + 1)
    win /= win.sum()
    gp = np.concatenate([g[-L:], g, g[:L]])
    return ss.fftconvolve(gp, win, mode='valid')[:N]


def write_wav24(path, x):
    tmp = path + '.f32.wav'
    wavfile.write(tmp, SR, x.astype(np.float32))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'pcm_s24le', '-ar', '48000', '-ac', '2', path], check=True)
    os.remove(tmp)


def master(work, out_dir, target=-14.0, ceil=-1.4, guard=0.003):
    stems = {k: np.load(f'{work}/{k}.npy').astype(np.float64) for k in ('music', 'sfx', 'amb')}
    total = sum(stems.values())
    gdb = 0.0
    tmp = f'{work}/_m.wav'
    gfade = np.ones(N)
    ng = int(guard * SR)
    gfade[:ng] = 0.5 - 0.5 * np.cos(np.pi * np.arange(ng) / ng)
    gfade[-ng:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(ng) / ng)
    for it in range(8):
        y = total * dB(gdb)
        g = limiter_gain(y, ceil) * gfade
        wavfile.write(tmp, SR, (y * g[:, None]).astype(np.float32))
        I, tp, lra = measure(tmp)
        print(f'iter {it}: gain {gdb:+.2f} dB ceiling {ceil:+.2f} -> I={I:.2f} LUFS TP={tp:.2f} dBTP LRA={lra:.1f} (min limiter gain {20*np.log10(g.min()+1e-12):.2f} dB)')
        if tp > -1.0:
            ceil -= (tp + 1.0) + 0.05
            continue
        if abs(I - target) <= 0.15:
            break
        gdb += (target - I) * 0.9
    os.makedirs(out_dir, exist_ok=True)
    names = {'music': 'stem_music_PLACEHOLDER.wav', 'sfx': 'stem_sfx_PLACEHOLDER.wav', 'amb': 'stem_ambience_PLACEHOLDER.wav'}
    for k, v in stems.items():
        write_wav24(f'{out_dir}/{names[k]}', v * dB(gdb) * g[:, None])
    write_wav24(f'{out_dir}/LKDV_mock_PLACEHOLDER.wav', (total * dB(gdb)) * g[:, None])
    print('final: gain', gdb, 'ceil', ceil)
    return gdb, ceil


if __name__ == '__main__':
    master(sys.argv[1], sys.argv[2])
