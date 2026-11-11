# REVIEW P1 — Animatique (carte des temps) · qa-critic

Date : 2026-11-11. Relecteur indépendant, rejet par défaut. Aucun rendu ni snapshot lancé ; revue sur documents, sur `qa/contact-sheet-P1-animatic.png`, sur `ffprobe` des deux MP4 de `qa/tmp/p1/` et sur des mesures du WAV et de ses stems (ffmpeg `silencedetect`, `ebur128`, enveloppes à 5 ms en numpy).

Pièces lues en entier : `storyboard/LKDV — Trailer 60 s.md` (474 lignes), `CLAUDE.md`, `.claude/agents/qa-critic.md`, `BEATMAP.md`, `tools/beatmap.mjs`, `tools/gen-animatic.mjs`, `audio/MIX.md`, `index.html`, `animatic/index.html` (diff), `ASSETS.md`, `assets/brand/logo-mark.svg`, `assets/brand/lkdv-badge-1024.png`.

## 1. Verdict global : **REJETÉ**

La carte des temps est soignée sur les chocs, les silences, les changements d'acte et les durées du logo, et la maquette sonore tombe à l'échantillon près là où elle le dit. Mais la porte P1 n'est pas franchie :

- l'animatique ne contient **ni pictos ni boîtes d'interface** : la porte « rythme et lisibilité sans texte » (CLAUDE.md §6.2, storyboard §6 « Méthode ») ne peut pas être jugée, car le seul contenu lisible est du texte ;
- deux raccords sont **inconstructibles ou contradictoires** tels qu'écrits (0:51→0:52 badge ; 56,0–57,0) ;
- la rafale 0:41 est **hors de la grille du storyboard**, contredite par MIX.md, et présente un risque de flash ;
- une dizaine de changements de plan n'ont **aucune transition prévue**, donc des coupes franches non voulues par défaut.

## 2. Verdict par acte (sur la carte des temps)

| Acte | Verdict | Raison principale |
| --- | --- | --- |
| 1. Ouverture 0:00–0:06 | ACCEPTÉ (rythme) | Marqueurs 0,75 / 1,5 / 2,25 / 3,0 / 5,5 sur la grille ; signature mesurée à 3,000 / 3,500 / 3,750 s (±5 ms) ; lignes conformes au storyboard. Réserves : n° 9, 14, 21, 26. |
| 2. Descente 0:06–0:12 | ACCEPTÉ (rythme) | Choc 1 au pic à 6,002 s, silence 11,500–12,000 en zéro numérique. Réserves : exception du réticule (n° 12), montgolfière peinte deux fois (n° 17), raccord 10,9–11,1 hors grille (n° 22). |
| 3. Le groupe 0:12–0:24 | REJETÉ | Logo de la crête sous le voile qui se déchire (n° 8), fenêtres des logos non fixées (n° 7), son et image de 0:19–0:20 désaccordés (n° 11), 0:15 surchargé (n° 16), raccord étiquette → anneau absent (n° 6). |
| 4. Confiance et terrain 0:24–0:30 | REJETÉ | Quatre coupes franches non prévues à 26,0 / 27,0 / 28,0 / 29,0 (n° 5), 0:25 porte cinq idées (n° 16), plan de 0:27 non choisi (n° 24). |
| 5. Le relais 0:30–0:44 | REJETÉ | Rafale (n° 3), raccords des trois plongées absents (n° 6), coupes non prévues 37 / 38 / 39 / 43 (n° 5), plan « vue du ciel » 0:38 inexistant (n° 18), 0:40 surchargé (n° 16). |
| 6. Retour et envol 0:44–0:52 | REJETÉ | 0:45 impossible tel qu'écrit (logo 1 s sur la couverture **et** dos du carnet dans la même seconde, n° 10) ; tutti à 48,0 au lieu de 49 (n° 20). |
| 7. Signature 0:52–1:00 | REJETÉ | Raccord 0:51→0:52 inconstructible avec le badge réel (n° 2), contradiction 56,0–57,0 (n° 4), signature de 0:52 masquée (n° 13). |

## 3. Écarts numérotés

Gravité : **B** = bloquant (porte P1), **M** = majeur (à corriger avant de construire la scène), **m** = mineur.

### Bloquants

