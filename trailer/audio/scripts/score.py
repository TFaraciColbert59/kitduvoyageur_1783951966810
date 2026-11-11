#!/usr/bin/env python3
"""Partition synthétisée LKDV 60 s (maquette PLACEHOLDER). 120 BPM, ré mineur.
Rend les trois stems (musique, effets, ambiances) en flottant, circulaires (boucle sans couture)."""
import sys, json, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *
from synth import _fc

M = Stem('music', rt60=2.6, wet=1.0, seed=11)
S = Stem('sfx', rt60=1.4, wet=1.0, seed=22)
A = Stem('amb', rt60=0.9, wet=1.0, seed=33)

CH = {
    'Dm':  ['D3', 'A3', 'D4', 'F4', 'A4'],
    'Bb':  ['Bb2', 'F3', 'Bb3', 'D4', 'F4'],
    'F':   ['F3', 'C4', 'F4', 'A4', 'C5'],
    'C':   ['C3', 'G3', 'C4', 'E4', 'G4'],
    'G':   ['G2', 'D4', 'G4', 'B4', 'D5'],
    'Gm':  ['G3', 'D4', 'G4', 'Bb4', 'D5'],
    'Dm9': ['D3', 'A3', 'E4', 'F4', 'A4'],
}
ROOT = {'Dm': 'D2', 'Bb': 'Bb1', 'F': 'F2', 'C': 'C2', 'G': 'G1', 'Gm': 'G1', 'Dm9': 'D2'}
ARP = {  # notes d'arpège (piano)
    'Dm': ['D3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4', 'A3'],
    'Bb': ['Bb2', 'F3', 'Bb3', 'D4', 'F4', 'D4', 'Bb3', 'F3'],
    'F':  ['F3', 'C4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C4'],
    'C':  ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'],
    'G':  ['G3', 'D4', 'G4', 'B4', 'D5', 'B4', 'G4', 'D4'],
    'Gm': ['G3', 'D4', 'G4', 'Bb4', 'D5', 'Bb4', 'G4', 'D4'],
}


def pad(ch, t, dur, db, cut=2200, att=0.5, rel=0.8, send=0.35, pan=0.0, what=None, notes=None):
    sig = strings([nf(x) for x in (notes or CH[ch])], dur, att, rel, cut, name=f'pad{ch}{t}')
    M.add(sig, t, db, pan, send, what=what or f'nappe de cordes {ch}', note=f'filtre {int(cut)} Hz', dur=dur + rel)


def bass(ch, t, dur, db, what=None):
    M.add(subtone(nf(ROOT[ch]), dur, 0.03, 0.3), t, db, 0, 0.05, what=what or f'sub basse {ROOT[ch]}', dur=dur)


def stac(ch, t0, t1, db0, db1, step=0.25, cut=3000):
    times = np.arange(t0, t1 - 1e-9, step)
    notes = [nf(x) for x in CH[ch][:3]]
    for i, t in enumerate(times):
        db = db0 + (db1 - db0) * i / max(1, len(times) - 1)
        sig = strings(notes, 0.09, 0.012, 0.11, cut, name=f'stac{ch}{t}', det=(-6, 6), kmax=26)
        M.add(sig, t, db, (-0.3, 0.3)[i % 2], 0.25, what=None)
    M.log.append(dict(t=t0, stem='music', what=f'cordes staccato {ch} en croches', db=db0, note=f'{db0:+.0f} à {db1:+.0f} dB, {t0:.2f} à {t1:.2f}', dur=t1 - t0))


KICK = kick('kick')
KICK_S = kick('kickS', f0=110, f1=50, dec=0.13, click=0.15)
SN = [snare('sn1'), snare('sn2')]
HAT = [hat('h1'), hat('h2'), hat('h3')]


def pulse(t0, t1, db0, db1, step=0.5, what='pulsation (grosse caisse douce)'):
    times = np.arange(t0, t1 - 1e-9, step)
    for i, t in enumerate(times):
        db = db0 + (db1 - db0) * i / max(1, len(times) - 1)
        M.add(KICK_S, t, db, 0, 0.1)
    M.log.append(dict(t=t0, stem='music', what=what, db=db0, note=f'{db0:+.0f} à {db1:+.0f} dB, un coup par temps, {t0:.2f} à {t1:.2f}', dur=t1 - t0))


def drums(t0, t1, dk, ds, dh, hat_step=0.25, snares=True, what='batterie'):
    k = 0
    for t in np.arange(t0, t1 - 1e-9, 0.5):
        M.add(KICK, t, dk, 0, 0.12)
        beat = int(round((t % 2.0) / 0.5))
        if snares and beat in (1, 3):
            M.add(SN[k % 2], t, ds, 0.1, 0.3)
            k += 1
    for i, t in enumerate(np.arange(t0, t1 - 1e-9, hat_step)):
        M.add(HAT[i % 3], t, dh - (2.5 if (i % 2) else 0), (-0.4, 0.4)[i % 2], 0.05)
    M.log.append(dict(t=t0, stem='music', what=what, db=dk, note=f'grosse caisse/caisse claire/charley {t0:.2f} à {t1:.2f} ; kick {dk:+.0f}, snare {ds:+.0f}, hat {dh:+.0f} dB', dur=t1 - t0))


