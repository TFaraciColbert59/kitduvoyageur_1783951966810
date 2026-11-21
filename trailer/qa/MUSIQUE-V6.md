# Musique v6 — trois montages pour l'oreille de Tony (A « continu », B « doux épique », C « le drop pour le logo »)

Rédigé le 16/11/2026 par `sound-designer`. **Mesuré, non écouté** partout. Outils : ffmpeg 6.0, ffprobe 4.4, Python 3 + numpy 2.0.2 + Pillow 11.3, HyperFrames 0.9.33.

Ces trois montages répondent au refus du v4/v5 par Tony (« pas fluide, pas doux épique sur le lac et le panorama, trop de répétition, sons parasites ») :
- **musique seule** : aucun effet, aucun habillage ;
- **2 à 4 raccords** au lieu de 7 ;
- **aucune portion du morceau jouée deux fois** ;
- structure `DECOUPAGE-24.md` § v6 : drop ou grand moment à 28,03 s (mesure 17), logo à 57,811 s (mesure 34).

Fichiers :
- WAV (ignorés par git) : `qa/mix-v6a.wav`, `qa/mix-v6b.wav`, `qa/mix-v6c.wav` ;
- écoute pour Tony : `livraison/LKDV-musique-v6-A.m4a`, `-B.m4a`, `-C.m4a` (AAC 256 kb/s) ;
- grilles : `qa/mix-v6a|b|c.beats.json` ;
- carte du morceau : `qa/tmp/carte-morceau.json` ;
- planches : `qa/snapshots/musique-v6/`.

Reconstruction : `node tools/audio/build-all.mjs --v6a` (ou `--v6b`, `--v6c`), avec ffmpeg et ffprobe dans le PATH.

**Les trois montages n'ont pas changé depuis l'envoi à Tony.** Deux reconstructions ont été vérifiées : les sommes SHA-256 des trois WAV et des trois m4a sont identiques à celles des fichiers envoyés.

| Fichier | SHA-256 |
|---|---|
| `mix-v6a.wav` | `74c34958…92a7` |
| `mix-v6b.wav` | `bcd0a804…75e2` |
| `mix-v6c.wav` | `6a366fa8…6ccd` |
| `LKDV-musique-v6-A.m4a` | `e1451e14…a163a` |
| `LKDV-musique-v6-B.m4a` | `32463c58…3c11` |
| `LKDV-musique-v6-C.m4a` | `9b15414e…b428` |

`--v4` et `--v5` reconstruisent toujours leurs WAV à l'identique (sommes vérifiées avant et après).

## 1. Carte du morceau, mesure par mesure

Méthode, avec `tools/audio/carte-morceau.py` sur les 173 s du MP3. La grille est la grille mesurée : temps 0,437965 s, m40 = 71,4914 s. Pour chaque mesure :
- **tenu** et **percussif** : séparation harmonique / percussive par filtres médians (le long du temps, le tenu ; le long des fréquences, le percussif) ;
- **grosse caisse** : flux spectral entre 30 et 150 Hz ;
- **grave** : 30–150 Hz ;
- **brillance** : 4–11 kHz ;
- **largeur** : énergie côté / milieu ;
- **ressemblance** avec toutes les autres mesures : cosinus d'un profil chroma + timbre.

Les classes sont calculées par des règles relatives aux centiles du morceau, écrites dans le script : elles sont discutables. Planche : `qa/snapshots/musique-v6/carte-morceau.png` (regardée).

### Ce que dit la carte

| Passage | Mesures | Morceau (s) | Caractère mesuré |
|---|---|---|---|
| Intro | m−1–m7 | 0–15,4 | **Apaisé** : phrases de synthé séparées de trous, grave presque absent, image assez étroite |
| Montée, 1re partie | m8–m29 | 15,4–54,0 | **Doux et ample** : tenu 9 à 12 dB au-dessus du percussif, **la plus large du morceau** (côté/milieu −2,3 à −4 dB), un coup de grave toutes les 4 mesures (m8, m12, m16…), percussions légères |
| Montée, 2e partie | m30–m38 | 54,0–69,7 | **Doux et ample, le plus tenu et le plus « épique » du morceau** : tenu au maximum avant le drop (m32 : 44,0 dB, tenu − percussif +12 ; m34 : +13), grave tenu (17 à 20 dB), grosse caisse au plus bas (m32, m37, m38). m31 fait monter le grave (30 dB) et arrive sur m32. |
| Riser | m39 | 69,7–71,5 | **Qui monte** : percussif +7 dB, grave +17 dB, brillance +7 dB |
| Drop 1 | m40–m55 | 71,5–99,5 | **Plein et percussif** : grave 46–48 dB, percussif 42–43 dB, image étroite (−10 à −14 dB) |
| Pont | m56–m63 | 99,5–113,5 | **Doux et ample** : tenu − percussif jusqu'à +14,7 (m58), grave faible (6–19 dB), trou presque silencieux vers 105,2 s (m59) ; m63 fait remonter le grave |
| Reprise | m64–m71 | 113,5–127,5 | **Plein, sans charleston** : grave du drop, brillance basse (18,9 à 28 dB contre 31 à 35 dans les drops). m71 : respiration puis roulement |
| Drop 2 | m72–m87 | 127,5–155,6 | **Plein et percussif, copie du drop 1** |
| Outro | m88–m95 | 155,6–169 | **Apaisé, très large** (−2 à −3 dB), plus de grave ni de batterie |
| Fin | m96–m97 | 169–173 | Extinction |