**1. [B] Toute la durée — l'animatique ne montre ni pictos ni boîtes d'interface.**
Preuves : `grep -o 'icons/…' compositions/*.html` ne renvoie rien ; les hôtes `ui-a1`…`ui-a7` sont des étiquettes « UI-Ax · PLACEHOLDER » (gen-animatic.mjs l. 69–97). Sur la planche, 0:00–0:10,5, 0:47,5–0:54 et 0:58,5–1:00 sont un cadre encre vide (18,5 s, soit 31 % du film) : `cosmos.html` monte le vrai canvas, qui ne peint rien ; le reste est un aplat gris uni. Le seul élément lisible est la carte de texte en bas (« idée de la seconde »). CLAUDE.md §6.2 exige « boîtes grises, pictos principaux » et un jugement « sur le rythme et la lisibilité sans texte ». Ici, on ne peut juger que le texte.
Correctif : générer depuis `beatmap.mjs` une couche « silhouette » par seconde : une boîte grise par élément d'interface, à sa place réelle (centre 608 × 1080), avec son picto `assets/icons/sf` ou `extra`, son entrée et sa sortie sur la grille. Ajouter une boîte « cosmos » grise étiquetée par état (nébuleuse, disque, Terre, voile, orbite, logo), et une silhouette du logo aux 9 fenêtres. Refaire la planche **sans** la carte de texte : c'est elle qu'on juge.

**2. [B] 0:51,0–0:52,0 (raccord `cosmos` → `ui-a7`) — le badge réel ne contient pas les montagnes du logo.**
Le raccord (BEATMAP l. 139) pose les montagnes de `logo-mark.svg` au centre (960, 520), 420 px, et demande à `ui-a7` de « faire naître le badge autour de cette boîte ». Or `lkdv-badge-1024.png` a en son centre le lettrage « LKDV », un massif photoréaliste en haut et un petit emblème de montagnes en bas, au-dessus de « TON PROCHAIN VOYAGE COMMENCE ICI ». Aucune forme à cet endroit ne reçoit le tracé. De plus, le PNG est en RGB sans alpha, avec des coins noirs purs.
Correctif : décider de l'accroche avant P2. Soit (a) le tracé se pose exactement sur le petit emblème du badge (mesurer sa boîte dans le PNG, l'écrire dans `LKDV.LOGO_MARK`) pendant que le cercle s'ouvre autour ; soit (b) le tracé se résout dans la ligne de crête du massif du haut. Préciser qui peint les montagnes après 52,00 : un seul calque, pas le trait de `cosmos` par-dessus le badge. Garder le masque circulaire.

