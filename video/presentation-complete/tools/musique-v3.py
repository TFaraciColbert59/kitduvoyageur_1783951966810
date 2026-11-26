# Bande-son des 20 premières secondes (9:16), v3 — 120 BPM, sol mineur. Chaque coupe et chaque geste a son coup :
#   0–2     un mot par croche → frappe + accord qui monte d'un demi-ton de couleur à chaque mot
#   2,0     « Tout ça… » (respiration + montée) ; 2,5 « …dans une seule app » (caisse claire) ; 2,6 aspiration (souffle inversé)
#   3,0     BOUM, la pulsation démarre ; 3,4 le téléphone atterrit (choc sourd)
#   4,5 · 6,0 · 7,5 · 9,0 · 12,0 · 13,5 · 15,0   coupes : souffle + coup
#   8,0 · 8,5  le repère pulse (verre) ; 9,0–10,4 la liste défile (tic en doubles croches)
#   10,5 · 11,0 · 11,5  les cartes du budget claquent (grosse frappe)
#   12,5  appui sur « Démarrer le voyage » (clic + choc) ; 13,0 second anneau
#   13,5 · 14,0 · 14,5  « Billets. Réservations. Urgences. » (accords frappés)
#   16,5  éclair + boum ; carrousel : roulement qui accélère jusqu'à 18,5 ; 18,1 aspiration
#   18,5  BOUM final + accord de sol majeur ; 18,75 « que le Hub. » ; 19,1 verre.
import os, sys, wave
os.environ['DUR'] = '20.0'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *

def click(gain=0.22):
    n = int(SR * 0.05); t = np.arange(n) / SR
    x = rng.standard_normal(n); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); X *= np.exp(-((f - 3800) / 1600) ** 2); x = np.fft.irfft(X, n)
    return (x / (np.abs(x).max() + 1e-9) * np.exp(-t * 160) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 220) * 0.5) * gain
def stab(midis, gain=0.09, dur=0.3):
    return organ(midis, dur, att=0.006, rel=0.2, stops=(0.6, 1.0, 0.45, 0.15), gain=gain)
def sub(m, dur=0.45, gain=0.35):
    n = int(SR * dur); t = np.arange(n) / SR
    return np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 4) * np.clip(t / 0.005, 0, 1) * gain
def tom(m, gain=0.5):
    n = int(SR * 0.35); t = np.arange(n) / SR; f = hz(m) * (1 + 0.5 * np.exp(-t * 30))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * gain
def thud(gain=0.8):
    n = int(SR * 0.5); t = np.arange(n) / SR; f = 55 + 60 * np.exp(-t * 20)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) + lp(rng.standard_normal(n), 600) * np.exp(-t * 30) * 0.4) * gain
def rev_whoosh(dur=0.35, gain=0.2):
    return whoosh(dur, gain)[::-1] * np.linspace(0.3, 1, int(SR * dur)) ** 2
def hit(t, g=1.0):      # coupe franche : grosse caisse + caisse claire + sub
    add(kick(0.9 * g), t); add(clap(0.32 * g), t); add(sub(NOTE['G2'], 0.4, 0.25 * g), t)
def cut(t, pan=0.0, g=1.0):   # coupe avec souffle juste avant
    add(whoosh(0.28, 0.17 * g), t - 0.2, pan=pan); hit(t, g)

PROG = [('G1', 'G3 Bb3 D4'), ('Eb2', 'G3 Bb3 Eb4'), ('Bb1', 'F3 Bb3 D4'), ('F2', 'F3 A3 C4')]
# ---------- 0 – 2 : huit mots, un par croche
WORDCH = [('G2', 'G3 Bb3 D4'), ('G2', 'A3 C4 D4'), ('Eb2', 'G3 Bb3 Eb4'), ('Eb2', 'Bb3 Eb4 G4'), ('C2', 'C4 Eb4 G4'), ('C2', 'Eb4 G4 C5'), ('D2', 'D4 F#4 A4'), ('D2', 'F#4 A4 D5')]
NOTE['F#4'] = NOTE['Fs4']
for k in range(8):
    t = 0.25 * k; bass, up = WORDCH[k]
    add(kick(0.95 if k % 2 == 0 else 0.6), t); add(stab([NOTE[bass] + 12] + [NOTE[x] for x in up.split()], 0.11), t)
    add(sub(NOTE[bass], 0.25, 0.3), t)
    if k % 2: add(clap(0.3), t)
    add(hat(0.05), t + 0.125, pan=0.3)
