# Musique du film 30 s — analyse et montage

Piste fournie par le client : `b1ee4763-Insta_Saver_jayz_audio_No_Church_In_The_Wild_feat._Frank_Ocean.mp3`, le morceau « No Church In The Wild » (Jay-Z & Kanye West feat. Frank Ocean).

Méthode : aucune écoute. Tout vient de mesures sur le signal décodé par ffmpeg : FFT numpy, flux spectral par bande, autocorrélation, repliement sur la grille, régression des attaques, mesure EBU R128. Les scripts et les fichiers intermédiaires sont dans le scratchpad de la session (`…/scratchpad/music/scripts/`).

Livrables :

| Fichier | Contenu |
|---|---|
| `video/film-30s/audio/musique-30s.wav` | montage final, 30,000 s exactement (1 440 000 échantillons), 48 kHz, stéréo, PCM 24 bits |
| `video/film-30s/audio/musique-30s.mp3` | même montage, 192 kb/s, 48 kHz, aligné à l'échantillon près sur le WAV (décalage mesuré : 0) |
| `video/film-30s/audio/temps-forts.json` | grille complète du film (temps, mesures) et 204 temps forts mesurés (nature, force 0–1, écart à la grille), avec le journal du montage |
| `research/musique-attaques-source.csv` | 692 attaques fortes de la piste source, à la milliseconde, avec leur mesure et leur temps |
| `research/musique-*.png` | images d'analyse (liste en §5) |

---

## 1. Fiche technique de la source

| Mesure | Valeur |
|---|---|
| Conteneur / codec | MP4 (`isom`) au nom en `.mp3`. Le flux est en **AAC**, pas en MP3. |
| Durée | 272,623 s dans le conteneur, 272,534 s décodées (4 min 32 s). C'est **le morceau entier**, pas un extrait de Reel. |
| Échantillonnage / canaux | 44,1 kHz, stéréo |
| Débit | ≈ 62 kb/s : compression forte (copie Instagram). Le spectre monte jusqu'à environ 16 kHz. |
| Sonie intégrée (EBU R128) | **−14,1 LUFS** |
| Crête vraie | **−2,7 dBTP**. La crête échantillon est à −2,71 dBFS. |
| Plage de sonie (LRA) | **3,1 LU** (de −16,0 à −12,9 LUFS) : un mix très compressé, typique du hip-hop |
| RMS / facteur de crête | −15,5 dB RMS, soit un facteur de crête d'environ 12,8 dB |
| Plancher de bruit | −69,8 dB |

## 2. Tempo et grille

- **BPM : 92,80.** La valeur affinée est 92,8009 BPM, soit un temps de 646,545 ms et une mesure de 2,586181 s.
  - Le premier pic d'autocorrélation du flux d'attaques tombe à un décalage de 640 ms (93,75 BPM). Le repliement de l'enveloppe d'attaques à 1 ms donne ensuite 92,80 BPM. Une régression robuste sur 527 attaques franches donne 92,8009 BPM, avec un résidu médian de 8,8 ms.
  - Contrôle des multiples et sous-multiples : le double (185,6 BPM) et les rapports ×1,5 et ×2/3 sont moins nets. La **moitié (46,4 BPM)** est plus nette, parce que le motif de batterie se répète tous les deux temps. Le morceau se ressent donc comme lourd et en demi-tempo.
- **Stabilité : tempo de machine, sans dérive.** Par fenêtres de 20 s, le BPM local reste à 92,80 ± 0,05. Les seuls écarts (92,3 à 94,2) tombent sur les cassures, où les attaques manquent. Le résidu médian par tranche de 30 s reste entre −2 et +4 ms sur tout le morceau.
- **Phase :**
  - Premier temps de mesure à **−0,027 s**. Le fichier commence 27 ms après le début de l'attaque du tout premier temps.
  - Premier temps entier dans le fichier : 0,620 s (temps 2 de la mesure 1).
  - Formules : temps n à `t = −0,0268 + n × 0,6465452 s` ; mesure m (numérotée à partir de 1) à `t = −0,0268 + (m − 1) × 2,5861808 s`.
