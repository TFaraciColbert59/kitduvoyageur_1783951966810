# Insère un passage nouvellement synthétisé dans la voix déjà calée, sans resynthétiser le reste
# (Piper varie de quelques centièmes d'une passe à l'autre : on garde l'ancienne voix telle quelle, tout ce qui suit est décalé d'un bloc).
# Usage : python tools/inserer-voix.py ancien.wav ancien.json nouveau.wav nouveau.json "phrase avant" "phrase après"
# Sortie : audio/voix-longue.wav/.json ; affiche le décalage.
import sys, os, json, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ow, oj, nw, nj, avant, apres = sys.argv[1:7]
def rd(p):
    w = wave.open(p); return w.getframerate(), np.frombuffer(w.readframes(w.getnframes()), np.int16)
SR, a = rd(ow); SR2, b = rd(nw); assert SR == SR2
O = json.load(open(oj)); N = json.load(open(nj))
f = lambda J, t, k: next(p[k] for p in J['phrases'] if p.get('texte') == t)
A, B = f(O, avant, 'fin'), f(O, apres, 'debut'); A2, B2 = f(N, avant, 'fin'), f(N, apres, 'debut')
gap = B - A; L = (B2 - gap) - A2; D = round(B2 - A2 - gap, 3)
seg = b[int(A2 * SR):int((B2 - gap) * SR)]
out = np.concatenate([a[:int(A * SR)], seg, a[int(A * SR):]])
w = wave.open(os.path.join(ROOT, 'audio', 'voix-longue.wav'), 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
L = len(seg) / SR; D = round(L, 3)
ph = []
for p in O['phrases']:
    q = dict(p)
    if 'texte' in q and q['debut'] > A: q['debut'] = round(q['debut'] + D, 3); q['fin'] = round(q['fin'] + D, 3)
    if 'titre' in q:
        if q['bloc_debut'] > A: q['bloc_debut'] = round(q['bloc_debut'] + D, 3)
        if q['bloc_fin'] > A: q['bloc_fin'] = round(q['bloc_fin'] + D, 3)
    ph.append(q)
new = [dict(p, debut=round(p['debut'] - A2 + A, 3), fin=round(p['fin'] - A2 + A, 3)) for p in N['phrases'] if 'texte' in p and A2 < p['debut'] < B2 - gap]
k = next(i for i, p in enumerate(ph) if p.get('texte') == avant) + 1
ph = ph[:k] + new + ph[k:]
json.dump(dict(duree=round(O['duree'] + D, 3), phrases=ph), open(os.path.join(ROOT, 'audio', 'voix-longue.json'), 'w'), ensure_ascii=False, indent=1)
print('décalage', D, 's ;', len(new), 'phrases insérées')
