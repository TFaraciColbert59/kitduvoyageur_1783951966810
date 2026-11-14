# Audit du son du trailer (musique, calage, raccords, effets)

Rédigé au fil de l'eau le 2026-11-14 par `sound-designer`. **Mesuré, non écouté** partout : je lis des chiffres, je n'entends rien.
Outils : FFmpeg 6.1.1-3ubuntu5, Python 3 + numpy 2.5.3 (pas de scipy ni librosa sur la machine), hyperframes CLI.
Fichiers lus : `MUSIQUE.md`, `assets/audio/storm-ii.beats.json`, `film/shots.json`, `TRAME-60s.md`, `qa/SON-MESURES.md`, `qa/tmp/joins-REEL.json`, `qa/tmp/mix-report.json`.

État au départ : `qa/mix-v1.wav` (montage + 36 effets, −14 LUFS, −1,3 dBTP) est branché dans le film. Les raccords réels mesurés par `check-joins.mjs` (`qa/tmp/joins-REEL.json`) : 5,41 s et 33,48 s « discrets », 58,00 s « à surveiller », **47,47 s et 51,00 s « risque de s'entendre »** (47,47 : −10,2 dB, grave −26 dB ; 51,00 : +10,6 dB, grave +36,5 dB, timbre −2 octaves).

