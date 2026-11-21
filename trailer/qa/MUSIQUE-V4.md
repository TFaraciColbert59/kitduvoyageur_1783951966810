# Montage musical v4 — STORM II calé sur le film, émotion par émotion (24 i/s)

Rédigé le 14/11/2026 par `sound-designer`. **Mesuré, non écouté** partout. Outils : ffmpeg 6.0 et ffprobe 4.4 (binaires de `node_modules`), Python 3 + numpy 2.0.2 + Pillow 11.3, HyperFrames 0.9.33.

Ce qui change par rapport à la v3 (refusée par Tony) :
- **la musique sonne dès l'image 0** : −17,5 dBFS RMS sur les 400 premières ms ;
- **la structure suit le découpage du film** décidé par l'orchestrateur ;
- trois sons d'habillage sont posés sur une **piste séparée**.

Fichiers (tous ignorés par git, chemins depuis `trailer/`) :
- `qa/mix-v4.wav` : le mixage ;
- `qa/mix-v4-musique.wav` : la musique seule ;
- `qa/mix-v4-habillage.wav` : les trois sons seuls.

Les deux pistes séparées ont reçu le même gain : leur somme redonne `mix-v4.wav` (écart maximal 3·10⁻⁷).

- Grille : `qa/mix-v4.beats.json`.
- Planches : `qa/snapshots/musique-v4/`.
- Reconstruction : `node tools/audio/build-all.mjs --v4`, avec ffmpeg et ffprobe dans le PATH.
- La v3 reste reconstructible à l'identique (`--v3`, somme de contrôle inchangée `0e58a9f5…`).

## 1. Grille et matière

**Tempo et grille.** Grille mesurée en v3 (voir `MUSIQUE-V3.md` § 1) :
- 136,997 BPM, temps = 0,437965 s, mesure = 1,75186 s = 42,04 images ;
- dans le morceau, m40 temps 1 = 71,4914 s ;
- mesure n du film = (n − 1) × 1,75186 s, la mesure 1 commençant à l'image 0.

**Hypothèses de l'orchestrateur vérifiées :**
- la montée finit bien à m39 ;
- le drop 1 est à m40 (71,49 s) ;
- le drop 2 est à m72 (127,55 s), ses 7 dernières mesures sont m81–m87 ;
- l'outro commence à m88 (155,58 s) ;
- la reprise qui mène au drop 2 est m68–m71, avec la respiration puis le roulement dans m71 (temps 3–4).

**L'intro du morceau** (0–11,9 s) : quatre phrases mélodiques sans batterie ni basse, séparées par des « trous » de réverbération à −32 dB. Les attaques de phrase sont à 0,05, 3,90, 7,08 et 10,65 s. Les notes ne tombent pas exactement sur la grille (±30 à 150 ms).

Raideur des attaques, montée du RMS 5 ms en 20 ms :

| Attaque (s dans le morceau) | Montée | Remarque |
|---|---|---|
| 0,05 | — | Première note |
| 0,97 | +8,9 dB | Mais +19,8 dB dans l'aigu |
| 1,43 | +8,6 dB | Note de m0 |
| **3,90** | **+17,8 dB** | **2e phrase, après un trou** |
| 7,08 | +12,4 dB | 3e phrase |
| 10,65 | +9,5 dB | 4e phrase |

La plus nette est **3,90 s**. C'est elle qui allume le Soleil.

## 2. Le film, section par section