def arp(ch, t0, t1, db, step=0.25, vel=0.6, what=None, octv=0):
    notes = ARP[ch]
    n = 0
    for t in np.arange(t0, t1 - 1e-9, step):
        f = nf(notes[n % len(notes)]) * (2 ** octv)
        M.add(piano(f, step * 1.6, vel, name=f'arp{t}', rel=0.5), t, db, ((n % 3) - 1) * 0.3, 0.35)
        n += 1
    M.log.append(dict(t=t0, stem='music', what=what or f'arpège de piano {ch} en croches', db=db, note=f'{t0:.2f} à {t1:.2f}', dur=t1 - t0))


# ============================================================ MUSIQUE
# --- boucle : grave (59.0) et chœur (58.0) circulaires, queue sur 0:00-0:04
M.add(grave(), 59.0, -6, 0, 0.12, what='note grave ré1+ré2+la2 (identique 0:00 / 0:59, circulaire)', dur=4.6,
      note='posée à 59,000 ; sa queue passe la coupure et sonne à 0:00')
M.add(choir([nf(x) for x in ('D3', 'A3', 'D4', 'F4')], 2.6, att=1.3, rel=1.6, name='choirA'), 58.0, -11, 0, 0.5,
      what='souffle de chœur (a/o) Dm', note='posé à 58,000, pic 59,3 ; queue sonne à 0:00-0:01,6', dur=5.5)
# 0:01,5-0:03 : nappe qui monte
pad('Dm', 1.5, 1.6, -22, cut=1400, att=1.1, rel=0.5, what='nappe cordes Dm (montée)')
# 0:03 signature de 3 notes de piano : A4 (3,00 ; 0,5 s), D5 (3,50 ; 0,25 s), E5 (3,75 ; 1,2 s)
def signature(t0, db=-8):
    for dt, nm, d, v in ((0.0, 'A4', 0.5, 0.85), (0.5, 'D5', 0.25, 0.85), (0.75, 'E5', 1.2, 0.9)):
        M.add(piano(nf(nm), d, v, name='sig' + nm, rel=0.6), t0 + dt, db, (-0.12, 0, 0.12)[('A4', 'D5', 'E5').index(nm)], 0.35,
              what=f'signature piano {nm}', note=f'durée tenue {d:.2f} s', dur=d + 1)
signature(3.0)
pad('Dm', 3.0, 1.0, -26, cut=1600, att=0.4, rel=0.6, what='nappe cordes Dm (sous la signature)')
pulse(3.0, 6.0, -27, -22)
pad('Bb', 4.0, 2.0, -24, cut=1800, att=0.8, rel=0.5)
# 0:06 CHOC 1 : descente (batterie complète + cordes staccato)
drums(6.0, 11.5, -12, -13, -26)
taiko_t = np.arange(6.0, 11.5, 2.0)
for t in taiko_t:
    M.add(taiko(), t, -12, 0, 0.3)
M.log.append(dict(t=6.0, stem='music', what='taiko sur chaque mesure', db=-12, note='6,0 8,0 10,0', dur=5.5))
stac('Dm', 6.0, 8.0, -20, -17)
stac('Bb', 8.0, 10.0, -17, -14)
stac('Gm', 10.0, 11.5, -14, -12)
pad('Dm', 6.0, 2.0, -17, cut=2600, att=0.05, rel=0.4, what='nappe cordes Dm (descente)')
pad('Bb', 8.0, 2.0, -16, cut=2800, att=0.1, rel=0.4)
pad('Gm', 10.0, 1.5, -15, cut=3000, att=0.1, rel=0.2)
bass('Dm', 6.0, 2.0, -14); bass('Bb', 8.0, 2.0, -14); bass('Gm', 10.0, 1.5, -14)

# 0:12 CHOC 2 : drop, cordes (respiration 12,0-12,5 sans batterie)
pad('F', 12.0, 2.0, -11, cut=3200, att=0.04, rel=0.5, send=0.5, what='cordes F plein (drop)')
M.add(choir([nf(x) for x in ('F3', 'A3', 'C4', 'F4')], 2.0, att=0.2, rel=1.0, name='choirF', vowel=(500, 1000)), 12.0, -12, 0, 0.5,
      what='chœur F (respiration)', dur=3.2)
bass('F', 12.0, 2.0, -10, what='sub basse F2 (drop)')
drums(12.5, 24.0 - 1.0, -15, -17, -31, what='batterie légère (acte 3)')
CHORDS_A3 = ['F', 'C', 'Dm', 'Bb', 'F', 'C']
for i, ch in enumerate(CHORDS_A3):
    t = 12.0 + 2.0 * i
    if i > 0:
        pad(ch, t, 2.0, -14 + (0 if i < 5 else 1), cut=2600, att=0.25, rel=0.5, what=f'nappe cordes {ch}')
        bass(ch, t, 2.0, -12)
# piano arpège : 13-18, 19-21 ; 18-19 retenue
arp('C', 14.0, 16.0, -19, 0.25, 0.55)
arp('Dm', 16.0, 17.0, -17, 0.125, 0.6, what='arpège montant Fmaj7 (0:16)')
arp('Dm', 17.0, 18.0, -19, 0.25, 0.55)
arp('F', 13.0, 14.0, -19, 0.25, 0.55)
arp('Bb', 19.0, 20.0, -19, 0.25, 0.55)
arp('F', 20.0, 22.0, -19, 0.25, 0.55)
# 0:15 glissando type harpe
for i, nm in enumerate(['D4', 'F4', 'A4', 'C5', 'D5', 'F5', 'A5', 'C6']):
    M.add(piano(nf(nm), 0.2, 0.55, name='gl' + nm, rel=0.8), 15.0 + i * 0.045, -20 + i * 0.4, -0.4 + i * 0.11, 0.5)