**Répétitions mesurées :**
- **Le drop 2 est la copie du drop 1.** Cosinus 0,98–0,997 mesure pour mesure (m42 ↔ m74 : 0,994 ; m45 ↔ m77 : 0,996 ; m47 ↔ m79 : 0,995). Les deux grands carrés clairs de la matrice d'auto-similarité le montrent.
- Le v4 faisait entendre le drop 1, puis le drop 2, puis encore le premier temps du drop 2 au logo, et deux fois le roulement de m71 : c'est la « répétition » que Tony entend.
- Autres répétitions : le pont m56–m58 ressemble à la montée m32–m34 (0,96–0,97) ; dans la montée, m11 ≈ m15 (0,997) et m8 ≈ m12 (0,987) sont des boucles de 4 mesures.
- **La reprise m64–m71 est la seule partie pleine qui ne répète pas les drops** : cosinus 0,90–0,96, sans charleston.

**Où est le « doux épique » ?** Dans la **2e partie de la montée (m30–m38)** et dans le **pont (m56–m63)**. Pas dans les drops : ils sont pleins, percussifs et étroits.

### Tableau mesure par mesure

Total, tenu − percussif, grave et largeur en dB. Grosse caisse : flux moyen. « Plus proche » : la mesure la plus ressemblante et son cosinus.

