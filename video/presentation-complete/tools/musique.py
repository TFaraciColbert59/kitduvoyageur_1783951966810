# Bande-son des 20 premières secondes (9:16) — 120 BPM, sol mineur. Le son FRAPPE avec l'image :
#   0–3 s   hook : un écran par temps → grosse caisse + accord d'orgue bref sur chaque temps, souffle juste avant chaque coupe,
#           claps sur les contretemps de mesure, charleston en doubles croches, montée vers 3,0.
#   3,0     impact : tout rentre dans une seule app (boum + accord plein) ; une note de verre par écran qui rentre (doubles croches).
#   5–7 s   le Hub : les huit tuiles jaillissent (une note par tuile, en doubles croches), puis rentrent (souffle inversé).
#   7–19 s  huit tiroirs, un toutes les 1,5 s : clic du doigt → souffle qui monte → coup sur le temps quand le détail se pose
#           (mélodie qui monte d'un tiroir à l'autre) → souffle court à la fermeture.
#   19,5    dernier impact, accord final. Sortie : audio/musique.wav (puis normalisée en audio/bande-son.wav).
import os, sys, wave
os.environ['DUR'] = '20.0'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *

def click(gain=0.22):           # le doigt qui touche l'écran
    n = int(SR * 0.05); t = np.arange(n) / SR
    x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((f - 3800) / 1600) ** 2); x = np.fft.irfft(X, n)
    return (x / (np.abs(x).max() + 1e-9) * np.exp(-t * 160) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 220) * 0.5) * gain
def stab(midis, gain=0.09):     # accord d'orgue bref (un temps)
    return organ(midis, 0.42, att=0.008, rel=0.25, stops=(0.6, 1.0, 0.45, 0.15), gain=gain)
def sub(m, dur=0.45, gain=0.35):
    n = int(SR * dur); t = np.arange(n) / SR
    return np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 4) * np.clip(t / 0.005, 0, 1) * gain
def rev_whoosh(dur=0.35, gain=0.2):
    return whoosh(dur, gain)[::-1] * np.linspace(0.3, 1, int(SR * dur)) ** 2