**3. [B] 0:41,0–0:42,0 — rafale à 0,125 s par plan : hors de la grille du storyboard, contredite par le son, risque de flash.**
- Grille : le storyboard l. 53 dit « chaque apparition tombe sur un temps **ou une croche (0,25 s)** ». La double-croche n'y est permise qu'à 0:05 (l. 254) et pour le clavier. 41,125 / 41,375 / 41,625 / 41,875 sont hors grille. À 60 i/s, 7,5 images par plan donnent une alternance 7/8 images, irrégulière ; dans le brouillon à 30 i/s, 3,75 images par plan, donc l'animatique P1 ne peut même pas montrer ce choix.
- Son : MIX.md l. 158 pose « un coup sec + whoosh par plan » à 41,0 / 41,5 / 42,0 / 42,5. Mesuré dans `stem_sfx` : 4 transitoires exactement à ces temps, **aucun** à 41,125, 41,25, etc. BEATMAP l. 109 dit « un coup par double-croche ». Les deux sources se contredisent.
- Storyboard l. 312 : « un seul picto par plan ». BEATMAP met « — » à 0:41 : les pictos de la rafale ont disparu.
- Lisibilité : en 125 ms, on saisit l'essentiel d'une scène (« un paysage »), pas le lieu. Sahara, Atacama et Antelope seront indiscernables. L'idée « le monde entier » passe ; la règle « saisie en 0,4 s » ne passe pour aucun plan.
- Sécurité : 8 changements plein cadre par seconde entre des luminances très différentes (Uyuni blanc, Antelope sombre, Raja Ampat saturé) dépassent la limite de 3 flashs par seconde (WCAG 2.3.1, test de Harding).
Correctif (au choix de l'utilisateur, à trancher avant de construire) :
(a) **Préféré** : garder 8 plans en 1 s comme **exception validée par l'utilisateur**, mais en raccords de forme et non en coupes sèches. Un seul horizon, à hauteur constante, traverse les 8 plans, et la ligne sage continue de l'un à l'autre. Ordonner les plans par luminance et teinte (Sahara → Antelope → Atacama → Népal → Uyuni → Baïkal → Raja Ampat → Amazonie) pour lisser les sauts. Recadrer chaque double-croche sur le roulement de caisse claire déjà présent dans `stem_music` (41–43). Mettre MIX.md à 8 coups. Contrôle de flash obligatoire en P5.
(b) **Sur la grille** : 4 plans à la croche à 0:41 (par ex. Sahara, Uyuni, Raja Ampat, Népal), chacun avec son picto ; les 4 autres sortent du film. Cela demande l'accord de l'utilisateur, puisqu'il a fixé « plans 11 à 18 ».
Dans les deux cas : réécrire BEATMAP 0:41 et MIX.md ensemble.

### Majeurs

**4. [M] 56,0–57,0 — contradiction entre la ligne 0:54 et le raccord.**
BEATMAP l. 122 : `gnd-finale` peint le fond encre de 54,0 à **56,5**. Raccord l. 141 : `gnd-finale` « tient le plan plein cadre dessous » pendant que la photo de la carte grandit jusqu'à couvrir le cadre à **57,0**. De 56,5 à 57,0, le plan 21 en plein cadre apparaît donc autour de la carte qui n'a pas fini de grandir : l'image est en double, et le raccord se voit.
Correctif : fond encre jusqu'à 57,0 exactement, plan 21 seulement à partir de 57,0 (même cadrage que la photo de la carte) ; ou la carte couvre le cadre à 56,5. Écrire une seule valeur dans les deux lignes.

**5. [M] 24,0 · 26,0 · 27,0 · 28,0 · 29,0 · 37,0 · 38,0 · 39,0 · 43,0 — changements de plan sans transition, donc coupes franches non prévues.**
Le storyboard (l. 62, 65) n'autorise que le balayage filé, la traversée de matière et le raccord de forme, et limite les coupes franches à la rafale et au noir du bouton. BEATMAP change de plan à ces temps sans rien dire : 03 flou → 04 port (24,0), 04 → 03 intérieur (26,0), 03 → « 03 / 06 » (27,0), → 05 (28,0), 05 → 06 (29,0), 09 large → 09 serré (37,0), → vue du ciel (38,0), → 09 (39,0), 20 sentier → 07 feu de camp (43,0). La table des raccords ne couvre que les changements de fichier.
Correctif : ajouter à `beatmap.mjs` un champ `cut` par seconde (`swipe`, `matter`, `shape`, `hard-voulu`) et décrire l'état de part et d'autre. Pistes : 24,0 l'anneau plein cadre sert de traversée de matière vers le port ; 26,0 et 28,0 balayages filés ; 29,0 raccord de forme par la route redessinée ; 37,0 coupe sur le silence, à déclarer **voulue** et à faire valider (storyboard l. 308 : « Silence d'un demi-temps. Plan serré ») ; 38,0 raccord d'échelle (la caméra monte jusqu'à la vue du ciel) ; 43,0 balayage depuis le sentier vers le feu.

**6. [M] Raccords entre fichiers manquants (interface ↔ sol).**
La table l. 133–142 ignore tous les passages où une forme change de calque :
- 14,0 : cercle vide (`ui-a3`) → bouteille sur l'océan (`gnd-iceland`) ;
- 15,0–15,5 : bulle → balayage filé vers le plan 03 ;
- 23,0 : étiquette de la tente, peinte sur le plan 03 (`gnd-iceland`) → anneau (`ui-a3`) ;
- 31,0–32,5 : photo du plan 08 dans la carte du fil (`ui-a5`) → réfraction → plan 08 plein cadre (`gnd-relay`) : **plongée 1** ;
- 35,75–36,25 : bulle (`ui-a5`) → téléphone de Tom sur le plan 09 : **plongée 2** ;
- 39,75–40,25 : carte du club → plan 10 : **plongée 3** ;
- 45,0–46,0 : carnet (`ui-a6`) ↔ plan 04 (`gnd-return`).
Ce sont les trois plongées, la colonne vertébrale du relais (storyboard l. 77).
Correctif : une ligne de raccord par passage, avec position, taille et rayon de la vignette au départ, plan cible et cadrage à l'arrivée, durée exacte (plongée 1 : 0,5 s ; plongées 2 et 3 : 0,25 s), et le calque qui porte la réfraction.

