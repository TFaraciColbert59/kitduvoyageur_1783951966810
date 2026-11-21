# Montage musical v3 — STORM II, 60 s, film à 24 i/s

Rédigé le 14/11/2026 par `sound-designer`. **Mesuré, non écouté** partout : je lis des chiffres et des planches, je n'entends rien. Outils : ffmpeg 6.0 et ffprobe 4.4 (binaires de `node_modules`), Python 3 + numpy 2.0.2 + Pillow 11.3, HyperFrames 0.9.33. Les mesures v1/v2 (`SON-AUDIT.md`) ont été faites avec FFmpeg 6.1.1 : à comparer avec prudence.

Musique seule, **aucun effet sonore**. Consigne de Tony : silence, puis le vrai début du morceau en douceur, coupé pour tenir en 60 s.

- Fichier : `qa/mix-v3.wav` (non versionné, ignoré par `qa/*.wav`).
- Grille : `qa/mix-v3.beats.json` (137 temps, 35 mesures, en s et en images à 24 i/s).
- Planches : `qa/snapshots/musique-v3/`.
- Reconstruction : `node tools/audio/build-all.mjs --v3` (ffmpeg et ffprobe dans le PATH).

## 1. Vérification de la matière

### Le morceau
`assets/audio/storm-ii.mp3` : 173,479 s, 44,1 kHz, stéréo, 320 kb/s.

### `storm-ii.beats.json` correspond bien à ce fichier
- Aucun décalage global.
- 97,4 % de ses 380 temps ont une attaque mesurée à ±60 ms : c'est le même chiffre que l'audit v1, donc le même fichier.
- Dans les drops, l'écart médian avec la grille mesurée est de −0,4 ms (drop 1) et −1,2 ms (drop 2).

### Mais sa grille n'est pas assez précise pour couper
- Les temps sont quantifiés par pas de 10 ms.
- Le tempo est arrondi à 136,9 BPM.
- Dans l'intro et la longue montée, les temps s'écartent jusqu'à 200 ms. On y trouve aussi un temps doublé et un temps manquant.

### La grille que j'ai mesurée, et qui sert ici
- **Tempo réel : 136,997 BPM**, soit un temps de **0,437965 s**.
  - Mesure : intercorrélation des enveloppes du drop 1 et du drop 2, qui sont à 32 mesures d'écart (décalage 56,0595 s).
  - Contre-mesures : 0,437992 s de m40 à m48, et 0,437929 s de m72 à m80.
- **Phase : m40 temps 1 = 71,4914 s.**
  - C'est la médiane de 128 attaques de grosse caisse : 50 % de la montée de l'enveloppe 30–150 Hz, pas de 1 ms.
  - Écart absolu médian : 4 ms.
  - Drop 1 : 71,4917 s ; drop 2 : 71,4902 s.
- Avec 136,9 BPM, la grille du film dériverait de 43 ms sur 60 s, soit environ 1 image à 24 i/s.
- En temps de film : **10,511 images par temps**, **mesure = 1,75186 s = 42,04 images**.

### Numérotation des mesures
- `mN` désigne une mesure du morceau.
- m0 commence à 1,4170 s.
- Le morceau s'ouvre sur 3 temps de levée (« m−1 », 0,103 s à 1,417 s).
- On a toujours mN temps 1 = 71,4914 + (N − 40) × 4 × 0,437965 s.

## 2. Structure

Temps du film en secondes et en images (24 i/s, image entière la plus proche). La grille du film est continue de 0 à 60 s : temps k = 58,000 + k × 0,437965 s.

| Section | Film (s) | Images | Morceau (s) | Mesures | Niveau (LUFS M moyen) |
|---|---|---|---|---|---|
| Silence (zéro numérique) | 0–0,5235 | 0–13 | — | — | — |
| **Intro** : le vrai début, fondu d'entrée cubique de 2 s | 0,5235–10,6998 | 13–257 | 0–10,176 | m−1 (levée) à m4 | −27,8 |
| **Montée** (riser vers le drop) | 10,6998–14,2035 | 257–341 | 67,988–71,491 | m38–m39 | ≈ −16 |
| **Premier grand moment** : drop 1 | 14,2035–21,2109 | 341–509 | 71,491–78,499 | m40–m43 | ≈ −12,5 (B en entier : −13,2) |
| **Respiration** : le pont (sans grave ni batterie, mélodie, trou vers 26,9 s, grave qui remonte sur m63) | 21,2109–35,2258 | 509–845 | 99,521–113,536 | m56–m63 | −16,9 |
| **Reprise** (grave sans charleston, puis respiration et roulement m71) | 35,2258–42,2333 | 845–1014 | 120,543–127,551 | m68–m71 | ≈ −15 |
| **Drop principal** : drop 2 | 42,2333–56,2481 | 1014–1350 | 127,551–141,566 | m72–m79 | ≈ −12,5 (E en entier : −12,8) |
| **Pré-impact** : respiration et roulement m71, une seconde fois | 56,2481–58,0000 | 1350–1392 | 125,799–127,551 | m71 | −13,5 |
| **Coup final** : m72 temps 1, sur le logo | 58,0000–58,438 | 1392–1403 | 127,551–127,989 | m72 t1 | — |
| **Queue** : nappe de l'outro, décroissance exponentielle | 58,438–60,000 | 1403–1440 | 156,019–157,581 | m88 t2… | −45,8 |

