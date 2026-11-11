# MIX — maquette sonore LKDV 60 s (PLACEHOLDER)

Fichiers (`assets/audio/`) : `LKDV_mock_PLACEHOLDER.wav` (mix), `stem_music_PLACEHOLDER.wav`, `stem_sfx_PLACEHOLDER.wav`, `stem_ambience_PLACEHOLDER.wav` (somme des trois = mix, même gain et même limiteur). 48 kHz, stéréo, 24 bits, 2 880 000 échantillons.

**Origine** : entièrement synthétisée (Python numpy/scipy, `audio/scripts/`), œuvre originale, graine fixe (CRC32 du nom de chaque événement). **Aucune ressource tierce, aucune licence tierce** : la recherche de musiques et d'effets du commerce est abandonnée (décision de l'utilisateur), rien n'a été conservé dans `assets/audio/candidates/`.

Régénération : `score.py <travail>` (rend les stems), `master.py <travail> assets/audio` (gain, limiteur, export), `check.py` (contrôles), `gen_mix.py` (ce tableau).

## Tonalité et harmonie
Ré mineur, 120 BPM (temps 0,5 s, mesure 2 s). Progression par mesure : Dm (0–4) · Bb (4–6) · Dm/Bb/Gm (6–12, descente) · F, C, Dm, Bb, F, C (12–24) · Dm, Bb, Gm (24–30) · F, Dm, Bb (30–36) · F (38–40) · C, G (40–44) · Dm9 piano seul (44–46) · Bb, C (46–50) · Dm9 (50–52) · Dm (52–54) · Bb, C, Dm (56–60).

## Motif de signature (0:03 et 0:52, identique)
Piano : **La4 (3,000 ; tenue 0,50 s) – Ré5 (3,500 ; 0,25 s) – Mi5 (3,750 ; 1,20 s, laisse sonner)**. Quarte montante puis seconde : la neuvième de Ré mineur, ouverte, qui ne retombe pas. Mêmes notes, vélocités (0,85/0,85/0,90), durées et pan à 0:52, sous un accord de Dm plein ; le « dernier accord » de 0:53 (Dm9 : Ré3 La3 Mi4 Fa4 La4) la résout.

## Boucle 1:00 → 0:00
Le rendu est circulaire : tout événement qui dépasse 60,000 s revient au début. La note grave (ré1 accordé à 36,667 Hz = 2 200 périodes en 60 s, + ré2 + la2, attaque 0,35 s, posée à **59,000**) et le chœur (posé à 58,000) passent donc la coupure : leur queue est ce qu'on entend à 0:00. C'est rigoureusement la même note. Pour éviter un clic à la première lecture, 3 ms de fondu aux deux extrémités du fichier (les deux bouts valent 0).

## Silences d'un demi-temps (zéro numérique)
11,5–12,0 (passe-bas de la musique 10,9→11,5 puis silence ; CHOC 2 à 12,0) · 37,0–37,5 (puis un coup sec à 37,5) · 45,5–46,0 (CHOC 3 à 46,0) · « noir sec » 54,0–54,5 (puis un seul ping A6 à 54,5). Les silences sont posés sur tous les stems (fondu de 3 ms avant, ouverture franche sur la grille).

## Choix de lecture de la colonne « Son » à valider
- 0:00 : la note grave et le chœur sont la queue de ceux de 0:59, pas une attaque neuve.
- 0:54 : le ping est à 54,5 (le noir dure 0,5 s), pas à 54,0. Modifiable (`score.py`, `ping(...)`).
- 0:38 « foulées sur le tempo » : un pas par temps (120/min) ; « rires » (0:22, 0:40) non synthétisés.
- Clavier 0:04 : 8 frappes sur la grille 1/16 de temps (0,125 s), pas 40 caractères/s.
- Le « riser » 2,0–3,0 est coupé net à 2,96–3,00 pour laisser entendre la signature.
- Pas de sons réels : vent, vagues, feu, pas, roue libre, avion, brûleur, souffle sont du bruit filtré (stem ambience).

