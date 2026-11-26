import os, math, wave
import numpy as np
from scipy.signal import fftconvolve
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000; DUR = float(__import__("os").environ.get("DUR", "10.5")); N = int(SR * DUR); BEAT = 0.5; E = BEAT / 2
rng = np.random.default_rng(23)
L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {}
for o in range(0, 7):
    for k, nm in enumerate(['C', 'Cs', 'D', 'Eb', 'E', 'F', 'Fs', 'G', 'Ab', 'A', 'Bb', 'B']): NOTE[f'{nm}{o}'] = 12 * (o + 1) + k
g = lambda s: [NOTE[x] for x in s.split()]
def add(sig, t0, pan=0.0, gain=1.0):
    i = int(round(t0 * SR)); j = min(N, i + len(sig))
    if j <= i or i < 0: return
    s = (sig[:j - i] * gain).astype(np.float32)
    L[i:j] += s * math.cos((pan + 1) * math.pi / 4) * 1.414; R[i:j] += s * math.sin((pan + 1) * math.pi / 4) * 1.414
def env(n, att, rel):
    t = np.arange(n) / SR; d = n / SR
    return np.clip(t / att, 0, 1) ** 1.5 * np.clip((d - t) / rel, 0, 1) ** 1.2
def lp(x, fc, order=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** order); return np.fft.irfft(X, len(x))
def organ(midis, dur, att=0.9, rel=1.4, stops=(0.5, 1.0, 0.35, 0.12), gain=0.1):
    n = int(SR * dur); t = np.arange(n) / SR; out = np.zeros(n)
    for m in midis:
        for mult, sg in zip((0.5, 1, 2, 3), stops):
            if sg <= 0: continue
            f = hz(m) * mult * 2 ** (rng.uniform(-3, 3) / 1200)
            if f > 9000: continue
            trem = 1 + 0.012 * np.sin(2 * np.pi * 5.1 * t + rng.uniform(0, 6))
            for k, a in enumerate((1, 0.45, 0.18, 0.10, 0.05, 0.03), 1):
                if f * k > 12000: break
                out += sg * a * np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) * trem
    return out * env(n, att, rel) * gain / len(midis)
def felt(m, dur=3.0, vel=0.5):
    n = int(SR * dur); t = np.arange(n) / SR; f0 = hz(m); out = np.zeros(n); B = 0.0003
    for k in range(1, 9):
        fk = f0 * k * math.sqrt(1 + B * k * k)
        if fk > 7000: break
        out += (1 / k ** 1.6) * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * np.exp(-t * (0.7 + 0.55 * k ** 1.25))
    thump = lp(rng.standard_normal(n), 400) * np.exp(-t * 60) * 0.25
    return (out * np.clip(t / 0.012, 0, 1) + thump) * vel * 0.32
def strings(midis, dur, att=1.6, rel=1.6, bright=2600, gain=0.1):
    n = int(SR * dur); t = np.arange(n) / SR; out = np.zeros(n)
    for m in midis:
        for v in range(4):
            f = hz(m) * 2 ** (rng.uniform(-7, 7) / 1200); vib = 1 + 0.0035 * np.sin(2 * np.pi * rng.uniform(4.8, 5.8) * t + rng.uniform(0, 6))
            ph = 2 * np.pi * np.cumsum(f * vib) / SR
            for k in range(1, 14):
                if f * k > bright * 2.2: break
                out += np.sin(k * ph + rng.uniform(0, 6)) / k * (1 / (1 + (f * k / bright) ** 2))
    return out * env(n, att, rel) * gain / len(midis) / 4
def choir(midis, dur, att=1.8, rel=1.8, gain=0.1):
    n = int(SR * dur); t = np.arange(n) / SR; out = np.zeros(n)
    F = [(800, 1.0, 80), (1150, 0.5, 90), (2900, 0.25, 120), (3300, 0.12, 130)]
    for m in midis:
        for v in range(3):
            f = hz(m) * 2 ** (rng.uniform(-9, 9) / 1200); vib = 1 + 0.004 * np.sin(2 * np.pi * rng.uniform(4.5, 5.5) * t + rng.uniform(0, 6))
            ph = 2 * np.pi * np.cumsum(f * vib) / SR
            for k in range(1, 40):
                fk = f * k
                if fk > 4500: break
                a = sum(g * math.exp(-((fk - fc) / (bw * 2.2)) ** 2) for fc, g, bw in F) + 0.04 / k
                out += a * np.sin(k * ph + rng.uniform(0, 6))
    return out * env(n, att, rel) * gain / len(midis) / 3
def roll(m, dur, gain=0.25):
    n = int(SR * dur); t = np.arange(n) / SR; f = hz(m)
    return ((np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 1.5 * t)) * 0.6 + lp(rng.standard_normal(n), 180) * 2.2) * (t / dur) ** 2 * gain
def glass(m, dur, gain=0.04):
    n = int(SR * dur); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.01 * t)) * env(n, 0.8, 1.2) * gain

# --- batterie ---------------------------------------------------------------
def kick(gain=0.9):
    n = int(SR * 0.45); t = np.arange(n) / SR
    f = 42 + 110 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 7) + lp(rng.standard_normal(n), 3000) * np.exp(-t * 120) * 0.25) * gain
def boom(gain=1.0):   # impact : grosse caisse profonde + souffle
    n = int(SR * 2.2); t = np.arange(n) / SR
    f = 32 + 70 * np.exp(-t * 9); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 2.2) + lp(rng.standard_normal(n), 900) * np.exp(-t * 5) * 0.5) * gain
def clap(gain=0.35):
    n = int(SR * 0.3); t = np.arange(n) / SR; x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((f - 1600) / 900) ** 2); x = np.fft.irfft(X, n)
    e = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.023)) * np.exp(-t * 9)
    return x / (np.abs(x).max() + 1e-9) * e * gain
def hat(gain=0.08):
    n = int(SR * 0.06); t = np.arange(n) / SR; x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= (f > 7000); x = np.fft.irfft(X, n)
    return x / (np.abs(x).max() + 1e-9) * np.exp(-t * 70) * gain
def riser(dur, gain=0.3):
    n = int(SR * dur); t = np.arange(n) / SR; u = t / dur
    x = rng.standard_normal(n); out = np.zeros(n); step = 2400
    for i in range(0, n, step):   # bruit dont le filtre s'ouvre
        seg = x[i:i + step]; out[i:i + step] = lp(seg, 300 + 9000 * (i / n) ** 2)[:len(seg)]
    sw = np.sin(2 * np.pi * np.cumsum(200 + 900 * u ** 2) / SR) * 0.25
    return (out + sw) * u ** 2.2 * gain
def whoosh(dur=0.5, gain=0.25):
    n = int(SR * dur); t = np.arange(n) / SR; u = t / dur
    return lp(rng.standard_normal(n), 2500) * np.sin(np.pi * u) ** 2 * gain