| Mesures du film | Temps (s) | Images | Section | Matière réellement utilisée (s du morceau) | Ce que la musique y fait (mesuré) | Court terme moyen |
|---|---|---|---|---|---|---|
| 1–3 | 0–5,256 | 0–126 | `cosmos` | Note de m0 (1,415→2,465), fin du trou 1 et **2e phrase** (3,617→5,767), fin du trou 2 et **3e phrase** (6,772→9,266) | Synthé seul, sans grave ni batterie. La note de m0 sonne dès l'image 0. Un creux de réverbération (comblé par le souffle) précède **l'attaque de la 2e phrase à 1,324 s, image 32**. La 3e phrase arrive à 3,502 s (image 84). Intro relevée de 5 dB. | −16,4 LUFS |
| 4–7 | 5,256–12,263 | 126–294 | `declic` | m5 (fin du trou 3), **4e phrase** à 5,746 s (image 138, temps 2 de la mesure 4), m6–m8 en continu (10,61→17,18) | Le début de la montée tel que le morceau l'enchaîne, encore dépouillé : mélodie sans batterie. **La basse entre sur le premier temps de m8 = mesure 7 du film (10,511 s, image 252, le lac)** : grave de −54 à −38 dB dans le morceau. Relevé de 1,5 dB. | −17,3 |
| 8–11 | 12,263–19,270 | 294–462 | `decision` | m33–m36 (59,23→66,24) | La montée chargée : basse tenue, plus de couches, niveau plus haut que `declic`. Relevé de 1 dB. | −15,9 |
| 12–14 | 19,270–24,526 | 462–589 | `depart` | m37–m39, enchaîné sans coupe (66,24→71,49) | Crescendo. m39 contient le riser et les frappes qui annoncent le drop (grave +11 dB, aigu +4 dB dans le morceau). | −14,4 (maximum −10,8) |
| 15–19 | 24,526–33,285 | 589–799 | `montagne` | **Drop 1** m40–m44 (71,49→80,25), suite naturelle de m39 | Grosse caisse, basse et accords pleins dès le premier temps de la mesure 15. Gain nature. | −12,2 |
| 20–26 | 33,285–45,548 | 799–1093 | `coureur-cycliste` | **Drop 2**, ses 7 dernières mesures m81–m87 (143,32→155,58) | Plein, charleston un peu plus présent que dans le drop 1. **Seulement +0,6 LU au-dessus du drop 1** (voir § 5). La dernière frappe est m87 temps 4 (45,11 s). | −11,6 |
| 27–30 | 45,548–52,556 | 1093–1261 | `bivouac` | **Outro** m88–m91 (155,58→162,59), suite naturelle du drop 2 | La batterie et la basse s'arrêtent net sur le premier temps (grave −53 dB). Il reste une nappe douce. Relevée de 3 dB (rampe d'un temps). 6,2 LU sous le drop 2. | −17,8 |
| 31–33 | 52,556–57,811 | 1261–1387 | `final` | **Reprise** m69–m71 (122,30→127,55) | Le grave et la grosse caisse reviennent d'un coup, sans charleston. m71 : respiration (temps 1–2) puis **roulement (temps 3–4, à partir de 56,935 s, image 1366)**. Abaissée de 2 dB pour que l'impact ressorte. | −15,9 |
| impact | 57,811–60,000 | 1387–1440 | `logo` | m72 temps 1 (127,55→127,99), puis la nappe de l'outro m88 dès le temps 2 (156,02→157,77) | **Premier temps du drop 2, avec `impact-logo` dessous.** Relâchement de 120 ms avant le temps 2, puis la nappe s'éteint en exponentielle. | M max −12,8 |

Moments clés (dans `mix-v4.beats.json`, champ `keyMoments`) :

| Moment | Temps (s) | Image |
|---|---|---|
| `soleil` | 1,333 (attaque mesurée à 1,324) | 32 |
| `drop1` | 24,526 | 589 |
| `drop2` | 33,285 | 799 |
| `nuit` | 45,548 | 1093 |
| `reprise` | 52,556 | 1261 |
| `roulement` | 56,935 | 1366 |
| `impact` | 57,811 | 1387 |

Attaques réelles de l'intro, à suivre pour couper l'image (champ `intro`) :

| Temps (s) | Image |
|---|---|
| 1,324 | 32 |
| 1,462 | 35 |
| 2,432 | 58 |
| 3,502 | 84 |
| 4,442 | 107 |
| 4,880 | 117 |
| 5,746 | 138 |

## 3. Raccords

Il y a sept raccords. Pour les raccords « temps », le fondu est un quart de sinus de 25 ms qui finit 8 ms avant le temps (comme en v3).

Lecture des colonnes :
- **Grille :** écart des grosses caisses à la grille, de part et d'autre du raccord.
- **Clic :** plus grand saut d'échantillon dans le fondu, rapporté à celui des 250 ms voisines.
- **Harmonie :** cosinus des chromas sur une mesure ; la valeur entre parenthèses est celle du passage naturel du morceau.

