# Musique de la présentation complète — ouverture (0–10,5 s), sol mineur, 120 BPM à partir de l'app.
# Chaque geste de l'image a son son : point de lumière (verre), trait (cordes), devise (piano), horizon (orgue + souffle),
# fil qui trace le téléphone (montée), écran (impact doux), tuiles du Hub (pulsation, une note par tuile). Sortie : audio/ouverture.wav
import os, sys, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *
# 0,35 : le point de lumière
add(glass(NOTE['D6'], 3.0, 0.03), 0.3, pan=0.1); add(felt(NOTE['D5'], 3.0, 0.1), 0.35)
add(organ(g('G1 D2'), 4.2, att=1.6, rel=1.2, stops=(0.8, 0.4, 0, 0), gain=0.07), 0.0)
# 1,0 : le trait s'ouvre — cordes qui montent
add(strings(g('G3 D4'), 3.0, att=0.9, rel=1.2, bright=2200, gain=0.07), 0.95)
# 1,75 : « Là où la carte se termine. » — piano, une note par mot
for k, m in enumerate(['G4', 'Bb4', 'D5', 'C5', 'Bb4', 'A4']): add(felt(NOTE[m], 2.6, 0.11 - 0.008 * k), 1.75 + 0.11 * k, pan=0.2 * (k % 2) - 0.1)
# 3,8 : le trait devient l'horizon — souffle, puis l'orgue s'ouvre avec la Terre
add(whoosh(1.2, 0.14), 3.7)
add(organ(g('Eb2 Eb3 G3 Bb3 Eb4'), 2.6, att=0.7, rel=1.0, stops=(0.6, 0.9, 0.3, 0.06), gain=0.09), 4.1)
add(strings(g('G3 Bb3 Eb4 G4'), 2.6, att=0.8, rel=1.0, bright=2600, gain=0.08), 4.1)
add(felt(NOTE['G5'], 2.5, 0.08), 4.9)  # Vercors
# 5,2 : « Une aventure, de l'envie au retour. »
add(organ(g('Bb1 Bb2 F3 Bb3 D4'), 1.8, att=0.4, rel=0.9, stops=(0.6, 0.9, 0.3, 0.06), gain=0.085), 6.1)
for k, m in enumerate(['D5', 'F5', 'Bb5']): add(felt(NOTE[m], 2.0, 0.07), 5.25 + 0.25 * k)
# 6,6 : le fil trace le téléphone
add(riser(0.75, 0.12), 6.6)
# 7,3 : l'écran s'allume — impact doux, accord de fa
add(boom(0.35), 7.3)
add(organ(g('F2 F3 A3 C4 F4'), 1.0, att=0.08, rel=0.6, stops=(0.6, 0.9, 0.35, 0.1), gain=0.1), 7.3)
# 8,0 → : le Hub — pulsation à 120 BPM, une note de piano par tuile (croches doubles)
for i in range(6): add(kick(0.42), 8.0 + i * BEAT); add(hat(0.03), 8.0 + i * BEAT + E, pan=0.3)
add(organ(g('G1 G2 D3 G3 Bb3 D4'), 2.6, att=0.2, rel=0.8, stops=(0.6, 0.9, 0.3, 0.06), gain=0.085), 8.0)
add(strings(g('G3 Bb3 D4 G4'), 2.6, att=0.4, rel=0.8, bright=2600, gain=0.07), 8.0)
for k, m in enumerate(['G4', 'Bb4', 'D5', 'G5', 'D5', 'Bb4', 'D5', 'G5']): add(felt(NOTE[m], 1.4, 0.06), 8.25 + 0.125 * k, pan=(-0.3 if k % 2 else 0.3))
def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(SR * sec); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / sec); x = lp(x, 5000); x[:int(0.02 * SR)] = 0; return (x / np.sqrt((x ** 2).sum())).astype(np.float32)
wet = 0.24
L2 = L * (1 - wet) + fftconvolve(L, ir(2.4, 1))[:N] * wet * 2; R2 = R * (1 - wet) + fftconvolve(R, ir(2.4, 2))[:N] * wet * 2
tt = np.arange(N) / SR; fade = np.clip((DUR - tt) / 0.5, 0, 1); L2 *= fade; R2 *= fade
st = np.stack([L2, R2], 1); st /= np.abs(st).max() * 1.05
w = wave.open(os.path.join(ROOT, 'audio', 'ouverture.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); w.close(); print('ouverture.wav', DUR, 's')
