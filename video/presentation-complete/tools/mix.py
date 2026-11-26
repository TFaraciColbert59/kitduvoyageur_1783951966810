# Bande-son v5 : la piste « Mountains » (Mixkit, licence Mixkit : usage commercial permis) de 37,40 s à 57,40 s
# (son drop, mesuré à 47,22 s, tombe sur b20 = 9,816 s du film) + effets synthétisés, placés sur les gestes de film.js.
# Effets tonals dans la pentatonique de la mineur (la piste est en la mineur / do majeur). Sortie : audio/bande-son.wav (-14 LUFS).
import os, sys, subprocess, wave
import numpy as np
os.environ['DUR'] = '20.0'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *          # SR, N, L, R, add(), organ, felt, glass, whoosh, riser, boom, kick, clap, hat, lp, NOTE, hz…
HERE = ROOT
SONG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'audio', 'mountains.mp3')
B = 0.4908
def b(n): return n * B
S0 = 47.22 - 20 * B          # début de l'extrait : le drop tombe sur b20

# ---------- effets
def click(gain=0.25):
    n = int(SR * 0.05); t = np.arange(n) / SR
    x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((f - 3600) / 1500) ** 2); x = np.fft.irfft(X, n)
    return (x / (np.abs(x).max() + 1e-9) * np.exp(-t * 170) + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 240) * 0.5) * gain
def key(gain=0.12):           # touche de clavier
    n = int(SR * 0.04); t = np.arange(n) / SR
    x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((f - 2600) / 1800) ** 2); x = np.fft.irfft(X, n)
    return x / (np.abs(x).max() + 1e-9) * np.exp(-t * 200) * gain
def blip(m, gain=0.08):
    n = int(SR * 0.35); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t * 11) * np.clip(t / 0.003, 0, 1) * gain
def thump(gain=0.6):
    n = int(SR * 0.45); t = np.arange(n) / SR; f = 50 + 70 * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * gain
def swish(dur=0.32, gain=0.2, up=True):
    n = int(SR * dur); t = np.arange(n) / SR; u = t / dur
    x = rng.standard_normal(n); out = np.zeros(n); step = 1200
    for i in range(0, n, step):
        fc = 400 + 7000 * ((i / n) if up else (1 - i / n)) ** 1.5; seg = x[i:i + step]; out[i:i + step] = lp(seg, fc)[:len(seg)]
    return out * np.sin(np.pi * u) ** 1.6 * gain
def shimmer(dur=1.6, gain=0.05):
    out = np.zeros(int(SR * dur))
    for k, m in enumerate(['A5', 'C6', 'E6', 'G6', 'A6']):
        g_ = glass(NOTE[m], dur - 0.1 * k, gain); out[int(0.08 * k * SR):int(0.08 * k * SR) + len(g_)] += g_[:len(out) - int(0.08 * k * SR)]
    return out
def tick(gain=0.08): return key(gain) * 0.7 + blip(NOTE['A6'], gain * 0.3)[:int(SR * 0.04)]
PENTA = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6']

# 0 : le point s'ouvre en fenêtre
add(thump(0.55), 0.0); add(swish(0.4, 0.18), 0.0); add(blip(NOTE['A5'], 0.08), 0.02)
for k in (1, 2, 3): add(swish(0.22, 0.16, up=False), b(k) - 0.08, pan=(0.4 if k % 2 else -0.4)); add(thump(0.45), b(k)); add(click(0.12), b(k))
# b4 : la fenêtre devient le champ du Compas
add(swish(0.4, 0.2), b(4) - 0.3); add(thump(0.4), b(4))
# frappe : chaque mot apparaît sur un temps (b5…b9) ; un roulement de touches en triples croches
for w in range(5):
    t0 = b(5 + w)
    for c in range(6): add(key(0.11 - 0.008 * c), t0 - 0.12 + c * B / 8, pan=0.15 * ((c % 3) - 1))