- **Mesure à 4 temps**, avec le premier temps confirmé de deux façons :
  - la nouveauté harmonique est deux fois plus forte sur la position 1 (0,045, contre 0,020 à 0,026 sur les autres positions) ;
  - les trois retours du groupe après une cassure (149,972, 170,661 et 201,695 s) tombent tous sur cette position.
- La structure se range en blocs de 4, 8, 10 et 16 mesures (§4).

Début de chaque mesure de la source (s) :

| | | | | | | | |
|---|---|---|---|---|---|---|---|
| 1: −0,027 | 2: 2,559 | 3: 5,146 | 4: 7,732 | 5: 10,318 | 6: 12,904 | 7: 15,490 | 8: 18,076 |
| 9: 20,663 | 10: 23,249 | 11: 25,835 | 12: 28,421 | 13: 31,007 | 14: 33,594 | 15: 36,180 | 16: 38,766 |
| 17: 41,352 | 18: 43,938 | 19: 46,524 | 20: 49,111 | 21: 51,697 | 22: 54,283 | 23: 56,869 | 24: 59,455 |
| 25: 62,042 | 26: 64,628 | 27: 67,214 | 28: 69,800 | 29: 72,386 | 30: 74,972 | 31: 77,559 | 32: 80,145 |
| 33: 82,731 | 34: 85,317 | 35: 87,903 | 36: 90,490 | 37: 93,076 | 38: 95,662 | 39: 98,248 | 40: 100,834 |
| 41: 103,420 | 42: 106,007 | 43: 108,593 | 44: 111,179 | 45: 113,765 | 46: 116,351 | 47: 118,937 | 48: 121,524 |
| 49: 124,110 | 50: 126,696 | 51: 129,282 | 52: 131,868 | 53: 134,455 | 54: 137,041 | 55: 139,627 | 56: 142,213 |
| 57: 144,799 | 58: 147,385 | 59: 149,972 | 60: 152,558 | 61: 155,144 | 62: 157,730 | 63: 160,316 | 64: 162,903 |
| 65: 165,489 | 66: 168,075 | 67: 170,661 | 68: 173,247 | 69: 175,833 | 70: 178,420 | 71: 181,006 | 72: 183,592 |
| 73: 186,178 | 74: 188,764 | 75: 191,351 | 76: 193,937 | 77: 196,523 | 78: 199,109 | 79: 201,695 | 80: 204,281 |
| 81: 206,868 | 82: 209,454 | 83: 212,040 | 84: 214,626 | 85: 217,212 | 86: 219,799 | 87: 222,385 | 88: 224,971 |
| 89: 227,557 | 90: 230,143 | 91: 232,729 | 92: 235,316 | 93: 237,902 | 94: 240,488 | 95: 243,074 | 96: 245,660 |
| 97: 248,247 | 98: 250,833 | 99: 253,419 | 100: 256,005 | 101: 258,591 | 102: 261,177 | 103: 263,764 | 104: 266,350 |
| 105: 268,936 | 106: 271,522 | | | | | | |

## 3. Transitoires

- **Méthode :** l'attaque est détectée sur la montée en dB sur 15 ms d'une enveloppe RMS glissante (pas de 1 ms), dans trois bandes séparées :
  - grosse caisse 35–120 Hz (RMS sur 10 ms) ;
  - caisse claire / claquement 1,5–6 kHz (RMS sur 5 ms) ;
  - charley 6–16 kHz.

  Un seuil adaptatif (médiane + MAD sur 3 s) s'y ajoute. L'instant retenu est le début de la montée (+3 dB au-dessus du niveau précédent), à ±5 ms environ.
