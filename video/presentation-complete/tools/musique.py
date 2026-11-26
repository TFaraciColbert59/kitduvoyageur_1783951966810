# Bande-son v4 « dopamine » — 20 s, 120 BPM. Un arc : sol mineur (le doute, la nuit, l'effort) → silence → sol MAJEUR (l'aube).
#   0–1,5   nuit : bourdon, piano ; 1,0 le trait barre « Pas » (frappe sèche) ; 1,5 « POUR MOI. » → gros coup, la pulsation part
#   2,0     montée dans le téléphone ; 2,5 impact (éclair) ; 3,0 les tuiles explosent (une note par tuile) ; 3,25 / 3,5 les mots claquent
#   4,0 / 4,5 / 5,0 / 5,5 / 6,25   coupes : souffle + coup ; « Seul ? » accord grave ; la poignée de main : accord chaud
#   7,5     appui sur « Démarrer le voyage » (clic + choc) ; 7,85 montée inversée → 8,0 BOUM, la nuit : batterie qui double
#   10,75   tout tombe : piano et cordes pour la mère
#   12,0 / 12,5 / 13,0  la paroi : trois grosses frappes, la montée
#   13,5–14 SILENCE (un seul verre qui monte)
#   14,0    DROP en sol majeur : orgue plein, chœur, batterie qui pousse jusqu'à 18,5
#   16,5    la carte Rencontre (verre) ; 17,1–18 les compteurs (tics qui montent) ; 18,5 accord final.
import os, sys, wave
os.environ['DUR'] = '20.0'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *
for _o in range(7): NOTE[f'F#{_o}'] = NOTE[f'Fs{_o}']

def click(gain=0.22):
    n = int(SR * 0.05); t = np.arange(n) / SR
    x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((f - 3800) / 1600) ** 2); x = np.fft.irfft(X, n)
    return (x / (np.abs(x).max() + 1e-9) * np.exp(-t * 160) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 220) * 0.5) * gain
def stab(midis, gain=0.09, dur=0.3): return organ(midis, dur, att=0.006, rel=0.2, stops=(0.6, 1.0, 0.45, 0.15), gain=gain)
def sub(m, dur=0.45, gain=0.35):
    n = int(SR * dur); t = np.arange(n) / SR
    return np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 4) * np.clip(t / 0.005, 0, 1) * gain
def tom(m, gain=0.5):
    n = int(SR * 0.35); t = np.arange(n) / SR; f = hz(m) * (1 + 0.5 * np.exp(-t * 30))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * gain
def thud(gain=0.8):
    n = int(SR * 0.5); t = np.arange(n) / SR; f = 55 + 60 * np.exp(-t * 20)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + lp(rng.standard_normal(n), 600) * np.exp(-t * 30) * 0.4) * gain