M.log.append(dict(t=15.0, stem='music', what='glissando ré pentatonique (8 notes)', db=-20, note='15,000 à 15,32', dur=0.5))
# 0:18 musique retenue : pas de pulsation, nappe seule (automation plus bas)
# 0:22 grosse caisse
M.add(taiko('gc', f0=70, f1=42, dec=0.9, dur=2.0), 22.0, -6, 0, 0.35, what='coup de grosse caisse', dur=2.0)

# 0:24 acte 4 : note tenue chaude
pad('Dm', 24.0, 2.0, -15, cut=1200, att=0.6, rel=1.0, send=0.5, what='note tenue chaude (cordes graves Dm)',
    notes=['D2', 'A2', 'D3', 'F3'])
M.add(piano(nf('D4'), 2.0, 0.6, name='warm', rel=1.0), 24.0, -17, 0, 0.4, what='piano D4 tenu')
pulse(24.0, 30.0, -29, -26)
pad('Bb', 26.0, 2.0, -18, cut=1500, att=0.5, rel=0.6)
pad('Gm', 28.0, 2.0, -19, cut=1500, att=0.6, rel=0.6)
bass('Dm', 24.0, 2.0, -14); bass('Bb', 26.0, 2.0, -15); bass('Gm', 28.0, 2.0, -16)
# 0:25 double tick (sfx) + carillon
M.add(bell(nf('A5'), 1.2), 25.5, -26, 0.2, 0.5, what='carillon A5', dur=3.0)

# 0:30 feu de camp : guitare sèche (F), 30-32
GUIT = ['F2', 'C3', 'A3', 'C4', 'A3', 'C3', 'F3', 'A3', 'C4', 'F4', 'C4', 'A3', 'F3', 'C3', 'A2', 'C3']
for i, nm in enumerate(GUIT):
    M.add(ks(nf(nm), 2.2, 0.996, name='guit'), 30.0 + i * 0.125, -17 + (2 if i % 4 == 0 else 0), (-0.25, 0.25)[i % 2], 0.25)
M.log.append(dict(t=30.0, stem='music', what='guitare sèche (Karplus-Strong), arpège F', db=-17, note='16 notes en doubles-croches, 30,0 à 32,0', dur=2.0))
pulse(30.0, 32.0, -30, -29)
# 0:32 plongée 1 : vent seul (musique coupée 32,0-33,0 sauf 33,0 reprise)
# 0:33 reprise
pulse(33.0, 35.0, -26, -23)
pad('Dm', 33.0, 2.0, -19, cut=1800, att=0.8, rel=0.6, what='nappe cordes Dm (sommet)')
pad('Bb', 34.0 - 0.0, 2.0, -18, cut=2000, att=0.6, rel=0.5)
bass('Dm', 33.0, 1.0, -17); bass('Bb', 34.0, 2.0, -16)
# 0:35 envolée de cordes : ligne montante
for i, (nm, d) in enumerate((('D4', 0.5), ('A4', 0.5), ('D5', 0.5), ('F5', 1.0))):
    M.add(strings([nf(nm), nf(nm) * 2], d, 0.12, 0.4, 3600, name='fly' + nm), 35.0 + i * 0.5 - (0.0), -13 + i * 0.7, 0, 0.5)
M.log.append(dict(t=35.0, stem='music', what='envolée de cordes D4-A4-D5-F5', db=-13, note='35,0 à 37,0', dur=2.0))
pulse(35.0, 36.0, -22, -21)
drums(35.0, 36.0, -20, -99, -34, snares=False, what='percussion légère (envolée)')
# 0:36 plongée 2 : musique discrète (piano), silence 37,0-37,5
M.add(piano(nf('Bb3'), 0.9, 0.5, name='tomA', rel=0.5), 36.0, -22, 0, 0.5, what='piano Bb3 (Tom)')
M.add(piano(nf('F4'), 0.4, 0.5, name='tomB', rel=0.5), 36.5, -23, 0, 0.5, what='piano F4 (Tom)')
# 0:37,5 coup sec (sfx), puis foulées sur le tempo
pulse(37.5, 40.0, -24, -19, what='pulsation (foulées)')
pad('F', 38.0, 2.0, -20, cut=2200, att=0.5, rel=0.4, what='nappe cordes F (foulées)')
arp('F', 38.0, 40.0, -22, 0.25, 0.55)
bass('F', 38.0, 2.0, -15)
# 0:40-0:43 crescendo : tutti
drums(40.0, 43.0, -13, -14, -28, what='batterie tutti (crescendo)')
for i, t in enumerate(np.arange(41.0, 43.0, 0.125)):
    M.add(SN[i % 2], t, -26 + 12 * (t - 41.0) / 2.0, 0, 0.25)
