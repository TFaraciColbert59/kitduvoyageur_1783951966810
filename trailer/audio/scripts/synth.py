"""Bibliothèque de synthèse LKDV (numpy/scipy). Tout est déterministe : graine fixe par nom."""
import zlib
import numpy as np
import scipy.signal as ss

SR = 48000
DUR = 60.0
N = int(SR * DUR)  # 2 880 000


def R(name):
    return np.random.default_rng(zlib.crc32(str(name).encode()) & 0xFFFFFFFF)


def dB(x):
    return 10.0 ** (x / 20.0)


def T(n):
    return np.arange(n) / SR


_NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nf(s):
    """'D4', 'Bb3', 'F#4' -> Hz (A4 = 440)."""
    n = _NOTES[s[0]]
    i = 1
    while s[i] in 'b#':
        n += -1 if s[i] == 'b' else 1
        i += 1
    octv = int(s[i:])
    return 440.0 * 2 ** ((12 * (octv + 1) + n - 69) / 12.0)


# ---------------------------------------------------------------- filtres
def _fc(f):
    return float(np.clip(f, 5.0, 22000.0))


def lp(x, fc, order=2):
    return ss.sosfilt(ss.butter(order, _fc(fc), 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return ss.sosfilt(ss.butter(order, _fc(fc), 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return ss.sosfilt(ss.butter(order, [_fc(lo), _fc(hi)], 'band', fs=SR, output='sos'), x, axis=0)


def norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def fade_env(n, att=0.0, rel=0.0):
    e = np.ones(n)
    na, nr = int(att * SR), int(rel * SR)
    if na > 0:
        na = min(na, n)
        e[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    if nr > 0:
        nr = min(nr, n)
        e[-nr:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(nr) / nr)
    return e


def smooth_noise(n, fc, name):
    """Bruit lent normalisé (écart-type 1), pour moduler des gains."""
    x = lp(R(name).standard_normal(n), fc, 2)
    return x / (np.std(x) + 1e-12)


# ---------------------------------------------------------------- bus
class Stem:
    def __init__(self, name, rt60, wet=1.0, seed=1):
        self.name = name
        self.dry = np.zeros((N, 2))
        self.send = np.zeros((N, 2))
        self.rt60 = rt60
        self.wet = wet
        self.seed = seed
        self.log = []

    def _put(self, buf, sig, t):
        start = int(round(t * SR)) % N
        n = len(sig)
        pos = 0
        while pos < n:
            k = min(n - pos, N - start)
            buf[start:start + k] += sig[pos:pos + k]
            pos += k
            start = 0

    def add(self, sig, t, db=0.0, pan=0.0, send=0.0, what=None, note='', dur=None):
        sig = np.asarray(sig, dtype=np.float64)
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1)
        g = dB(db)
        self._put(self.dry, sig * g, t)
        if send > 0:
            self._put(self.send, sig * g * send, t)
        if what is not None:
            self.log.append(dict(t=t, stem=self.name, what=what, db=db, note=note,
                                 dur=dur if dur is not None else len(sig) / SR))

    def render(self):
        out = self.dry.copy()
        if np.any(self.send):
            out += reverb_circ(self.send, self.rt60, self.seed) * self.wet
        return out


def make_ir(rt60, seed, predelay=0.015):
    n = int((rt60 * 1.15 + predelay) * SR)
    t = T(n)
    ir = np.zeros((n, 2))
    for c in range(2):
        x = R(f'ir{seed}{c}').standard_normal(n)
        a, b = lp(x, 7500), lp(x, 1500)
        w = np.clip(t / rt60, 0, 1)
        x = a * (1 - w) + b * w
        x *= np.exp(-6.91 * t / rt60) * (1 - np.exp(-t / 0.012))
        x[:int(predelay * SR)] = 0
        ir[:, c] = x
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir * 0.07  # niveau de queue raisonnable


def reverb_circ(x, rt60, seed):
    ir = make_ir(rt60, seed)
    mono = x.mean(axis=1)
    out = np.zeros((N, 2))
    for c in range(2):
        full = ss.fftconvolve(mono, ir[:, c])
        w = full[:N].copy()
        extra = full[N:]
        w[:len(extra)] += extra  # repliement circulaire (boucle)
        out[:, c] = w
    return out * 12.0


# ---------------------------------------------------------------- instruments
def piano(f, dur=1.0, vel=0.8, name='p', rel=0.45):
    tau = 2.6 * (261.6 / f) ** 0.55
    L = float(np.clip(tau * 4.0, 1.6, 6.0))
    L = max(L, dur + rel + 0.3)
    n = int(L * SR)
    t = T(n)
    rng = R(f'{name}{f:.1f}')
    out = np.zeros(n)
    B = 0.00018 * (f / 261.6)
    for k in range(1, 14):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 11000:
            break
        a = k ** -1.05 * np.exp(-(k - 1) * 0.22 * (1.2 - vel))
        dk = tau / (1 + 0.5 * (k - 1))
        for det in (-1, 1):
            out += 0.5 * a * np.sin(2 * np.pi * fk * (1 + det * 0.00035) * t + rng.uniform(0, 6.283)) * np.exp(-t / dk)
    out *= (0.55 + 0.45 * np.exp(-t / 0.4))
    out *= 1 - np.exp(-t / 0.0015)
    ham = lp(rng.standard_normal(n), 2500, 2) * np.exp(-t / 0.006) * 0.9
    out = out / (np.max(np.abs(out)) + 1e-9) + 0.12 * vel * ham / (np.max(np.abs(ham)) + 1e-9)
    # étouffoir après la tenue (pédale douce)
    m = t > dur
    out[m] *= np.exp(-(t[m] - dur) / rel)
    return norm(out) * vel


def strings(notes, dur, att=0.5, rel=0.7, cut=2400, vib_rate=4.6, vib=0.0028,
            name='s', det=(-8, 0, 8), kmax=48, bow=0.0):
    n = int((dur + rel) * SR)
    t = T(n)
    env = fade_env(n, att, rel)
    rng = R(name)
    out = np.zeros(n)
    for fn in notes:
        for d in det:
            f0 = fn * 2 ** (d / 1200.0)
            vf = 1 + vib * np.minimum(1.0, t / (att + 0.4)) * np.sin(2 * np.pi * vib_rate * t + rng.uniform(0, 6.283))
            ph = 2 * np.pi * np.cumsum(f0 * vf) / SR + rng.uniform(0, 6.283)
            K = int(min(kmax, max(3, 7000 / f0)))
            for k in range(1, K + 1):
                w = 1.0 / k / (1 + (k * f0 / cut) ** 2)
                out += w * np.sin(k * ph)
    if bow > 0:
        out += bow * bp(rng.standard_normal(n), 800, 3500) * np.sqrt(len(notes))
    out *= env
    return norm(out)


def choir(notes, dur, att=0.9, rel=1.4, name='c', vowel=(400, 800)):
    sig = strings(notes, dur, att=att, rel=rel, cut=1100, vib_rate=5.1, vib=0.004, name=name, kmax=30)
    n = len(sig)
    f1, f2 = vowel
    y = bp(sig, f1 * 0.8, f1 * 1.25) + 0.6 * bp(sig, f2 * 0.82, f2 * 1.22) + 0.25 * lp(sig, 260)
    br = bp(R(name + 'br').standard_normal(n), 500, 3000) * fade_env(n, att * 1.1, rel) * 0.12
    return norm(y + br * np.max(np.abs(y)))


def subtone(f, dur, att=0.02, rel=0.3, h3=0.18):
    n = int((dur + rel) * SR)
    t = T(n)
    y = np.sin(2 * np.pi * f * t) + h3 * np.sin(2 * np.pi * 2 * f * t + 0.5)
    return y * fade_env(n, att, rel)


def grave():
    """Note grave de la boucle : ré 1 + ré 2 + la 2, attaque douce (0,35 s), queue de 4,5 s."""
    n = int(4.6 * SR)
    t = T(n)
    f = 36.667  # ré 1 accordé pour 2200 périodes en 60 s (boucle en phase), -1,9 cent
    y = np.sin(2 * np.pi * f * t) + 0.55 * np.sin(2 * np.pi * 2 * f * t + 0.3) + 0.22 * np.sin(2 * np.pi * 3 * f * t + 1.1)
    y += 0.12 * np.sin(2 * np.pi * 4 * f * t + 2.0)
    a = 0.5 - 0.5 * np.cos(np.pi * np.minimum(t / 0.35, 1.0))
    d = np.exp(-np.maximum(t - 0.5, 0) / 1.5)
    r = 0.5 + 0.5 * np.cos(np.pi * np.clip((t - 4.1) / 0.5, 0, 1))
    rumble = lp(R('grave').standard_normal(n), 90, 2) * 0.25
    return norm((y + rumble * 0.6) * a * d * r)


def kick(name='k', f0=135, f1=46, tau=0.035, dec=0.17, dur=0.5, click=0.25):
    n = int(dur * SR)
    t = T(n)
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / dec) * (1 - np.exp(-t / 0.0006))
    y += click * lp(R(name).standard_normal(n), 3500) * np.exp(-t / 0.004)
    return norm(y)


def snare(name='sn', dur=0.45, body=190, tone=0.55):
    n = int(dur * SR)
    t = T(n)
    nz = bp(R(name).standard_normal(n), 1300, 7500)
    y = nz * np.exp(-t / 0.11) + tone * np.sin(2 * np.pi * body * t * (1 + 0.3 * np.exp(-t / 0.02))) * np.exp(-t / 0.07)
    return norm(y * (1 - np.exp(-t / 0.0005)))


def hat(name='h', dur=0.12, dec=0.025):
    n = int(dur * SR)
    t = T(n)
    return norm(hp(R(name).standard_normal(n), 6500) * np.exp(-t / dec) * (1 - np.exp(-t / 0.0004)))


def taiko(name='tk', f0=95, f1=55, dec=0.55, dur=1.4):
    n = int(dur * SR)
    t = T(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec)
    y += 0.5 * lp(R(name).standard_normal(n), 900) * np.exp(-t / 0.03)
    return norm(y * (1 - np.exp(-t / 0.0007)))


def impact(name, dur=3.2, f0=88, f1=34, tau_body=1.0, bright=1.0, sub_f=36.667, sub_tau=1.5, noise_amt=0.8):
    n = int(dur * SR)
    t = T(n)
    nz = R(name).standard_normal(n)
    parts = [(lp(nz, 9000 * bright), 0.06), (lp(nz, 2800), 0.22), (lp(nz, 800), 0.7), (lp(nz, 220), 1.4)]
    nzf = sum(p * np.exp(-t / tt) for p, tt in parts)
    f = f1 + (f0 - f1) * np.exp(-t / 0.12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau_body)
    sub = np.sin(2 * np.pi * sub_f * t) * np.exp(-t / sub_tau)
    y = noise_amt * nzf / (np.std(nzf[:int(0.3 * SR)]) + 1e-9) * 0.35 + body * 1.1 + sub * 0.9
    y *= (1 - np.exp(-t / 0.0005)) * fade_env(n, 0, 0.4)
    return norm(y)


def dry_hit(name, dur=0.7):
    n = int(dur * SR)
    t = T(n)
    nz = lp(R(name).standard_normal(n), 6500) * np.exp(-t / 0.05)
    f = 60 + 120 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    y = nz * 0.6 + body
    return norm(y * (1 - np.exp(-t / 0.0004)) * fade_env(n, 0, 0.1))


def sweep_noise(dur, f_lo, f_hi, name, power=1.0, nb=14, width=0.7, fall=False):
    n = int(dur * SR)
    u = T(n) / dur
    nz = R(name).standard_normal(n)
    cs = np.geomspace(80, 14000, nb)
    uu = (1 - u) if fall else u
    fc = f_lo * (f_hi / f_lo) ** (uu ** power)
    out = np.zeros(n)
    for c in cs:
        b = bp(nz, c / 1.2, min(c * 1.2, 21000), 2)
        out += np.exp(-0.5 * (np.log2(c / fc) / width) ** 2) * b
    return out / (np.std(out) + 1e-9)


def riser(dur, name, f_lo=250, f_hi=9000, tone=(None, None), accel=(6.0, 28.0), tone_amt=0.5, curve=2.0):
    n = int(dur * SR)
    t = T(n)
    u = t / dur
    nz = sweep_noise(dur, f_lo, f_hi, name, power=1.4)
    rate = accel[0] + (accel[1] - accel[0]) * u ** 2
    trem = 0.62 + 0.38 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
    out = nz * trem * 0.5
    if tone[0]:
        f = tone[0] * (tone[1] / tone[0]) ** (u ** 1.3)
        ph = 2 * np.pi * np.cumsum(f) / SR
        out += tone_amt * (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph))
    out *= u ** curve * (1 - np.exp(-t / 0.002))
    out *= np.minimum(1.0, (dur - t) / 0.001)
    return norm(out)


def whoosh(dur, name, f_lo=300, f_hi=6000, peak=0.5, fall=False):
    n = int(dur * SR)
    u = T(n) / dur
    nz = sweep_noise(dur, f_lo, f_hi, name, power=1.0, fall=fall)
    e = np.where(u < peak, np.sin(0.5 * np.pi * u / peak) ** 2, np.cos(0.5 * np.pi * (u - peak) / (1 - peak)) ** 2)
    return norm(nz * e)


def tick(freq=3100, name='tk', dur=0.09):
    n = int(dur * SR)
    t = T(n)
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.012)
    y += 0.7 * bp(R(name).standard_normal(n), 2500, 8000) * np.exp(-t / 0.004)
    return norm(y * (1 - np.exp(-t / 0.0003)))


def thock(name='th', pitch=1.0):
    n = int(0.06 * SR)
    t = T(n)
    y = lp(R(name).standard_normal(n), 2200 * pitch) * np.exp(-t / 0.006)
    y += 0.8 * np.sin(2 * np.pi * 210 * pitch * t) * np.exp(-t / 0.012)
    return norm(y * (1 - np.exp(-t / 0.0004)))


def pop(freq, name='pp', dec=0.11):
    n = int(0.5 * SR)
    t = T(n)
    f = freq * (1 + 0.18 * (1 - np.exp(-t / 0.012)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.exp(-t / dec)
    return norm(y * (1 - np.exp(-t / 0.0008)))


def ping(freq, dec=1.0, dur=2.5):
    n = int(dur * SR)
    t = T(n)
    y = np.sin(2 * np.pi * freq * t) * np.exp(-t / dec) + 0.12 * np.sin(2 * np.pi * 2.0 * freq * t) * np.exp(-t / (dec * 0.4))
    return norm(y * (1 - np.exp(-t / 0.0008)) * fade_env(n, 0, 0.3))


def bell(freq, dec=1.6, dur=3.5):
    n = int(dur * SR)
    t = T(n)
    y = np.zeros(n)
    for r, a, d in ((1, 1, 1), (2.76, 0.5, 0.6), (5.4, 0.3, 0.35), (8.93, 0.15, 0.2)):
        y += a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (dec * d))
    return norm(y * (1 - np.exp(-t / 0.001)) * fade_env(n, 0, 0.4))


def ks(f, dur=2.5, damp=0.996, name='g', bright=0.5):
    P = max(2, int(round(SR / f - 0.5)))
    n = int(dur * SR)
    rng = R(f'{name}{f:.1f}')
    burst = rng.uniform(-1, 1, P)
    burst = np.convolve(burst, [1 - bright, bright], 'same') if bright < 1 else burst
    x = np.zeros(n)
    x[:P] = burst
    a = np.zeros(P + 2)
    a[0] = 1
    a[P] = -0.5 * damp
    a[P + 1] = -0.5 * damp
    y = ss.lfilter([1.0], a, x)
    y = lp(y, 5500, 1)
    return norm(y * fade_env(n, 0, 0.2))


def flick(name, dur=0.09, lo=2000, hi=9000, dec=0.025):
    n = int(dur * SR)
    t = T(n)
    y = bp(R(name).standard_normal(n), lo, hi) * (1 - np.exp(-t / 0.004)) * np.exp(-t / dec)
    return norm(y)


def cork(name='cork'):
    n = int(0.2 * SR)
    t = T(n)
    f = 260 + 300 * np.exp(-t / 0.012)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    y += 0.4 * bp(R(name).standard_normal(n), 600, 2500) * np.exp(-t / 0.01)
    return norm(y * (1 - np.exp(-t / 0.0005)))


def metal_tink(name, f=2300):
    n = int(0.15 * SR)
    t = T(n)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, 0.05), (1.52, 0.6, 0.03), (2.4, 0.3, 0.02)))
    return norm(y * (1 - np.exp(-t / 0.0004)))