**7. [M] Logos fondus — durées justes, fenêtres non fixées.**
Les 9 apparitions et leurs durées sont conformes à la table du storyboard (l. 20–30) :

| Temps | Durée |
| --- | --- |
| 0:03 | 0,75 s |
| 0:12 | 0,5 s |
| 0:14 | 0,5 s |
| 0:25 | 0,5 s |
| 0:35 | 0,75 s |
| 0:38 | 0,5 s |
| 0:45 | 1 s |
| 0:51 | 1 s |
| 0:52 | 2 s |

Mais seules 0:03 (3,00–3,75), 0:45, 0:51 et 0:52 ont un début et une fin. Pour 0:12, 0:14, 0:25, 0:35 et 0:38, rien ne dit si le logo occupe la première ou la seconde moitié de la seconde. Or ces fenêtres entrent en collision avec d'autres événements (n° 8, n° 16).
Correctif proposé :
- 0:12 → 12,25–12,75 (n° 8) ;
- 0:14 → 14,25–14,75, le reflet passe après la plongée dans le cercle ;
- 0:25 → 25,0–25,5, avant les barres ;
- 0:35 → 35,0–35,75, la bulle part à 35,75 ;
- 0:38 → 38,0–38,5, sans interface au-dessus ; « 8,0 km », la barre et « +40 » entre 38,5 et 39,0.

**8. [M] 0:12,0–0:12,5 — le logo de la crête est caché par le voile.**
`cosmos` (z 20) est **au-dessus** de `gnd-iceland` (z 10), et le raccord l. 134 déchire le voile « du centre vers les bords » de 12,0 à 12,5. Une crête est en haut du cadre, donc découverte en dernier. Un logo de 0,5 s pendant 12,0–12,5 serait à moitié sous le voile.
Correctif : fenêtre 12,25–12,75, et une déchirure qui découvre d'abord la zone de la crête. L'écrire dans le raccord.

**9. [M] 0:03, 0:12, 0:35, 0:38, 0:51 — le tracé réel a deux sommets, pas trois.**
`logo-mark.svg` : `M2 24 L10 10 L14 16 L20 6 L30 24 Z`, soit deux maxima, (10,10) et (20,6), une base et le point-soleil (24,9). BEATMAP l. 71 (« aurore sage = 3 montagnes ») et le storyboard (l. 252, 273 : « la crête a trois sommets ») décrivent une forme que le vrai logo n'a pas. CLAUDE.md impose le vrai design system.
Correctif : réécrire « deux sommets, base, soleil à droite du plus haut ». Les plans 02 et 08, encore « à créer », doivent être générés avec un profil de crête compatible : le mettre dans leur cahier des charges (ASSETS.md) avant la génération.