M.log.append(dict(t=41.0, stem='music', what='roulement de caisse claire en doubles-croches (crescendo)', db=-26, note='41,0 à 43,0, -26 à -14 dB', dur=2.0))
pad('C', 40.0, 2.0, -15, cut=3000, att=0.2, rel=0.4, send=0.45, what='cordes C tutti')
pad('G', 42.0, 1.0, -12, cut=3600, att=0.15, rel=0.15, send=0.45, what='cordes G tutti')
M.add(choir([nf(x) for x in ('G3', 'D4', 'G4', 'B4')], 1.0, att=0.3, rel=0.2, name='choirG', vowel=(600, 1100)), 42.0, -14, 0, 0.5, what='chœur G (tutti)', dur=1.4)
stac('C', 40.0, 42.0, -19, -13)
stac('G', 42.0, 43.0, -13, -11)
bass('C', 40.0, 2.0, -13); bass('G', 42.0, 1.0, -12)
M.add(taiko(), 42.0, -11, 0, 0.3, what='taiko 0:42')
# 0:44 piano seul chaleureux
for dt, nm, d, v in ((0.0, 'D3', 1.0, 0.55), (0.5, 'A3', 0.8, 0.5), (0.75, 'F4', 0.7, 0.5), (1.0, 'E4', 0.7, 0.55), (1.25, 'A4', 0.6, 0.5), (1.5, 'D4', 0.6, 0.5)):
    M.add(piano(nf(nm), d, v, name='warmP' + nm, rel=0.6), 44.0 + dt, -12, 0, 0.45)
M.log.append(dict(t=44.0, stem='music', what='piano seul chaleureux (Dm9, arpège lent)', db=-12, note='D3 A3 F4 E4 A4 D4', dur=2.0))
# 0:45 accord tenu puis silence 45,5
pad('Dm9', 45.0, 0.5, -17, cut=2200, att=0.15, rel=0.1, send=0.4, what='accord tenu Dm9 (cordes)')
for nm in CH['Dm9']:
    M.add(piano(nf(nm), 0.6, 0.6, name='ac' + nm, rel=0.2), 45.0 + 0.012 * CH['Dm9'].index(nm), -15, 0, 0.4)
M.log.append(dict(t=45.0, stem='music', what='accord tenu Dm9 (piano)', db=-15, note='coupé net à 45,5', dur=0.5))
# 0:46 CHOC 3
pad('Bb', 46.0, 2.0, -9, cut=3600, att=0.03, rel=0.4, send=0.5, what='tutti Bb (choc 3)')
M.add(choir([nf(x) for x in ('Bb3', 'D4', 'F4', 'Bb4')], 2.0, att=0.15, rel=0.6, name='choirB', vowel=(500, 1000)), 46.0, -11, 0, 0.5, what='chœur Bb (choc 3)', dur=2.8)
bass('Bb', 46.0, 2.0, -9)
drums(46.0, 50.0, -12, -13, -26, what='batterie finale (46-50)')
stac('Bb', 46.0, 48.0, -17, -14)
stac('C', 48.0, 50.0, -15, -12)
pad('C', 48.0, 2.0, -10, cut=3800, att=0.1, rel=0.4, send=0.5, what='tutti C (tutti 0:49)')
bass('C', 48.0, 2.0, -10)
M.add(taiko(), 46.0, -9, 0, 0.3, what='taiko choc 3'); M.add(taiko(), 49.0, -10, 0, 0.3, what='taiko 0:49')
# 0:48 quatre notes (doubles-croches... une par croche 0,25 s)
for i, nm in enumerate(['D5', 'F5', 'A5', 'D6']):
    M.add(piano(nf(nm), 0.3, 0.8, name='q4' + nm, rel=0.5), 48.0 + 0.25 * i, -11, (-0.3, -0.1, 0.1, 0.3)[i], 0.4, what=f'note de piano {nm} (trace {i+1})')
    M.add(bell(nf(nm), 0.9, 1.6), 48.0 + 0.25 * i, -24, (-0.3, -0.1, 0.1, 0.3)[i], 0.5)
# 0:50 respiration : nappe tenue, pas de batterie
pad('Dm9', 50.0, 2.0, -12, cut=2600, att=0.5, rel=0.6, send=0.55, what='nappe tenue Dm9 (respiration)')
M.add(choir([nf(x) for x in ('D3', 'A3', 'E4', 'A4')], 2.0, att=0.8, rel=0.8, name='choirR'), 50.0, -13, 0, 0.55, what='chœur tenu (respiration)', dur=3.6)
bass('Dm', 50.0, 2.0, -13)
# 0:52 signature
signature(52.0)
pad('Dm', 52.0, 1.0, -15, cut=2600, att=0.15, rel=0.4, send=0.5, what='cordes Dm (signature)')
M.add(subtone(nf('D2'), 2.0, 0.02, 0.3), 52.0, -12, 0, 0.1, what='sub D2 (signature)', dur=2)
# 0:53 dernier accord, coupé net à 54,0
pad('Dm9', 53.0, 1.0, -13, cut=2600, att=0.08, rel=0.15, send=0.6, what='dernier accord Dm9 (cordes)')
M.add(choir([nf(x) for x in ('D3', 'A3', 'E4', 'A4')], 1.0, att=0.2, rel=0.2, name='choirL'), 53.0, -14, 0, 0.5, what='dernier accord (chœur)', dur=1.2)
for k, nm in enumerate(CH['Dm9']):
    M.add(piano(nf(nm), 1.0, 0.7, name='dern' + nm, rel=0.3), 53.0 + 0.02 * k, -11, 0, 0.5)