def gravel_step(name, dur=0.16):
    n = int(dur * SR)
    t = T(n)
    rng = R(name)
    y = np.zeros(n)
    for i in range(7):
        s = int(rng.uniform(0, 0.09) * SR)
        m = int(0.02 * SR)
        g = bp(rng.standard_normal(m), 900, 5500) * np.exp(-np.arange(m) / SR / 0.006) * rng.uniform(0.4, 1)
        y[s:s + m] += g[:max(0, min(m, n - s))]
    y += 0.5 * np.sin(2 * np.pi * 80 * t) * np.exp(-t / 0.03)
    return norm(y)


def run_step(name, dur=0.14):
    n = int(dur * SR)
    t = T(n)
    y = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.03) + 0.7 * lp(R(name).standard_normal(n), 1800) * np.exp(-t / 0.018)
    y += 0.25 * hp(R(name + 'x').standard_normal(n), 3000) * np.exp(-t / 0.01)
    return norm(y * (1 - np.exp(-t / 0.0006)))


def fire(dur, name='fire', rate=28.0, lvl=1.0):
    n = int(dur * SR)
    rng = R(name)
    bed = lp(rng.standard_normal(n), 420, 2) * (0.35 + 0.15 * np.clip(smooth_noise(n, 2.0, name + 'm'), -2, 2))
    imp = np.zeros(n)
    k = rng.poisson(rate * dur)
    pos = rng.integers(0, n, k)
    imp[pos] = rng.exponential(1.0, k) ** 1.5
    big = rng.integers(0, n, int(dur * 2.5))
    imp[big] += rng.uniform(2.5, 5.0, len(big))
    dec = ss.lfilter([1.0], [1, -0.994], imp)
    cr = bp(dec, 900, 7000)
    cr = cr / (np.std(cr) + 1e-9)
    y = bed / (np.std(bed) + 1e-9) * 0.45 + cr * 0.55
    return norm(y) * lvl


