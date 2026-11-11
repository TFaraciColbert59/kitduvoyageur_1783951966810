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

