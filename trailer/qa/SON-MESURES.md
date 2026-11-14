# P6 — Son du trailer : mesures (v1)

Mesuré, non écouté : tous les chiffres viennent de commandes lancées le 2026-11-11 avec **FFmpeg 6.1.1-3ubuntu5** et hyperframes 0.9.33. Les niveaux ne sont comparables qu'à version égale.

**`assets/audio/storm-ii.mp3` est absent** (vérifié au début et à la fin du chantier). Tout ce qui dépend de la musique est mesuré sur un **SUBSTITUT** : un faux morceau de 173,5 s, avec les mêmes 380 temps et les mêmes sections que STORM II, des grosses caisses, des nappes d'accords et un bruit mis en forme. Il passe dans la vraie commande de montage. **Les raccords réels, la piste d'effets calée sur le vrai lit et `qa/mix-v1.wav` ne sont pas encore faits.**

Dès que le MP3 sera déposé, une seule commande refait tout : `node tools/audio/build-all.mjs`. Sans le MP3, elle s'arrête avec le code 2 et un message clair ; `--substitut` rejoue la chaîne d'essai.

## 1. Durées exactes

| Fichier | Format | Échantillons | Durée |
|---|---|---|---|
| `qa/tmp/montage-SUBSTITUT.wav` (non versionné) | 48 kHz, pcm_s24le, stéréo | 2 880 000 | 60,000000 s |
| `qa/sfx-v1.wav` (non versionné) | 48 kHz, pcm_f32le, mono (flottant, pour ne pas écrêter avant le mix) | 2 880 000 | 60,000000 s |
| `qa/mix-v1-SUBSTITUT.wav` (non versionné) | 48 kHz, pcm_s24le, stéréo | 2 880 000 | 60,000000 s |
| `assets/audio/storm-ii-montage-60s.wav` | **reporté** (attend le MP3) | — | — |

`build-montage.mjs` applique la commande de MUSIQUE.md à l'identique (filtre recopié dans `lib.mjs`). Il refuse toute sortie qui n'est pas en 48 kHz, en pcm_s24le, et longue d'exactement 2 880 000 échantillons.

## 2. Coupes et temps de la musique

Le tableau complet est celui de `qa/P1-SQUELETTE.md` (§ « Écarts coupe / temps de musique »). Il a été recoupé indépendamment par `node tools/audio/cut-beat-table.mjs`, qui donne les mêmes valeurs : 137 temps dans le montage, 26,3 images par temps.

Les 53 coupes ont toutes un écart de 0,4 image au plus (écart moyen de 0,42 image). Le maximum, 9,6 images, est celui de P01 à l'image 0 : c'est le début du film, pas une coupe. **Aucune coupe ne dépasse une image. Aucune n'a été déplacée.**

Les repères de MUSIQUE.md sont arrondis au centième. Le drop 1 à 5,41 s tombe donc 0,4 image avant l'image 325, et l'outro à 47,47 s tombe 0,2 image après l'image 2848.

## 3. Raccords du montage (`tools/audio/check-joins.mjs`), sur SUBSTITUT uniquement

Le script mesure 0,5 s de chaque côté du raccord : RMS, LUFS momentané et court terme, centroïde spectral, énergie par bandes, distance de chroma, creux et saut d'échantillon au collage, et attaques trouvées par `hyperframes audio`.

**Les chiffres ci-dessous décrivent le faux morceau, pas STORM II.** Ils prouvent seulement que le script tourne. Les seuils sont des heuristiques à moi, à recaler à l'oreille.

| Raccord | Dist. chroma | Δ aigu | Creux sur 10 ms | Verdict (SUBSTITUT) |
|---|---|---|---|---|
| 5,41 s (drop 1) | 0,24 | +15,5 dB | −22,3 dB | risque de s'entendre (5) |
| **33,48 s** (drop 2) | 0,44 | +0,4 dB | −12,7 dB | à surveiller (3) |
| 47,47 s (outro) | 0,16 | −24,3 dB | −10,7 dB | risque de s'entendre (6) |
| **51,00 s** (montée) | 0,06 | +21,6 dB | −18,2 dB | risque de s'entendre (6) |
| 58,00 s (impact final) | 0,40 | +2,1 dB | −16,7 dB | à surveiller (3) |

