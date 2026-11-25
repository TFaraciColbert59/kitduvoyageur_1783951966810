# Voix provisoire de la présentation (Piper, voix Siwis, CC BY 4.0) à partir de TEXTE-PRESENTATION.md (via audio/blocs.json).
# Chaque phrase (« / ») est synthétisée séparément, un peu ralentie et un peu plus grave ; « (silence) » = 1,2 s ;
# les répliques « APP : « … » » passent par un filtre de haut-parleur de téléphone (voix de guidage de l'app).
# Sortie : audio/voix-longue.wav (48 kHz mono) + audio/voix-longue.json (horaires de chaque phrase et de chaque bloc).
# Usage : python tools/voix.py <exécutable piper> <modèle .onnx>
import sys, os, re, json, subprocess, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIPER, MODEL = sys.argv[1], sys.argv[2]
SR = 48000
TMP = os.path.join(ROOT, 'audio', 'tmp'); os.makedirs(TMP, exist_ok=True)
blocs = json.load(open(os.path.join(ROOT, 'audio', 'blocs.json')))

def synth(text, idx, app=False):
    raw = os.path.join(TMP, f'p{idx}.wav'); out = os.path.join(TMP, f'q{idx}.wav')
    subprocess.run([PIPER, '-m', MODEL, '-f', raw, '--length-scale', '1.0' if app else '1.12'], input=text.encode(), check=True, capture_output=True)
    # narration : hauteur abaissée d'environ 1,4 demi-ton sans changer le tempo ; app : bande téléphone
    af = 'highpass=f=350,lowpass=f=3400,acompressor=threshold=-18dB:ratio=4' if app else 'asetrate=22050*0.92,aresample=22050,atempo=1/0.92,highpass=f=70'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', af, '-ar', str(SR), '-ac', '1', out], check=True)
    w = wave.open(out); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    env = np.convolve(np.abs(a), np.ones(480) / 480, 'same'); nz = np.nonzero(env > 0.008)[0]
    return a[nz[0]:nz[-1] + 1] if len(nz) else a

pieces, meta, t, k = [], [], 0.6, 0
for bi, b in enumerate(blocs):
    t0 = t
    parts = [p.strip() for p in b['voix'].split(' / ') if p.strip()]
    if b.get('app_ouverture'):
        parts = ['APP : « Dans deux cents mètres, à gauche. »', '(silence)'] + parts
    for p in parts:
        if p.startswith('(silence'):
            t += 1.2; continue
        app = p.startswith('APP')
        txt = re.sub(r'^APP : « (.*) »$', r'\1', p)
        a = synth(txt, k, app); k += 1
        pieces.append((t, a))
        meta.append(dict(bloc=bi, texte=txt, app=app, debut=round(t, 3), fin=round(t + len(a) / SR, 3)))
        t += len(a) / SR + 0.45
    meta.append(dict(bloc=bi, titre=b['titre'], bloc_debut=round(t0, 3), bloc_fin=round(t - 0.45, 3)))
    t += 1.0
D = t + 1.0
out = np.zeros(int(D * SR), np.float32)
for t0, a in pieces:
    i = int(t0 * SR); out[i:i + len(a)] += a
w = wave.open(os.path.join(ROOT, 'audio', 'voix-longue.wav'), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
json.dump(dict(duree=round(D, 3), phrases=meta), open(os.path.join(ROOT, 'audio', 'voix-longue.json'), 'w'), ensure_ascii=False, indent=1)
print('durée', round(D, 1), 's,', k, 'phrases')
for m in meta:
    if 'titre' in m: print(f"{m['bloc_debut']:7.2f} → {m['bloc_fin']:7.2f}  {m['titre'][:50]}")
