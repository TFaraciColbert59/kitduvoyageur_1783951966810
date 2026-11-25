# Orgue de la présentation « Pas pour moi » (≈ 4 min 49), composé chapitre par chapitre sur audio/timeline.json.
# Mêmes instruments que l'épisode 1 (orgue à tuyaux, piano feutré, cordes, chœur, timbales douces, verre), sol mineur, 90 BPM.
# Courbe : ouverture sombre → excuses (une note seule) → montée → suspens « Vigilance » → chaleur du groupe → sommet au lac
# → tendresse « ta mère » → transmission → accord final sur « Le Kit du Voyageur ».
# Sortie : audio/orgue.wav (48 kHz, stéréo, 24 bits, non normalisé).
import os, sys, json, wave, math
import numpy as np
from scipy.signal import fftconvolve
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'audio', 'timeline.json')))
SR = 48000; DUR = TL['duree']; N = int(SR * DUR); BEAT = 60 / 90; E = BEAT / 2
rng = np.random.default_rng(17)
L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
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

NOTE = dict(G1=31, A1=33, Bb1=34, C2=36, D2=38, Eb2=39, F2=41, G2=43, A2=45, Bb2=46, C3=48, D3=50, Eb3=51, F3=53, Fs3=54, G3=55, A3=57, Bb3=58, B3=59, C4=60,
            D4=62, Eb4=63, F4=65, Fs4=66, G4=67, A4=69, Bb4=70, B4=71, C5=72, D5=74, Eb5=75, F5=77, G5=79)
g = lambda s: [NOTE[x] for x in s.split()]
CH = {'Gm': ('G2', 'G3 Bb3 D4'), 'Eb': ('Eb2', 'G3 Bb3 Eb4'), 'Bb': ('Bb1', 'F3 Bb3 D4'), 'F': ('F2', 'F3 A3 C4'), 'Cm': ('C2', 'G3 C4 Eb4'),
      'D': ('D2', 'Fs3 A3 D4'), 'G': ('G1', 'G3 B3 D4'), 'Dsus': ('D2', 'A3 D4 G4')}
ARP = {'Gm': 'G4 Bb4 D5 Bb4', 'Eb': 'G4 Bb4 Eb5 Bb4', 'Bb': 'F4 Bb4 D5 Bb4', 'F': 'F4 A4 C5 A4', 'Cm': 'G4 C5 Eb5 C5', 'D': 'Fs4 A4 D5 A4', 'G': 'G4 B4 D5 B4', 'Dsus': 'G4 A4 D5 A4'}
def phrase_t(txt): return next(p['debut'] for p in TL['phrases'] if p['texte'] == txt)
chap = {c['bloc']: c for c in TL['chapitres']}

def section(t0, t1, prog, lvl=0.5, org=True, strg=False, cho=False, arp=None, arp_vel=0.06, pedal=True):
    """Accords de 4 temps qui bouclent sur [t0, t1] ; arp = pas de l'arpège ('E' croches, 'S' doubles) ou None."""
    t = t0; k = 0
    while t < t1 - 0.3:
        c = prog[k % len(prog)]; bass, up = CH[c]; d = min(4 * BEAT, t1 - t) + 0.9
        if org: add(organ(([NOTE[bass]] if pedal else []) + g(up), d, att=0.6, rel=0.9, stops=(0.55, 0.9, 0.25, 0.05), gain=0.10 * lvl), t)
        if strg: add(strings([NOTE[bass] + 12] + g(up), d, att=0.9, rel=0.9, bright=2200, gain=0.09 * lvl), t)
        if cho: add(choir(g(up)[1:] + [g(up)[-1] + 12], d, att=1.0, rel=0.9, gain=0.10 * lvl), t)
        if arp:
            step = E if arp == 'E' else E / 2; ns = g(ARP[c]); tt = t; j = 0
            while tt < min(t + 4 * BEAT, t1) - 0.01:
                add(felt(ns[j % 4], 1.2, arp_vel), tt, pan=(-0.25 if j % 2 else 0.25)); tt += step; j += 1
        t += 4 * BEAT; k += 1