| # | Film (s) / image | Morceau | Type et raison | Grille | Clic | RMS avant → après (0,5 s) | Harmonie |
|---|---|---|---|---|---|---|---|
| 1 | 1,050 / 25 | 2,465 → 3,617 | Dans le trou 1 (réverbération des deux côtés, fondu de 40 ms) : raccourcit l'intro pour que la 2e phrase tombe sur le Soleil | intro libre | 0,42 | −24,4 → −22,0 | même trou |
| 2 | 3,200 / 77 | 5,767 → 6,772 | Dans le trou 2 (fondu de 40 ms) : la 3e phrase tombe sur le 9e temps du film | intro libre | 0,33 | −21,9 → −22,0 | même trou |
| 3 | 5,6935 / 137 | 9,266 → 10,614 | Dans le trou 3, au temps 2 de la mesure 4 (fondu de 40 ms) : la 4e phrase et la montée repartent calées sur la grille | intro libre | 0,32 | −21,3 → −22,7 | même trou |
| 4 | 12,263 / 294 | m9 t1 → m33 t1 | Premier temps. m8 et m32 ouvrent chacun une phrase de 4 mesures, donc m8 → m33 est l'équivalent de m32 → m33. | continu par construction (grosses caisses d'un seul côté) | 0,86 | −20,4 → −18,4 | 0,23 (0,19) |
| 5 | 33,285 / 799 | m45 t1 → m81 t1 | Premier temps, drop 1 → drop 2 | **−0,7 ms** | 1,46 (*) | −14,6 → −13,4 | **0,94 (0,92)** |
| 6 | 52,556 / 1261 | m92 t1 → m69 t1 | Premier temps, outro → reprise | continu par construction | 1,33 (*) | −23,4 → −16,9 | 0,31 (0,26) |
| 7 | 58,249 / 1398 | m72 t2 → m88 t2 | Relâchement de l'impact (120 ms), nappe et queue | — | 0,41 | −13,9 → −29,8 | — |

(*) Ce n'est pas un clic.
- Raccord 5 : le plus grand saut (0,202) est celui du morceau lui-même au même endroit (0,210, à −15 ms du temps). C'est le transitoire qui précède la frappe de m81.
- Raccord 6 : 0,065, contre 0,069 dans le morceau.

Grille mesurée sur les grosses caisses, écart médian à la grille (et écart absolu médian) :

| Segment | Frappes | Écart médian |
|---|---|---|
| M2 (montée + drop 1) | 21 | +4,0 ms (3,1) |
| D2 (drop 2 + outro) | 28 | −0,3 ms (4,1) |
| R (reprise) | 12 | −0,1 ms (0,2) |

L'écart reste inférieur à 0,1 image partout. Les images de la grille arrondies tombent à 21 ms au plus du temps exact (½ image), voir `errMs`.

## 4. Habillage (piste séparée `qa/mix-v4-habillage.wav`)

Trois sons générés : banque versionnée `assets/audio/sfx/`, recettes à graine fixe dans `tools/audio/gen-sfx.mjs`, notés dans `assets/audio/sfx/SOURCES.md`. Placement dans `habillageV4Cues()` (`tools/audio/lib.mjs`).

| Son | Fichier | Début | Gain (avant mastering) | Niveau mesuré dans le mix |
|---|---|---|---|---|
| Souffle grave qui monte, de l'image 0 au Soleil | `souffle-cosmos.wav` (1,36 s) | 0,000 s, image 0 | −10 dB | −26 dBFS RMS sur 0,8–1,32 s, soit 3 dB au-dessus de la musique dans ce creux (−29,5) |
| Impact sur l'allumage du Soleil | `impact-soleil.wav` (2,0 s) | 1,331 s, image 32 | −4 dB | −21,4 dBFS sur 400 ms, 4,7 dB sous la note |
| Impact à longue queue sous le coup final | `impact-logo.wav` (2,15 s, sous −60 dB à la fin) | 57,809 s, image 1387 | −1 dB | −18 dBFS sur 400 ms, environ 7 dB sous la frappe du drop 2 ; la queue tient la fin |

## 5. Mesures (`qa/mix-v4.wav`, ffmpeg 6.0)

- **ffprobe :** pcm_s24le, 48 000 Hz, 2 canaux, 24 bits, **2 880 000 échantillons = 60,000000 s**. Les deux pistes séparées ont le même format.
- **ebur128 :** **−14,0 LUFS intégrés**, **LRA 6,1 LU**, **crête vraie −2,0 dBTP**, crête échantillon −2,05 dBFS.
  - Mastering : gain unique de −5,7 dB sur la somme, sans limiteur ; la marge de crête vient du choix des gains.
  - Contre-mesure `hyperframes audio` : même résultat, 0 écrêtage.
- **Après AAC 320 kb/s,** avec `-aac_pns 0` comme par défaut : −14,0 LUFS, **crête vraie −2,0 dBTP**.
- **Début :**
  - premier échantillon non nul à 0,00002 s ;
  - **RMS des 400 premières ms : −17,5 dBFS** (−17,6 / −17,8 / −17,7 / −17,0 par tranche de 100 ms), crête −6,2 dBFS ;
  - au-dessus de −30 dBFS dès la première fenêtre de 50 ms.
- **Niveau par section** (court terme moyen) : cosmos −16,4 · declic −17,3 · decision −15,9 · depart −14,4 · montagne −12,2 · coureur-cycliste −11,6 · bivouac −17,8 · final −15,9 LUFS.
  - L'intro est à 4,8 LU sous les drops, le bivouac à 6,2 LU. Les deux sont bien en deçà des 12 LU maximum demandés.
