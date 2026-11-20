# Références vidéo — film vertical 30 s (investisseurs)

Analyse du 17/11/2026. 16 liens fournis, **14 vidéos distinctes analysées** :

- **n° 5 non téléchargée** : TikTok répond « Video not available, status code 10231 » (vidéo retirée ou privée, compte `mavena.motionai`), trois essais sans identifiants.
- **n° 9 et n° 10 sont la même vidéo** (même identifiant TikTok 7695831758230637856, fichiers identiques au MD5 près). Une seule fiche.
- Les 4 Instagram sont passés sans connexion.

Méthode : `yt-dlp` puis `ffprobe`/`ffmpeg` (vignettes 72×128 px, différences d'images, histogrammes couleur) et `numpy` (flux spectral, basses < 150 Hz pour la grosse caisse, aigus > 2 kHz pour les charlestons). Planches contact à 3–4 images/s, 15 images/s et image par image pour le favori. **Toutes les descriptions viennent de planches regardées** (dossier `refs/`).

Précautions de lecture :
- **Fréquence d'images réelle** : 16, 7 et 9 sont déclarées à 60 i/s mais ne contiennent que 30, 35 et 40 images distinctes par seconde (images doublées). Les durées « en images » ci-dessous sont comptées **à 30 i/s** pour le favori.
- **Coupes** : le détecteur automatique ne voit que les coupes franches. En motion design la plupart des changements sont des morphs ou des mouvements continus, donc j'ai aussi compté à la main les **changements visuels** (nouveau sujet, nouvelle couleur de fond ou nouveau mot) sur les planches, à ±1 changement près.
- **Énergie** = différence absolue moyenne entre images (0–255), ramenée à 30 i/s. Pour les vidéos qui filment un écran dans une pièce (6, 7, 8, 9, 11, 13, 16), le décor immobile fait baisser la valeur, donc l'énergie réelle *dans l'écran* est sous-estimée.
- **BPM** : mesure fiable seulement pour 16 (129, confirmé par les mots changés toutes les 0,233 s) et 1 (129, une coupe tous les deux temps). Les autres valeurs sont indicatives (« ~ »). Les bandes son de 6, 8 et 11 sont très faibles (RMS < 0,02), probablement des ambiances.
- Aucune vidéo n'a été écoutée par une oreille humaine : présence de voix non vérifiée, sauf indication visuelle.

---

## 1. Tableau récapitulatif

| # | Groupe | Durée · format · i/s réels | Coupes franches (auto) | Changements visuels (main) | Plan moyen | Transitions dominantes | Énergie (moy. / pic) | Style | Musique |
|---|---|---|---|---|---|---|---|---|---|
| 1 | A | 17,6 s · 16:9 · 24 | 13 → 44/min | ~14 → 48/min | 1,26 s (min 0,04, max 3,7) | coupe sèche sur le temps, 1 fouet zoom-flou | 3,8 / 13,4 (12 s) | film de voyage Patagonie, étalonnage ciné | **~129 BPM**, une coupe tous les 2 temps (0,93 s) |
| 2 | A | 11,6 s · 9:16 (image couchée à 90°) · 25 | 15 → **77/min** | 16 | 0,73 s (médiane 0,44) | coupe sèche **12/15 sur des attaques** | 3,6 / 6,9 (10 s) | drone Lofoten, titre serif | ~86–88 BPM, coupes en croches |
| 3 | A | 18,4 s · 16:9 · 30 | 8 → 26/min | 9 | 2,0 s | coupe sèche lente | 2,8 / 7,5 | drone Kazakhstan, titre machine à écrire | ~112 BPM, coupes hors temps |
| 4 | A | 31,5 s · 9:16 (couché) · 60 | 0 | 1 | 31,5 s | aucune (plan unique) | 1,4 / 1,8 | canyon rouge, saturation forte | ~? (non mesurable) |
| 6 | A | 20,1 s · 9:16 · 30 | 1 | ~9 → 27/min | ~2,2 s | flash de lumière, gerbe de rayons, fondu flou | 0,7 / 2,3 (écran sombre) | pub Revolut faite par IA, écran filmé dans le noir | ambiance très faible |
| 7 | A | 23,4 s · 9:16 · ~35 | 0 | ~12 → 31/min | ~2 s | traversée de cartes 3D, anneau orange, flou | 1,8 / 8,2 (1 s : main) | UI 3D sombre + orbe orange (Mavena), MacBook filmé | ~92 BPM ? |
| 8 | A | 23,2 s · 9:16 · 60 | 4 | ~30 → **~75/min** | ~0,75 s | plongées 3D inclinées dans l'UI, aspiration en portail, match cut sur bouton | 2,3 / 6,6 (6 s) | app « Créneau » noir + orange, MacBook filmé | ~115 BPM ?, silence la 1re seconde |
| 9 (=10) | A | 24,7 s · 9:16 · ~40 | 0 | ~10 « gags » | plan-séquence | caméra qui suit une réaction en chaîne | 1,4 / 4,6 | court métrage 3D néon (réveil, dominos), MacBook filmé | ~105 BPM ? |
| 11 | A | 20,0 s · 9:16 · 30 | 0 | ~22 → **66/min** | ~0,9 s | orbites autour d'un téléphone, zooms dans l'UI, anneaux néon | 1,4 / 3,5 | app « Foulée » noir + rouge, MacBook filmé | ambiance faible |
| 12 | **B** | 16,8 s · 9:16 · 60 | 1 | ~9 arrêts → 35/min | plan-séquence 15,5 s + logo 1,3 s | **caméra continue** (travelling, zoom avant, dézoom final) | **7,1 / 14,6** (13 s) | widgets bento clair/noir + vert citron, ombres douces | ~145 BPM ?, bruitages « ASMR » |
| 13 | **B** | 11,7 s · 9:16 · 30 | 0 | ~8 → 41/min | ~1,5 s | mot par mot, flou, pop d'échelle | 0,4 / 1,0 | Spotify noir + vert, écran TV filmé | ~92 BPM ? |
| 14 | **B** | 120 s · 16:9 · 60 | 1 | ~60 → ~30/min | ~2 s | morph de cartes, écran dans l'écran (dézoom), mot par mot | 3,1 / 14,5 (37 s) | explicatif bleu encre/blanc, verre, UI | voix off probable (une carte « Script » apparaît), non vérifiée |
| 15 | **B** | 13,0 s · 16:9 · 30 | 2 | ~8 → 37/min | ~1,6 s | bascule caméra 3D + flou de profondeur, carte qui pivote | **4,1 / 9,0** (4 s) | prompt → code → site, noir + flamme orange + bleu | ~105–125 BPM ? |
| **16** | **C ★** | 14,9 s · 9:16 · 30 | 11 | **14 → 56/min** (6 en 1,9 s) | 1,25 s (médiane 0,45, max 5,6) | **morph, iris flash, smear 1 image, explosion vers caméra, mots claqués, fouet** | 3,1 / **11,7 (11 s)** | reel de motion design sur un portable posé sur une table brillante | **129 BPM**, drop à 1,75 s, mots sur les croches |

Moyennes utiles (vidéos à rythme, sans 4 ni 14) : **~50 changements visuels/min**, plan médian **0,45–0,9 s**, et toujours un plan long (2–6 s) qui sert de respiration.

---

## 2. Fiches courtes

### Groupe A — références générales

**1 · Patagonie (Instagram, Yuval Hassid).** À 0,0 s, le titre serif espacé « THE MAGIC OF PATAGONIA » est posé sur un plan de montagne qui bouge déjà lentement, avec en dessous un **compte à rebours 3 → 2 → 1** (vu à 0,1 s puis 2,5 s). À 2,67 s un fouet en zoom avec flou radial ouvre le montage. Ensuite une coupe sèche toutes les **0,88–1,04 s**, soit tous les deux temps à ~129 BPM (6 coupes sur 13 tombent à moins de 60 ms d'une attaque). Plans : glacier en gros plan de texture, guanaco, lac, couple de dos, piste, rapace en vol, randonneur. Le dernier plan dure 3,6 s, en drone. Palette rouille, bleu glacier, gris chaud, désaturée et contrastée. Ce qu'on garde : **coupe tous les 2 temps et compte à rebours dans le titre**.

**2 · Lofoten (Instagram).** L'image est couchée à 90° (paysage tourné dans un cadre vertical). Titre serif « LOFOTEN » à la verticale pendant 2,5 s, puis une rafale de coupes à 0,24 / 0,44 s en alternance : **77 coupes/min, et 12 coupes sur 15 tombent sur une attaque de la musique**. C'est la référence la plus « montage au temps ». Plans de drone en plongée (stade sur une île, ponts, falaises, coucher de soleil).

**3 · Kazakhstan (Instagram).** Le titre « KAZAKHSTAN » s'écrit lettre par lettre pendant 5,5 s, en **brouillage** (chaque nouvelle lettre passe par des glyphes au hasard : « KAZE », « KAZAV » avant de se fixer), sur un plan de drone. Ensuite 8 plans de ~2 s, coupes hors temps. Rythme sage, la bonne idée est le titre brouillé.

**4 · Canyon (Instagram).** Un seul plan de 31 s, couché à 90°, rivière turquoise et roche rouge saturée, poussée lente. Énergie la plus basse du lot (1,4). Ça ne sert que de **référence couleur** (complémentaires turquoise/rouge).

**6 · « Revolut » faite par Claude (TikTok).** Pastille Claude et « Opus 5.5 🤯 » en légende fixe. Écran filmé dans le noir. À 0,0 s, un point de lumière bleu qui grossit, puis une carte qui brille, puis « Revolut » au centre d'une **gerbe de rayons lumineux**. UI de téléphone avec **compteurs qui défilent** (1 480,15 € → 3 819,55 € → 5 244,99 €). Un verbe par écran, avec point final : **« Reçois. » « Convertis. » « Paie partout. »**. La carte est dessinée par un trait de lumière (15,0–15,7 s), et la fin reprend la gerbe de rayons sur le logo avec la promesse tapée « Ton argent voyage avec toi ». Bande son quasi muette.

**7 · Mavena « Jusqu'où va l'IA ? » (TikTok).** Téléphone à la main devant un MacBook. **Accroche à 0,0 s : la main ouvre le portable** (énergie maximale de la vidéo dans la 1re seconde). À l'écran : orbe orange sur noir, cartes UI inclinées en 3D, anneau orange qui balaie, barre de prompt qui se tape mot à mot, pistes d'un montage empilées en 3D (Animation / Voix off / Musique / Bruitages) traversées par une barre de lecture orange, puis le site et le logo « Mavena » avec un bouton orange.

**8 · « Créneau » (TikTok, Mavena).** C'est la **structure narrative la plus utile pour un film d'investisseurs** : problème → bascule → solution → preuve chiffrée → logo. À 0–1 s une main ouvre le portable. Problème (4–7,7 s) : des messages s'empilent en 3D (« On peut décaler la séance de jeudi ? », « Finalement 18 h ? », « Désolée, j'ai oublié le cours… »), basculent puis sont **aspirés dans un portail lumineux** (7,7 s). Solution (8–15 s) : grille horaire, plongée sur un gros bouton orange « Réserver », coche, « Payé · 19 € ». Preuve (16–19 s) : **compteurs 9 séances 171 € → 16 séances 304 € → 23 séances 437 €** pendant que la grille se remplit d'orange. Fin : dézoom sur la grille entière (20,3–21,3 s), l'icône tombe d'en haut, puis le nom « Créneau » et le bouton. Dans la 2e moitié, un changement **toutes les ~0,33 s**.

**9 (=10) · Réveil en réaction en chaîne (TikTok, Mavena).** Court métrage 3D néon orange sur noir, filmé sur un MacBook. À 0,0 s l'horloge affiche 06:59 et passe à **07:00 à 0,67 s** : c'est l'accroche, l'heure déclenche tout. Ensuite un **plan-séquence** dont la caméra suit des dominos, une bascule, une bille, un pendule de Newton, une roue, et l'horloge revient (07:05, 07:09, 07:15, 07:18). Fin : lever de soleil, la couleur passe du noir à l'orange puis au crème, et l'horloge affiche « Bonjour 07:18 ». L'idée à retenir : **une seule chaîne causale, sans aucune coupe**.

**11 · « Foulée » (TikTok, Mavena).** Noir et rouge néon. Téléphone posé sur un sol en grille avec des **anneaux rouges concentriques**, et une caméra qui tourne autour. Plongées dans l'UI : pourcentage qui descend 83 → 72 %, clavier qui tape 12 000, chrono 13:59 → 20:56 → 29:12, anneau 84 → 91 → 99 → 100 %. Classement de téléphones alignés 1-2-3-4, puis logo (anneau et « Foulée ») et bouton « Télécharger l'app ». Environ 66 changements/min.

### Groupe B — « uniquement motion design » (style à privilégier)

**12 · Widgets (TikTok, refined.motion).** **Un seul mouvement de caméra virtuelle de 15,5 s, sans coupe**, et l'énergie la plus haute du lot (7,1, pic 14,6 à 13 s). À 0,0 s le fond est gris clair vide, et de petites tuiles noires et blanches apparaissent avec un ressort (0,0–1,0 s) pour composer une grille « bento ». La caméra plonge ensuite sur chaque widget : calendrier « Daily Activity » avec pastilles vert citron, batterie 56 → 57 %, horloge dont les aiguilles tournent, voiture en charge 0 → 100 % (barre verte), carte de navigation, appel « Mom », prochain vol. Elle reste ~1,5 s sur chacun puis glisse vers le suivant. **Dézoom final de 12,6 à 15,3 s** qui montre toute la grille, puis coupe sèche sur noir avec un petit monogramme blanc « RM » pendant 1,3 s. Palette blanc, gris, noir, vert citron, une pointe de rouge. Ombres douces, coins très arrondis.

**13 · Spotify 2.0 (TikTok, xzecreative).** Écran TV filmé dans une pièce sombre. UI Spotify qui défile, puis une phrase en **mot par mot** au centre (« See what your [avatars] are playing. », « And react to it », « In real-time »), puis le logo : l'icône verte apparaît avec un rebond d'échelle (9,3 s), le nom « Spotify » glisse hors de l'icône et « 2.0 » s'ajoute. Énergie très basse (0,4), donc élégant mais pas épique.

**14 · Troiscoups (TikTok, 120 s, 16:9).** Explicatif d'agence, bleu encre et blanc, cartes en verre. Pas un format court, mais une **bibliothèque de procédés** :
- mots qui arrivent un par un toutes les ~0,25 s (« Rien / n'a / été / filmé. ») ;
- mots barrés à l'apparition (« Caméra », « Décor », « Acteur ») ;
- mot dessiné en contour vectoriel avec ses poignées de Bézier, puis rempli avec un flou de mouvement (« mot », 81,75–82,75 s), puis agrandi jusqu'à sortir du cadre (84,25–84,5 s) ;
- **écran dans l'écran** : la carte rétrécit en rectangle bleu qui devient l'écran d'un portable tenu par des mains (86,0–87,0 s), puis d'un téléphone ;
- boutons à bascule, sliders « Lent / Rapide », compteur 99 → 100 % ;
- fin sur le logo et l'accroche « Faites-les rester. ».

**15 · « Built with Claude » (TikTok, zensu.visuals, 16:9).** À 0,0 s, des flammes orange floues sur noir, et l'étincelle Claude apparaît dès 0,33 s. Rangée de pastilles en verre (Create / Write / Code…) avec un curseur. Le prompt « I want a website for my motion design work. » se tape **mot par mot, le mot neuf en orange**. La caméra **bascule vers le bas à travers le prompt** pour tomber dans du code qui défile avec un flou de profondeur (4,3–5,0 s), et la carte du site **pivote en 3D** depuis la droite (rotation Y ~40° → 10°, 0,6 s). Deuxième prompt « I want a blue background. », la carte devient bleue. Fin : étincelle et « Built with Claude. » dont les lettres tombent en place. Énergie 4,1, pic à 4 s.

---

## 3. Le favori (n° 16) — analyse image par image

`@motionlovee`, « 5.5 is ridiculous at motion ». 14,9 s, 1080×1920, **30 images distinctes/s**.

### 3.1 Dispositif
- Ce n'est **pas** un motion design plein cadre. C'est un **reel de motion design joué sur un ordinateur portable posé sur une table noire brillante**, filmé dans une pièce sombre, **caméra fixe** (le portable ne bouge pas d'un pixel entre 1 s et 10 s).
- Ce dispositif apporte deux choses :
  - le **reflet inversé** de l'écran sur la table double chaque image ;
  - **la lumière de l'écran éclaire la pièce** : à chaque changement de couleur de fond (orange, cyan, bleu roi, citron), la table, le clavier et le mur changent de teinte. Le motion design devient un objet physique.
- Calque fixe pendant 15 s : l'étincelle Claude (saumon, ~20 % de la largeur) et le texte blanc « 5.5 is ridiculous at motion », légèrement incliné, en haut à gauche.
- Dans l'écran, un **habillage d'interface** reste en place : coins en équerre, petites étiquettes mono en capitales (« CLAUDE · MOTION REEL · 2026 »), code temporel et barre de progression en bas. Tout cela fait « outil pro ».

### 3.2 Liste chronologique des plans
t = secondes, f = image à 30 i/s.

| # | Début (t / f) | Durée | Ce qu'on voit | Entrée → sortie |
|---|---|---|---|---|
| 1 | 0,00 / f0 | 0,07 s | écran noir, habillage d'interface seul | — |
| 2 | 0,07 / f2 | 0,33 s | un point blanc naît, un anneau fin pousse autour | grossit avec un léger dépassement (~6 images) |
| 3 | 0,40 / f12 | 0,40 s | les rayons se tracent **un par un, dans le sens horaire**, un grand anneau extérieur s'ouvre | tracé de trait (~1 rayon toutes les 2 images) |
| 4 | 0,87 / f26 | 0,67 s | les rayons s'épaississent en pétales : **le logo Claude**. Un anneau de micro-texte circulaire, une rotation lente, la couleur passe du crème à l'orange | morph d'épaisseur |
| 5 | 1,53 / f46 | 0,20 s | le logo **implose** jusqu'à un point | contraction en accélération (ease-in) |
| 6 | **1,73 / f52** | 0,13 s | **DROP** : un **iris blanc** explose depuis le point et remplit l'écran. La pièce s'illumine | 4 images |
| 7 | 1,87 / f56 | 0,27 s | « CLAUDE » (grotesque noire très large) monte lettre par lettre par **masque**, sur un dégradé pêche → orange | décalage d'~1–2 images par lettre |
| 8 | 2,13 / f64 | 1,13 s | le mot « respire » : **largeur variable** (condensé puis étendu) avec flou horizontal. « motion designer » apparaît en **serif italique** fin, petit, sous le mot (2,73 s) | — |
| 9 | 3,27 / f98 | 0,13 s | chaque lettre **se replie en un point**, de gauche à droite | morph lettre → point |
| 10 | 3,40 / f102 | **1 image** | traînée orange → cyan : un **smear** à la place d'une coupe | coupe maquillée |
| 11 | 3,43 / f103 | 0,30 s | les points **volent en arc** avec flou de mouvement et se rangent dans une liste « Six ways to get from A to B » (fond cyan pâle) | ~9 images, en décalé |
| 12 | 3,73 / f112 | 1,47 s | **démonstration d'easings** : 6 points font la course avec 6 courbes (linéaire, in, out, in-out, rebond, paliers), course d'~1 s | — |
| 13 | 5,20 / f156 | 0,27 s | les 6 points **convergent** en un seul, qui s'écrase (squash) | ~6 images |
| 14 | **5,53 / f166** | 1,73 s | fond **bleu roi**. Le point devient anneau puis disque blanc entouré de 12 satellites. **Morphs** : cercle → triangle (6,0 s) → étoile (6,5 s) → carré (7,0 s). Les satellites changent de forme en même temps | **chaque morph dure 4 images**, une forme **par temps (0,47 s)**, léger dépassement en rotation (~6 images) |
| 15 | 7,27 / f218 | 0,20 s | le fond bleu s'éteint au noir, le carré reste | fondu |
| 16 | 7,53 / f226 | 0,27 s | le carré **se découpe en tuiles de Truchet** (arcs) qui envahissent l'écran | expansion depuis le centre |
| 17 | 7,80 / f234 | 1,60 s | **vague orange** qui balaie le motif blanc sur noir, de gauche à droite puis en anneau qui se referme au centre | — |
| 18 | 9,40 / f282 | 0,20 s | le motif se dissout en grille de croix et de particules | — |
| 19 | 9,60 / f288 | 0,20 s | la grille **bascule en 3D** (perspective) : la caméra virtuelle s'incline | — |
| 20 | 9,80 / f294 | 1,07 s | les particules se plient en **vase 3D**, puis en **tore** qui tourne | — |
| 21 | **10,87 / f326** | 0,10 s | le tore **explose vers la caméra** (zoom à travers, traînées radiales) | 3 images |
| 22 | 10,97 / f329 | 0,13 s | **respiration** noire, quelques traînées résiduelles | 4 images |
| 23 | **11,13 / f334** | 0,30 s | « **EASE** » claqué, avec une doublure fantôme rouge/noire décalée, sur fond crème | 1 image de claque + 2 de stabilisation |
| 24 | 11,47 / f344 | 0,23 s | « **IN.** » blanc sur noir : les lettres entrent comme des barres verticales, **le point final en orange** | — |
| 25 | 11,73 / f352 | 0,13 s | « **EASE** » en version condensée, dégradé bleu | — |
| 26 | 11,87 / f356 | 0,23 s | « **OUT.** » blanc sur bleu roi, point orange | — |
| 27 | 12,13 / f364 | 0,47 s | « **NEVER** » noir sur **vert citron**. À 12,33 s le mot se **répète en rangées** qui défilent (écho typographique) | — |
| 28 | 12,60 / f378 | 0,40 s | « **LINEAR.** » blanc sur noir, avec une diagonale (la courbe linéaire). **Fouet vers la droite** de 12,83 à 13,0 s (5 images, flou horizontal croissant) : le point rouge grossit en cercle | fouet de 5 images |
| 29 | 13,00 / f390 | 1 image | aplat orange flou | — |
| 30 | 13,03 / f391 | 0,27 s | **ondes concentriques**, et le logo noir **tourne en grandissant** (8 images) | rotation + échelle |
| 31 | 13,30 / f399 | 0,23 s | logo et poussière de particules | — |
| 32 | 13,53 / f406 | 0,27 s | le logo **glisse à gauche** et les lettres « CLAUDE » se dévoilent derrière lui avec un flou, puis « motion designer » | ~8 images |
| 33 | 13,80 / f414 | **1,20 s** | carte de fin tenue : logo, nom, sous-titre serif et filets fins | — |

### 3.3 Grammaire de mouvement
- **Une seule idée bouge à la fois.** Un élément principal, ou un groupe qui se comporte comme un seul (6 points, 12 satellites, une grille). Jamais deux sujets en concurrence.
- **Chaque scène naît de la précédente** : logo → point → iris → mot → points → liste → point → formes → tuiles → particules → 3D → explosion. **Aucune coupe « vide »** avant 11 s : les transitions sont des **morphs** ou des **changements d'échelle extrêmes** (un point grossit jusqu'au plein écran, une grille se replie en objet).
- **Durées typiques**, à 30 i/s et 129 BPM :

| Mouvement | Durée |
|---|---|
| morph de forme | 4 images (0,13 s) |
| stabilisation avec dépassement | ~6 images (0,2 s) |
| entrée d'un mot claqué | 1 image + 2 images de fantôme |
| trajectoire en arc | 9 images (0,3 s) |
| fouet | 5 images (0,17 s) |
| iris, flash | 4 images |
| explosion vers la caméra | 3 images |
| respiration au noir | 4 images |
| logo qui entre en tournant | 8 images |
| dévoilement du nom | ~8 images |
| tenue finale | 36 images (1,2 s) |

- **Courbes** : entrées très rapides qui décélèrent (expo-out avec dépassement visible sur les formes et le logo). Sorties en accélération (implosion, contraction des points). Flou de mouvement réel sur tout ce qui va vite (lettres, points, fouet). Le film montre même ses propres courbes à l'écran (scène des 6 points).
- **Rythme** : « exposé » de 0 à 10,9 s (scènes de 1,1 à 1,7 s, avec un morph interne à chaque temps), puis **rafale** de 11,1 à 13,0 s (**6 écrans en 1,9 s, un par croche de 0,233 s**), puis **résolution** sur le logo (1,7 s).

### 3.4 Typographie
- **Mot unique, plein écran** : le mot occupe ~80–90 % de la largeur de l'écran du portable. Jamais plus d'un mot à la fois en gros.
- **Familles** :
  - grotesque **noire très étendue** en capitales (CLAUDE, EASE, NEVER, OUT.) ;
  - variante **condensée** (EASE bleu) ;
  - grotesque grasse plus neutre (LINEAR.) ;
  - en contrepoint, une **serif italique fine** petite (« motion designer »), soit ~1/5 de la hauteur du mot ;
  - étiquettes d'interface en mono minuscule.
- **Ponctuation en couleur d'accent** : le point final orange ou rouge de « IN. », « OUT. », « LINEAR. ». La phrase « EASE IN. EASE OUT. NEVER LINEAR. » est découpée en mots posés **un par croche**.
- **Animations de lettres** :
  - masque montant avec un décalage d'1–2 images par lettre ;
  - **largeur variable** qui respire ;
  - **doublure fantôme décalée** (rouge/noir) au moment du claquement ;
  - entrée en barres verticales ;
  - **écho** (le mot répété en rangées qui défilent) ;
  - **lettres qui se replient en points** pour faire la transition.

### 3.5 Couleur
- Une **couleur de fond pleine par séquence**, et chaque changement de fond tombe sur un temps fort :
  - noir bleuté
  - crème / pêche → **orange Claude**
  - **cyan pâle**
  - **bleu roi**
  - noir + blanc
  - noir + orange
  - crème
  - noir
  - bleu roi
  - **vert citron**
  - noir
  - orange.
- Une seule couleur d'accent constante : l'orange-rouge (points finaux, vague, logo).
- Luminance moyenne 50/255 (sombre) mais saturation élevée (33), parce que le contraste passe par des aplats et pas par des dégradés.

### 3.6 Son
- **0 à 1,7 s : intro presque muette** (RMS ≈ 0,04) avec trois petits clics à 0,40, 0,88 et 1,27 s, un tous les ~0,45 s, qui accompagnent la construction du logo.
- **Drop à 1,75 s** : le niveau est multiplié par ~10 (RMS 0,47), **exactement au moment de l'iris blanc** (1,73 s).
- 129 BPM ensuite, un temps = 0,465 s. Pendant la rafale, des attaques aiguës tombent toutes les 0,232 s (11,22 ; 11,44 ; 11,56 ; 11,90 ; 12,02 ; 12,35…) et **les mots changent sur ces croches, à ±2 images près**.

### 3.7 Ce qui crée le « wow »
1. **Le contraste de densité** : 11 s de construction élégante et logique, puis 2 s de rafale typographique et un fouet. L'œil est rassasié puis bousculé.
2. **La continuité par morph** : rien n'apparaît de nulle part, chaque élément *devient* le suivant. On a l'impression d'une seule matière qui se transforme.
3. **L'iris sur le drop à 1,75 s** : le premier vrai choc tombe avant 2 s, pile sur la musique, et la pièce entière s'allume.
4. **La lumière réelle et le reflet** : chaque aplat recolore la pièce et la table, ce qui donne de la physicalité à des pixels.
5. **La boucle de logo** : le film s'ouvre sur la naissance du logo et se ferme sur le même logo, nommé.

---

## 4. Comment les références font « claquer »

### 4.1 La typographie
| Procédé | Où | Chiffres |
|---|---|---|
| **Un mot par écran, sur la croche** | 16 (EASE / IN. / EASE / OUT. / NEVER / LINEAR.) | 0,233 s par mot à 129 BPM (7 images à 30 i/s) |
| Un verbe et un point par écran | 6 (« Reçois. » « Convertis. » « Paie partout. ») | ~1,5–2 s par verbe, sous-rythme |
| Mot par mot qui construit une phrase | 13, 14, 15 | ~0,25 s par mot ; en 15, le mot neuf en couleur d'accent |
| **Claque avec fantôme** (doublure décalée rouge/noire, 1 image) | 16 EASE | 1 image d'impact + 2 de stabilisation |
| Masque montant lettre par lettre | 16 CLAUDE | 1–2 images de décalage par lettre, ~8 images en tout |
| Largeur variable qui respire | 16 CLAUDE | cycle de ~1 s |
| Écho : le mot répété en rangées | 16 NEVER | 0,2 s |
| Lettres repliées en points (transition) | 16 | 4 images |
| Brouillage avant fixation | 3 KAZAKHSTAN | ~0,33 s par lettre (trop lent pour nous) |
| Contour vectoriel puis remplissage, puis agrandissement hors cadre | 14 « mot » | dessin 0,75 s, remplissage 0,25 s, agrandissement 0,25 s |
| Mots barrés à l'apparition | 14 | ~0,25 s |
| Point final en couleur d'accent | 16, 6 | systématique |

**Échelle** : le mot occupe 80–90 % de la largeur (16, 14). Le texte secondaire fait ~1/5 de la hauteur du mot principal et change de famille (serif italique fine).

### 4.2 La caméra virtuelle
| Mouvement | Où | Durée |
|---|---|---|
| **Plan-séquence continu** : travelling de widget en widget, ~1,5 s d'arrêt chacun | 12 | 15,5 s sans coupe |
| **Dézoom final** qui révèle tout le système | 12 (12,6–15,3 s), 8 (20,3–21,3 s) | 1–2,7 s |
| Plongée inclinée dans l'UI (bouton, compteur) | 8, 11 | 0,3–0,7 s |
| Orbite autour d'un téléphone posé sur un sol en grille | 11 | ~1 s |
| Bascule 3D à travers une couche (prompt → code) avec flou de profondeur | 15 | 0,7 s |
| Carte qui pivote en Y depuis le bord | 15 | 0,6 s |
| Grille 2D qui bascule en 3D | 16 (9,6 s) | 0,2 s |
| **Écran dans l'écran** (le plan rétrécit et devient l'écran d'un appareil) | 14 (86–87 s) | ~0,75 s |
| Caméra qui suit une chaîne causale | 9 | 24 s |

### 4.3 Les transitions
| Type | Où | Durée (images à 30 i/s) |
|---|---|---|
| **Morph de forme ou de lettre** | 16 | 4 images |
| **Iris ou flash** depuis un point | 16 (drop) ; gerbe de rayons en 6 | 4 images |
| **Smear d'une image** (traînée de couleur à la place d'une coupe) | 16 (3,40 s) | 1 image |
| **Explosion vers la caméra** puis respiration noire | 16 (10,87 s) | 3 + 4 images |
| **Fouet horizontal** avec flou croissant | 16 (12,83 s) ; 1 (zoom-fouet à 2,67 s) | 5 images |
| Aspiration dans un portail | 8 (7,7 s) | ~10 images |
| **Match cut** sur un élément (le point devient anneau, le bouton devient grille) | 16, 8 | 0–1 image |
| Points qui convergent ou se dispersent (éclatement d'éléments) | 16 (5,2 s), 7 (cartes qui s'envolent) | 6–9 images |
| Coupe sèche sur le temps | 1, 2 | 0 image |

### 4.4 Les logos
| Vidéo | Apparition |
|---|---|
| **16 (ouverture)** | point, puis anneau, puis rayons tracés un à un, puis pétales, rotation et virage crème → orange, implosion, iris (1,7 s en tout) |
| **16 (clôture)** | aplat orange (1 image), ondes concentriques, logo qui tourne en grandissant (8 images), particules, puis le logo glisse à gauche et le nom se dévoile derrière lui (8 images), **tenue 1,2 s** |
| 6 | point lumineux, puis **gerbe de rayons** derrière le nom, puis promesse tapée dessous |
| 13 | icône qui rebondit à l'échelle, puis le nom glisse hors de l'icône, puis on ajoute « 2.0 » |
| 15 | étincelle qui luit, puis « Built with Claude. » dont les lettres tombent |
| 8 | dézoom sur le produit, l'icône tombe d'en haut, puis le nom et le bouton |
| 11, 7 | orbe ou anneau, puis nom, puis bouton (CTA) à côté du produit |
| 12 | coupe sèche au noir, petit monogramme blanc, 1,3 s |
| 14 | logo, puis accroche « Faites-les rester. » sur bleu |

Règle commune : le logo **naît d'une forme ou d'une lumière simple** (point, anneau, rayons), puis **le nom sort de l'icône** par glissement ou dévoilement. Il est tenu **1,2 à 1,5 s** et il est la seule chose qui ne bouge plus.

---

## 5. Synthèse chiffrée — ce qu'il faut reprendre pour 30 s

**Tempo** : **128–130 BPM** (le favori et la n° 1 sont à ~129). À 129 BPM :

| Unité | Durée | Images à 30 i/s | Images à 60 i/s |
|---|---|---|---|
| temps | 0,465 s | 14 | 28 |
| croche | 0,233 s | 7 | 14 |
| mesure | 1,86 s | 56 | 112 |

30 s ≈ 64 temps ≈ **16 mesures**.

**Densité de montage**
- Cible **50–60 changements visuels/min** en moyenne, soit **25–30 changements en 30 s**, comme le favori (56/min) et 1 (48/min), au-dessus de 6 et 7 (27–31/min), en dessous de 2 et 8 (75–77/min).
- La moyenne cache la forme. Elle doit se répartir ainsi :
  - **scènes d'exposition** de 1,4–1,9 s (3–4 temps), avec **un morph interne par temps** ;
  - **une rafale** de 6–8 écrans à la croche (0,233 s) ;
  - **une tenue finale** du logo de 1,2–1,5 s.
- Plan médian visé : 0,45–0,9 s. Aucun plan de plus de 2 s, sauf la tenue finale (et un éventuel plan-séquence à la 12, qui doit alors s'arrêter sur quelque chose toutes les ~1,5 s).

**Entrées et sorties**

| Mouvement | Durée |
|---|---|
| entrée standard (expo-out avec léger dépassement) | **6–9 images à 30 i/s (0,2–0,3 s)** |
| morph | 4 images |
| mot claqué | 1 image + 2 images de fantôme |
| fouet | 5 images |
| flash ou iris | 4 images |
| sortie (en accélération, plus courte que l'entrée) | 3–4 images |
| logo final | entrée en 8 images, nom en ~8 images, tenue 36–45 images |

Ressorts : un dépassement visible de 5–10 % sur l'échelle ou la rotation, stabilisé en ~6 images. Flou de mouvement obligatoire sur tout ce qui traverse plus d'un tiers de l'écran en moins de 6 images.

**Transitions, par ordre de préférence**
1. **Morph ou match cut** (l'élément devient la scène suivante), la règle du favori.
2. Iris ou flash depuis un point, sur le drop.
3. Changement d'échelle extrême : dézoom « écran dans l'écran » (14), zoom à travers un élément.
4. Fouet horizontal de 5 images pour entrer dans le final.
5. Explosion vers la caméra puis respiration noire de 4 images, juste avant la rafale.
6. Smear d'une image à la place d'une coupe sèche.

À éviter : les fondus enchaînés lents et les coupes sèches non motivées.

**Typographie cinétique, règles**
- Un mot plein écran à la fois (80–90 % de la largeur), en capitales grotesques **noires et étendues**. Une variante condensée pour casser.
- Phrase-manifeste découpée **un mot par croche**, chaque mot avec son fond plein (modèle « EASE IN. EASE OUT. NEVER LINEAR. »).
- Point final dans la couleur d'accent.
- Entrée des lettres par masque, décalage d'1–2 images par lettre. Claque avec fantôme décalé d'une image. Écho en rangées pour le mot le plus fort.
- Contrepoint : un sous-titre en serif italique fine à ~1/5 de la hauteur, jamais animé fort.
- Chiffres : **compteurs qui défilent** (6, 8, 11 ; ex. 171 € → 304 € → 437 €), le moyen le plus lisible de montrer une traction à des investisseurs.

**Densité d'éléments**
- **1 sujet principal en mouvement à la fois**, ou un groupe homogène de 6–12 éléments qui bougent ensemble avec un décalage de 1–2 images.
- Un habillage fixe discret (coins, étiquettes mono, code temporel) pour l'effet « outil pro ».
- Une couleur de fond pleine par séquence, qui change sur les temps forts, et **une seule couleur d'accent** constante.

**Où placer les pics** (repères calqués sur le favori, rapportés à 30 s)

| Moment | Quoi |
|---|---|
| **0,0 s** | quelque chose est déjà en train de naître (point, lumière, main qui ouvre le portable en 7 et 8, horloge qui bascule à 07:00 en 9). **Pas de carton immobile.** Un objet visible dès la 2e image |
| 0–1,8 s | montée calme et précise (construction du logo ou d'un signe), son presque nu, clics sur les temps |
| **~1,8 s (fin de la 1re mesure)** | **DROP** : iris ou flash plein écran |
| 2–20 s | exposition rythmée, une scène tous les 3–4 temps, un morph par temps. Les preuves passent ici (UI en plongée, compteurs). Un pic secondaire vers 13–15 s (explosion ou changement d'échelle) |
| **~22–26 s (75–85 % de la durée)** | **pic principal** : respiration noire de 4 images, puis rafale de 6–8 mots ou écrans à la croche, puis fouet (le favori a son pic d'énergie à 11–12 s sur 15, soit 75–80 %) |
| 26–30 s | résolution : le logo naît de la dernière forme, le nom se dévoile, **tenue 1,2–1,5 s**, son qui se pose |

**Option de dispositif** : 7 des 14 vidéos (dont le favori) montrent le motion design **joué sur un vrai écran filmé** (portable sur table brillante, pièce sombre, reflet, lumière qui recolore la pièce). Pour des investisseurs, c'est une option de plan d'ouverture ou de fermeture qui ancre le produit dans le réel. Le cœur du film doit rester du motion design plein cadre (groupe B).

---

## 6. Fichiers

Planches contact dans `refs/` (JPEG, ~4,5 Mo en tout ; vidéos non copiées) :
- `refNN_planche_01.jpg` / `_02.jpg` : une image toutes les 0,33 s (toutes les 2 s pour 14), avec le temps incrusté.
- `ref14_detail_*.jpg`, `ref15_detail_*.jpg` : passages à 4 et 15 images/s.
- Favori :
  - `ref16_planche_0-15s_4ips.jpg` : cadre entier, toutes les 0,25 s (temps relatif à chaque bande de 5 s : bande 1 = 0–5 s, 2 = 5–10 s, 3 = 10–15 s) ;
  - `ref16_ecran_A-Bs_15ips.jpg` : recadrage sur l'écran à 15 i/s. **Le nombre jaune = temps × 60** (ex. 668 = 11,13 s) ;
  - `ref16_transitions_image_par_image.jpg` : 4 bandes de 16 images consécutives (à 30 i/s) qui couvrent 3,33–3,83 s (lettres → points → liste), 6,40–6,90 s (morph triangle → étoile), 10,87–11,37 s (explosion du tore → EASE) et 12,77–13,27 s (fouet LINEAR → logo).