M.log.append(dict(t=53.0, stem='music', what='dernier accord Dm9 (piano)', db=-11, note='coupé net à 54,000', dur=1.0))
# 0:56 reprise de la pulsation, 0:57 cordes une mesure, 0:58 chœur, 0:59 note grave
pulse(56.0, 59.5, -28, -22, what='pulsation (reprise 0:56)')
pad('Bb', 56.0, 2.0, -20, cut=1800, att=0.8, rel=0.8, what='nappe cordes Bb (0:56)')
pad('C', 57.0, 2.0, -15, cut=3000, att=0.8, rel=0.8, send=0.5, what='cordes C : une mesure (0:57)')
pad('Dm', 58.0, 2.0, -17, cut=2200, att=0.8, rel=0.8, what='nappe cordes Dm (0:58)')
bass('Bb', 56.0, 2.0, -16); bass('C', 57.0, 1.0, -16)

# ============================================================ EFFETS (stem sfx)
def sx(sig, t, db, pan=0, send=0.15, what=None, note='', dur=None):
    S.add(sig, t, db, pan, send, what=what, note=note, dur=dur)

# 0:00-0:03
sx(riser(0.75, 'rs1', 300, 9000, tone=(nf('D3'), nf('D5')), accel=(8, 40), curve=1.6), 0.75, -10, 0, 0.3, 'riser qui accélère', '0,75 à 1,50')
sx(impact('imp15', 3.0, bright=1.0), 1.5, -2, 0, 0.45, 'IMPACT (naissance du Soleil)', 'bruit+sinus descendant 88→34 Hz+sub', 3.0)
sx(riser(1.5, 'rs2', 400, 7000, tone=(nf('D3'), nf('A5')), accel=(4, 20), curve=1.2, tone_amt=0.4), 1.55, -17, 0, 0.3, 'montée continue (riser)', '1,55 à 3,05 ; coupée avant la signature')
S.dry[int(2.96 * SR):int(3.0 * SR)] *= np.linspace(1, 0, int(0.04 * SR))[:, None]  # coupe nette du riser avant la signature
S.send[int(2.96 * SR):int(3.0 * SR)] *= np.linspace(1, 0, int(0.04 * SR))[:, None]
sx(dry_hit('dry225'), 2.25, -4, 0, 0.3, 'IMPACT SEC (la Lune)', 'transitoire bref', 0.7)
# clavier feutré
for i in range(8):
    sx(thock(f'key{i}', 0.9 + 0.05 * (i % 3)), 4.0 + 0.125 * i, -27 - (i % 2) * 2, (-0.2, 0.2)[i % 2], 0.05)
S.log.append(dict(t=4.0, stem='sfx', what='clavier feutré (8 frappes)', db=-27, note='4,000 à 4,875 pas 0,125', dur=0.9))
for i, f in enumerate((1174.7, 1396.9, 1760.0, 2093.0)):
    sx(pop(f, f'pp{i}'), 5.0 + 0.125 * i, -19, (-0.45, -0.15, 0.15, 0.45)[i], 0.4)
S.log.append(dict(t=5.0, stem='sfx', what='pops cristallins D6 F6 A6 C7', db=-19, note='5,000 5,125 5,250 5,375', dur=0.5))
sx(thock('btn', 0.6), 5.5, -20, 0, 0.1, 'bouton d\'envoi (clic)', '')
sx(riser(0.4, 'rs3', 500, 11000, tone=(nf('A4'), nf('A6')), accel=(14, 46), curve=1.0, tone_amt=0.35), 5.5, -14, 0, 0.2, 'riser coupé net', '5,500 à 5,900')
# 0:06 CHOC 1
sx(impact('imp6', 3.4, bright=1.1), 6.0, -1, 0, 0.5, 'CHOC 1 (impact + sub)', 'D1 sub 36,7 Hz, queue 3,4 s', 3.4)
sx(whoosh(0.9, 'wh6', 400, 7000, 0.2), 6.0, -18, 0, 0.3, 'flash/zoom exponentiel (whoosh)', '')
for t, nm in ((7.0, 'tk7'), (9.0, 'tk9'), (13.0, 'tk13'), (13.5, 'tk13b')):
    sx(tick(3200, nm), t, -21, 0.2, 0.15, 'tick sage', '')
sx(tick(3300, 'tk8'), 8.0, -21, -0.2, 0.15, 'tick sage', '')
sx(doppler(1.0, 'plane'), 9.0, -22, 0, 0.2, 'passage d\'avion (Doppler)', 'gauche→droite', 1.0)
# cascade de ticks 0:10
rng = R('cascade')
tm = np.sort(np.unique(np.round(rng.uniform(10.0, 10.95, 24) * 16) / 16))
sc = ['D6', 'F6', 'A6', 'C7', 'D7']
for i, t in enumerate(tm):
    sx(tick(nf(sc[i % 5]) * 1.0, f'c{i}', 0.07), t, -24 + 4 * (t - 10.0), (-0.5, 0.5)[i % 2], 0.2)