# ---------- 2 – 3 : « Tout ça… dans une seule app. »
add(sub(NOTE['D2'], 1.0, 0.35), 2.0); add(riser(1.0, 0.24), 2.0)
add(felt(NOTE['D5'], 1.5, 0.12), 2.0)
add(clap(0.45), 2.5); add(kick(0.8), 2.5); add(stab(g('D3 F#4 A4 D5'), 0.1, 0.25), 2.5)
add(rev_whoosh(0.4, 0.22), 2.6)
# ---------- 3,0 : BOUM ; la pulsation démarre
add(boom(1.0), 3.0); add(kick(1.0), 3.0)
add(organ(g('G1 G2 D3 G3 Bb3 D4 G4'), 1.4, att=0.01, rel=0.9, stops=(0.8, 0.9, 0.45, 0.12), gain=0.13), 3.0)
add(thud(0.7), 3.42)
for b in range(31):                      # 3,0 → 18,5 : la pulsation (kick sur chaque temps, clap 2 et 4, charleston)
    t = 3.0 + 0.5 * b
    if t >= 16.5: break
    bass, up = PROG[b // 2 % 4]
    add(kick(0.62), t); add(sub(NOTE[bass] + 12, 0.45, 0.2), t)
    if b % 2: add(clap(0.26), t)
    add(hat(0.04), t + 0.25, pan=0.3); add(hat(0.02), t + 0.125, pan=-0.2); add(hat(0.02), t + 0.375, pan=-0.2)
    if b % 2 == 0: add(organ([NOTE[bass] + 12] + g(up), 1.05, att=0.04, rel=0.4, stops=(0.5, 0.9, 0.3, 0.05), gain=0.045), t)
# ---------- coupes
for t, pan in [(4.5, 0.5), (6.0, 0.0), (7.5, 0.0), (9.0, 0.0), (12.0, -0.5), (13.5, 0.0), (15.0, 0.0)]: cut(t, pan)
for k in range(8): add(click(0.08), 4.62 + 0.17 * k, pan=(-0.5 + k / 7))                       # le défilé des tuiles
add(whoosh(0.45, 0.16), 6.42, pan=0.5); add(tom(NOTE['G3'], 0.35), 6.55)                        # la frise arrive
add(riser(0.4, 0.1), 7.1)
for t in (8.0, 8.5): add(glass(NOTE['D6'], 0.6, 0.06), t); add(felt(NOTE['G5'], 1.0, 0.09), t)  # le repère pulse
for k in range(11): add(click(0.07), 9.35 + 0.1 * k)                                            # la liste défile
for k, t in enumerate((10.54, 11.04, 11.54)):                                                   # les cartes claquent
    add(kick(1.0), t); add(clap(0.45), t); add(tom(NOTE[['D3', 'Bb2', 'G2'][k]], 0.6), t); add(stab(g(['G3 Bb3 D4', 'F3 Bb3 D4', 'D4 G4 Bb4'][k]), 0.1), t)
add(click(0.35), 12.5); add(thud(0.6), 12.52); add(felt(NOTE['G5'], 1.2, 0.12), 12.5)         # appui sur Démarrer le voyage
add(click(0.25), 13.0); add(glass(NOTE['D6'], 0.6, 0.05), 13.0)
for k, t in enumerate((13.5, 14.0, 14.5)):                                                      # Billets. Réservations. Urgences.
    add(stab(g(['G3 Bb3 D4 G4', 'A3 C4 Eb4 A4', 'Bb3 D4 F4 Bb4'][k]), 0.12, 0.35), t); add(clap(0.35), t); add(kick(0.8), t)
add(whoosh(0.3, 0.15), 15.3, pan=0.6); add(tom(NOTE['C3'], 0.5), 15.5); add(kick(0.7), 15.5)
# ---------- 16,5 – 18,5 : le carrousel, roulement qui accélère
add(boom(0.8), 16.5); add(kick(1.0), 16.5)
add(riser(2.0, 0.26), 16.5)
add(organ(g('Eb2 Eb3 G3 Bb3 Eb4'), 1.0, att=0.05, rel=0.5, stops=(0.6, 0.9, 0.35, 0.08), gain=0.08), 16.5)
add(organ(g('F2 F3 A3 C4 F4'), 1.0, att=0.05, rel=0.5, stops=(0.6, 0.9, 0.35, 0.08), gain=0.09), 17.5)
t = 16.5; step = 0.25
while t < 18.45:
    add(tom(NOTE['G2'] + int((t - 16.5) * 6), 0.28), t); add(hat(0.04), t, pan=0.3)
    t += step; step = max(0.0625, step * 0.86)
add(rev_whoosh(0.4, 0.22), 18.1)
# ---------- 18,5 : BOUM final
add(boom(1.0), 18.5); add(kick(1.0), 18.5); add(clap(0.4), 18.5)
add(organ(g('G1 G2 D3 G3 B3 D4 G4'), 1.5, att=0.01, rel=1.0, stops=(0.8, 0.9, 0.45, 0.12), gain=0.15), 18.5)
add(choir(g('B4 D5 G5'), 1.5, att=0.05, rel=1.0, gain=0.1), 18.5)
add(kick(0.8), 18.75); add(clap(0.35), 18.75)
add(glass(NOTE['G6'], 0.9, 0.05), 19.1)

def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(SR * sec); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / sec); x = lp(x, 5000); x[:int(0.02 * SR)] = 0; return (x / np.sqrt((x ** 2).sum())).astype(np.float32)
wet = 0.12
L2 = L * (1 - wet) + fftconvolve(L, ir(1.4, 1))[:N] * wet * 2; R2 = R * (1 - wet) + fftconvolve(R, ir(1.4, 2))[:N] * wet * 2
tt = np.arange(N) / SR; fade = np.clip((DUR - tt) / 0.3, 0, 1); L2 *= fade; R2 *= fade
st = np.stack([L2, R2], 1); st /= np.abs(st).max() * 1.05
w = wave.open(os.path.join(ROOT, 'audio', 'musique.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); w.close(); print('musique.wav', DUR, 's')