| Mesure | Début (s) | Total | Tenu − percussif | Grosse caisse | Grave | Largeur | Classe | Plus proche (cos) |
|---|---|---|---|---|---|---|---|---|
| m-1 | -0,3 | 40,6 | 5,9 | 3,23 | -3,7 | -12,5 | apaisé | m3 (0,893) |
| m0 | 1,4 | 37,6 | 12,3 | 2,35 | -7,5 | -8,5 | apaisé | m4 (0,965) |
| m1 | 3,2 | 38,8 | 9,6 | 2,72 | -5,4 | -10,4 | apaisé | m17 (0,921) |
| m2 | 4,9 | 36,1 | 7,3 | 2,42 | -4,3 | -7,7 | qui monte | m61 (0,928) |
| m3 | 6,7 | 39,1 | 5,5 | 2,50 | -4,2 | -9,3 | qui monte | m-1 (0,893) |
| m4 | 8,4 | 37,8 | 9,7 | 2,74 | -4,6 | -7,3 | qui monte | m0 (0,965) |
| m5 | 10,2 | 40,7 | 6,6 | 2,98 | 1,4 | -8,9 | qui monte | m4 (0,923) |
| m6 | 11,9 | 41,1 | 7,3 | 2,92 | 2,5 | -8,5 | qui monte | m7 (0,953) |
| m7 | 13,7 | 42,1 | 6,7 | 3,02 | 4,9 | -9,7 | apaisé | m6 (0,953) |
| m8 | 15,4 | 42,9 | 8,9 | 2,87 | 18,1 | -3,8 | doux et ample | m12 (0,987) |
| m9 | 17,2 | 41,7 | 8,3 | 2,58 | 8,8 | -2,5 | apaisé | m13 (0,930) |
| m10 | 18,9 | 42,1 | 8,4 | 2,38 | 7,8 | -2,8 | apaisé | m23 (0,969) |
| m11 | 20,7 | 42,8 | 10,1 | 2,43 | 7,8 | -2,7 | doux et ample | m15 (0,997) |
| m12 | 22,4 | 42,5 | 9,1 | 2,87 | 19,3 | -3,8 | doux et ample | m8 (0,987) |
| m13 | 24,2 | 42,3 | 8,3 | 2,70 | 8,3 | -3,0 | apaisé | m9 (0,930) |
| m14 | 25,9 | 43,1 | 9,3 | 2,29 | 7,7 | -2,8 | doux et ample | m15 (0,976) |
| m15 | 27,7 | 42,7 | 9,6 | 2,68 | 8,4 | -2,5 | doux et ample | m11 (0,997) |
| m16 | 29,4 | 41,6 | 5,6 | 2,67 | 19,4 | -6,0 | apaisé | m12 (0,914) |
| m17 | 31,2 | 42,3 | 5,6 | 2,33 | 11,2 | -6,6 | apaisé | m21 (0,943) |
| m18 | 33,0 | 43,8 | 9,6 | 2,59 | 7,4 | -4,7 | doux et ample | m59 (0,984) |
| m19 | 34,7 | 42,4 | 8,2 | 2,39 | 8,5 | -2,9 | doux et ample | m23 (0,979) |
| m20 | 36,5 | 44,5 | 8,8 | 2,59 | 19,8 | -7,2 | doux et ample | m38 (0,922) |
| m21 | 38,2 | 44,6 | 7,6 | 2,77 | 10,9 | -6,6 | doux et ample | m29 (0,954) |
| m22 | 40,0 | 44,8 | 11,6 | 2,58 | 8,3 | -5,8 | doux et ample | m35 (0,982) |
| m23 | 41,7 | 42,8 | 9,0 | 2,70 | 8,6 | -2,3 | doux et ample | m19 (0,979) |
| m24 | 43,5 | 44,1 | 5,3 | 2,94 | 14,4 | -5,8 | apaisé | m17 (0,940) |
| m25 | 45,2 | 44,1 | 6,4 | 2,66 | 10,7 | -6,5 | apaisé | m29 (0,959) |
| m26 | 47,0 | 44,9 | 10,6 | 2,71 | 8,1 | -5,8 | doux et ample | m30 (0,979) |
| m27 | 48,7 | 43,8 | 8,9 | 2,90 | 9,6 | -3,0 | doux et ample | m23 (0,957) |
| m28 | 50,5 | 43,8 | 5,4 | 2,79 | 18,8 | -6,2 | apaisé | m13 (0,922) |
| m29 | 52,2 | 44,4 | 5,9 | 2,53 | 15,7 | -7,1 | apaisé | m25 (0,959) |
| m30 | 54,0 | 44,7 | 10,9 | 2,89 | 19,5 | -6,0 | doux et ample | m26 (0,979) |
| m31 | 55,7 | 43,6 | 7,8 | 2,72 | 30,4 | -2,7 | doux et ample | m30 (0,903) |
| m32 | 57,5 | 44,8 | 12,0 | 2,05 | 17,4 | -7,9 | doux et ample | m56 (0,970) |
| m33 | 59,2 | 44,4 | 10,4 | 2,74 | 18,1 | -7,3 | doux et ample | m57 (0,963) |
| m34 | 61,0 | 43,7 | 13,0 | 2,31 | 17,5 | -6,9 | doux et ample | m58 (0,974) |
| m35 | 62,7 | 43,6 | 10,6 | 2,41 | 17,0 | -6,0 | doux et ample | m22 (0,982) |
| m36 | 64,5 | 43,1 | 11,9 | 2,28 | 18,0 | -6,2 | doux et ample | m60 (0,941) |
| m37 | 66,2 | 44,8 | 11,6 | 2,03 | 20,5 | -8,4 | doux et ample | m61 (0,936) |
| m38 | 68,0 | 45,2 | 9,1 | 1,94 | 19,8 | -7,2 | doux et ample | m20 (0,922) |
| m39 | 69,7 | 46,8 | 2,2 | 3,19 | 37,1 | -9,1 | qui monte | m38 (0,895) |
| m40 | 71,5 | 50,2 | 4,5 | 3,26 | 46,8 | -10,2 | plein et percussif | m72 (0,987) |
| m41 | 73,2 | 49,4 | 5,0 | 3,21 | 45,6 | -10,6 | plein et percussif | m81 (0,979) |
| m42 | 75,0 | 49,5 | 5,0 | 3,00 | 46,4 | -10,6 | plein et percussif | m74 (0,994) |
| m43 | 76,7 | 50,2 | 4,9 | 3,07 | 46,6 | -10,3 | plein et percussif | m75 (0,991) |
| m44 | 78,5 | 50,5 | 5,5 | 3,30 | 47,7 | -11,8 | plein et percussif | m76 (0,994) |
| m45 | 80,3 | 50,1 | 5,3 | 3,28 | 46,6 | -11,5 | plein et percussif | m77 (0,996) |
| m46 | 82,0 | 49,6 | 4,8 | 3,01 | 46,0 | -9,8 | plein et percussif | m78 (0,997) |
| m47 | 83,8 | 49,9 | 3,9 | 3,57 | 45,5 | -9,7 | plein et percussif | m79 (0,995) |
| m48 | 85,5 | 49,6 | 4,8 | 3,20 | 47,2 | -11,9 | plein et percussif | m75 (0,954) |
| m49 | 87,3 | 50,8 | 6,4 | 3,23 | 48,5 | -13,7 | plein et percussif | m52 (0,952) |
| m50 | 89,0 | 49,8 | 7,0 | 3,07 | 46,0 | -11,9 | plein et percussif | m51 (0,947) |
| m51 | 90,8 | 49,5 | 4,8 | 3,48 | 45,8 | -11,1 | plein et percussif | m54 (0,955) |
| m52 | 92,5 | 49,2 | 4,8 | 3,34 | 46,7 | -11,5 | plein et percussif | m49 (0,952) |
| m53 | 94,3 | 49,8 | 4,0 | 3,53 | 47,2 | -12,4 | plein et percussif | m49 (0,934) |
| m54 | 96,0 | 50,1 | 7,4 | 2,89 | 46,9 | -10,3 | qui monte | m51 (0,955) |
| m55 | 97,8 | 49,1 | 5,0 | 3,07 | 45,5 | -8,8 | plein et percussif | m54 (0,951) |
| m56 | 99,5 | 44,4 | 11,4 | 2,93 | 19,1 | -8,4 | doux et ample | m32 (0,970) |
| m57 | 101,3 | 44,8 | 10,1 | 2,70 | 6,6 | -9,0 | doux et ample | m33 (0,963) |
| m58 | 103,0 | 43,8 | 14,7 | 2,34 | 6,1 | -8,5 | doux et ample | m34 (0,974) |
| m59 | 104,8 | 42,4 | 9,0 | 2,78 | 9,0 | -8,0 | doux et ample | m18 (0,984) |
| m60 | 106,5 | 43,2 | 11,7 | 2,88 | 17,0 | -7,2 | doux et ample | m22 (0,980) |
| m61 | 108,3 | 45,1 | 12,8 | 2,65 | 9,0 | -9,5 | qui monte | m37 (0,936) |
| m62 | 110,0 | 45,1 | 9,8 | 2,72 | 18,7 | -9,2 | doux et ample | m21 (0,917) |
| m63 | 111,8 | 44,2 | 8,2 | 2,99 | 32,0 | -7,2 | doux et ample | m37 (0,921) |
| m64 | 113,5 | 48,3 | 5,0 | 3,32 | 47,4 | -13,8 | qui monte | m67 (0,962) |
| m65 | 115,3 | 48,8 | 5,2 | 3,10 | 48,2 | -13,5 | plein et percussif | m64 (0,958) |
| m66 | 117,0 | 47,8 | 7,2 | 3,28 | 46,8 | -12,3 | qui monte | m67 (0,970) |
| m67 | 118,8 | 47,2 | 4,7 | 3,64 | 45,3 | -9,2 | qui monte | m66 (0,970) |
| m68 | 120,5 | 48,9 | 6,3 | 3,42 | 47,5 | -10,5 | plein et percussif | m42 (0,938) |
| m69 | 122,3 | 49,1 | 5,3 | 3,41 | 47,5 | -10,3 | plein et percussif | m85 (0,899) |
| m70 | 124,0 | 48,1 | 6,8 | 3,65 | 45,6 | -8,1 | qui monte | m78 (0,938) |
| m71 | 125,8 | 47,7 | -2,1 | 4,32 | 43,5 | -7,2 | qui monte | m47 (0,942) |
| m72 | 127,6 | 50,1 | 4,9 | 3,50 | 46,6 | -10,6 | plein et percussif | m80 (0,994) |
| m73 | 129,3 | 50,0 | 6,2 | 3,09 | 46,9 | -10,7 | plein et percussif | m45 (0,982) |
| m74 | 131,1 | 49,8 | 5,3 | 3,00 | 46,7 | -10,1 | plein et percussif | m82 (0,997) |
| m75 | 132,8 | 50,0 | 4,2 | 3,14 | 45,9 | -9,5 | plein et percussif | m83 (0,994) |
| m76 | 134,6 | 50,1 | 5,1 | 3,37 | 47,0 | -10,7 | plein et percussif | m84 (0,995) |
| m77 | 136,3 | 50,1 | 5,5 | 3,08 | 46,5 | -10,9 | plein et percussif | m45 (0,996) |
| m78 | 138,1 | 49,7 | 4,9 | 2,87 | 46,0 | -10,4 | qui monte | m46 (0,997) |
| m79 | 139,8 | 49,7 | 4,4 | 3,32 | 45,3 | -10,4 | plein et percussif | m47 (0,995) |
| m80 | 141,6 | 50,2 | 5,1 | 3,33 | 46,8 | -10,7 | plein et percussif | m72 (0,994) |
| m81 | 143,3 | 50,4 | 5,8 | 3,34 | 47,6 | -11,0 | plein et percussif | m41 (0,979) |
| m82 | 145,1 | 49,8 | 4,8 | 3,16 | 46,6 | -10,3 | plein et percussif | m74 (0,997) |
| m83 | 146,8 | 50,3 | 4,4 | 3,24 | 46,3 | -9,4 | plein et percussif | m75 (0,994) |
| m84 | 148,6 | 50,5 | 5,5 | 3,34 | 47,7 | -11,3 | plein et percussif | m76 (0,995) |
| m85 | 150,3 | 50,9 | 4,9 | 3,23 | 47,9 | -11,2 | plein et percussif | m77 (0,941) |
| m86 | 152,1 | 50,0 | 5,2 | 3,04 | 45,3 | -9,2 | plein et percussif | m46 (0,971) |
| m87 | 153,8 | 50,2 | 4,3 | 3,15 | 45,6 | -9,7 | plein et percussif | m79 (0,991) |
| m88 | 155,6 | 39,5 | 13,9 | 2,63 | 2,0 | -3,1 | apaisé | m92 (0,994) |
| m89 | 157,3 | 38,5 | 11,5 | 2,75 | -0,6 | -2,0 | apaisé | m21 (0,901) |
| m90 | 159,1 | 38,3 | 11,7 | 2,48 | -1,7 | -2,5 | apaisé | m30 (0,968) |
| m91 | 160,8 | 39,3 | 14,1 | 2,85 | 1,9 | -2,9 | apaisé | m94 (0,962) |
| m92 | 162,6 | 39,3 | 16,3 | 2,73 | 0,9 | -2,7 | apaisé | m88 (0,994) |
| m93 | 164,3 | 39,7 | 16,2 | 2,58 | -1,3 | -4,1 | apaisé | m13 (0,920) |
| m94 | 166,1 | 37,0 | 17,6 | 2,41 | -4,7 | -4,4 | apaisé | m91 (0,962) |
| m95 | 167,8 | 26,8 | 20,2 | 1,84 | -9,0 | -2,6 | apaisé | m94 (0,930) |
| m96 | 169,6 | 12,0 | 20,7 | 1,65 | -9,9 | -4,0 | apaisé | m97 (0,898) |
| m97 | 171,3 | -5,0 | 10,3 | 1,16 | -14,8 | -6,8 | apaisé | m96 (0,898) |