## Événements (temps réel en secondes, stem, niveau en dB relatif)
Les niveaux sont ceux de la synthèse (crête d'événement normalisée à 0 dBFS puis atténuée). Le mix subit ensuite +2,25 dB de gain commun et un limiteur de crête (plafond −1,4 dBFS, anticipation 10 ms).

| T (s) | Nature | Stem | Niveau (dB avant gain commun +2,25) | Détail |
| --- | --- | --- | --- | --- |
| 0.750 | riser qui accélère | sfx | -10 | 0,75 à 1,50 |
| 1.500 | nappe cordes Dm (montée) | music | -22 | filtre 1400 Hz |
| 1.500 | IMPACT (naissance du Soleil) | sfx | -2 | bruit+sinus descendant 88→34 Hz+sub |
| 1.550 | montée continue (riser) | sfx | -17 | 1,55 à 3,05 ; coupée avant la signature |
| 2.250 | IMPACT SEC (la Lune) | sfx | -4 | transitoire bref |
| 3.000 | signature piano A4 | music | -8 | durée tenue 0.50 s |
| 3.000 | nappe cordes Dm (sous la signature) | music | -26 | filtre 1600 Hz |
| 3.000 | pulsation (grosse caisse douce) | music | -27 | -27 à -22 dB, un coup par temps, 3.00 à 6.00 |
| 3.500 | signature piano D5 | music | -8 | durée tenue 0.25 s |
| 3.750 | signature piano E5 | music | -8 | durée tenue 1.20 s |
| 4.000 | nappe de cordes Bb | music | -24 | filtre 1800 Hz |
| 4.000 | clavier feutré (8 frappes) | sfx | -27 | 4,000 à 4,875 pas 0,125 |
| 5.000 | pops cristallins D6 F6 A6 C7 | sfx | -19 | 5,000 5,125 5,250 5,375 |
| 5.500 | bouton d'envoi (clic) | sfx | -20 |  |
| 5.500 | riser coupé net | sfx | -14 | 5,500 à 5,900 |
| 6.000 | batterie | music | -12 | grosse caisse/caisse claire/charley 6.00 à 11.50 ; kick -12, snare -13, hat -26 dB |
| 6.000 | taiko sur chaque mesure | music | -12 | 6,0 8,0 10,0 |
| 6.000 | cordes staccato Dm en croches | music | -20 | -20 à -17 dB, 6.00 à 8.00 |
| 6.000 | nappe cordes Dm (descente) | music | -17 | filtre 2600 Hz |
| 6.000 | sub basse D2 | music | -14 |  |
| 6.000 | CHOC 1 (impact + sub) | sfx | -1 | D1 sub 36,7 Hz, queue 3,4 s |
| 6.000 | flash/zoom exponentiel (whoosh) | sfx | -18 |  |
| 7.000 | tick sage | sfx | -21 |  |
| 8.000 | vent filtré (haute atmosphère) | amb | -24 | 8,0 à 10,2 |
| 8.000 | cordes staccato Bb en croches | music | -17 | -17 à -14 dB, 8.00 à 10.00 |
| 8.000 | nappe de cordes Bb | music | -16 | filtre 2800 Hz |
| 8.000 | sub basse Bb1 | music | -14 |  |
| 8.000 | tick sage | sfx | -21 |  |
| 9.000 | tick sage | sfx | -21 |  |
| 9.000 | passage d'avion (Doppler) | sfx | -22 | gauche→droite |
| 10.000 | cordes staccato Gm en croches | music | -14 | -14 à -12 dB, 10.00 à 11.50 |
| 10.000 | nappe de cordes Gm | music | -15 | filtre 3000 Hz |
| 10.000 | sub basse G1 | music | -14 |  |
| 10.000 | cascade de ticks (13 sur grille 1/16 de temps) | sfx | -24 | 10,0 à 10,95, notes pentatoniques |
| 10.200 | souffle de brûleur (1) | amb | -23 |  |
| 10.700 | souffle de brûleur (2) | amb | -23 |  |
| 12.000 | cordes F plein (drop) | music | -11 | filtre 3200 Hz |
| 12.000 | chœur F (respiration) | music | -12 |  |
| 12.000 | sub basse F2 (drop) | music | -10 |  |
| 12.000 | CHOC 2 (drop) | sfx | -1 | D1 sub |
| 12.000 | souffle d'ouverture | sfx | -20 |  |
| 12.500 | batterie légère (acte 3) | music | -15 | grosse caisse/caisse claire/charley 12.50 à 23.00 ; kick -15, snare -17, hat -31 dB |
| 13.000 | arpège de piano F en croches | music | -19 | 13.00 à 14.00 |
| 13.000 | tick sage | sfx | -21 |  |
| 13.500 | tick sage | sfx | -21 |  |
| 14.000 | vague | amb | -24 | 14,0 à 16,2 |
| 14.000 | nappe cordes C | music | -14 | filtre 2600 Hz |
| 14.000 | sub basse C2 | music | -12 |  |
| 14.000 | arpège de piano C en croches | music | -19 | 14.00 à 16.00 |
| 14.500 | bouchon de liège | sfx | -17 |  |
| 15.000 | glissando ré pentatonique (8 notes) | music | -20 | 15,000 à 15,32 |
| 15.500 | balayage filé | sfx | -17 |  |
| 16.000 | nappe cordes Dm | music | -14 | filtre 2600 Hz |
| 16.000 | sub basse D2 | music | -12 |  |
| 16.000 | arpège montant Fmaj7 (0:16) | music | -17 | 16.00 à 17.00 |
| 17.000 | arpège de piano Dm en croches | music | -19 | 17.00 à 18.00 |
| 17.000 | ticks (kit éprouvé) | sfx | -22 | 17,00 17,25 17,50 17,75 |
| 18.000 | nappe cordes Bb | music | -14 | filtre 2600 Hz |
| 18.000 | sub basse Bb1 | music | -12 |  |
| 19.000 | arpège de piano Bb en croches | music | -19 | 19.00 à 20.00 |
| 19.000 | pops de pastilles (1 par couleur) | sfx | -18 | 19,00 19,25 19,50 19,75 |
| 20.000 | nappe cordes F | music | -14 | filtre 2600 Hz |
| 20.000 | sub basse F2 | music | -12 |  |
| 20.000 | arpège de piano F en croches | music | -19 | 20.00 à 22.00 |
| 20.000 | pops en cascade (4 vagues de 3) | sfx | -20 | 20,00 à 20,94 |
| 21.000 | montée (grille allumée) | sfx | -14 | 21,0 à 22,0 |
| 22.000 | vent sur l'océan | amb | -22 | 22,0 à 23,8 |
| 22.000 | nappe cordes C | music | -13 | filtre 2600 Hz |
| 22.000 | sub basse C2 | music | -12 |  |
| 22.000 | coup de grosse caisse | music | -6 |  |
| 23.500 | riser court (anneau) | sfx | -15 | 23,5 à 24,0 |
| 24.000 | note tenue chaude (cordes graves Dm) | music | -15 | filtre 1200 Hz |
| 24.000 | piano D4 tenu | music | -17 |  |
| 24.000 | pulsation (grosse caisse douce) | music | -29 | -29 à -26 dB, un coup par temps, 24.00 à 30.00 |
| 24.000 | sub basse D2 | music | -14 |  |
| 25.000 | double tick (téléphones) | sfx | -21 |  |
| 25.500 | carillon A5 | music | -26 |  |
| 26.000 | nappe de cordes Bb | music | -18 | filtre 1500 Hz |
| 26.000 | sub basse Bb1 | music | -15 |  |
| 26.000 | trois pings D6 F6 A6 | sfx | -22 | 26,00 26,25 26,50 |
| 27.000 | grésillement coupé net | sfx | -30 | 27,000 à 27,750 |
| 28.000 | vent léger (rhyolite) | amb | -32 | 28,0 à 29,2 |
| 28.000 | pas sur gravier (4) | amb | -21 | 28,00 28,50 29,00 29,25 |
| 28.000 | nappe de cordes Gm | music | -19 | filtre 1500 Hz |
| 28.000 | sub basse G1 | music | -16 |  |
| 29.000 | bourrasque puis calme | amb | -17 | 29,0 à 30,1 |
| 29.800 | vagues de plage de sable noir | amb | -29 | 29,8 à 32,4 |
| 30.000 | crépitement du feu de camp | amb | -21 | 30,0 à 32,4 |
| 30.000 | guitare sèche (Karplus-Strong), arpège F | music | -17 | 16 notes en doubles-croches, 30,0 à 32,0 |
| 30.000 | pulsation (grosse caisse douce) | music | -30 | -30 à -29 dB, un coup par temps, 30.00 à 32.00 |
| 31.000 | tick (envoi) | sfx | -22 |  |
| 31.250 | swipe | sfx | -19 |  |
| 32.000 | le vent seul (respiration 2) | amb | -15 | 32,0 à 33,5 |
| 33.000 | pulsation (grosse caisse douce) | music | -26 | -26 à -23 dB, un coup par temps, 33.00 à 35.00 |
| 33.000 | nappe cordes Dm (sommet) | music | -19 | filtre 1800 Hz |
| 33.000 | sub basse D2 | music | -17 |  |
| 33.000 | cliquetis de bâtons (4 coups) | sfx | -22 | 33,000 33,125 33,500 33,625 |
| 33.500 | vent de crête | amb | -23 | 33,5 à 34,5 |
| 34.000 | nappe de cordes Bb | music | -18 | filtre 2000 Hz |
| 34.000 | sub basse Bb1 | music | -16 |  |
| 34.000 | pages qui claquent (5 flips) | sfx | -18 | 34,000 34,250 34,500 34,750 34,875 |
| 35.000 | vent (sommet) | amb | -25 | 35,0 à 36,0 |
| 35.000 | envolée de cordes D4-A4-D5-F5 | music | -13 | 35,0 à 37,0 |
| 35.000 | pulsation (grosse caisse douce) | music | -22 | -22 à -21 dB, un coup par temps, 35.00 à 36.00 |
| 35.000 | percussion légère (envolée) | music | -20 | grosse caisse/caisse claire/charley 35.00 à 36.00 ; kick -20, snare -99, hat -34 dB |
| 35.000 | envolée (souffle) | sfx | -20 |  |
| 36.000 | ville au loin (Rhône) | amb | -36 | 36,0 à 36,85 |
| 36.000 | piano Bb3 (Tom) | music | -22 |  |
| 36.150 | souffle de coureur | amb | -26 |  |
| 36.500 | piano F4 (Tom) | music | -23 |  |
| 36.650 | souffle de coureur | amb | -26 |  |
| 37.500 | pulsation (foulées) | music | -24 | -24 à -19 dB, un coup par temps, 37.50 à 40.00 |
| 37.500 | coup sec unique (après silence) | sfx | -10 | bois sec |
| 38.000 | foulées sur le tempo (4) | amb | -19 | 38,0 38,5 39,0 39,5 (un pied par temps) |
| 38.000 | nappe cordes F (foulées) | music | -20 | filtre 2200 Hz |
| 38.000 | arpège de piano F en croches | music | -22 | 38.00 à 40.00 |
| 38.000 | sub basse F2 | music | -15 |  |
| 39.000 | tick | sfx | -22 |  |
| 40.000 | roue libre de vélo | amb | -22 | 40,0 à 41,0 |
| 40.000 | batterie tutti (crescendo) | music | -13 | grosse caisse/caisse claire/charley 40.00 à 43.00 ; kick -13, snare -14, hat -28 dB |
| 40.000 | cordes C tutti | music | -15 | filtre 3000 Hz |
| 40.000 | cordes staccato C en croches | music | -19 | -19 à -13 dB, 40.00 à 42.00 |
| 40.000 | sub basse C2 | music | -13 |  |
| 41.000 | roulement de caisse claire en doubles-croches (crescendo) | music | -26 | 41,0 à 43,0, -26 à -14 dB |
| 41.000 | rafale : un coup sec + whoosh par plan | sfx | -16 | 41,0 41,5 42,0 42,5 |
| 42.000 | cordes G tutti | music | -12 | filtre 3600 Hz |
| 42.000 | chœur G (tutti) | music | -14 |  |
| 42.000 | cordes staccato G en croches | music | -13 | -13 à -11 dB, 42.00 à 43.00 |
| 42.000 | sub basse G1 | music | -12 |  |
| 42.000 | taiko 0:42 | music | -11 |  |
| 43.000 | retour du crépitement | amb | -20 | 43,0 à 44,0 |
| 43.000 | vagues lointaines | amb | -30 | 43,0 à 44,0 |
| 44.000 | piano seul chaleureux (Dm9, arpège lent) | music | -12 | D3 A3 F4 E4 A4 D4 |
| 45.000 | accord tenu Dm9 (cordes) | music | -17 | filtre 2200 Hz |
| 45.000 | accord tenu Dm9 (piano) | music | -15 | coupé net à 45,5 |
| 46.000 | tutti Bb (choc 3) | music | -9 | filtre 3600 Hz |
| 46.000 | chœur Bb (choc 3) | music | -11 |  |
| 46.000 | sub basse Bb1 | music | -9 |  |
| 46.000 | batterie finale (46-50) | music | -12 | grosse caisse/caisse claire/charley 46.00 à 50.00 ; kick -12, snare -13, hat -26 dB |
| 46.000 | cordes staccato Bb en croches | music | -17 | -17 à -14 dB, 46.00 à 48.00 |
| 46.000 | taiko choc 3 | music | -9 |  |
| 46.000 | CHOC 3 (drop final) | sfx | -1 | D1 sub |
| 46.000 | envol (souffle) | sfx | -19 |  |
| 46.250 | flashs d'écran (1 par croche, 7 flashs) | sfx | -19 | 46,25 46,50 46,75 47,00 47,25 47,50 47,75 |
| 47.000 | souffle inversé | sfx | -23 | montée 47,0 à 48,0 |
| 48.000 | cordes staccato C en croches | music | -15 | -15 à -12 dB, 48.00 à 50.00 |
| 48.000 | tutti C (tutti 0:49) | music | -10 | filtre 3800 Hz |
| 48.000 | sub basse C2 | music | -10 |  |
| 48.000 | note de piano D5 (trace 1) | music | -11 |  |
| 48.250 | note de piano F5 (trace 2) | music | -11 |  |
| 48.500 | note de piano A5 (trace 3) | music | -11 |  |
| 48.750 | note de piano D6 (trace 4) | music | -11 |  |
| 49.000 | taiko 0:49 | music | -10 |  |
| 50.000 | air d'altitude (respiration 3) | amb | -30 | 50,0 à 51,0 |
| 50.000 | nappe tenue Dm9 (respiration) | music | -12 | filtre 2600 Hz |
| 50.000 | chœur tenu (respiration) | music | -13 |  |
| 50.000 | sub basse D2 | music | -13 |  |
| 50.800 | montée finale (riser) | sfx | -13 | 50,8 à 52,0 coupée net |
| 52.000 | signature piano A4 | music | -8 | durée tenue 0.50 s |
| 52.000 | cordes Dm (signature) | music | -15 | filtre 2600 Hz |
| 52.000 | sub D2 (signature) | music | -12 |  |
| 52.000 | souffle d'accueil (logo) | sfx | -26 |  |
| 52.500 | signature piano D5 | music | -8 | durée tenue 0.25 s |
| 52.750 | signature piano E5 | music | -8 | durée tenue 1.20 s |
| 53.000 | dernier accord Dm9 (cordes) | music | -13 | filtre 2600 Hz |
| 53.000 | dernier accord (chœur) | music | -14 |  |
| 53.000 | dernier accord Dm9 (piano) | music | -11 | coupé net à 54,000 |
| 54.500 | PING unique (noir sec 54,0 -> 54,5) | sfx | -12 | A6 1760 Hz |
| 55.000 | respiration (nuit norvégienne) | amb | -29 | 55,0 à 56,0 |
| 56.000 | pulsation (reprise 0:56) | music | -28 | -28 à -22 dB, un coup par temps, 56.00 à 59.50 |
| 56.000 | nappe cordes Bb (0:56) | music | -20 | filtre 1800 Hz |
| 56.000 | sub basse Bb1 | music | -16 |  |
| 56.000 | tick (reprise pulsation) | sfx | -21 |  |
| 57.000 | vent de montée dans l'aurore | amb | -32 | 57,0 à 58,3 |
| 57.000 | cordes C : une mesure (0:57) | music | -15 | filtre 3000 Hz |
| 57.000 | sub basse C2 | music | -16 |  |
| 58.000 | souffle de chœur (a/o) Dm | music | -11 | posé à 58,000, pic 59,3 ; queue sonne à 0:00-0:01,6 |
| 58.000 | nappe cordes Dm (0:58) | music | -17 | filtre 2200 Hz |
| 59.000 | note grave ré1+ré2+la2 (identique 0:00 / 0:59, circulaire) | music | -6 | posée à 59,000 ; sa queue passe la coupure et sonne à 0:00 |