def rev_whoosh(dur=0.35, gain=0.2): return whoosh(dur, gain)[::-1] * np.linspace(0.3, 1, int(SR * dur)) ** 2
def hit(t, g=1.0): add(kick(0.9 * g), t); add(clap(0.32 * g), t); add(sub(NOTE['G2'], 0.4, 0.25 * g), t)
def cut(t, pan=0.0, g=1.0): add(whoosh(0.26, 0.16 * g), t - 0.2, pan=pan); hit(t, g)
def groove(t0, t1, prog, kick_g=0.62, dbl=False, pad=0.045):
    b = 0; t = t0
    while t < t1 - 0.01:
        bass, up = prog[b // 2 % len(prog)]
        add(kick(kick_g), t); add(sub(NOTE[bass] + 12, 0.45, 0.2), t)
        if dbl: add(kick(kick_g * 0.6), t + 0.25)
        if b % 2: add(clap(0.27), t)
        add(hat(0.04), t + 0.25, pan=0.3); add(hat(0.02), t + 0.125, pan=-0.2); add(hat(0.02), t + 0.375, pan=-0.2)
        if b % 2 == 0 and pad: add(organ([NOTE[bass] + 12] + g(up), 1.05, att=0.04, rel=0.4, stops=(0.5, 0.9, 0.3, 0.05), gain=pad), t)
        b += 1; t += 0.5
MIN = [('G1', 'G3 Bb3 D4'), ('Eb2', 'G3 Bb3 Eb4'), ('Bb1', 'F3 Bb3 D4'), ('F2', 'F3 A3 C4')]
MAJ = [('G1', 'G3 B3 D4'), ('D2', 'F#3 A3 D4'), ('E2', 'G3 B3 E4'), ('C2', 'G3 C4 E4')]

# ---------- 0 – 1,5 : la nuit, le doute
add(organ(g('G1 D2'), 1.6, att=0.4, rel=0.6, stops=(0.8, 0.4, 0, 0), gain=0.08), 0.0)
add(felt(NOTE['D5'], 2.0, 0.12), 0.05); add(felt(NOTE['Bb4'], 2.0, 0.1), 0.5); add(felt(NOTE['G4'], 2.0, 0.1), 0.52)
add(kick(0.35), 0.0); add(kick(0.3), 0.5)                         # battement de cœur
add(clap(0.5), 1.0); add(click(0.4), 1.0); add(tom(NOTE['D3'], 0.45), 1.0)   # le trait barre « Pas »
add(rev_whoosh(0.3, 0.2), 1.2)
# 1,5 : « POUR MOI. »
add(boom(0.9), 1.5); hit(1.5, 1.1); add(stab(g('G2 G3 Bb3 D4 G4'), 0.13, 0.45), 1.5)
groove(1.5, 7.85, MIN)
# ---------- 2 – 4 : l'app
add(riser(0.5, 0.2), 2.0); hit(2.5, 0.9); add(click(0.3), 2.5)
hit(3.0, 1.0); add(stab(g('Bb3 D4 G4'), 0.1), 3.0)
for k, m in enumerate(['G5', 'A5', 'Bb5', 'C6', 'D6', 'Eb6', 'F6', 'G6']): add(glass(NOTE[m], 0.5, 0.05), 3.0 + 0.0625 * k, pan=(-0.4 if k % 2 else 0.4)); add(click(0.1), 3.0 + 0.0625 * k)
hit(3.25, 0.8); hit(3.5, 1.0); add(stab(g('D4 G4 Bb4'), 0.11), 3.5)
# ---------- 4 – 7 : le sac, le groupe
add(whoosh(0.5, 0.16), 4.0, pan=-0.3)
for k in range(6): add(click(0.07), 4.05 + 0.07 * k)
cut(4.5); cut(5.0); add(stab(g('Eb2 Eb3 G3 Bb3'), 0.12, 0.45), 5.0)        # « Seul ? »
cut(5.5); add(strings(g('G3 Bb3 D4 G4'), 1.6, att=0.2, rel=0.6, bright=2600, gain=0.08), 5.5)
cut(6.25, g=0.8); add(felt(NOTE['G5'], 1.0, 0.1), 6.3)
# ---------- 7 – 10 : « Démarrer le voyage » puis la nuit
cut(7.0, g=0.8)
add(click(0.4), 7.5); add(thud(0.7), 7.52); add(felt(NOTE['D6'], 1.0, 0.1), 7.5)
add(rev_whoosh(0.4, 0.25), 7.6)
add(boom(1.0), 8.0); hit(8.0, 1.1)
groove(8.0, 10.0, MIN, kick_g=0.72, dbl=True, pad=0.06)
for t in (8.0, 8.75, 9.0, 9.5): add(tom(NOTE['G2'], 0.4), t)
cut(9.0, g=0.9)
add(whoosh(0.4, 0.15), 9.8); hit(10.0, 0.7)
# ---------- 10,75 – 12 : la mère (tout tombe)
add(strings(g('Eb3 G3 Bb3 Eb4'), 1.4, att=0.25, rel=0.6, bright=2400, gain=0.1), 10.75)
for k, m in enumerate(['G5', 'F5', 'Eb5', 'D5', 'Bb4']): add(felt(NOTE[m], 2.0, 0.12 - 0.01 * k), 10.8 + 0.25 * k)
add(organ(g('Eb2 Bb2'), 1.3, att=0.3, rel=0.5, stops=(0.8, 0.4, 0, 0), gain=0.06), 10.75)
# ---------- 12 – 13,5 : la paroi
for k, t in enumerate((12.0, 12.5, 13.0)):
    hit(t, 1.1); add(tom(NOTE[['G2', 'Bb2', 'D3'][k]], 0.6), t); add(stab(g(['G3 Bb3 D4', 'A3 C4 Eb4', 'Bb3 D4 F4'][k]), 0.11, 0.35), t)
    add(kick(0.5), t + 0.25)
add(riser(1.5, 0.28), 12.0)
# ---------- 13,5 – 14 : silence (un verre qui monte)
add(glass(NOTE['D6'], 0.55, 0.035), 13.5)
# ---------- 14 – 18,5 : DROP en sol majeur
add(boom(1.0), 14.0); hit(14.0, 1.2)
add(organ(g('G1 G2 D3 G3 B3 D4 G4'), 2.0, att=0.02, rel=0.8, stops=(0.8, 0.9, 0.45, 0.12), gain=0.12), 14.0)
add(choir(g('B4 D5 G5'), 2.0, att=0.12, rel=0.8, gain=0.1), 14.0)
add(organ(g('D2 D3 F#3 A3 D4'), 2.0, att=0.1, rel=0.6, stops=(0.7, 0.9, 0.4, 0.1), gain=0.1), 16.0)
add(choir(g('A4 D5 F#5'), 1.0, att=0.1, rel=0.5, gain=0.08), 16.0); add(choir(g('B4 E5 G5'), 1.5, att=0.1, rel=0.6, gain=0.08), 17.0)
groove(14.0, 18.5, MAJ, kick_g=0.7, pad=0.05)
for k, m in enumerate(['D5', 'G5', 'B5', 'D6', 'B5', 'G5', 'D6', 'G6']): add(felt(NOTE[m], 1.0, 0.07), 14.5 + 0.25 * k, pan=(-0.3 if k % 2 else 0.3))
cut(16.0, g=0.9); add(glass(NOTE['B5'], 0.6, 0.06), 16.5); add(click(0.25), 16.5)
cut(17.0, g=0.9)
for k in range(14): add(click(0.09), 17.1 + 0.065 * k); add(glass(NOTE['G5'] + k, 0.15, 0.02), 17.1 + 0.065 * k)
add(rev_whoosh(0.45, 0.22), 18.05)
# ---------- 18,5 : fin
add(boom(1.0), 18.5); hit(18.5, 1.2)
add(organ(g('G1 G2 D3 G3 B3 D4 G4'), 1.5, att=0.01, rel=1.0, stops=(0.8, 0.9, 0.45, 0.12), gain=0.15), 18.5)
add(choir(g('B4 D5 G5'), 1.5, att=0.05, rel=1.0, gain=0.11), 18.5)
hit(18.65, 0.6); add(glass(NOTE['G6'], 0.9, 0.05), 18.95)

def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(SR * sec); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / sec); x = lp(x, 5000); x[:int(0.02 * SR)] = 0; return (x / np.sqrt((x ** 2).sum())).astype(np.float32)
wet = 0.14
L2 = L * (1 - wet) + fftconvolve(L, ir(1.6, 1))[:N] * wet * 2; R2 = R * (1 - wet) + fftconvolve(R, ir(1.6, 2))[:N] * wet * 2
tt = np.arange(N) / SR; fade = np.clip((DUR - tt) / 0.3, 0, 1); L2 *= fade; R2 *= fade
st = np.stack([L2, R2], 1); st /= np.abs(st).max() * 1.05
w = wave.open(os.path.join(ROOT, 'audio', 'musique.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); w.close(); print('musique.wav', DUR, 's')