## 2. Règles communes et méthode des raccords

- **Grille continue :** chaque raccord tombe sur un premier temps du film, et les segments sont décalés d'un nombre entier de mesures sur la grille mesurée. La seule exception est l'intro de C, qui est jouée librement (voir C).
- **Fondus :**
  - « court » : fondu enchaîné de 25 ms, fini 8 ms avant le temps, quand l'attaque d'après est franche (entrée d'un drop ou d'une outro) ;
  - « long » : fondu enchaîné à puissance constante (sinus / cosinus) de 300 ou 400 ms, fini 8 ms avant le temps, sur de la matière tenue.
- **Début :** la musique démarre à l'image 0. A et B démarrent sur un premier temps du morceau, avec un fondu de 5 ms ; C démarre sur la 1re note du morceau, avec un fondu de 20 ms.
- **Fin :** sur le coup du logo (mesure 34, 57,811 s, image 1387), puis décroissance exponentielle dès 58,11 s, jusqu'à zéro à 60,000 s.
- **Mastering :** gain unique vers −14 LUFS, sans limiteur, aucun gain de section.
- **Non-répétition :** les intervalles du morceau réellement lus (fondus compris) sont triés et vérifiés sans recouvrement. Le détail est dans le champ `nonRepetition` de chaque `beats.json`.
- **Contrôle des clics :** le plus grand saut d'échantillon dans le fondu est comparé à celui des 250 ms voisines. Un rapport supérieur à 1 a été vérifié contre le morceau seul (voir C, raccord 1).