def surf(dur, name='surf', period=7.4):
    n = int(dur * SR)
    t = T(n)
    nz = R(name).standard_normal(n)
    y = lp(nz, 1400, 2) * 0.7 + bp(nz, 2500, 6000) * 0.15
    ph = R(name + 'p').uniform(0, 6.28)
    e = (0.5 + 0.5 * np.sin(2 * np.pi * t / period + ph)) ** 2 * 0.85 + 0.15
    return norm(y * e)


def wind(dur, name='wind', gusty=1.0):
    n = int(dur * SR)
    nz = R(name).standard_normal(n)
    out = 0
    for i, (lo, hi) in enumerate(((120, 400), (350, 900), (800, 2200))):
        g = 0.55 + 0.45 * np.clip(smooth_noise(n, 0.6 + 0.5 * i, f'{name}g{i}'), -2.2, 2.2) / 2.2 * gusty
        out = out + bp(nz, lo, hi) * g * (1.0, 0.8, 0.45)[i]
    return norm(out)


def breath(dur=0.8, name='br'):
    n = int(dur * SR)
    t = T(n)
    u = t / dur
    nz = bp(R(name).standard_normal(n), 400, 3200)
    e = np.sin(np.pi * u ** 0.8) ** 2
    return norm(nz * e)


def static_crackle(dur, name='stat'):
    n = int(dur * SR)
    rng = R(name)
    imp = np.zeros(n)
    k = int(dur * 1500)
    imp[rng.integers(0, n, k)] = rng.exponential(1.0, k)
    y = hp(ss.lfilter([1.0], [1, -0.85], imp), 1800)
    return norm(y)