Dans le script, les segments sont A (intro), B (montée et drop 1), D (pont), E (reprise et drop 2), G (m71 et l'impact) et H (queue) : voir `montageV3Segments()` dans `tools/audio/lib.mjs`.

## 3. Raccords

Il y a cinq raccords, tous sur un temps de la grille.

- Le segment entrant commence 33 ms avant son temps, avec un fondu d'entrée en quart de sinus de 25 ms.
- Le segment sortant s'arrête 8 ms avant ce temps, avec un fondu de sortie sur la même fenêtre.
- Aucune attaque n'est entamée.
- Les décalages entre segments sont des multiples entiers d'une mesure (ou du même temps de mesure pour G → H) : la grille reste continue.

Harmonie : cosinus des chromas sur une mesure, entre la mesure avant le raccord et la mesure jouée après. Les passages naturels du morceau font 0,55 à 0,84.

| # | Film (s) / image | Morceau (s) | Comment | Pourquoi là | Mesures (§ 5) |
|---|---|---|---|---|---|
| 1 A→B | 10,6998 / 257 | 10,176 → 67,988 (m5 t1 → m38 t1) | Fondu de 25 ms | La coupe tombe dans le « trou » de l'intro, une queue de réverbération à −33 dBFS. m4 → m38 : harmonie 0,86, contre 0,95 pour la suite naturelle. On passe directement aux deux dernières mesures de la montée. | +13,1 dB (−32,9 → −19,8 dBFS RMS 0,5 s) : voulu, c'est l'entrée de la montée. Le morceau fait lui-même environ +9 dB à 10,65 s. |
| 2 B→D | 21,2109 / 509 | 78,499 → 99,521 (m44 t1 → m56 t1) | Fondu de 25 ms | Fin d'une phrase de 4 mesures du drop 1, enchaînée sur le début du pont, comme le morceau le fait à m55 → m56. Harmonie 0,73, contre 0,72 pour le passage naturel m55 → m56. | −5,5 dB (−14,5 → −20,0) |
| 3 D→E | 35,2258 / 845 | 113,536 → 120,543 (m64 t1 → m68 t1) | Fondu de 25 ms | Fin du pont (le grave remonte sur m63). m68 vaut m64 à 0,96 près : c'est la même phrase de reprise, décalée de 4 mesures. Harmonie 0,67, contre 0,76 pour m63 → m64. | +7,0 dB (−22,1 → −15,1), comme dans le morceau |
| 4 E→G | 56,2481 / 1350 | 141,566 → 125,799 (m80 t1 → m71 t1) | Fondu de 25 ms | Fin de la première phrase de 8 mesures du drop 2, suivie de la respiration et du roulement de m71, qui mènent naturellement au premier temps de m72. Harmonie 0,93, contre 0,86 pour la suite naturelle. | −0,9 dB (−16,2 → −17,1) |
| 5 G→H | 58,4380 / 1403 | 127,989 → 156,019 (m72 t2 → m88 t2) | Fin de l'impact : relâchement en quart de sinus de 120 ms (58,31 → 58,43). Entrée de la nappe d'outro sur la même fenêtre. Puis décroissance exponentielle (−100 dB en 3 s, environ −33 dB/s, comme un RT60 de 1,8 s). Fondu de sécurité de 80 ms jusqu'à zéro à 60,000 s. | Le morceau n'a pas de coup suivi d'une queue. Après un drop, il enchaîne sur cette nappe d'outro sans batterie (m87 → m88). Elle prend donc le relais au même temps de mesure (temps 2), sans couper la grosse caisse du temps 2. | −16,6 dB (−15,1 → −31,7) : voulu |

## 4. Moments clés pour l'image (ouverture : nébuleuse en silence, création du système solaire en ≈ 1 s, la Terre)

- **Silence :** 0 à 0,5235 s (images 0–13), zéro numérique.
- **Le morceau démarre à 0,5235 s** (image 13). Premier échantillon non nul à 0,545 s. La première note du MP3 (0,05 s dans le morceau, soit 0,57 s dans le film) est entièrement noyée dans le fondu cubique.
- **La musique devient audible :**
  - elle passe −50 dBFS (RMS 50 ms) à **1,235 s** (image 30) ;
  - elle passe −30 dBFS à **2,065 s** (image 50) ;
  - elle passe −20 dBFS seulement à 10,74 s (entrée de la montée).
- **Première attaque perceptible :** 1,505 s (image 36), sur un temps de la grille (+2,5 ms). Elle est encore faible : −41 dBFS sur 10 ms.
- **Premier temps fort utilisable pour l'allumage du Soleil : 1,9405 s, image 47** (+18 ms par rapport à l'image).
  - C'est m0 temps 1, le premier temps de mesure du morceau.
  - Une nouvelle note y attaque : de −40 à −28,5 dBFS en 60 ms.
  - Le fondu d'entrée y retire encore environ 9 dB (gain x³ à 71 % du fondu). Il est entièrement ouvert à 2,52 s.