PROG = [('G1', 'G3 Bb3 D4'), ('Eb2', 'G3 Bb3 Eb4'), ('Bb1', 'F3 Bb3 D4'), ('F2', 'F3 A3 C4')]
# ---------- 0 – 3 : le hook
for b in range(6):
    t = 0.5 * b; bass, up = PROG[b // 2 % 4]
    add(kick(0.95), t); add(sub(NOTE[bass] + 12, 0.45, 0.3), t)
    add(stab([NOTE[bass] + 12] + g(up), 0.1), t)
    if b > 0: add(whoosh(0.22, 0.16), t - 0.15, pan=(0.4 if b % 2 else -0.4))
    if b % 2 == 1: add(clap(0.42), t)
    for s in range(4): add(hat(0.05 if s % 2 else 0.03), t + s * 0.125, pan=0.3)
    add(hat(0.06), t + 0.25)
add(riser(1.0, 0.22), 2.0)
add(rev_whoosh(0.5, 0.18), 2.5)
# ---------- 3,0 : l'impact, tout rentre dans une seule app
add(boom(1.0), 3.0); add(kick(1.0), 3.0)
add(organ(g('G1 G2 D3 G3 Bb3 D4 G4'), 2.0, att=0.02, rel=1.0, stops=(0.8, 0.9, 0.45, 0.12), gain=0.14), 3.0)
add(choir(g('Bb4 D5 G5'), 2.0, att=0.15, rel=1.0, gain=0.09), 3.0)
for k, m in enumerate(['G5', 'A5', 'Bb5', 'C6', 'D6', 'G6']): add(glass(NOTE[m], 0.6, 0.05), 3.5 + 0.125 * k, pan=(-0.4 if k % 2 else 0.4)); add(click(0.12), 3.5 + 0.125 * k)
add(kick(0.7), 3.5); add(clap(0.35), 4.0); add(kick(0.7), 4.0); add(kick(0.6), 4.5)
add(rev_whoosh(0.45, 0.16), 4.55)
# ---------- 5 – 7 : le Hub, les tuiles jaillissent puis rentrent
for b in range(4):
    t = 5.0 + 0.5 * b; bass, up = PROG[b // 2 % 4]
    add(kick(0.8), t); add(sub(NOTE[bass] + 12, 0.45, 0.25), t); add(stab([NOTE[bass] + 12] + g(up), 0.06), t)
    if b % 2: add(clap(0.32), t)
    add(hat(0.04), t + 0.25, pan=0.3)
for k, m in enumerate(['G4', 'Bb4', 'D5', 'F5', 'G5', 'Bb5', 'D6', 'G6']): add(felt(NOTE[m], 1.2, 0.09), 5.5 + 0.125 * k, pan=(-0.35 if k % 2 else 0.35)); add(click(0.1), 5.5 + 0.125 * k)
add(whoosh(0.3, 0.18), 6.6); add(kick(0.7), 6.95)
# ---------- 7 – 19 : huit tiroirs, un toutes les 1,5 s (3 temps)
MEL = ['D5', 'F5', 'G5', 'Bb5', 'A5', 'C6', 'D6', 'G6']
for b in range(24):
    t = 7.0 + 0.5 * b; bass, up = PROG[b // 2 % 4]
    add(kick(0.72), t); add(sub(NOTE[bass] + 12, 0.45, 0.22), t)
    if b % 2: add(clap(0.3), t)
    add(hat(0.035), t + 0.25, pan=0.3); add(hat(0.02), t + 0.125, pan=-0.2); add(hat(0.02), t + 0.375, pan=-0.2)
    if b % 2 == 0: add(organ([NOTE[bass] + 12] + g(up), 1.05, att=0.05, rel=0.4, stops=(0.5, 0.9, 0.3, 0.05), gain=0.05), t)
for i in range(8):
    t0 = 7.0 + 1.5 * i
    add(click(0.3), t0)                                   # le doigt
    add(whoosh(0.4, 0.15), t0 + 0.06, pan=0.1)             # le tiroir monte
    add(felt(NOTE[MEL[i]], 1.4, 0.14), t0 + 0.5); add(glass(NOTE[MEL[i]] + 12, 0.8, 0.035), t0 + 0.5)   # le détail se pose
    add(kick(0.5), t0 + 0.5)
    add(whoosh(0.22, 0.09), t0 + 1.22, pan=-0.1)           # il se referme
# ---------- 19 – 20 : la fin
add(rev_whoosh(0.5, 0.2), 19.0)
add(boom(0.8), 19.5); add(kick(0.9), 19.5)
add(organ(g('G1 G2 D3 G3 B3 D4 G4'), 0.6, att=0.01, rel=0.5, stops=(0.8, 0.9, 0.45, 0.12), gain=0.14), 19.5)
add(choir(g('B4 D5 G5'), 0.5, att=0.05, rel=0.4, gain=0.08), 19.5)

def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(SR * sec); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / sec); x = lp(x, 5000); x[:int(0.02 * SR)] = 0; return (x / np.sqrt((x ** 2).sum())).astype(np.float32)
wet = 0.14
L2 = L * (1 - wet) + fftconvolve(L, ir(1.6, 1))[:N] * wet * 2; R2 = R * (1 - wet) + fftconvolve(R, ir(1.6, 2))[:N] * wet * 2
tt = np.arange(N) / SR; fade = np.clip((DUR - tt) / 0.35, 0, 1); L2 *= fade; R2 *= fade
st = np.stack([L2, R2], 1); st /= np.abs(st).max() * 1.05
w = wave.open(os.path.join(ROOT, 'audio', 'musique.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); w.close(); print('musique.wav', DUR, 's')