def doppler(dur, name='dopp'):
    n = int(dur * SR)
    t = T(n)
    u = t / dur
    fc = 1500 - 900 * (1 / (1 + np.exp(-10 * (u - 0.5))))
    nz = sweep_noise(dur, 500, 1500, name, power=1.0)
    nz2 = sweep_noise(dur, 1500, 500, name + 'b', power=1.0, fall=True)
    w = 1 / (1 + np.exp(-10 * (u - 0.5)))
    y = nz * (1 - w) + nz2 * w
    ph = 2 * np.pi * np.cumsum(220 * (1.1 - 0.2 * w)) / SR
    y = y * 0.7 + 0.25 * lp(np.sign(np.sin(ph)) + np.sin(ph), 1100)
    e = np.exp(-0.5 * ((u - 0.5) / 0.22) ** 2)
    return norm(y * e)


def burner(dur=0.4, name='burn'):
    n = int(dur * SR)
    u = T(n) / dur
    nz = R(name).standard_normal(n)
    y = bp(nz, 700, 4200) * 0.8 + lp(nz, 380) * 0.8
    e = np.sin(np.pi * np.minimum(u * 1.3, 1)) ** 1.5 * (1 - u ** 3)
    return norm(y * e)


def ratchet(dur, name='rat', r0=46.0, r1=9.0):
    n = int(dur * SR)
    t = T(n)
    u = t / dur
    rate = r0 * (r1 / r0) ** u
    ph = np.cumsum(rate) / SR
    trig = np.diff(np.floor(ph), prepend=0) > 0
    imp = trig.astype(float)
    tk = ss.lfilter([1.0], [1, -0.97], imp)
    y = bp(tk, 1800, 6500) + 0.5 * bp(imp, 300, 900)
    y *= 1.0 - 0.8 * u
    return norm(y)