- **Première note franche,** pleine et hors fondu : **4,414 s, image 106**. C'est la deuxième phrase de l'intro, à −24,7 dBFS. Elle tombe entre deux temps (m1, entre les temps 2 et 3) : l'intro est jouée librement, ses attaques s'écartent de la grille de 30 à 150 ms.
- **Proposition pour l'image** :
  - nébuleuse dans le silence jusqu'à environ 1,2 s ;
  - effondrement pendant que la musique émerge ;
  - **Soleil allumé à l'image 47** ;
  - disque et planètes entre les images 47 et 70 ;
  - Terre installée avant la première note franche (image 106).
- **Suite :**
  - montée à 10,70 s (image 257) ;
  - **drop 1 à 14,2035 s (image 341)** ;
  - respiration à 21,21 s (image 509), avec un trou du pont vers 26,6–27,1 s (images 638–650) ;
  - reprise à 35,23 s (image 845) ;
  - roulement à 41,36 s (image 993) ;
  - **drop 2 à 42,2333 s (image 1014)** ;
  - roulement à 57,12 s (image 1371) ;
  - **impact du logo à 58,000 s (image 1392)**.

## 5. Mesures (ffmpeg 6.0, ffprobe 4.4)

- **ffprobe :** pcm_s24le, 48 000 Hz, 2 canaux, 24 bits, **2 880 000 échantillons = 60,000000 s**.
- **ebur128 :** **−14,0 LUFS intégrés**, **LRA 10,9 LU**, **crête vraie −4,8 dBTP**, crête échantillon −4,78 dBFS.
- **Gain et limiteur :** gain unique de −5,9 dB sur le montage, qui mesurait −8,1 LUFS. **Aucun limiteur** : il n'en faut pas, et c'est un risque de décalage en moins.
- **Contre-mesure `npx hyperframes audio --only loudness` :** −14 LUFS, crête vraie −4,8 dBTP, court terme maximum −11,9, 0 écrêtage.
- **Après encodage AAC 320 kb/s :**
  - avec `-aac_pns 0` : −14,0 LUFS, **crête vraie −4,8 dBTP**, crête échantillon −4,81 dB ;
  - avec l'encodage AAC par défaut : identique.
  - Aucun dépassement : la marge de 3,8 dB sous −1 dBTP vient de la dynamique du morceau, il n'y a pas d'effets bruités.
