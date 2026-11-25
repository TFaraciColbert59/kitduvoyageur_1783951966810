# Grille du film : la voix (audio/voix-longue.json) est décalée pour laisser, avant chaque chapitre I à VII,
# 2,4 s où l'excuse s'écrit à l'écran sans voix. Sortie : audio/timeline.json (chapitres, excuses, phrases aux horaires du film)
# et audio/voix-finale.wav (la voix replacée sur ces horaires).
import os, json, wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = json.load(open(os.path.join(ROOT, 'audio', 'voix-longue.json')))
EXCUSES = {1: 'Je ne suis pas sportif.', 2: 'Je ne saurais pas où aller.', 3: 'C’est trop compliqué.', 4: 'Je n’ai personne avec qui partir.',
           5: 'Je n’ai pas le matériel.', 6: 'Et si j’oublie quelque chose ?', 7: 'Et si je me perds ?'}
EX = 2.4
blocs = [m for m in V['phrases'] if 'titre' in m]
phr = [m for m in V['phrases'] if 'texte' in m]
shift, chapters = 0.0, []
for b in blocs:
    i = b['bloc']
    ex = None
    if i in EXCUSES:
        ex = dict(texte=EXCUSES[i], debut=round(b['bloc_debut'] + shift, 3), fin=round(b['bloc_debut'] + shift + EX, 3)); shift += EX
    chapters.append(dict(bloc=i, titre=b['titre'], excuse=ex, debut=(0.0 if i == 0 else round(ex['debut'] if ex else b['bloc_debut'] + shift - 0.35, 3)), voix_debut=round(b['bloc_debut'] + shift, 3), voix_fin=round(b['bloc_fin'] + shift, 3), _shift=shift))
sh = {c['bloc']: c['_shift'] for c in chapters}
for p in phr: p['debut'] = round(p['debut'] + sh[p['bloc']], 3); p['fin'] = round(p['fin'] + sh[p['bloc']], 3)
D = round(V['duree'] + shift + 2.0, 3)
for k, c in enumerate(chapters):
    c['fin'] = round(chapters[k + 1]['debut'] if k + 1 < len(chapters) else D, 3); c.pop('_shift')
json.dump(dict(duree=D, chapitres=chapters, phrases=phr), open(os.path.join(ROOT, 'audio', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
# voix replacée
w = wave.open(os.path.join(ROOT, 'audio', 'voix-longue.wav')); SR = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
out = np.zeros(int(D * SR), np.float32)
for b in blocs:
    i = b['bloc']; s0 = int((b['bloc_debut'] - 0.6 if i == 0 else b['bloc_debut'] - 0.3) * SR); s1 = int((b['bloc_fin'] + 0.3) * SR)
    d0 = s0 + int(sh[i] * SR); seg = a[max(0, s0):s1]; out[d0:d0 + len(seg)] += seg
w2 = wave.open(os.path.join(ROOT, 'audio', 'voix-finale.wav'), 'wb'); w2.setnchannels(1); w2.setsampwidth(2); w2.setframerate(SR)
w2.writeframes(np.clip(out, -32768, 32767).astype(np.int16).tobytes()); w2.close()
print('durée du film', D, 's')
for c in chapters: print(f"{c['debut']:7.2f} → {c['fin']:7.2f}  voix {c['voix_debut']:7.2f}–{c['voix_fin']:7.2f}  {c['titre'][:44]}")