# b10 : clic sur « envoyer »
add(click(0.4), b(10)); add(click(0.18), b(10) + 0.07); add(blip(NOTE['E6'], 0.07), b(10))
add(swish(0.35, 0.2), b(10) + 0.02)
# b10,5 – b12 : la préparation (tics qui montent)
for k in range(12): add(tick(0.07), b(10.5) + k * B / 4); add(blip(NOTE[PENTA[k % 10]], 0.03), b(10.5) + k * B / 4)
# b12 : le Hub ; b13 → les tuiles jaillissent en croches ; b17,4 elles rentrent en triples croches
add(swish(0.4, 0.2), b(12) - 0.3); add(thump(0.4), b(12))
for k in range(8): add(blip(NOTE[PENTA[k + 1]], 0.09), b(13) + k * B / 2, pan=(-0.4 if k % 2 == 0 else 0.4)); add(click(0.1), b(13) + k * B / 2)
for k in range(8): add(tick(0.06), b(17.4) + k * B / 8)
add(swish(0.25, 0.16, up=False), b(17.4))
# b18 : le bouton ; le curseur appuie (b18,5) et maintient : la charge monte jusqu'au drop
add(swish(0.35, 0.18), b(18) - 0.25); add(click(0.35), b(18.5)); add(riser(b(20) - b(18.5), 0.22), b(18.5))
for k in range(12): add(tick(0.05 + 0.004 * k), b(18.5) + k * B / 4)
# b20 : DROP — relâché, la forme explose en plein cadre
add(click(0.3), b(20) - 0.01); add(boom(0.9), b(20)); add(swish(0.6, 0.25), b(20) - 0.05)
add(shimmer(1.8, 0.05), b(20.9))
# morphoses après le drop (b24, b26, b28, b30, b32)
for t in (b(24) - 0.12, b(26) - 0.06, b(28) - 0.12, b(30) - 0.06, b(32)):
    add(swish(0.32, 0.17, up=(t not in (b(24) - 0.12, b(28) - 0.12))), t - 0.12); add(thump(0.35), t + 0.1)
# compteurs du carnet
for j0, t0 in enumerate((b(24.3), b(24.55), b(24.8))):
    for k in range(9): add(tick(0.05), t0 + k * 0.08 * (1 + k * 0.12))
    add(blip(NOTE[['C6', 'E6', 'A6'][j0]], 0.07), t0 + 0.95)
# la carte Rencontre
add(blip(NOTE['G5'], 0.08), b(32.4)); add(click(0.15), b(32.4))
# b34 : tout revient au point ; l'anneau ; le logo
add(swish(0.45, 0.2, up=False), b(34) - 0.25); add(blip(NOTE['A5'], 0.08), b(34.1))
add(glass(NOTE['E6'], 1.2, 0.05), b(34.6)); add(shimmer(2.2, 0.06), b(35.2)); add(thump(0.5), b(36)); add(glass(NOTE['A6'], 1.4, 0.04), b(37))

sfx = np.stack([L, R], 1)
# ---------- la piste
tmp = os.path.join(HERE, 'audio', 'song-seg.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{S0:.4f}', '-t', '20.0', '-i', SONG, '-ar', str(SR), '-ac', '2', tmp], check=True)
w = wave.open(tmp); song = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2) / 32768; w.close(); os.remove(tmp)
song = np.pad(song, ((0, max(0, N - len(song))), (0, 0)))[:N]
tt = np.arange(N) / SR
fade = np.clip((20.0 - tt) / 1.1, 0, 1) ** 1.5                     # la piste s'efface sur le logo
song *= fade[:, None]
song *= np.clip(tt / 0.02, 0, 1)[:, None]
mix = song * 0.62 + sfx * 0.9
mix /= np.abs(mix).max() * 1.06
out = os.path.join(HERE, 'audio', 'mix-brut.wav')
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', out, '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-ar', str(SR), os.path.join(HERE, 'audio', 'bande-son.wav')], check=True)
print('bande-son.wav ok, début de piste', round(S0, 3))