S.log.append(dict(t=10.0, stem='sfx', what=f'cascade de ticks ({len(tm)} sur grille 1/16 de temps)', db=-24, note='10,0 à 10,95, notes pentatoniques', dur=1.0))
# 0:12 CHOC 2
sx(impact('imp12', 3.8, bright=1.0, f0=95), 12.0, -1, 0, 0.55, 'CHOC 2 (drop)', 'D1 sub', 3.8)
sx(whoosh(1.0, 'wh12', 300, 5000, 0.12, fall=True), 12.0, -20, 0, 0.3, 'souffle d\'ouverture', '')
# 0:14-15 bouteille, 0:15 swoosh
sx(cork(), 14.5, -17, 0.2, 0.3, 'bouchon de liège', '')
sx(whoosh(0.45, 'wh155', 800, 7500, 0.55), 15.5, -17, 0.3, 0.2, 'balayage filé', '')
# 0:17 ticks, 0:19 pops par pastille, 0:20 pops en cascade
for t in (17.0, 17.25, 17.5, 17.75):
    sx(tick(3300, f'tk17{t}'), t, -22, 0, 0.15)
S.log.append(dict(t=17.0, stem='sfx', what='ticks (kit éprouvé)', db=-22, note='17,00 17,25 17,50 17,75', dur=0.75))
for i, f in enumerate((1174.7, 1568.0, 1760.0, 2093.0)):
    sx(pop(f, f'p19{i}'), 19.0 + 0.25 * i, -18, (-0.4, -0.15, 0.15, 0.4)[i], 0.35)
S.log.append(dict(t=19.0, stem='sfx', what='pops de pastilles (1 par couleur)', db=-18, note='19,00 19,25 19,50 19,75', dur=1.0))
for w, t in enumerate((20.0, 20.25, 20.5, 20.75)):
    for j in range(3):
        sx(pop(1318.5 * 2 ** ((j + w) / 5), f'p20{w}{j}'), t + 0.0625 * j, -20, (-0.5 + 0.5 * j) * 0.7, 0.35)
S.log.append(dict(t=20.0, stem='sfx', what='pops en cascade (4 vagues de 3)', db=-20, note='20,00 à 20,94', dur=1.0))
sx(riser(1.0, 'rs21', 350, 10000, tone=(nf('D3'), nf('D5')), accel=(6, 30), curve=1.4), 21.0, -14, 0, 0.3, 'montée (grille allumée)', '21,0 à 22,0')
sx(riser(0.5, 'rs23', 500, 9000, tone=(nf('G4'), nf('G5')), accel=(10, 36), curve=1.2), 23.5, -15, 0, 0.3, 'riser court (anneau)', '23,5 à 24,0')
# 0:24-0:29
sx(tick(3000, 'tk25a'), 25.0, -21, -0.1, 0.15, 'double tick (téléphones)', ''); sx(tick(3000, 'tk25b'), 25.125, -21, 0.1, 0.15)
for i, f in enumerate((1174.7, 1396.9, 1760.0)):
    sx(ping(f, 0.5, 1.5), 26.0 + 0.25 * i, -22, (-0.4, 0, 0.4)[i], 0.4)
S.log.append(dict(t=26.0, stem='sfx', what='trois pings D6 F6 A6', db=-22, note='26,00 26,25 26,50', dur=1.5))
sx(static_crackle(0.75, 'stat27'), 27.0, -30, 0, 0.0, 'grésillement coupé net', '27,000 à 27,750')
for t in (31.0,):
    sx(tick(3100, 'tk31'), t, -22, 0, 0.15, 'tick (envoi)', '')
sx(whoosh(0.35, 'sw31', 1500, 7000, 0.5), 31.25, -19, 0.4, 0.2, 'swipe', '')
# 0:33 cliquetis de bâtons
for i, t in enumerate((33.0, 33.125, 33.5, 33.625)):
    sx(metal_tink(f'pole{i}', 2100 + 200 * (i % 2)), t, -22, (-0.3, 0.3)[i % 2], 0.2)
S.log.append(dict(t=33.0, stem='sfx', what='cliquetis de bâtons (4 coups)', db=-22, note='33,000 33,125 33,500 33,625', dur=0.7))
# 0:34 pages (5 flips)
for i, t in enumerate((34.0, 34.25, 34.5, 34.75, 34.875)):
    sx(flick(f'pg{i}', 0.1), t, -18, (-0.3, 0.3)[i % 2], 0.2)
S.log.append(dict(t=34.0, stem='sfx', what='pages qui claquent (5 flips)', db=-18, note='34,000 34,250 34,500 34,750 34,875', dur=1.0))
sx(whoosh(0.7, 'ft35', 400, 6500, 0.7), 35.0, -20, 0, 0.3, 'envolée (souffle)', '')
# 0:37,5 coup sec
sx(thock('coup375', 1.8), 37.5, -10, 0, 0.12, 'coup sec unique (après silence)', 'bois sec')
sx(tick(3100, 'tk39'), 39.0, -22, 0, 0.15, 'tick', '')
# rafale 0:41 -> 0:42,5 : un coup par temps
for i, t in enumerate((41.0, 41.5, 42.0, 42.5)):
    sx(whoosh(0.28, f'raf{i}', 700 * (i + 1), 8000, 0.3), t, -16, (-0.4, 0.4)[i % 2], 0.2)
    sx(thock(f'rafh{i}', 0.7), t, -17, 0, 0.1)