## 3. Montage A · « continu » (2 raccords)

Parti pris : le morceau dans son ordre, en trois longs passages.
- Les 28 premières mesures sont jouées sans aucune coupe, de la montée au drop 1 (49 s continues).
- Le pont, qui suit le drop dans le morceau, porte le bivouac et l'espoir.
- L'entrée de la reprise frappe le logo.

| Section | Film (s) / images | Matière (morceau) | Caractère mesuré (court terme moyen) |
|---|---|---|---|
| cosmos (mes. 1–3) | 0–5,26 / 0–126 | m24–m26 (43,46–48,72 s) | Montée douce, assez large, percussions légères ; −15,9 LUFS |
| declic (4–7) | 5,26–12,26 / 126–294 | m27–m30 (48,72–55,73) | Doux et ample ; **lac = m30** (tenu − percussif +10,9, grave tenu) ; −16,1 |
| decision (8–13) | 12,26–22,77 / 294–547 | m31–m36 | Le grave monte sur m31, puis m32–m36 : le passage le plus tenu ; −16,3 |
| depart (14–16) | 22,77–28,03 / 547–673 | m37–m39 | Fin de la montée et riser m39 ; −15,2 |
| montagne (17–21) | 28,03–36,79 / 673–883 | **Drop 1** m40–m44 (71,49–80,25), suite naturelle du riser | Plein et percussif ; **−12,0** |
| coureur-cycliste (22–28) | 36,79–49,05 / 883–1177 | m45–m51, suite du drop 1 | Plein ; −11,9 |
| bivouac (29–30) | 49,05–52,56 / 1177–1261 | **Pont** m56–m57 (99,52–103,03) | Doux et ample, sans grave ; −16,0 |
| final (31–33) | 52,56–57,81 / 1261–1387 | Fin du pont m61–m63 (108,28–113,54) | Mélodie, le grave remonte sur m63 ; −15,7 |
| logo (34) | 57,81–60 / 1387–1440 | **m64 temps 1** (113,54) : entrée de la reprise, puis extinction | Coup : +8,0 dB sur 200 ms |