- **Coup final à 57,811 s :**
  - +9,7 dB (RMS sur 200 ms : −21,7 → −12,0) ;
  - +6,9 dB (sur 400 ms : −20,3 → −13,4) ;
  - +4,4 LU en sonie momentanée.
  - En v3, on avait environ +2 dB.
- **Fin :**
  - sous −60 dBFS (RMS 50 ms) à **59,435 s** ;
  - crête des 100 dernières ms : −69 dBFS ;
  - dernier échantillon : 0.
- **Reconstruction :** relancée deux fois, sommes SHA-256 **identiques** pour les trois WAV et les trois sons générés.
  - `mix-v4.wav` : `1a713add…1f92b3`
  - `mix-v4-musique.wav` : `91f10af5…6a90`
  - `mix-v4-habillage.wav` : `8c445bf2…cfec`

Planches regardées (`qa/snapshots/musique-v4/`) :
- `planche-60s.png` : sections du film et émotions, segments du morceau, forme d'onde, LUFS momentané, spectrogramme, raccords, moments clés ;
- les 7 zooms `raccord-*.png` (±150 ms) ;
- `debut-0-6s.png` et `fin-56-60s.png`.

## 6. Écarts à la demande, et ce qui coince (franchement)

1. **L'intro ne commence pas au 0 du morceau.** Elle commence à la note de m0 (1,415 s du MP3) : c'est le seul moyen d'avoir un son franc à l'image 0 **et** l'attaque la plus nette sur le Soleil (images 24–40). La toute première note et les 3 temps de levée du morceau sont coupés. J'ai raccourci deux trous.
2. **L'intro est jouée libre par rapport à la grille du film :**
   - segment I1 décalé de −164 ms ;
   - segment I2 aligné sur l'attaque du Soleil, pas sur un temps ;
   - segment I3 à −35 ms.

   La grille ne devient exacte qu'à partir de 5,694 s. Pour l'ouverture, couper sur les attaques du champ `intro`, pas sur les temps.
3. **La mesure 4 (`declic`) commence dans un trou.** La phrase de Léa à la fenêtre entre au temps 2 (5,746 s, image 138), pas sur le premier temps.
4. **Le drop 2 n'apporte presque pas de « cran d'énergie » (+0,6 LU).** C'est la même boucle que le drop 1 avec un charleston un peu plus présent. Le cran devra venir de l'image ou d'un effet sur l'entrée du coureur (pas fait : hors habillage autorisé). Je n'ai pas relevé le drop 2 pour ne pas toucher à la marge de crête.
5. **Outro → reprise (52,556 s) : +6,5 dB d'un coup,** le grave revient (raccord 6, harmonie faible des deux côtés). Abaisser la reprise de 2 dB l'adoucit sans l'effacer. C'est le raccord le plus exposé.
   - Autre solution, à écouter : 3 mesures d'outro (m88–m90), puis la reprise complète m68–m71 sur 4 mesures. La frontière `bivouac`/`final` reculerait d'une mesure (50,804 s). Je n'ai mesuré l'harmonie que pour m91 → m68 (0,40), pas pour m90 → m68.
6. **Le Soleil :** l'attaque musicale tombe 9 ms avant l'image 32. Le souffle d'habillage remplit le creux de 0,8 à 1,3 s. Le souffle et les deux impacts sont des sons de synthèse : à juger à l'oreille.
7. **Non écouté.** Le relâchement de 120 ms de l'impact (la basse du drop 2 s'éteint avant le temps 2) peut s'entendre comme un « button ». L'impact-logo est là pour le masquer.
8. **Licence de synchronisation de STORM II** à obtenir avant toute diffusion publique.

## 7. Fichiers

- Code, dans `tools/audio/` :
  - `lib.mjs` : `V4`, `filmBar`, `montageV4Segments`, `gainPointsV4`, `joinsV4`, `montageV4Filter`, `habillageV4Cues` ;
  - `build-montage.mjs --v4` ;
  - `build-habillage-v4.mjs` (nouveau) ;
  - `build-mix.mjs --v4` (`buildMasterV4`) ;
  - `beats-v4.mjs` (nouveau) ;
  - `gen-sfx.mjs` (3 recettes ajoutées) ;
  - `audit-v3.py --v4` (même script, mode v4) ;
  - `build-all.mjs --v4`.
- Banque d'effets : `assets/audio/sfx/souffle-cosmos.wav`, `impact-soleil.wav`, `impact-logo.wav`, et `SOURCES.md`.
- Non versionnés : `qa/mix-v4*.wav`, `assets/audio/storm-ii-montage-60s-v4.wav`, `qa/tmp/habillage-v4-brut.wav`, `qa/tmp/audit-v4.json`.