Le tableau complet est dans `qa/tmp/build-all-SUBSTITUT.log` et `qa/tmp/joins-SUBSTITUT.json`.

Les micro-fondus de 5 ms creusent par construction 10 à 22 dB sur 10 ms au point de collage. À l'oreille, cela peut s'entendre comme un « trou » sur une musique dense, d'où les masques à 33,48 s et 51,00 s. **Raccords réels : reporté** (`build-all.mjs` les mesure, dans `qa/tmp/joins-REEL.json`).

## 4. Piste d'effets (`tools/audio/sfx-cues.json` → `build-sfx.mjs` → `qa/sfx-v1.wav`)

36 effets, chacun avec une cause visible à l'image. Le pic est mesuré sur le signal posé (maximum de l'enveloppe RMS sur 5 ms) et tombe **à l'image + 1, avec 0,00 image d'écart pour chacun des 31 effets ponctuels**. Les 5 ambiances commencent sur leur image et s'arrêtent sur la coupe suivante, avec un fondu de 150 ms.

Le gain est calculé contre le lit : RMS sur 50 ms autour du pic, après un passe-haut à 120 Hz. Le niveau au-dessus du lit est mesuré sur la piste sommée, effets superposés compris. Les gains suivants valent pour le SUBSTITUT ; ils sont recalculés sur le vrai lit.

| Image → pic | Plan | Fichier | Gain | Au-dessus du lit | Cause |
|---|---|---|---|---|---|
| 166→167 | P02→P03 | whoosh-long-a | +4,8 | 4,0 | plongée, flou radial |
| 220→221 | P03→P04 | souffle-a | +2,3 | 3,0 | entrée dans le nuage |
| 272→273 | P04→P05 | whoosh-court-a | +3,9 | 4,0 | trouée du nuage |
| 325→326 | P05→P06 | whoosh-long-b | +4,3 | 4,0 | traversée de la vitre, drop 1 |
| 330–482 | P06–P07 | pluie-vitre | +3,6 | −10 (ambiance) | soir de pluie |
| 482→483 | **P08** | impact-sourd-a | +11,7 | 5,0 | l'œil |
| 508→509 | P09 | whoosh-court-b | +6,3 | 4,0 | poussée dans l'écran |
| 1034→1035 | **P17** | impact-sec-a | +9,8 | 5,8 | « Commander » |
| 1060→1061 | P17→P18 | sonnette | +1,3 | 4,0 | le colis arrive |
| 1191→1192 | **P20** | clac-boucle-a (Kenney) | +20,3 | 5,0 | clac de la boucle |
| 1271→1272 | P21→P22 | whoosh-court-c | +3,1 | 4,0 | filé vers le train |
| 1271–1323 | P22 | rails-train | +9,7 | −8 (ambiance) | train |
| 1402→1403 | P24 | pas-sentier-a (Kenney) | +6,5 | 3,0 | premiers pas |
| 1507→1508 | P25→P26 | whoosh-long-a | +5,4 | 4,0 | le drone s'arrache |
| 1507–1612 | P26 | vent-altitude-a | +3,2 | −9 (ambiance) | Seceda |
| 1612→1613 | P27 | whoosh-court-a | +5,9 | 4,0 | FPV sur l'arête |
| 1927→1928 | P31 | declic-photo | +14,0 | 3,0 | photo (image du déclic à confirmer) |
| 2009→2010 | P32→P33 | whoosh-long-b + crash-a | +1,7 / +3,0 | 5,1 | **masque du raccord à 33,48 s**, entrée du coureur |
| 2063→2064 | **P34** | impact-sec-b + pied-pierre (Kenney) | +10,8 / +12,9 | 5,0 | pied sur la pierre |
| 2245→2246 | P37 | eclaboussure-torrent | +14,3 | 3,0 | saut au-dessus du torrent |
| 2297→2298 | P37→P38 | pas-sentier-b (Kenney) | +7,0 | 3,0 | il atterrit |
| 2297–2378 | P38 | vent-altitude-b | +5,8 | −9 (ambiance) | Tofana |
| 2508→2509 | P41 | gravillons-a | +12,6 | 4,0 | gravillons projetés |
| 2560→2561 | P42 | whoosh-court-b | +5,9 | 4,0 | plongée en rotation |
| 2770→2771 | P44→P45 | whoosh-court-c | +4,9 | 4,0 | Clara passe |
| 2848→2849 | P45→P46 | whoosh-long-a | −1,8 | 3,0 | le ciel accélère (outro) |
| 2930–3060 | P47–P48 | feu-crepitement | +6,3 | −7 (ambiance) | le feu |
| 3060→3061 | P48→P49 | whoosh-long-b + crash-b | +1,4 / +1,8 | 5,1 | **masque du raccord à 51,00 s**, publication |
| 3271→3272 | P51→P52 | whoosh-court-a | +4,0 | 4,0 | remontée |
| 3324→3325 | P52 | souffle-b | +5,0 | 3,0 | les nuages |
| 3376→3377 | P52→P53 | whoosh-court-b | +4,9 | 4,0 | passage en orbite |
| 3480→3481 | **P53→P54** | montee-riser + impact-final | +0,9 / +11,3 | 5,5 | **logo**, impact final |