- **Grille, par grosses caisses** (attaque 30–150 Hz, écart à la grille) :
  - segment B : +4,2 ms (17 frappes, écart absolu médian 1,2 ms) ;
  - segment E : −0,1 ms (47 frappes, 3,8 ms) ;
  - segment G : +2,0 ms (4 frappes).
  - Continuité au raccord 3 : +3,2 ms ; au raccord 4 : −4,2 ms.
  - Les raccords 1, 2 et 5 touchent un côté sans grosse caisse (intro, pont, nappe). Leur continuité est assurée par construction (décalages entiers d'une mesure sur la grille mesurée).
  - Le flux spectral (toutes bandes) donne un biais constant de −21 à −27 ms sur tous les segments : c'est le détecteur, pas un décalage.
- **Clics :** à chaque raccord, le plus grand saut d'échantillon dans la fenêtre du fondu reste inférieur ou égal à celui des 250 ms voisines. Rapports : 1,26 (raccord 1, où le côté après est 13 dB plus fort, donc pas un clic), 0,74, 0,52, 0,74 et 0,38. Les zooms ne montrent aucune discontinuité.
- **Fin :**
  - le niveau retombe sous −60 dBFS (RMS 50 ms) à **59,515 s** ;
  - crête des 100 dernières ms : −62,2 dBFS ;
  - dernier échantillon : 0.
- **Reconstruction :** relancée une seconde fois, sommes SHA-256 **identiques**.
  - `qa/mix-v3.wav` : `0e58a9f5…8560c8`
  - montage intermédiaire `assets/audio/storm-ii-montage-60s-v3.wav` (flottant 32 bits, ignoré par git) : `0304e7fe…880517`

Les planches ont été regardées :
- `planche-60s.png` : forme d'onde, LUFS momentané, spectrogramme, sections, raccords, temps et moments clés ;
- `raccord-1` à `raccord-5` : ±150 ms ;
- `debut-0-3s.png` et `fin-57-60s.png`.

## 6. Ce qui est fragile (franchement)

1. **Le coup final n'est pas un « boum » isolé.**
   - C'est le premier temps du drop 2 du morceau : grosse caisse, basse et accord, sans cymbale crash.
   - Au RMS 10 ms, il ne dépasse le roulement qui le précède que d'environ 2 dB (−15 contre −17 dBFS).
   - Sa queue n'est pas sa propre réverbération : c'est la nappe d'outro, qu'on fait entrer au temps 2 puis qu'on éteint. C'est un « button » fabriqué.
   - Si ça sonne « coupé », il faudra un vrai coup (effet d'impact, plus tard avec les effets) ou une autre fin.
2. **Raccord 1 (10,70 s) : +13 dB d'un coup.** On passe du trou de l'intro aux deux dernières mesures de la montée. C'est voulu (la montée « entre »), mais c'est le raccord le plus exposé.
3. **Proportions.**
   - Drop 1 : 4 mesures (7 s).
   - Respiration : 8 mesures (14 s), assez peu en dessous des drops (−16,9 contre −12,5 LUFS M) et avec un trou presque silencieux vers 26,9 s.
   - Le roulement de m71 revient deux fois (41,4 s et 57,1 s).
4. **Début.**
   - La musique n'est vraiment présente qu'après 2 s (−30 dBFS à 2,07 s), et l'intro reste douce : −27,8 LUFS M moyen, d'où le LRA de 10,9 LU (v2 : 4,9).
   - Sur un haut-parleur de téléphone, les 2 premières secondes peuvent passer inaperçues.
   - Les notes de l'intro ne sont pas sur la grille (±30 à 150 ms) : couper l'image sur leurs attaques mesurées, pas sur la grille.
5. **Non écouté**, et mesures faites avec ffmpeg 6.0 (v1/v2 : 6.1.1).
6. **Licence de synchronisation de STORM II à obtenir avant toute diffusion publique.**

## 7. Trois moments à faire écouter à Tony

1. **9,5 s → 15 s** (images 228–360). Fin de l'intro, entrée de la montée à **10,70 s**, drop 1 à **14,20 s**. À juger :
   - l'entrée de la montée sonne-t-elle comme un collage (saut de +13 dB) ?
   - 3,5 s de montée suffisent-elles pour que le drop 1 « tombe » ?
2. **20,5 s → 28 s** (images 492–672). Le drop 1 s'arrête après 4 mesures et le pont commence à **21,21 s**, avec le trou vers 26,9 s. À juger :
   - la fin du drop paraît-elle prématurée ?
   - la respiration est-elle assez intime ?
   - le trou est-il un beau silence ou un vide ?
3. **55,5 s → 60 s** (images 1332–1440). Fin du drop 2, raccord à **56,25 s**, roulement, **impact à 58,000 s**, queue jusqu'à 59,5 s. À juger :
   - l'impact est-il assez net pour le logo ?
   - la queue s'éteint-elle naturellement ou sonne-t-elle comme un fondu ?
   - entend-on que le roulement est déjà passé à 41,4 s ?

En plus, pour caler l'ouverture : écouter **0 → 5 s** et dire à partir de quand on « entend » la musique (mesuré : 1,2 à 2,1 s).

## 8. Fichiers

- Code versionné, dans `tools/audio/` :
  - `lib.mjs` : `V3`, `v3Bar`, `montageV3Segments`, `joinsV3`, `montageV3Filter` ;
  - `build-montage.mjs --v3` ;
  - `build-mix.mjs --v3` (`buildMasterV3`) ;
  - `beats-v3.mjs` ;
  - `audit-v3.py` ;
  - `build-all.mjs --v3`.
- Les modes `--v1` (sans option) et `--v2` sont inchangés. Leurs montages se refont toujours (vérifié dans un dossier temporaire). Leurs mixages demandent `qa/sfx-v*.wav`, absents sur ce poste.
- Non versionnés : `qa/mix-v3.wav` et `assets/audio/storm-ii-montage-60s-v3.wav`, ignorés par git. `qa/tmp/audit-v3.json` contient toutes les mesures.