**10. [M] 0:45 — irréalisable tel qu'écrit.**
« Le carnet terminé se referme : couverture Paper, logo en creux 1 s » **et** « au dos : île, 1 322 km, grille des 38 objets », plus le silence à 45,5. Si le logo est tenu 1 s sur la couverture, on ne voit jamais le dos. S'ajoute la « photo du groupe de dos face à l'océan » (storyboard l. 321), omise par BEATMAP.
Correctif, une seule idée : la couverture se referme à 45,0 et le logo en creux est tenu 45,0–46,0. Le contenu du dos se résume à une tranche aux 4 couleurs de la grille (pas d'île ni de « 1 322 km »), ou il est supprimé. La photo du groupe devient l'image de couverture.

**11. [M] 0:19–0:20 — le son ne suit pas l'image.**
BEATMAP : 0:19 = sage seul, 0:20 = **trois** vagues (ambre, bleu, Stone). MIX.md l. 94 : 0:19 = « pops 1 par couleur » à 19,00 / 19,25 / 19,50 / 19,75 (4 couleurs) ; l. 98 : 0:20 = « 4 vagues de 3 ». Les pops sont le signal de synchro des vagues : tels quels, ils annoncent quatre couleurs à 0:19.
Correctif : 0:19 = pops de la vague sage seule (sur les croches 19,0–19,75) ; 0:20 = 3 vagues, à 20,0 (ambre), 20,25 (bleu) et 20,5 (Stone), chacune sur une croche, puis 20,75 libre.

**12. [M] Règle « aucun élément d'interface > 1,5 s » invérifiable, et violée par endroits.**
BEATMAP ne donne ni entrée ni sortie pour les éléments. D'après la table :
- réticule, altimètre et pile de pictos de 6,0 à 11,5 (5,5 s ; prévu par le storyboard l. 262–267) ;
- barre de saisie de 4,0 à environ 6,0 (2 s) ;
- grille 38 objets et compteur « x / 38 » de 18,0 à 22,0 (≥ 3 s) ;
- widget de course de Tom (picto course, distance, pause/lecture) de 36,0 à 39,0 (3 s) ;
- carnet → carte du fil de 30,0 à 32,0 (2 s) ;
- anneau de 23,0 à 25,0 (2 s).
Correctif : ajouter `in`/`out` par élément dans `beatmap.mjs`. Déclarer explicitement le réticule comme « caméra » (seul élément inventé, storyboard l. 190) **ou** comme exception à faire valider. Pour les autres, une transformation visible au plus tard toutes les 1,5 s (la grille change d'état chaque seconde : à écrire) ; masquer le compteur « x / 38 » après 1 s.

**13. [M] 0:52 — la signature sonore n'émerge pas.**
Mesuré dans `stem_music` : attaques à 3,000 / 3,500 / 3,750 nettes (+10 à +13 dB sur le fond) ; à 52,000 environ +5 dB, mais à 52,500 et 52,750 seulement +1 à +3 dB sur l'accord de Dm, les cordes et le sub. Les notes 2 et 3 se perdent. Le storyboard (l. 333) veut « les 3 notes », identiques à 0:03.
Correctif : cordes et sub entrent à 53,0 avec le « dernier accord » (ou −10 dB sous la signature) ; piano seul de 52,0 à 53,0.

**14. [M] Toutes les scènes au sol — gestes promis, plans fixes prévus.**
ASSETS.md liste 21 plans `.png` (fixes, « à créer »). Le storyboard exige des gestes : porte du van, Marc tend la housse (0:25), pouce qui s'arrête (0:31), bras qui s'ouvrent (0:35), Tom se lève (0:37), foulées (0:38), peloton (0:40), Inès lève les yeux (0:43), accolade (0:44), pouce sur le cercle (0:56). S'y ajoutent les rampes de vitesse 150 % → 40–60 % → 150 % (l. 61) et la règle « aucune image figée ». BEATMAP ne dit pas comment un PNG fait un geste.
Correctif avant P2 : pour chaque seconde au sol, écrire la source du mouvement : calques détourés en 2,5D avec parallaxe, personnage sur calque séparé déformé, particules, caméra. Les gestes impossibles deviennent « pose déjà atteinte + mouvement de caméra », et cela doit être écrit, pas découvert au rendu.

**15. [M] Son — sons réels et rires absents.**
Storyboard l. 44 et 136 : « sons réels de chaque lieu ». Colonne Son : 0:40 « rires » ; colonne Image : 0:22 et 0:44, rires. MIX.md l. 24 et 27 : rires non synthétisés, ambiances en bruit filtré. La décision « partition synthétisée originale, aucune ressource tierce » n'interdit pas des prises de son faites par l'équipe.
Correctif : demander à l'utilisateur, en une question groupée, si des bruitages enregistrés par l'équipe (rires, pas, feu, vagues) sont admis. Sinon, consigner l'écart comme définitif dans `qa/REVIEW.md`.

**16. [M] Secondes trop chargées (faisabilité, une idée par seconde).**
Simplifications à décider avant de construire :
- **0:15** : quatre actions (la bouteille part, mini-globe de centaines de points, la bulle revient, balayage vers les quatre dans le van) plus l'îlot H. Supprimer le mini-globe : la bouteille part à 15,0, la bulle remplit le cercle à 15,5, balayage à 15,75.
- **0:25** : remise de la tente, étiquette au logo, téléphones qui se touchent, double coche, 4 barres, « +25 ». Logo de 25,0 à 25,5 ; à 25,5, double coche et **une seule** barre (poignée de main) avec « +25 » ; les 3 autres barres ne s'affichent pas.
- **0:40** : plongée 3, peloton, 12 avatars cochés, « 42 km », barre, « +60 ». Garder peloton et barre « +60 » ; retirer « 42 km » ou les 12 coches.
- **0:44** : remise, accolade, deux téléphones (omis par BEATMAP), double coche, anneau 88 → 91. Une idée : l'accolade, avec l'anneau 88 → 91 sur la croche 44,5.
- **0:29** : nouvel itinéraire, time-lapse et arrivée sur la plage. Itinéraire de 29,0 à 29,5, time-lapse de 29,5 à 30,0, à écrire avec ces bornes.

### Mineurs

**17. [m] 0:10–0:11 — la montgolfière est peinte deux fois** : par `cosmos` (« montgolfière Forest et Paper », l. 78) et par le plan 01 (« mer de nuages et montgolfières »). Un seul propriétaire, l'autre ne la dessine pas.

**18. [m] 0:38 — plan « 09 vue du ciel » absent du jeu v3** (ASSETS l. 59 : « à créer »). Pareil pour l'océan de la bouteille à 0:14 (« fond de 02 ou 07 », non tranché ; 07 est un feu de minuit, pas un crépuscule) et pour les 5 pages de 0:34 (« fonds tirés des plans disponibles », alors que le storyboard décrit des lieux de Patagonie). Nommer ces images (09b, 02b…), leur propriétaire et leur source dans ASSETS.md.

**19. [m] 0:22 — « étiquettes de couleur discrètes sur le matériel » rangées dans la colonne Interface.** Le storyboard dit Interface « Aucune ». Ce sont des étiquettes physiques : les mettre dans la colonne Plan au sol, propriétaire `landscape-director A`, sinon `ui-builder` posera des pastilles d'interface sur le plan héros.

**20. [m] 0:48–0:49 — le « tutti C » est posé à 48,000** (MIX l. 180), alors que le storyboard met « Quatre notes » à 0:48 et « Tutti » à 0:49. Décaler à 49,0 ; garder 48,0–49,0 pour les 4 notes de piano.

**21. [m] 0:04 — clavier et frappe décalés.** 8 frappes de 4,000 à 4,875 (MIX). « Islande · van · 10 jours · 4 » fait 28 caractères, soit 0,70 s à 40 car./s, à partir de la fin du ressort (≈ 4,25). Fixer la frappe de 4,125 à 4,825 dans BEATMAP et y aligner les clics. MIX écrit aussi « grille 1/16 de temps (0,125 s) » : c'est un quart de temps.

**22. [m] 10,9–11,1 (raccord l. 134) — hors grille.** Passer à 10,75–11,0 ou 11,0–11,25.

**23. [m] 0:18 « Musique retenue »** : la batterie légère continue de 12,5 à 23,0 (MIX l. 75). La couper de 18,0 à 19,0.

**24. [m] 0:27 — plan « 03 / 06 » non choisi.** Le storyboard demande « Dehors, plus une antenne » : il faut un extérieur. Trancher.

**25. [m] 0:14 — « LKDV » moulé en toutes lettres** contredit 0:52 « seul texte lisible du film depuis 0:04 » (storyboard l. 333, BEATMAP l. 120). Mouler le tracé des montagnes, et non le mot, ou noter l'exception. À noter aussi pour la livraison : le badge contient la phrase « TON PROCHAIN VOYAGE COMMENCE ICI » et six mots. C'est admis (mots du logo), mais c'est un slogan dans un film « sans un seul slogan » : à signaler à l'utilisateur, pas à corriger.

**26. [m] 0:03,0–0:03,75 — l'hôte `ui-a1` démarre à 3,5**, en plein logo de l'aurore. Faire démarrer l'hôte à 4,0, ou garantir une opacité nulle avant 4,0.

**27. [m] 0:00 / 0:59 — creux à la boucle.** 3 ms de fondu à chaque bout sur une note tenue à −11 dB : RMS des 10 dernières ms −18,5 dB contre −10,8 dB juste avant, et −10,3 dB sur les 10 premières. En boucle, cela fait un trou d'environ 6 ms, audible. Faire un fondu croisé circulaire et non deux fondus à zéro (P4).

**28. [m] 2,96–3,05 — riser « coupé net » qui ne l'est pas** : `stem_sfx` à −25 dB à 3,00 et −30 dB à 3,04. Et 0:53 « dernier accord » avec cordes et chœur, alors que le storyboard l. 136 dit « dernière note de piano seule sur le logo ». Choisir une lecture.

**29. [m] Lignes du storyboard omises dans BEATMAP** :
- 0:02 « vapeur », « continents qui dérivent » ;
- 0:16 « flocon » rendu par `cloud-snow`, « chaussure » rendue par `footprints` ;
- 0:30 « Inès, téléphone en main » ;
- 0:44 « deux téléphones se touchent » ;
- 0:45 « photo du groupe ».

**30. [m] Documents et fichiers.**
- BEATMAP l. 39 affiche « 0:05,9000000000000004 » (erreur de flottant dans `tc()`, gen-animatic.mjs l. 7 : arrondir à 3 décimales).
- L'hôte `animatic` (z 50) est listé dans la table de la racine, alors qu'il n'est pas dans `index.html` : il vit dans `animatic/index.html`. Le dire.
- `LKDV_animatic_P1_960x540_30fps.mp4` : vidéo 60,000 s, 1 800 images, mais audio et conteneur à 60,010 s. Le 1080p30 est à 60,000.
- Le storyboard l. 65 met « le noir du bouton » à 0:56, et la table à 0:54. BEATMAP a raison de suivre 0:54 ; consigner que l. 65 est une coquille.

### Contrôles réussis (preuves)

- **Chocs** :
  - 6,0 : pic du mix à 6,0024 s ; pas de silence avant, donc attaque non isolable ; le riser est éteint (sfx −46 dB de 5,9 à 6,0) ;
  - 12,0 : attaque à 12,0001 s ;
  - 46,0 : attaque à 46,0000 s.
- **Silences en zéro numérique** (seuil −90 dB) : 11,500–12,000, 37,000–37,500, 45,500–46,000, et le noir 54,000–54,500, chacun de 0,500 s. Au seuil −60 dB : 11,4998 / 36,9997 / 45,4998 / 53,9999 → fins exactes sur la grille.
- **Après les silences** : coup sec à 37,500 ; ping à 54,500.
- **Respirations sonores** : 32,5–33,0, musique à −46,7 dB, ambiance (vent) à −26,9 dB, donc « seul le vent » est vrai. 44,0–45,0, effets −121 dB et ambiance −73 dB, donc « piano seul » est vrai.
- **Loudness** : −14,0 LUFS intégré, true peak −1,2 dBTP, LRA 8,1 LU.
- **Changements d'acte sur une seconde paire** : 6, 12, 24, 30, 44, 52.
- **Plongées** : 0,5 / 0,25 / 0,25 s à 32,0 / 36,0 / 40,0.
- **Respirations** : 12,0–12,5, 32,5–33,0, 0:50, sans hôte d'interface actif (ui-a2 s'éteint à 11,5, ui-a3 commence à 13 ; ui-a6 finit à 48, ui-a7 commence à 52).
- **Couverture du cadre** : aucun trou hors 56,5–57,0 (n° 4) : `cosmos` 0–12,5 et 46,25–54 ; sol 10,5–47,5 et 54–58,5 ; aurore opaque dès 58,25.
- **Décisions de l'utilisateur appliquées** : K2 au plan 08, plans 11–18 / 19 / 20 / 21, fonctions gardées (balise, montre, batterie, double coche, anneau, itinéraire, +25 / +40 / +60), logo seul à 0:53, mots tapés à 0:04.
- **`check`** : la dernière exécution (`.hyperframes/artifacts/checks/65e47fb1…`, 07:07) renvoie `ok: true`, 0 erreur.

## 4. Les 3 défauts les plus graves

1. **L'animatique ne montre que du texte (n° 1).** Pas un picto, pas une boîte d'interface, 31 % du film en cadre vide. La porte P1, « rythme et lisibilité sans texte », est sans objet tant que la planche ne montre pas les silhouettes de l'interface et du cosmos, carte de texte masquée. **Correctif** : couche silhouette générée depuis `beatmap.mjs`, nouvelle planche sans texte.
2. **Raccord 0:51→0:52 inconstructible (n° 2).** Le badge réel n'a pas de tracé de montagnes au centre. C'est un plan héros de P2. **Correctif** : choisir l'accroche (petit emblème du badge ou crête du haut), en mesurer la boîte dans le PNG, nommer un seul calque propriétaire après 52,00.
3. **Rafale 0:41 (n° 3).** Hors de la grille du storyboard, contredite par MIX.md (4 coups au lieu de 8), pictos perdus, risque de flash à 8 changements par seconde. **Correctif** : exception validée par l'utilisateur, avec raccords de forme sur un horizon commun, ordre de luminance et 8 coups sur le roulement ; ou 4 plans à la croche avec l'accord de l'utilisateur. Réécrire BEATMAP et MIX.md ensemble.

Juste derrière : coupes franches non prévues aux 9 changements de plan sans transition (n° 5), et raccords des trois plongées absents (n° 6).