# 0 — ouverture : pédale grave, verre, une note de piano sur « pas pour moi », accord doux au titre
add(organ(g('G1 D2'), chap[0]['fin'] + 1.0, att=3.0, rel=2.0, stops=(0.8, 0.3, 0, 0), gain=0.06), 0.0)
add(glass(NOTE['D5'] + 12, 6, 0.018), 2.0, pan=-0.3); add(glass(NOTE['A4'] + 12, 6, 0.014), 7.5, pan=0.3)
add(felt(NOTE['G2'], 4.0, 0.45), phrase_t('pas pour moi.')); add(felt(NOTE['D3'], 4.0, 0.25), phrase_t('pas pour moi.') + 0.02)
add(organ(g('G2 D3 Bb3 D4'), 3.0, att=0.4, rel=1.6, stops=(0.5, 0.8, 0.2, 0), gain=0.07), 16.2)
# excuses : avant chaque chapitre I–VII, une seule note grave de piano (le reste se tait)
for i in range(1, 8):
    ex = chap[i]['excuse']; add(felt(NOTE['D3'], 3.0, 0.35), ex['debut'] + 0.1); add(felt(NOTE['A3'], 3.0, 0.18), ex['debut'] + 0.12)
v = lambda i: chap[i]['voix_debut'] - 0.2
# I — pas sportif : pulsation de marche douce
section(v(1), chap[1]['fin'], ['Gm', 'Eb', 'Bb', 'F'], lvl=0.45, arp='E', arp_vel=0.05)
# II — rêver : cordes et verre, ouvert
section(v(2), chap[2]['fin'], ['Eb', 'Bb', 'Cm', 'F'], lvl=0.5, strg=True, arp='E', arp_vel=0.045)
add(glass(NOTE['G5'], 5, 0.02), v(2) + 12, pan=0.3); add(glass(NOTE['D5'] + 12, 5, 0.016), v(2) + 18, pan=-0.3)
# III — le Compas : la machine se met en route, doubles croches, puis suspens sur « Vigilance »
vig = phrase_t('Vigilance.')
section(v(3), v(3) + 16, ['Gm', 'Eb', 'Bb', 'F'], lvl=0.55, arp='E', arp_vel=0.06)
section(v(3) + 16, vig - 2.2, ['Gm', 'Eb', 'Cm', 'D'], lvl=0.7, strg=True, arp='S', arp_vel=0.06)
add(roll(NOTE['D2'] + 12, 2.0, 0.12), vig - 2.2)
add(organ(g('D2 A2 D3'), chap[3]['fin'] - vig + 2.4, att=0.2, rel=0.8, stops=(0.8, 0.5, 0, 0), gain=0.06), vig - 0.2)
add(glass(NOTE['Eb5'], 3, 0.02), vig + 0.1)
# IV — ensemble : chaleur, chœur, Si bémol
section(v(4), chap[4]['fin'], ['Bb', 'F', 'Gm', 'Eb'], lvl=0.55, strg=True, cho=True, arp='E', arp_vel=0.045)
# V — le sac : pulsation joueuse, puis résolution sur « Puis prêt »
pret = phrase_t('Puis prêt.')
section(v(5), pret - 0.1, ['Gm', 'Cm', 'F', 'Bb'], lvl=0.55, arp='E', arp_vel=0.07)
add(organ(g('Bb1 F2 Bb2 F3 Bb3 D4'), 2.4, att=0.08, rel=1.2, stops=(0.7, 1.0, 0.5, 0.2), gain=0.15), pret); add(felt(NOTE['D5'], 2.5, 0.4), pret)
# VI — la veille : suspens, pédale et piano qui compte
section(v(6), chap[6]['fin'], ['Dsus', 'Gm'], lvl=0.35, arp=None, strg=True)
t = v(6)
while t < chap[6]['fin'] - 0.5: add(felt(NOTE['D5'], 0.8, 0.05), t); t += BEAT
# VII — le terrain : tension, montée avec roulements, sommet au lac, puis tendresse au retour du réseau
lac = phrase_t('Puis le lac.'); reseau = phrase_t('Le réseau revient.')
section(v(7), lac - 8, ['Gm', 'Eb', 'Cm', 'D'], lvl=0.65, strg=True, arp='S', arp_vel=0.06)
section(lac - 8, lac - 0.2, ['Gm', 'Eb', 'Cm', 'D'], lvl=0.95, strg=True, cho=True, arp='S', arp_vel=0.08)
add(roll(NOTE['D2'] + 12, 3.0, 0.2), lac - 3.0)
add(organ(g('G1 G2 D3 G3 B3 D4 G4'), reseau - lac + 0.8, att=0.05, rel=1.2, stops=(0.9, 1.0, 0.7, 0.35), gain=0.26), lac)
add(strings(g('G2 D3 B3 D4 G4 B4 D5'), reseau - lac + 0.8, att=0.12, rel=1.2, bright=3400, gain=0.18), lac)
add(choir(g('B4 D5 G5'), reseau - lac + 0.8, att=0.15, rel=1.2, gain=0.2), lac)
section(reseau, chap[7]['fin'], ['Eb', 'Bb'], lvl=0.35, org=False, strg=True, arp=None)
add(felt(NOTE['G4'], 3, 0.35), reseau + 0.2); add(felt(NOTE['Bb4'], 3, 0.3), reseau + 1.6); add(felt(NOTE['D5'], 4, 0.35), phrase_t('Ta mère voit ton point au bord du lac.'))
# VIII — raconter : piano et cordes légères
section(chap[8]['debut'], chap[8]['fin'], ['Eb', 'Bb', 'Cm', 'Bb'], lvl=0.4, org=False, strg=True, arp='E', arp_vel=0.045)
# IX — transmettre : chaleur qui monte
section(chap[9]['debut'], chap[9]['fin'], ['Eb', 'Bb', 'F', 'Gm'], lvl=0.55, strg=True, cho=True, arp='E', arp_vel=0.05)
# épilogue : calme, puis accord final sur « Le Kit du Voyageur », qui s'éteint
kit = phrase_t('Le Kit du Voyageur.')
section(chap[10]['debut'], kit - 0.3, ['Gm', 'Eb', 'Bb', 'Dsus'], lvl=0.45, strg=True, arp='E', arp_vel=0.04)
add(organ(g('G1 G2 D3 G3 Bb3 D4 G4'), DUR - kit + 0.5, att=0.06, rel=3.5, stops=(0.8, 0.9, 0.4, 0.1), gain=0.16), kit)
add(choir(g('Bb4 D5 G5'), DUR - kit, att=0.3, rel=3.5, gain=0.14), kit); add(felt(NOTE['G5'], 4, 0.45), kit); add(glass(NOTE['G5'], 4, 0.02), kit + 0.3)

# salle (4 s) et sortie
def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(SR * sec); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / sec); x = lp(x, 5000); x[:int(0.025 * SR)] = 0; return (x / np.sqrt((x ** 2).sum())).astype(np.float32)
wet = 0.4
L2 = L * (1 - wet) + fftconvolve(L, ir(4.0, 1))[:N] * wet * 2.2; R2 = R * (1 - wet) + fftconvolve(R, ir(4.0, 2))[:N] * wet * 2.2
tt = np.arange(N) / SR; fade = np.clip((DUR - tt) / 2.5, 0, 1) ** 1.3; L2 *= fade; R2 *= fade
st = np.stack([L2, R2], 1); st /= np.abs(st).max() * 1.1
a = (np.clip(st, -1, 1) * (2 ** 23 - 1)).astype(np.int32).reshape(-1)
by = np.zeros((a.size, 3), np.uint8); by[:, 0] = a & 255; by[:, 1] = (a >> 8) & 255; by[:, 2] = (a >> 16) & 255
w = wave.open(os.path.join(ROOT, 'audio', 'orgue.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(by.tobytes()); w.close()
print('orgue.wav', round(DUR, 1), 's')