S.log.append(dict(t=41.0, stem='sfx', what='rafale : un coup sec + whoosh par plan', db=-16, note='41,0 41,5 42,0 42,5', dur=2.0))
sx(tick(3100, 'tk56'), 56.0, -21, 0, 0.15, 'tick (reprise pulsation)', '')
# 0:46 CHOC 3 + flashs
sx(impact('imp46', 4.0, bright=1.1, f0=92), 46.0, -1, 0, 0.55, 'CHOC 3 (drop final)', 'D1 sub', 4.0)
sx(whoosh(1.0, 'wh46', 3000, 400, 0.1, fall=True), 46.0, -19, 0, 0.3, 'envol (souffle)', '')
for i in range(8):
    t = 46.25 + 0.25 * i if i < 3 else 47.0 + 0.25 * (i - 3)
    sx(pop(1568.0 * (1 + 0.06 * i), f'fl{i}'), t, -19, (-0.4, 0.4)[i % 2], 0.3)
    sx(flick(f'flk{i}', 0.07), t, -23, 0, 0.2)
S.log.append(dict(t=46.25, stem='sfx', what='flashs d\'écran (1 par croche, 7 flashs)', db=-19, note='46,25 46,50 46,75 47,00 47,25 47,50 47,75', dur=1.6))
sx(sweep_noise(1.0, 400, 6000, 'rev47', power=1.0) * np.sin(0.5 * np.pi * T(SR)) ** 2 * 0.3, 47.0, -23, 0, 0.3, 'souffle inversé', 'montée 47,0 à 48,0')
# 0:50-0:52 montée finale
sx(riser(1.2, 'rs51', 300, 11000, tone=(nf('D3'), nf('D6')), accel=(6, 40), curve=1.3, tone_amt=0.5), 50.8, -13, 0, 0.35, 'montée finale (riser)', '50,8 à 52,0 coupée net')
S.dry[int(51.97 * SR):int(52.0 * SR)] *= np.linspace(1, 0, int(0.03 * SR))[:, None]
S.send[int(51.97 * SR):int(52.0 * SR)] *= np.linspace(1, 0, int(0.03 * SR))[:, None]
sx(whoosh(1.2, 'wh52', 200, 2500, 0.3, fall=True), 52.0, -26, 0, 0.5, 'souffle d\'accueil (logo)', '')
# 0:54 ping unique après noir sec
sx(ping(nf('A6'), 1.0, 3.0), 54.5, -12, 0, 0.55, 'PING unique (noir sec 54,0 -> 54,5)', 'A6 1760 Hz', 3.0)

# ============================================================ AMBIANCES
def am(sig, t, db, pan=0, send=0.1, what=None, note='', dur=None, fi=0.3, fo=0.5):
    sig = sig * fade_env(len(sig), fi, fo)
    A.add(sig, t, db, pan, send, what=what, note=note, dur=dur)

am(wind(2.2, 'w8'), 8.0, -24, 0, 0.2, 'vent filtré (haute atmosphère)', '8,0 à 10,2', 2.2, 0.8, 0.8)
am(burner(0.4, 'b1'), 10.2, -23, -0.2, 0.2, 'souffle de brûleur (1)', ''); am(burner(0.4, 'b2'), 10.7, -23, 0.2, 0.2, 'souffle de brûleur (2)', '', fi=0.01, fo=0.2)
am(surf(2.2, 'surf14', 6.0), 14.0, -24, 0, 0.2, 'vague', '14,0 à 16,2', 2.2, 0.8, 0.9)
am(wind(1.8, 'w22'), 22.0, -22, 0, 0.2, 'vent sur l\'océan', '22,0 à 23,8', 1.8, 0.2, 0.7)
am(wind(1.2, 'w28', 0.8), 28.0, -32, 0, 0.1, 'vent léger (rhyolite)', '28,0 à 29,2', 1.2, 0.5, 0.5)
for i, t in enumerate((28.0, 28.5, 29.0, 29.25)):
    A.add(gravel_step(f'gr{i}'), t, -21, (-0.15, 0.15)[i % 2], 0.1, what=None)
A.log.append(dict(t=28.0, stem='amb', what='pas sur gravier (4)', db=-21, note='28,00 28,50 29,00 29,25', dur=1.5))
am(wind(1.1, 'gust29', 1.4) * np.sin(np.pi * np.minimum(T(int(1.1 * SR)) / 0.75, 1) * 0.5) ** 2, 29.0, -17, 0, 0.2, 'bourrasque puis calme', '29,0 à 30,1', 1.1, 0.15, 0.5)
am(surf(2.6, 'surf30', 8.0), 29.8, -29, 0, 0.2, 'vagues de plage de sable noir', '29,8 à 32,4', 2.6, 0.5, 0.5)
am(fire(2.4, 'fire30'), 30.0, -21, 0, 0.15, 'crépitement du feu de camp', '30,0 à 32,4', 2.4, 0.15, 0.4)
am(wind(1.5, 'w32', 0.9), 32.0, -15, 0, 0.3, 'le vent seul (respiration 2)', '32,0 à 33,5', 1.5, 0.4, 0.8)
am(wind(1.0, 'w33', 0.7), 33.5, -23, 0, 0.2, 'vent de crête', '33,5 à 34,5', 1.0, 0.3, 0.7)
am(wind(1.0, 'w35', 0.9), 35.0, -25, 0, 0.2, 'vent (sommet)', '35,0 à 36,0', 1.0, 0.3, 0.5)
for i, t in enumerate((36.15, 36.65)):
    am(breath(0.45, f'br{i}'), t, -26, (-0.2, 0.2)[i], 0.15, 'souffle de coureur', '', 0.45, 0.15, 0.15)
