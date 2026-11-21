# Musique : STORM II (GENER8ION)

Fichier source : `trailer/assets/audio/storm-ii.mp3` (MP3 320 kb/s, 44,1 kHz, stéréo, 2 min 53 s). Il n'est **pas versionné** (droits d'auteur) : il faut le redonner à chaque nouvelle session.

**Licence :** titre commercial. Avant toute diffusion publique du trailer, il faut une licence de synchronisation ; sans elle, les plateformes risquent de couper le son ou de bloquer la vidéo.

## Analyse du morceau

Mesures faites avec `hyperframes beats` (tempo et temps) et `ffmpeg astats` (niveau RMS par demi-seconde).

- **Tempo : 136,9 BPM.** Un temps dure 0,438 s, une mesure 1,753 s, 16 mesures 28,05 s.
- Les temps sont dans `trailer/assets/audio/storm-ii.beats.json` (380 temps). Le premier temps de chaque mesure correspond aux indices où `indice % 4 == 3`.

| Section | Morceau | Niveau |
|---|---|---|
| Intro (avec trous) | 0–11 s | −18 à −30 dB |
| Montée | 11–71,5 s | −13 à −15 dB |
| **Drop 1** (16 mesures) | 71,495–99,565 s | −8 dB |
| Pont (silence quasi complet à 105,2 s) | 99,565–113,5 s | −14 dB |
| Reprise / montée vers le drop 2 | 113,5–127,545 s | −10 dB |
| **Drop 2** (16 mesures) | 127,545–155,555 s | −8 dB |
| Outro | 155,555–168 s | −18 dB |
| Fin | 168–173,5 s | fondu |

## Montage de 60 s, coupé sur les premiers temps de mesure

| Film | Morceau | Passage |
|---|---|---|
| 0,00–5,41 | 66,085–71,495 | Fin de la montée, fondu d'entrée de 0,25 s (espace et descente) |
| 5,41–33,48 | 71,495–99,565 | **Drop 1**, 16 mesures (déclic, Compas, départ, montagne) |
| 33,48–47,47 | 141,565–155,555 | **Drop 2**, 8 dernières mesures (coureur, cycliste) |
| 47,47–51,00 | 155,555–159,085 | Outro, 2 mesures (bivouac) |
| 51,00–58,00 | 120,545–127,545 | Montée vers le drop 2, 4 mesures (publication, Noah, remontée) |
| 58,00–60,00 | 127,545–129,545 | **Impact du drop 2** sur le logo, fondu de sortie de 0,8 s |

Fichier produit : `trailer/assets/audio/storm-ii-montage-60s.wav` (48 kHz, 24 bits, exactement 60,000 s). Les raccords ont un micro-fondu de 5 ms, sans chevauchement, pour que le minutage reste exact à l'image près.

Commande pour le refaire (depuis `trailer/assets/audio/`) :

```bash
ffmpeg -y -i storm-ii.mp3 -filter_complex "[0]atrim=66.085:71.495,asetpts=PTS-STARTPTS,afade=t=in:d=0.25,afade=t=out:st=5.405:d=0.005[a];[0]atrim=71.495:99.565,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=28.065:d=0.005[b];[0]atrim=141.565:155.555,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=13.985:d=0.005[c];[0]atrim=155.555:159.085,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=3.525:d=0.005[d];[0]atrim=120.545:127.545,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=6.995:d=0.005[e];[0]atrim=127.545:129.545,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=1.2:d=0.8[f];[a][b][c][d][e][f]concat=n=6:v=0:a=1,apad=whole_dur=60,atrim=0:60[o]" -map "[o]" -ar 48000 -c:a pcm_s24le storm-ii-montage-60s.wav
```

**Niveau :** le montage mesure −6,9 LUFS intégrés (master très fort). Pour la diffusion, il faut descendre à **−14 LUFS**, crête vraie à −1 dBTP, une fois les effets sonores ajoutés.

**À écouter, pas seulement à mesurer :** les raccords sont tous posés sur un premier temps de mesure, mais un passage d'un drop à l'autre peut faire entendre un changement de mélodie. Le sound-designer valide à l'oreille et ajoute au besoin un whoosh ou un crash pour masquer chaque raccord (en priorité à 33,48 s et à 51,00 s).

## Coupes du film

Les 54 coupes de `TRAME-60s.md` (v4.1) sont toutes posées sur un temps du montage.

- Plans de 0,44 s à 2,00 s, aucun au-delà de 2 s.
- Les plans de 0,44 s (P08 l'œil, P17 « Commander », P20 la boucle) sont des impacts sur un seul temps.

**Maquette de rythme :** `trailer/qa/maquette-rythme.mp4`, non versionnée. Fond coloré par acte, numéro du plan, image source, contenu et durée, flash blanc à chaque coupe, carré sauge sur chaque temps, musique montée.