- **Résultat :** 1 510 attaques de grave, 921 de claquement et 740 de charley. Les **692 attaques fortes** (force ≥ 0,6), horodatées à la milliseconde avec leur mesure et leur temps, sont dans `musique-attaques-source.csv`.
- **Motif :**
  - **Grosse caisse lourde sur chaque temps.** Elle est un peu plus forte sur les temps 1 et 3, avec des coups avant le temps et des croches (phase dominante à la demi-pulsation, 303–323 ms).
  - **Claquement / caisse claire surtout sur les temps 3 et 4.** Les attaques fortes calées à ±40 ms d'un temps se répartissent ainsi : 45 sur le 3, 44 sur le 4, 33 sur le 2, 13 sur le 1. C'est cette carrure qui donne la sensation de demi-tempo.
  - Le charley est discret ; les aigus portent surtout la voix et les nappes.

## 4. Structure, énergie, voix

Indice de voix : part d'énergie 300 Hz–3 kHz, centrée dans l'image stéréo, et lignes harmoniques à vibrato visibles sur le spectrogramme. C'est un indice de probabilité ; les paroles ne sont pas comprises.

| Mesures | Temps source (s) | Section | Description mesurée | Voix |
|---|---|---|---|---|
| 1–4 | −0,027 → 10,318 | Intro | Basse et grosse caisse seules, sans aigus (2–16 kHz à −15/−25 dB). −14,7 LUFS. | **improbable** (seul passage instrumental) |
| 5–14 | 10,318 → 36,180 | Refrain A | Entrée du groupe complet à 10,318 (nouveauté ×20). Voix chantée à vibrato dès 11,611 (levée sur le temps 3). Creux à 22,3 s. | probable |
| 15–30 | 36,180 → 77,559 | Couplet 1 (16 mesures) | Boucle de base, plus dense : −12,6 à −13,3 LUFS sur les mesures 22–30. | probable (rap) |
| 31–40 | 77,559 → 103,420 | Refrain A | Copie quasi identique des mesures 5–14 (similarité 1,000) | probable |
| 41–50 | 103,420 → 129,282 | Couplet 2 | Alternance mesure par mesure : nouveauté de 6 à 8 entre mesures voisines | probable |
| 51–58 | 129,282 → 149,972 | **Pont** | Graves allégés, nappes tenues et voix chantée (indice 0,7–0,85). **Montée sur 55–56 : les mesures les plus fortes du morceau** (−11,9 / −12,4 LUFS). **Cassure** à 148,032 (temps 2 de la mesure 58). | très probable |
| 59–78 | 149,972 → 201,695 | **Couplet 3 (drop)** | **DROP à 149,972, la plus forte nouveauté du morceau.** Couplet le plus brillant (8–16 kHz jusqu'à +7 dB). Deux cassures : 168,722 → retour 170,661, puis 199,756 → retour 201,695. | probable (rap) |
| 79–88 | 201,695 → 227,557 | Refrain A | Identique aux mesures 5–14 | probable |
| 89–96 | 227,557 → 248,247 | Final | Variante du couplet 2. **Le beat s'arrête à 248,247**, sans impact final. | probable |
| 97–106 | 248,247 → 272,534 | Outro | Beat absent, nappes et voix, −20 LUFS, fondu jusqu'à la fin | très probable |

**Pics, drops, cassures et silences de la source**

| Temps source (s) | Nature | Mesure |
|---|---|---|
| 10,318 | entrée du groupe (pic) | 5, temps 1 |
| 11,611 | entrée de la voix | 5, temps 3 |
| 22,3–22,6 | creux bref | 9, temps 3–4 |
| 129,282 | début du pont, bascule de texture | 51 |
| 139,627 → 144,8 | sommet d'énergie du morceau | 55–56 |
| 148,032 | **cassure** : batterie et basse coupées | 58, temps 2 |
| 148,40 → 148,70 | quasi-silence de 300 ms, puis nappe tenue et montée | 58 |
| **149,972** | **DROP principal** | 59, temps 1 |
| 168,722 → 170,661 | cassure a cappella, puis retour du beat | 66 → 67 |
| 199,756 → 201,695 | cassure a cappella ; **silence 201,25 → 201,69**, puis retour (attaque réelle à 201,724) | 78 → 79 |
| 248,247 | fin du beat, début de l'outro | 97 |

La matrice d'autosimilarité (`musique-autosimilarite.png`) confirme la forme : intro, refrain, couplet, refrain, couplet, pont, drop/couplet, refrain, final, outro. Les refrains sont des copies exactes (similarité 1,000) ; le pont et l'outro sont les seuls blocs à part.

## 5. Images (regardées pendant l'analyse)

- `musique-analyse.png` : morceau entier. Spectrogramme log 30 Hz–16 kHz, sonie momentanée EBU (pas de 100 ms) avec les sections et les évènements, énergie par bande, indice de voix.
- `musique-autosimilarite.png` : autosimilarité mesure par mesure.
- `musique-debut-0-30s.png` : intro sans aigus, entrée du groupe à 10,3 s, voix à 11,6 s.
- `musique-pont-120-155s.png` : pont, cassure et drop.
- `musique-cassure-drop-150s.png` : zoom à la milliseconde sur la cassure de 148 s et le drop de 149,972 s, grille numérotée.
- `musique-cassure-silence-201s.png` : cassure de 199,756 s, silence, retour à 201,695 s.
- `musique-grille-30-36s.png` : la grille calée sur les attaques de grosse caisse.
- `musique-film-30s.png` : réanalyse du montage final. Forme d'onde, enveloppes, mesures et raccords, temps forts verrouillés.
- `musique-film-raccords.png` : chaque raccord à la résolution de l'échantillon.

---

## 6. Découpes de 30 s proposées

Toutes les découpes sont faites de mesures entières, posées sur la grille. Dans le film, le temps k tombe donc exactement à `k × 0,6465452 s` et la mesure m à `(m − 1) × 2,5861808 s`. Les raccords sont des fondus enchaînés à puissance constante de 10 ms, placés juste **avant** le temps, pour ne jamais couper une attaque.

### A — « Impact → montée → cassure → DROP → cassure → impact final » (recommandée, produite)

| Film (s) | Source (s) | Mesures source | Rôle |
|---|---|---|---|
| 0,000 → 5,172 | 170,661 → 175,833 | 67–68 | accroche : retour du beat après une cassure, plein régime dès 0 |
| 5,172 → 25,862 | 139,627 → 160,316 | 55–62 (continu) | sommet du pont (montée), cassure, silence, **drop**, puis le couplet le plus brillant |
| 25,862 → 28,448 | 199,109 → 201,695 | 78 | dernière cassure a cappella, puis silence |
| 28,448 → 30,000 | 201,724 → … | 79 (temps 1) | **impact final**, tenu 0,55 s, puis queue de réverbération jusqu'au silence |

Temps forts à verrouiller (liste complète dans `temps-forts.json`) :

| Film (s) | Nature | Force | Note |
|---|---|---|---|
| **0,000** | impact + premier temps | 0,9 | le beat repart d'un coup : première image sur cet instant |
| 1,282 | grosse caisse | 0,96 | coup lourd, temps 3 |
| **5,172** | impact (raccord) | 0,6 | bascule vers le sommet du pont : plus dense et plus fort, sans attaque isolée |
| 9,041 | grosse caisse | 0,92 | |
| 12,931 | premier temps | 0,6 | dernière mesure avant la cassure |
| **13,577** | **cassure** | 0,9 | batterie et basse coupées ; le temps attendu ne frappe pas |
| **13,955 → 14,255** | **silence** | 0,8 | quasi-silence de 300 ms, puis nappe tenue qui monte (reprise à 14,26) |
| **15,517** | **DROP** | 1,0 | tout revient (attaque mesurée à 15,518) : coupe majeure à 52 % du film |
| 19,278 | grosse caisse | 1,0 | coup avant le temps 30 (19,396), accent fort |
| 24,565 | caisse claire | 1,0 | le claquement le plus fort du film |
| **26,508** | **cassure** | 0,85 | batterie et basse coupées, phrases a cappella |
| **28,140 → 28,447** | **silence** | 0,8 | silence de 307 ms avec un petit souffle vocal à 28,22–28,28 |
| **28,448** | **impact final** | 1,0 | attaque mesurée à 28,4479 s, posée exactement sur le temps |
| 30,000 | fin | — | queue : −16 dBFS RMS à 29,0 s, −33 à 29,5 s, −64 à 29,9 s ; dernier échantillon à zéro |

**Pourquoi c'est la recommandée :**
- elle commence en plein régime, sans intro ;
- elle enchaîne le passage le plus fort du morceau (mesures 55–56) avec sa propre cassure et son drop, sans raccord (149,972 est atteint en continu) ;
- le drop principal tombe à mi-film ;
- une seconde cassure suivie d'un vrai silence prépare un impact final unique.

Il n'y a que deux raccords réels : 5,172 et 25,862. Le troisième (28,448) tombe dans le silence.

### B — « Instrumental sourd → explosion → drop aux deux tiers » (variante)

| Film (s) | Source (s) | Mesures |
|---|---|---|
| 0,000 → 12,931 | 2,559 → 15,490 | 2–6 : intro sans aigus, puis entrée du groupe |
| 12,931 → 25,862 | 144,799 → 157,730 | 57–61 : fin du pont, cassure, drop, couplet |
| 25,862 → 28,448 | 199,109 → 201,695 | 78 : cassure et silence |
| 28,448 → 30,000 | 201,724 → | impact final et queue |

Temps forts du film :

| Film (s) | Nature |
|---|---|
| 0,000 | premier temps, basse seule |
| **7,759** | **impact** : entrée du groupe, les aigus arrivent |
| 9,052 | entrée de la voix |
| **16,164** | **cassure** |
| 16,53 → 16,83 | quasi-silence |
| **18,103** | **DROP**, à 60 % du film |
| 26,508 | cassure |
| 28,14 → 28,45 | silence |
| **28,448** | impact final |

Intérêt : 9 s sans voix au début, et le drop aux deux tiers. Limite : l'accroche est plus sourde (aucun aigu avant 7,8 s). C'est la seule découpe qui a besoin de +0,8 dB pour atteindre −14 LUFS.

### C — « Une seule prise » (sûreté)

| Film (s) | Source (s) |
|---|---|
| 0,000 → 28,448 | 173,247 → 201,695 (mesures 68–78, sans aucun raccord) |
| 28,448 → 30,000 | impact final et queue |

Temps forts : cassure à 26,508, silence de 28,14 à 28,45, impact final à 28,448.

Intérêt : naturel absolu, aucun raccord. Limite : énergie plate pendant 26 s, sans drop central.

Les aperçus normalisés de B et C sont dans le scratchpad (`…/scratchpad/music/edit/B.wav`, `C.wav`) ; seule A est livrée dans le projet.

---

## 7. Montage A — fabrication et vérification

- **Chaîne de traitement :**
  - Décodage de la source, puis rééchantillonnage en 48 kHz (soxr, précision 28 bits).
  - Lecture des segments avec un positionnement sous-échantillon (interpolation linéaire). Chaque segment commence dans le film à `k × mesure` arrondi à l'échantillon : l'erreur cumulée reste sous 10 µs.
- **Raccords :**
  - 5,172 s : fondu de 5,1144 à 5,1244. Il est placé 48 ms avant le temps, parce que la mesure source sortante a un coup de grave 42 ms avant son temps.
  - 25,862 s : fondu de 25,8418 à 25,8518.
  - Final : lecture recalée de +29 ms. L'attaque réelle du retour (201,724) tombe ainsi exactement sur le temps 28,448. Le fondu se fait dans le silence (28,426–28,436).
- **Impact final :**
  - l'impact est gardé tel quel pendant 0,55 s (0,85 temps), puis fondu en 60 ms, ce qui coupe la suite du groove ;
  - une queue de réverbération est ajoutée par convolution avec une réponse synthétique (bruit à décroissance exponentielle, RT60 2,2 s, filtrée vers 5 kHz, −4 dB) ;
  - un fondu final de 450 ms se termine à 30,000 s.
- **Sonie :**
  - WAV : −14,07 LUFS (loudnorm) / −13,93 LUFS (ebur128). Crête vraie **−2,75 dBTP**, donc ≤ −1 dBTP. Aucun limiteur n'a été nécessaire.
  - MP3 : −14,07 / −13,93 LUFS, crête vraie −2,71 dBTP. Il décode en exactement 1 440 000 échantillons.
- **Réanalyse du montage :**
  - **Grille :** 92,813 BPM et premier temps à +3 ms, retrouvés sur les attaques du fichier. Le décalage médian par tranche de 5 s reste entre −5,5 et +3,4 ms : la grille reste régulière d'un bout à l'autre.
  - **Clics :** dans la zone de chaque fondu, le pic de dérivée seconde vaut 2,3 / 1,6 / 2,4 fois la médiane locale, contre un 99ᵉ centile du voisinage de 2,1 / 3,9 / 4,0. Rien ne dépasse le niveau du contenu musical lui-même.
  - **Forme d'onde :** examinée à la résolution de l'échantillon (`musique-film-raccords.png`). Aucune discontinuité.

**Grille du film :**
- Temps (s) : 0,000 · 0,647 · 1,293 · 1,940 · 2,586 · 3,233 · 3,879 · 4,526 · 5,172 · 5,819 · 6,465 · 7,112 · 7,759 · 8,405 · 9,052 · 9,698 · 10,345 · 10,991 · 11,638 · 12,284 · 12,931 · 13,577 · 14,224 · 14,871 · 15,517 · 16,164 · 16,810 · 17,457 · 18,103 · 18,750 · 19,396 · 20,043 · 20,689 · 21,336 · 21,983 · 22,629 · 23,276 · 23,922 · 24,569 · 25,215 · 25,862 · 26,508 · 27,155 · 27,801 · 28,448 · 29,095 · 29,741.
- Mesures (s) : 1 = 0,000 · 2 = 2,586 · 3 = 5,172 · 4 = 7,759 · 5 = 10,345 · 6 = 12,931 · 7 = 15,517 · 8 = 18,103 · 9 = 20,689 · 10 = 23,276 · 11 = 25,862 · 12 = 28,448 (impact final, mesure incomplète).
- Les temps 45 (29,095) et 46 (29,741) ne frappent plus : seule la queue joue.

## 8. Limites

- **Pas d'écoute.** La qualité perçue des deux raccords (enchaînement des phrases rappées, couleur de la queue de réverbération) n'est déduite que des mesures. Une écoute de contrôle reste nécessaire.
- **Le morceau est chanté et rappé presque d'un bout à l'autre.** Seule l'intro (mesures 1–4, 10,3 s) est probablement sans voix. La découpe A contient du rap et du chant. Les raccords de 5,172 et 25,862 coupent des phrases en milieu de vers. Si le film doit être strictement sans voix, aucune découpe épique de 30 s n'est possible avec cette piste sans séparation de sources. La découpe B est la plus proche, avec 9 s sans voix.
- **Classification des attaques par bande seulement.** « kick » veut dire grave à 35–120 Hz ; « snare » veut dire claquement à 1,5–6 kHz, et peut inclure des consonnes de la voix. Précision de l'instant : ±5–10 ms (résidu médian de 8,8 ms). Les évènements de structure (drop, impact final, silences) ont été vérifiés sur la forme d'onde.
- **Source en AAC à 62 kb/s, issue d'Instagram.** Les aigus sont fragiles et des artefacts de compression sont possibles. Ils sont conservés, puisque le montage ne les traite pas.
- **Droits.** Le morceau est une œuvre commerciale (Roc-A-Fella / Def Jam). Son usage dans un film publié demande une licence de synchronisation. Ce point reste à la charge du client.
- La queue de l'impact final est une réverbération synthétique, ajoutée parce que le morceau ne finit sur aucun impact (le beat s'arrête net à 248,247 s). C'est une retouche de son, pas un élément d'origine.