am(lp(R('city').standard_normal(int(0.85 * SR)), 650, 2) * 1.0, 36.0, -36, 0, 0.1, 'ville au loin (Rhône)', '36,0 à 36,85', 0.85, 0.3, 0.25)
for i, t in enumerate(np.arange(38.0, 40.0, 0.5)):
    A.add(run_step(f'run{i}'), t, -19, (-0.25, 0.25)[i % 2], 0.1)
A.log.append(dict(t=38.0, stem='amb', what='foulées sur le tempo (4)', db=-19, note='38,0 38,5 39,0 39,5 (un pied par temps)', dur=2.0))
am(ratchet(1.0, 'bike'), 40.0, -22, 0.1, 0.1, 'roue libre de vélo', '40,0 à 41,0', 1.0, 0.0, 0.15)
am(fire(1.0, 'fire43'), 43.0, -20, 0, 0.15, 'retour du crépitement', '43,0 à 44,0', 1.0, 0.1, 0.1)
am(surf(1.0, 'surf43', 8.0), 43.0, -30, 0, 0.1, 'vagues lointaines', '43,0 à 44,0', 1.0, 0.1, 0.1)
am(wind(1.0, 'w50', 0.6), 50.0, -30, 0, 0.3, 'air d\'altitude (respiration 3)', '50,0 à 51,0', 1.0, 0.3, 0.3)
am(wind(1.0, 'w55', 0.5), 55.0, -29, 0, 0.3, 'respiration (nuit norvégienne)', '55,0 à 56,0', 1.0, 0.5, 0.5)
am(wind(1.3, 'w57', 0.8), 57.0, -32, 0, 0.3, 'vent de montée dans l\'aurore', '57,0 à 58,3', 1.3, 0.5, 0.8)
A.log.append(dict(t=0, stem='amb', what='(0:00-0:08 aucune ambiance : espace cosmique)', db=-99, note='', dur=0))

STEMS = (M, S, A)

# --------------------------------------------------------- post : automation, passe-bas, silences
def interp_db(points):
    pt = np.array(points)
    return dB(np.interp(np.arange(N) / SR, pt[:, 0], pt[:, 1]))[:, None]


def lowpass_sweep(buf, t0, t1, f0, f1, blk=48):
    a, b = int(t0 * SR), int(t1 * SR)
    nb = (b - a) // blk
    zi = None
    for i in range(nb):
        fc = f0 * (f1 / f0) ** (i / max(1, nb - 1))
        sos = ss.butter(2, _fc(fc), 'low', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, 2))
        seg = buf[a + i * blk:a + (i + 1) * blk]
        buf[a + i * blk:a + (i + 1) * blk], zi = ss.sosfilt(sos, seg, axis=0, zi=zi)
    # fin du balayage : le reste est coupé par le silence
    return buf

SILENCES = [(11.5, 12.0), (37.0, 37.5), (45.5, 46.0), (54.0, 54.5)]


def mask_array(fade=0.003):
    m = np.ones(N)
    nf_ = int(fade * SR)
    for a, b in SILENCES:
        ia, ib = int(round(a * SR)), int(round(b * SR))
        m[ia:ib] = 0.0
        m[ia - nf_:ia] = 0.5 + 0.5 * np.cos(np.pi * np.arange(nf_) / nf_)
    return m[:, None]


def build():
    music = M.render()
    # musique retenue 18-19 ; vent seul 32,0-33,0 ; creux 36,0-37,0
    music *= interp_db([(0, 0), (17.9, 0), (18.0, -7), (18.95, -7), (19.0, 0),
                        (31.9, 0), (32.1, -40), (32.9, -40), (33.0, 0),
                        (35.9, 0), (36.05, -3), (36.9, -3), (37.0, -3), (37.5, 0),
                        (43.0, 0), (43.01, -9), (43.9, -9), (44.0, 0),
                        (49.95, 0), (50.05, 0), (59.0, 0), (60, 0)])
    # sfx : pas de duck
    music = lowpass_sweep(music, 10.9, 11.5, 9000, 140)
    sfx = S.render()
    amb = A.render()
    # musique 32,0-33,0 : ne garder que le vent (amb)
    mask = mask_array()
    music *= mask; sfx *= mask; amb *= mask
    return music, sfx, amb


if __name__ == '__main__':
    music, sfx, amb = build()
    np.save(sys.argv[1] + '/music.npy', music.astype(np.float32))
    np.save(sys.argv[1] + '/sfx.npy', sfx.astype(np.float32))
    np.save(sys.argv[1] + '/amb.npy', amb.astype(np.float32))
    ev = []
    for s in STEMS:
        ev += s.log
    json.dump(ev, open(sys.argv[1] + '/events.json', 'w'), ensure_ascii=False, indent=1, default=float)
    print('rendered', len(ev), 'log rows')