**Écarts à la structure v6.** Le coureur dure une mesure de plus (jusqu'à la mesure 28), le bivouac une de moins (mesures 29–30). Raison : couper le drop en fin de groupe de 4 mesures (après m51), pas au milieu.

**Raccords**

| # | Film (s) / image | Morceau | Fondu | Grille | Saut de niveau (RMS 0,5 s) | Clic |
|---|---|---|---|---|---|---|
| 1 | 49,052 / 1177 | m52 t1 → m56 t1 | Court (25 ms) : le drop s'arrête et le pont entre, comme le morceau le fait en m55 → m56 | Continue (décalage entier) ; grosses caisses de A1 à +4,0 ms de la grille | −3,7 dB : fin de drop voulue | 0,90 |
| 2 | 52,556 / 1261 | m58 t1 → m61 t1 | Long (400 ms), matière tenue ; harmonie 0,91 (passage naturel m60 → m61 : 0,19) ; le trou de m59 est sauté | Continue ; grosses caisses de A3 à +0,6 ms | **+2,4 dB** | 0,77 |

**Non-répétition.** Intervalles lus (s du morceau) : 43,46–92,51 · 99,49–103,02 · 107,87–115,72. Aucun recouvrement. Drop 2, outro et intro ne sont pas utilisés.

**Mesures**
- −14,0 LUFS, LRA 4,9 LU, crête vraie −4,3 dBTP.
- Après AAC 320 kb/s : −4,2 dBTP (avec `-aac_pns 0`), −4,3 (par défaut). Le m4a 256 kb/s : −14,0 LUFS, −4,2 dBTP.
- 2 880 000 échantillons.
- 400 premières ms : −23,0 dBFS RMS.
- Sous −60 dBFS à 59,375 s.
- **Lac** (mesure 7) : −15,6 LUFS momentané moyen. **Panorama** (mesures 17–21) : −12,0 LUFS court terme. C'est le drop, plein.

## 4. Montage B · « doux épique » (2 raccords)

Parti pris :
- le lac et tout le panorama des Dolomites sont posés sur la montée, la partie la plus ample et la plus tenue du morceau ;
- le drop 1 arrive avec le coureur, par l'enchaînement naturel du morceau (riser m39 puis m40), **sans aucune coupe de l'image 0 à 49 s**.

| Section | Film (s) / images | Matière (morceau) | Caractère mesuré (court terme moyen) |
|---|---|---|---|
| cosmos (1–3) | 0–5,26 / 0–126 | m19–m21 (34,70–39,96 s) | Montée douce et large ; −15,2 LUFS |
| declic (4–7) | 5,26–12,26 / 126–294 | m22–m25 | **Lac = m25**, juste après m22 qui est le plus tenu de la 1re partie (+11,6) ; −15,3 |
| decision (8–13) | 12,26–22,77 / 294–547 | m26–m31 | Montée ample ; le grave monte sur m31 ; −15,1 |
| depart (14–16) | 22,77–28,03 / 547–673 | m32–m34 | **Le passage le plus tenu du morceau** (m32 tenu 44,0 dB, m34 tenu − percussif +13) ; −15,2 |
| montagne (17–21) | 28,03–36,79 / 673–883 | **m35–m39** (62,73–71,49) | Doux et ample (m35–m38), puis le riser m39 sous Sorapis ; **−15,2**, sans drop |
| coureur-cycliste (22–28) | 36,79–49,05 / 883–1177 | **Drop 1** m40–m46 (71,49–83,75), suite naturelle de m39 | Plein et percussif ; −11,1 (+4,1 LU d'un coup sur le coureur) |
| bivouac (29–30) | 49,05–52,56 / 1177–1261 | **Outro** m88–m89 (155,58–159,08) | Apaisé, très large ; −19,5 |
| final (31–33) | 52,56–57,81 / 1261–1387 | Fin du pont m61–m63 | Mélodie, le grave remonte ; −14,9 |
| logo (34) | 57,81–60 | m64 temps 1 (reprise), extinction | +8,0 dB sur 200 ms |

**Écarts.** Pas de « grand moment » percussif à 28 s : c'est le parti pris demandé pour B. Le panorama s'ouvre sur m35, qui n'est pas une arrivée dans le morceau : le seul vrai seuil y est l'entrée du riser m39 (35,04 s). Le coureur dure une mesure de plus, le bivouac une de moins (même raison que A).

**Raccords**

| # | Film (s) / image | Morceau | Fondu | Grille | Saut de niveau | Clic |
|---|---|---|---|---|---|---|
| 1 | 49,052 / 1177 | m47 t1 → m88 t1 | Court : le drop s'arrête net sur l'outro (harmonie 0,55, comme le passage naturel m87 → m88 : 0,55) | Continue ; grosses caisses de B1 à +2,6 ms | −10,5 dB : retombée voulue, comme dans le morceau | 0,51 |
| 2 | 52,556 / 1261 | m90 t1 → m61 t1 | Long (400 ms) ; harmonie 0,90 | Continue ; B3 à +0,6 ms | **+6,4 dB : au-delà des 3 dB demandés** | 0,79 |

**Non-répétition.** Intervalles lus : 34,70–83,75 · 107,87–115,72 · 155,55–159,08. Aucun recouvrement.

**Mesures**
- −14,0 LUFS, LRA 5,1 LU, crête vraie −3,5 dBTP.
- Après AAC 320 kb/s : −3,6 / −3,4 dBTP. Le m4a : −14,1 LUFS, −3,5 dBTP.
- 400 premières ms : −19,8 dBFS RMS.
- Sous −60 dBFS à 59,385 s.
- **Lac** : −15,2 LUFS. **Panorama** : −15,2 LUFS court terme, soit 4 LU sous le coureur.

## 5. Montage C · « le drop pour le logo » (4 raccords)

Parti pris, en une phrase : rien ne se répète, chaque partie du morceau sert une fois.
- le vrai début du morceau pour le cosmos ;
- la montée pour le lac et la préparation ;
- le pont pour le panorama ;
- la reprise pour le coureur ;
- l'outro pour la nuit ;
- le drop 1, gardé intact, n'éclate qu'une fois : sur le logo.

| Section | Film (s) / images | Matière (morceau) | Caractère mesuré (court terme moyen) |
|---|---|---|---|
| cosmos (1–3) | 0–5,26 / 0–126 | **Intro** 0,03–5,28 s : 1re phrase, trou, 2e phrase | Apaisé, notes seules ; **−21,3 LUFS**, creux à −30 LUFS momentané vers 2–3 s (le trou de l'intro) |
| declic (4–7) | 5,26–12,26 / 126–294 | m19–m22 (34,70–41,71) | **Lac = m22**, le plus tenu de la 1re partie de la montée ; −14,4 |
| decision (8–13) | 12,26–22,77 | m23–m28 | Montée ample ; −14,3 |
| depart (14–16) | 22,77–28,03 | m29–m31 | Le grave monte sur m31 ; −14,2 |
| montagne (17–20) | 28,03–35,04 / 673–841 | **Pont** m60–m63 (106,53–113,54) | Doux et ample, mélodie, le grave remonte sur m63 ; −14,3 |
| coureur-cycliste (21–28) | 35,04–49,05 / 841–1177 | **Reprise** m64–m71 (113,54–127,55), suite naturelle du pont | Pleine, sans charleston ; roulement de m71 sur les bras levés de la cycliste ; −12,7 |
| bivouac (29–30) | 49,05–52,56 | Outro m88–m89 | Apaisé ; −18,7 |
| final (31–33) | 52,56–57,81 | **Fin de la montée** m37–m39 (66,24–71,49), riser compris | Monte jusqu'au logo ; −13,6 |
| logo (34) | 57,81–60 | **Drop 1, m40 temps 1** (71,49) | Le seul drop du film ; +6,4 dB sur 200 ms, +2,9 LU momentané |

**Écarts.**
- La montagne ne dure que 4 mesures (17–20).
- Le coureur arrive une mesure plus tôt (mesure 21, 35,04 s) et dure 8 mesures (jusqu'à la mesure 28) ; le bivouac est en mesures 29–30.
- Le « grand moment » à 28,03 s est une ouverture douce (le pont), pas un drop.

**Raccords**

| # | Film (s) / image | Morceau | Fondu | Grille | Saut de niveau | Clic |
|---|---|---|---|---|---|---|
| 1 | 5,256 / 126 | intro 5,286 → m19 t1 | Long (400 ms), sur la fin tenue de la 2e phrase | L'intro est libre (environ −0,4 temps par rapport à la grille du film) ; grille exacte ensuite | +1,4 dB | 1,36 : c'est le transitoire de m19 lui-même (0,0811 dans le mix et dans le morceau seul, au même endroit), pas un clic |
| 2 | 28,030 / 673 | m32 t1 → m60 t1 | Long (300 ms) ; harmonie 0,73 (passage naturel m31 → m32 : 0,84) | Continue ; grosses caisses de C3 à +0,3 ms | −0,6 dB | 0,93 |
| 3 | 49,052 / 1177 | m72 t1 → m88 t1 | Court : le roulement de m71 ne débouche pas sur le drop mais sur l'outro, une suspension voulue | Continue | −9,6 dB, voulu | 0,51 |
| 4 | 52,556 / 1261 | m90 t1 → m37 t1 | Long (400 ms) ; harmonie 0,92 | Continue ; C5 à +3,2 ms | **+5,8 dB : au-delà des 3 dB** | 0,75 |

**Non-répétition.** Intervalles lus : 0,03–5,28 · 34,29–57,47 · 65,83–73,68 · 106,22–127,54 · 155,55–159,08. Aucun recouvrement.

**Mesures**
- −14,0 LUFS, LRA 4,6 LU, crête vraie −3,0 dBTP.
- Après AAC 320 kb/s : −3,0 / −3,1 dBTP. Le m4a : −14,1 LUFS, −3,0 dBTP.
- 400 premières ms : −22,2 dBFS RMS.
- Sous −60 dBFS à 59,41 s.
- **Lac** : −13,9 LUFS. **Panorama** : −14,3 LUFS court terme.

**Attaques de l'intro**, pour caler l'ouverture. Elles ont été mesurées sur le MP3 (voir `MUSIQUE-V4.md` § 1) et décalées de −0,03 s. Le détecteur automatique ne les relève pas ici (montées de moins de 8 dB), c'est pourquoi la liste `intro.attaques` de `mix-v6c.beats.json` est vide.

| Attaque dans le film (s) | Image | Remarque |
|---|---|---|
| 0,02 | 0 | Première note |
| 0,94 | 23 | Note brillante (+19,8 dB dans l'aigu) |
| 1,40 | 34 | |
| 3,87 | 93 | 2e phrase, la plus nette (+17,8 dB) |

## 6. Pour Tony, en langage simple

- **A, « continu ».**
  - La musique avance d'un seul souffle pendant 49 secondes, sans aucune coupe.
  - Le drop, le moment fort du morceau, tombe pile sur Seceda.
  - Le soir tombe sur le passage calme qui suit naturellement le drop.
  - Le logo frappe à l'entrée de la partie qui relance le morceau.
  - C'est le plus fluide : seulement deux coupes, toutes les deux après 49 s.
- **B, « doux épique ».**
  - Même fluidité au début (aucune coupe avant 49 s), mais le panorama des Dolomites reste sur la partie large et planante du morceau, sans batterie forte.
  - Le drop éclate seulement quand le coureur surgit.
  - Le bivouac est plus intime : la fin du morceau, très douce.
- **C, « le drop pour le logo ».**
  - Commence vraiment au début du morceau (les premières notes).
  - Le panorama flotte sur le passage le plus doux après le drop.
  - Le coureur part sur la relance du morceau, qui n'est pas une copie du drop.
  - Le drop n'arrive qu'une seule fois, à la toute fin, sur le logo.
  - Rien ne se répète, mais il y a quatre coupes.

**Où tendre l'oreille**

| Moment | A | B | C |
|---|---|---|---|
| Le lac, 10,5–12,3 s | Doux, ample, un coup de grave en chemin | Le plus large et le plus aérien | Plus présent, il suit de près l'intro |
| Le panorama, à partir de 28 s | Le drop frappe sur Seceda, plein jusqu'au coureur | Planant, monte lentement jusqu'au drop du coureur à 36,8 s | Le pont, doux, puis la relance à 35,0 s |
| Le passage au bivouac, 49,0–52,6 s | Coupe vers le passage calme, retombée de 3,7 dB | Coupe nette vers la fin du morceau, retombée de 10,5 dB | Coupe nette vers la fin du morceau, retombée de 9,6 dB |
| La fin, 52,5–60 s | Remontée douce, puis le coup du logo et l'extinction | Comme A, mais on y arrive depuis un bivouac plus bas : saut de +6,4 dB à 52,56 s, à juger | Remontée vers le logo (saut de +5,8 dB à 52,56 s) et le drop sur le logo : le coup le plus marqué en sonie (+2,9 LU) |

## 7. Ce qui reste fragile (franchement)

1. **Le passage du bivouac au final dépasse la règle des 3 dB dans B (+6,4 dB) et C (+5,8 dB),** à 52,556 s. L'outro est très basse et le final ne l'est pas.
   - Correction possible sans changer la matière : baisser le final de 3 dB au raccord, avec une remontée sur une mesure. Cela changerait les fichiers envoyés : je ne l'ai pas fait sans accord.
   - A respecte la règle (+2,4 dB).
2. **A et B ont la même fin** (m61–m63 puis m64). C'est l'enchaînement le plus fluide mesuré (harmonie 0,90–0,91), mais les deux propositions se ressemblent sur les 7 dernières secondes.
3. **La fin est une extinction en fondu après le coup,** pas une vraie queue de réverbération : le morceau n'a pas de coup isolé suivi de silence. L'écart du coup sur 400 ms reste modeste : +4,6 à +4,7 dB.
4. **A et B démarrent au milieu de la montée,** sur un premier temps, pas au début du morceau. Le son est là dès l'image 0, mais ce n'est pas « le début de la musique ». Seul C commence au début, et son intro est basse et creuse (−21,3 LUFS, creux à −30 vers 2–3 s) : sur un téléphone, le cosmos de C sera discret.
5. **Les classes de la carte sont des règles sur des mesures** (centiles), pas une écoute. « Doux épique » désigne ce qui est tenu, large et peu percussif.
6. **Non écouté.** Mesures faites avec ffmpeg 6.0.
7. **Licence de synchronisation de STORM II** à obtenir avant toute diffusion publique.

## 8. Planches et fichiers

Planches regardées, dans `qa/snapshots/musique-v6/` :
- `carte-morceau.png` ;
- `A-planche-60s.png`, `B-planche-60s.png`, `C-planche-60s.png` : sections v6, segments, forme d'onde, sonie momentanée, spectrogramme, raccords, moments clés ;
- zooms de chaque raccord : `X-raccord-n-*.png` ;
- `X-debut-0-6s.png` et `X-fin-56-60s.png`.

Code, dans `tools/audio/` :
- nouveaux : `carte-morceau.py`, `build-v6.mjs`, `beats-v6.mjs` ;
- modifiés :
  - `lib.mjs` : `V6`, `v6Segments`, `joinsV6`, `montageV6Filter`, `v6Paths` ;
  - `audit-v3.py` : modes `--v6a`, `--v6b`, `--v6c` ;
  - `build-all.mjs` : `--v6a`, `--v6b`, `--v6c`.