## Compte rendu (mesuré, non écouté ; FFmpeg 6.1.1-3ubuntu5)
1. **Tempo et grille : justes.** 97,4 % des 380 temps de `beats.json` ont une attaque indépendante à ±60 ms (grosse caisse : écart médian −6,5 ms, 0,4 image) ; 136,8 à 137,1 BPM mesuré d'un premier temps à l'autre ; phase de mesure `% 4 == 3` confirmée par les entrées de section ; aucun temps raté ni demi-temps décalé aux raccords.
2. **Bonne partie : drop 1 (5,41 s) et impact du logo (58,00 s) sont de vrais drops du morceau** (grave 27 → 53 dB ; retour du charleston +24 dB après respiration et roulement). **Mais 33,48 s n'est pas un drop entendu** (drop 1 → milieu du drop 2, +0,8 LU) et **la « montée » de 51 s n'en est pas une** (grave plein dès 51,00, niveau qui baisse jusqu'à 58 s).
3. **Moments forts :** de 5,4 à 47,5 s la musique est un mur (ΔM ±2 LU) : P08, P17, P20 et les plans ★ ne sont portés que par les effets. Contre-sens en v1 : P49 « Elle publie » (plan intime) reçoit un mur de +7,2 LU, et la remontée P52 → logo ne monte que de 1,5 LU.
4. **Raccords :** 47,47 et 58,00 (et 5,41) ne sont pas des collages, c'est le morceau ; leurs micro-fondus de 5 ms rabotaient l'attaque (−6,8 dB sur 10 ms au drop 1, −4,6 au logo). Vrais collages v1 : 33,48 (harmonie 0,67 = suite naturelle 0,69) et 51,00 (+10,5 dB, grave +48 dB, coup grave entamé de 10 ms).
5. **Effets :** 36, tous causés, n'écrasent pas la musique ; c'est le limiteur qui les écrase (clac P20 −6,3 dB, déclic −4,3, gravillons −4,0, logo −3,7) ; ambiances sous un drop plein, probablement masquées.
**Corrigé (v2, `node tools/audio/build-all.mjs --v2`, coupes image inchangées) :** passages continus non coupés ; m71 (respiration + roulement) sous P31–P32 pour un vrai drop à 33,48 (creux de 5,7 LU avant, contre 2,8) ; fin du pont m62–m63 sous P49–P51, grave rendu à 54,51 (P52), drop 2 sur le logo : la fin monte sans retomber (−16,7 → −17,8 → −14,5 → −13,5 → −12,2 LUFS) ; fondus enchaînés de 12 ms avant chaque attaque ; crash de masquage de 51 s retiré ; lit retiré de 3–4 dB sous 4 transitoires (déclic +2,8, gravillons +3,2, P34 +5,1 dB nets).
**`qa/mix-v2.wav` :** 2 880 000 échantillons = 60,000 s, 48 kHz, 24 bits, **−14,0 LUFS**, **−1,3 dBTP**, LRA 4,9 LU, 0 écrêtage (ebur128 et `hyperframes audio`). mix-v1 et le film intacts. Planche : `qa/snapshots/son/calage.png`.
**À écouter :** 31,5–34,5 s (pré-drop, déclic, possible bégaiement 33,40–33,47) ; 31,69 (arrêt net du charleston) ; 50,5–55 s (entrée du pont, retour du grave à 54,51, creux à −17 LUFS) ; 57,5–60 et 5,3–5,6 s (attaques sans micro-fondu) ; 19,87 s (clac encore raboté) ; ambiances sous les drops. Licence de synchronisation de STORM II à obtenir avant diffusion.

## Journal

### 1. Tempo et grille (mesuré, non écouté)
Commande : `python3 tools/audio/audit-calage.py --json qa/tmp/audit-calage.json` (flux spectral log, fenêtre 1024 à 22 050 Hz, pas 11,6 ms ; attaques = maxima locaux > 1,5 × médiane glissante).
- `beats.json` : 380 temps, intervalle médian 440 ms (136,4 BPM), mais **quantifié par pas de 10 ms** : intervalles de 340 à 560 ms. Entre deux premiers temps : drop 1 (71,495 → 99,565) = 64 temps en 28,070 s = **136,8 BPM** ; drop 2 (127,545 → 155,555) = 64 temps en 28,010 s = **137,1 BPM**. Le 136,9 BPM annoncé est juste, chaque temps du fichier porte une gigue de ±10 à 20 ms (≈ 1 image).
- Attaques indépendantes du MP3 : 1 416 attaques. **97,4 % des 380 temps ont une attaque à ±60 ms** ; l'attaque précède le temps de 21 ms en médiane (1,3 image), 90 % à moins de 44 ms. En grave seul (30–150 Hz, grosse caisse) : 54 % des temps ont une attaque, écart médian **−6,5 ms (0,4 image)**. Les temps tombent sur les vraies frappes.
- Premiers temps de mesure (`indice % 4 == 3`) : les débuts de section repérés par l'énergie (71,495 drop 1, 113,55 reprise, 127,545 drop 2, 155,555 outro) tombent tous sur des indices `% 4 == 3` (163, 291, 355…) et sur des multiples de 8 mesures depuis 71,495 : la phase de mesure est la bonne.
- Montage (temps du film) : écart médian grosse caisse / grille projetée par segment : +10, +2, −0,5, +13, −11,6, 0 ms. Tous < 1 image ; **aucun demi-temps décalé** (un décalage d'un demi-temps ferait ±219 ms). Intervalles entre temps de part et d'autre des 5 raccords : 410 à 490 ms (même gigue de quantification qu'ailleurs, pas de temps raté ni ajouté).
- Verdict 1 : **grille juste**, tempo juste, phase de mesure juste, aucun raccord ne casse la grille.

### 2. Bonne partie, vrais drops (mesuré, non écouté)
Commandes : `python3 tools/audio/audit-calage.py` (énergie par mesure sur tout le morceau, bandes 30–150 Hz et 4–11 kHz) et `python3 tools/audio/audit-raccords.py` (énergie temps par temps, chroma, tonalité ; sortie dans `qa/tmp/audit-raccords.txt`). Spectrogramme du morceau entier regardé.
- Structure réelle (mesures de 4 temps, indice de la mesure : début) : intro et longue montée m0–m39 (1,4–71,5 s, grave quasi absent jusqu'à m29) ; **drop 1 m40–m55** (71,495–99,565) ; **pont sans grave m56–m63** (99,565–113,545) ; **reprise m64–m71 : grave plein mais sans charleston** (aigu −10 à −25 dB sous le drop), avec une respiration (charleston coupé, m71 temps 1–2) puis un roulement (m71 temps 3–4, aigu +20 dB) ; **drop 2 m72–m87** (127,545–155,555) ; outro m88+ (grave −45 dB).
- **Drop 1 à 5,41 s : vrai drop.** Temps par temps : grave 26–28 dB jusqu'à 70,2 s, montée sur les deux derniers temps (40,6 puis 49,7), puis **52,9 dB au premier temps de m40 (71,495)** ; niveau global +5,5 dB sur la mesure. Image 325 = premier temps exact (attaque grave mesurée 28 ms avant, comme partout dans le morceau).
- **Drop 2 du morceau (127,545) : vrai drop**, mais doux en niveau : +2,3 dB, grave +5 dB, surtout le retour du charleston (aigu 16 → 40 dB) après la respiration et le roulement de m71.
- **33,48 s (image 2009) : PAS un drop entendu.** Le montage passe du dernier temps de drop 1 (m55) à la 9e mesure du drop 2 (m80), à pleine énergie des deux côtés : +1,3 dB par mesure, +0,8 LU en court terme, aucune respiration avant. L'harmonie est compatible (cosinus de chroma 0,67, la suite naturelle du morceau fait 0,69). C'est une relance, pas un drop, alors que l'image change d'acte (entrée du coureur).
- **47,47 s (outro) et 58,00 s (impact) ne sont pas des collages** : le montage v1 lit le morceau en continu (155,555 suit 155,555 ; 127,545 suit 127,545), comme à 5,41 s. Le « saut » de 47,47 (−10 dB, grave −26 dB) est la vraie fin du drop 2 dans le morceau. Seuls 33,48 et 51,00 sont de vrais collages. Mais `MUSIQUE.md` y met quand même deux micro-fondus de 5 ms : creux mesurés de −2,8 dB (5,41), −3,9 dB (47,47) et −5,1 dB (58,00) sur 10 ms, **juste sur l'attaque du drop 1 et de l'impact final**. Inutiles.
- **51,00 s : « montée » mal nommée.** La section 120,545–127,545 (m68–m71) n'est pas une montée : grave au niveau du drop (53–54 dB), niveau plat (55,1 → 54,8 → 53,5 → 52,4 dB par mesure, il **baisse**). Au raccord, l'outro (44,5 dB, grave 5 dB) passe d'un coup au grave plein : **+10,5 dB, grave +48 dB** en 5 ms. L'image, elle, monte de 51 à 58 (publication → drone qui s'élève → Noah → remontée → orbite → logo) ; la musique fait l'inverse : un mur à 51 s, puis un plateau qui s'affaisse.
- **Impact final 58,00 s : vrai drop du morceau** (premier temps de m72 après la respiration et le roulement de m71), et P53 (image 3376) tombe exactement sur le début de m71 : la respiration accompagne l'orbite, le roulement précède le logo. Bon calage.

### 3. Moments forts de l'image (mesuré, non écouté)
Commande : `python3 tools/audio/audit-planche.py --json qa/tmp/audit-moments.json` (ebur128 de FFmpeg 6.1.1 ; M = momentané 400 ms, S = court terme 3 s, ΔM = M(+0,5 s) − M(−0,5 s), sur le lit seul).
- De 5,4 à 47,5 s la musique est un mur continu (lit M −5,6 à −9 LUFS, ΔM entre −2 et +2 LU sur tous les plans) : P08 œil, P17 « Commander », P20 clac, P26 Seceda ★, P27 Tre Cime ★, P34, P38 Tofana ★, P40–P43 ★, P44 ne reçoivent **rien de la musique** ; seuls les effets les marquent. Ce n'est pas un défaut de calage (les coupes sont sur les temps) mais c'est la nature des 16 mesures de drop.
- Image qui monte, musique qui ne suit pas : **P33 drop 2 (33,48 s)** en v1 : mix −14,7 / −13,8 / −11,9 LUFS (M moyen sur P31 / P32 / P33) : la marche de +2 LU vient surtout du whoosh et du crash. **P52 remontée → P54 logo** en v1 : après le mur de 51 s (−14,0), le mix retombe (−15,9 sur P50–P51) puis reste à −14,6 / −13,7 / −12,5 : 1,5 LU de montée seulement sur la plus grande montée de l'image.
- Image qui retombe, musique qui suit : P46 bivouac (47,47 s) −10,6 LU, juste ; P53 orbite tombe sur la respiration de m71, juste.
- Image calme, musique qui frappe : **P49 « Elle publie » (51,00 s)**, gros plan d'un pouce sur un téléphone la nuit, reçoit en v1 le retour du grave plein (+7,2 LU au lit), puis P50 ★ (bivouac minuscule sous la Voie lactée) et P51 (bus de nuit) restent à pleine basse.

### 4. Raccords (mesuré, non écouté)
- 5,41 / 47,47 / 58,00 : continus dans le morceau (voir 2). Les micro-fondus de v1 y retirent l'attaque : RMS sur 10 ms centrées sur le raccord −11,7 dB en v1 contre −4,9 dB sans fondu (5,41, attaque du drop 1) ; −15,4 contre −10,8 (58,00, attaque du logo) ; −24,2 contre −17,8 (47,47).
- 33,48 (vrai collage) : grille juste, harmonie compatible (0,67 contre 0,69 pour la suite naturelle), +0,8 LU. En v1 le segment se finit à 99,565, soit 16 ms **après** l'attaque du pont (99,549) : un bout d'attaque du pont passe juste avant le coup du drop 2, lui-même entamé de 10 ms (attaque à 141,555, segment ouvert à 141,565). Mesuré au pas de 2,9 ms (`audit-raccords.py`, fin de sortie).
- 51,00 (vrai collage) : harmonie compatible (0,77 ; outro en ré mineur, reprise compatible), mais saut de niveau +10,5 dB et grave +48 dB en 5 ms, et le coup grave de la reprise (120,535) entamé de 10 ms. Le « risque de s'entendre » de `check-joins` est confirmé côté niveau et timbre, pas côté hauteur.
- Phase de mesure : les deux vrais collages sont sur des premiers temps et sur des frontières de phrase (m80 = 9e mesure du drop 2, m68 = 5e de la reprise).

### 5. Effets (mesuré, non écouté)
- 36 effets en v1, chacun avec sa cause écrite à l'image (`tools/audio/sfx-cues.json`), pic à image + 1 (0,00 image d'écart). Densité : 31 ponctuels en 60 s, un toutes les 1,9 s ; aucun plan à effet n'est sans cause.
- Les effets n'écrasent pas la musique : le mix est 8,4 dB sous le lit et le court terme ne gagne pas plus de 1 LU aux effets. Les pics momentanés des whooshes et crashs montent à −9 LUFS (5 LU au-dessus du lit) : bien visibles.
- **C'est l'inverse : le limiteur écrase les transitoires les plus importants.** Réduction de gain sur 50 ms autour du pic (`qa/tmp/mix-report.json`) : clac P20 −6,3 dB (net −1,3 dB au-dessus du lit au lieu de +5), déclic P31 −4,3 (net −1,3), gravillons P41 −4,0 (net 0), P34 −3,1 (net +2), riser + impact du logo −3,7 (net +1,8).
- Ambiances (pluie P06–P07, rails P22, vent P26 et P38) posées 8 à 10 dB sous un lit de drop plein : probablement masquées. Le feu (P47–P48) tombe sur l'outro calme : c'est la seule ambiance qui a une chance d'être entendue.

## Corrections : montage v2 et `qa/mix-v2.wav` (mix-v1 intact)
Commande unique : `node tools/audio/build-all.mjs --v2` (montage `--v2` de `build-montage.mjs`, segments dans `MONTAGE_V2_SEGMENTS` de `tools/audio/lib.mjs` ; effets `tools/audio/sfx-cues-v2.json` via la nouvelle option `--cues` de `build-sfx.mjs` ; mix `build-mix.mjs --v2`). Aucune coupe image déplacée. Aucun nouveau fichier d'effet (donc rien à ajouter à `assets/audio/sfx/SOURCES.md`).

| Film (s) | v1 | v2 | Pourquoi |
|---|---|---|---|
| 0–31,69 | montée + drop 1 m40–m55, micro-fondu à 5,41 | même musique, **sans** collage à 5,41 | rend l'attaque du drop 1 (+6,8 dB sur 10 ms) |
| 31,69–33,48 (P31–P32) | m55, fin du drop 1 | **m71 du morceau : respiration (charleston coupé) puis roulement** | un vrai pré-drop avant l'entrée du coureur ; le déclic photo de P31 tombe dans la respiration |
| 33,48–51,00 | drop 2 m80–m87 + outro, micro-fondu à 47,47 | même musique, **sans** collage à 47,47 | la fin du drop 2 est celle du morceau |
| 51,00–54,51 (P49–P51) | reprise m68–m69, grave plein | **fin du pont m62–m63 (mélodie, grave qui monte)** | la publication et le bivouac ★ restent intimes ; outro → pont : harmonie 0,88 (v1 0,77), +6,6 dB au lieu de +10,5 |
| 54,51–60 (P52–P54) | m70–m71 + drop 2, micro-fondu à 58,00 | m70–m71 + drop 2, **sans** collage à 58,00 | le grave revient avec la remontée (P52), le drop 2 du morceau sur le logo |

- Collages : 4 vrais collages (31,69 / 33,48 / 51,00 / 54,51), tous sur une coupe image et un premier temps, en fondu enchaîné quart de sinus de 12 ms fini au moins 15 ms avant l'attaque grave suivante (plus aucune attaque entamée). Attaques graves mesurées dans le montage v2 : 31,681 (image 1901 = 31,683), 33,470 (2009 = 33,483), 50,990 (3060), 54,492 (3271 = 54,517), 57,978 (3480) : identiques à v1 aux repères 2009, 3060, 3271, 3480, à 0,1 image de l'image 1901.
- Le morceau ne laisse que 1,734 s entre l'attaque de m71 et celle du drop, l'image en laisse 1,787 (P31 → P33) : les 53 ms d'écart passent dans une entrée en fondu de 45 ms sur la fin de m79 (le petit creux naturel du morceau avant m80). À écouter.
- Coupes / temps (`beats.json`, mêmes règles que `cut-beat-table.mjs`) : v2 écart moyen 0,28 image, maximum 0,9 image (P31) ; v1 0,42 et 0,4.
- Effets v2 : 35 (le crash de masquage de 51,00 s est retiré, le whoosh de la publication reste). Retrait bref du lit (`duckDb`, 40 ms avant à 100 ms après le pic) sous le clac P20 (4 dB), le déclic P31, l'impact P34 et les gravillons P41 (3 dB). Net au-dessus du lit après limiteur (`qa/tmp/mix-report-v2.json`) : déclic −1,3 → **+2,8 dB**, gravillons 0,0 → **+3,2**, P34 +2,0 → **+5,1** ; **clac P20 reste à +0,6** (le fichier Kenney a un facteur de crête trop fort : c'est le clac lui-même que le limiteur rabote, −8,4 dB) ; logo +1,4.

### Mesures de `qa/mix-v2.wav` (FFmpeg 6.1.1-3ubuntu5)
- `ffprobe` : pcm_s24le, 48 000 Hz, 2 880 000 échantillons = **60,000000 s**.
- `ffmpeg -i qa/mix-v2.wav -filter_complex ebur128=peak=true -f null -` : **−14,0 LUFS intégrés**, LRA 4,9 LU (v1 : 3,3), crête vraie **−1,3 dBTP** (rapport de `build-mix`).
- `npx hyperframes audio qa/mix-v2.wav --json --only loudness` : −14 LUFS, crête vraie −1,3 dBTP, crête échantillon −1,4 dB, court terme maximum −12,1, 0 écrêtage.
- Forme (M moyen du mix, LUFS) v1 → v2 : P31 −14,7 → **−17,3** ; P32 −13,8 → −13,3 ; P33 −11,9 → −11,6 (le drop 2 sort maintenant d'un creux de 5,7 LU au lieu de 2,8) ; P49–P50 −14,0 → **−16,7** ; P50–P51 −15,9 → **−17,8** ; P52 −14,6 → −14,5 ; P53 −13,7 → −13,5 ; P54 −12,5 → −12,2. En v2 la fin monte sans retomber de 51 à 59 s (−16,7, −17,8, −14,5, −13,5, −12,2) ; en v1 elle frappait à 51 s puis faisait un plateau.
- Planche : `qa/snapshots/son/calage.png` (214 Ko, regardée) : volume momentané v1/v2 sur 60 s, 54 coupes, 5 repères, moments forts, collages v2 en tirets, spectrogrammes ±1,2 s autour des 7 instants (v1 en haut, v2 en bas).
- Le lit v2 est identique à v1 hors des deux passages changés : écart résiduel = décalage de 11,3 µs (un demi-échantillon à 44,1 kHz, rééchantillonnage avant la découpe au lieu d'après), −37 dB sous 500 Hz, inaudible.

Non fait, volontairement : `qa/mix-v1.wav`, `film/assets/audio/mix-v1.wav`, `film/index.html` et `MUSIQUE.md` sont intacts. Brancher v2 dans le film et réécrire le tableau de `MUSIQUE.md` attend l'écoute de Tony. **La licence de synchronisation de STORM II reste à obtenir avant toute diffusion publique.**

## À écouter (Tony), v1 puis v2 au même endroit
1. **31,5–34,5 s** (P31 → P33) : la respiration puis le roulement font-ils un vrai drop à 33,48 s ? Le déclic photo (32,13 s) s'entend-il ? À 33,40–33,47 s, l'entrée en fondu sur la fin de m79 s'entend-elle comme un bégaiement avant le drop ?
2. **31,69 s** : la coupe drop 1 → respiration est-elle franche ou brutale (le charleston s'arrête net, voulu) ?
3. **50,5–55 s** : outro → fin du pont à 51,00 (publication) : la mélodie entre-t-elle sans heurt ? Le retour du grave à 54,51 (remontée) est-il un vrai élan ? Le passage 51–54,5 (−17 LUFS) est-il trop creux juste après l'outro (−21) ?
4. **57,5–60 s** : impact du logo et fondu de sortie de 0,8 s (inchangés), plus franc sans le micro-fondu ?
5. **5,3–5,6 s** : attaque du drop 1, plus pleine sans le micro-fondu ?
6. **19,87 s** (clac P20) : encore trop raboté par le limiteur (+0,6 dB net) ; remplacer la prise Kenney si on ne l'entend pas.
7. Ambiances pluie (5,5–8 s), rails (21,2–22 s), vent (25–27 s, 38,3–39,6 s) : audibles sous le drop ou à retirer ?