Règles vérifiées par le script, qui refuse sinon : chaque fichier existe, chaque cause est écrite, et le même whoosh ne revient jamais deux fois de suite (14 whooshes répartis sur 5 fichiers). Les effets ponctuels se placent tous **entre 3,0 et 5,8 dB au-dessus du lit**, avant le limiteur.

La banque compte 31 fichiers, dont 4 prises réelles CC0 de Kenney et 27 sons générés. Provenance et licences : `assets/audio/sfx/SOURCES.md`.

## 5. Mixage (`tools/audio/build-mix.mjs`), sur SUBSTITUT uniquement

Chaîne : somme du lit et des effets (effets au centre), gain unique, limiteur suréchantillonné ×4 avec plafond à −1,5 dB, retour à 48 kHz en 24 bits.

| Mesure sur `qa/mix-v1-SUBSTITUT.wav` | Valeur |
|---|---|
| Lit de substitution seul (montage) | −7,2 LUFS intégrés (visé −6,9 ; le limiteur du générateur plafonne ; crête vraie +0,8 dBTP) |
| `ffmpeg ebur128` (6.1.1) | **−14,2 LUFS intégrés**, crête vraie **−1,2 dBTP**, LRA 2,5 LU |
| `npx hyperframes audio --json` | −14,1 LUFS, crête vraie −1,2 dBTP, 0 écrêtage |
| Gain appliqué | −8,0 dB |
| Limiteur sur les effets ponctuels | réduction médiane 0,3 dB ; il rabote les transitoires courts : clac P20 −5,9 dB, déclic P31 −3,4, P34 −3,0, « Commander » −2,2 |

`mix-v1.wav` n'existe pas : `build-mix.mjs` refuse de l'écrire sans le montage réel.

## 6. À valider à l'oreille par Tony

1. Les raccords réels, surtout à 33,48 s et 51,00 s : faut-il garder ou retirer les masques whoosh + crash, et le creux des micro-fondus s'entend-il ?
2. Le caractère de chaque son généré, en priorité la sonnette (son tonal synthétisé, à remplacer de préférence par une vraie prise CC0), les impacts et le riser.
3. Le clac de boucle Kenney (source peut-être écrêtée) et le rabot du limiteur sur les clacs.
4. L'image exacte du déclic photo de P31 (posé sur un temps à l'image 1927), à recaler sur le plan monté.
5. L'équilibre des ambiances, réglées entre 7 et 10 dB sous le lit.

## 7. Reporté

- Montage réel, raccords réels, piste d'effets calée sur le vrai lit et `qa/mix-v1.wav` : ils attendent le MP3 (`node tools/audio/build-all.mjs`).
- Branchement dans `film/index.html` (balise `<audio>` avec `id`, puis `normalize-audio`) : hors de mon périmètre.
- Vraies prises CC0 pour la sonnette, le vent et la pluie : le proxy refuse Freesound, OpenGameArt et Wikimedia.
- La licence de synchronisation de STORM II reste à vérifier avant toute diffusion publique.
