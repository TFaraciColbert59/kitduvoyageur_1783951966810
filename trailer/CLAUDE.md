# CLAUDE.md — Trailer LKDV 60 s

Référence permanente du projet. Le storyboard `storyboard/LKDV — Trailer 60 s.md` est la source narrative et visuelle : en cas de conflit avec ce fichier sur le *quoi* (temps, images, transitions, couleurs), le storyboard gagne ; sur le *comment* (moteur, méthode, contrôles), ce fichier gagne.

## 1. Rôle : orchestrateur

La session principale est l'orchestrateur (`claude-fable-5-2`). Elle planifie, délègue, intègre, juge et décide. Elle ne fait elle-même que : l'intégration de la timeline racine, les petites corrections, les décisions de direction, la synthèse des revues, l'export final.

Délégation par difficulté (agents dans `.claude/agents/`) :

| Difficulté | Agent | Modèle, effort |
| --- | --- | --- |
| Plans procéduraux complexes : nébuleuse, système solaire, Terre, aurore, boucle | `cosmos-vfx` | Opus, high |
| Plans au sol, caméra, parallaxe, étalonnage, respirations | `landscape-director` | Opus, high |
| Interface LKDV, scènes de HUD, pastilles, anneau, carnet | `ui-builder` | Sonnet, medium |
| Musique, effets, mixage, synchro, boucle audio | `sound-designer` | Sonnet, medium |
| Copie d'assets, scripts, recherche de sources, ffprobe | `chore` | Sonnet, low |
| Revue indépendante, rejet par défaut | `qa-critic` | Opus, high |

Règles : un agent par périmètre de fichiers (jamais deux qui écrivent le même fichier) ; donne à chaque agent le storyboard, les secondes concernées et ses critères d'acceptation ; lance en parallèle ce qui est indépendant ; ne fais jamais valider un travail par l'agent qui l'a produit. Si une tâche déléguée échoue deux fois, reprends-la toi-même ou remonte-la à un agent Opus.

## 2. Une seule architecture de rendu : HyperFrames

- **HyperFrames** est le seul moteur : composition racine `index.html` (`data-duration="60"`), une sous-composition par scène dans `compositions/`, timelines GSAP en pause enregistrées dans `window.__timelines`, rendu par positionnement image par image dans Chrome headless puis encodage FFmpeg. Démarre par `/hyperframes` puis `/hyperframes-cli`. Ne devine aucune option de CLI : lis `npx hyperframes --help` et le skill.
- Cela **remplace** la section 6 du storyboard (`window.__render(t)`, Playwright, assemblage ffmpeg maison). Les règles de déterminisme de cette section restent valables : graine fixe, aucune horloge réelle, aucun `repeat: -1`, tout visible est fonction du temps de la timeline.
- **GSAP** (`gsap-core`, `gsap-timeline`, `gsap-plugins`, `gsap-performance`, `gsap-utils`) : toute l'animation, les easings, les ressorts et la synchro sur la grille 120 BPM. Aucun GSAP premium sans vérifier que le plugin est inclus dans la licence actuelle de GSAP.
- **Lemo-Opuscar** : *référence artistique seulement*. Lis `docs/references/lemo-opuscar/DIRECTOR.md` et `TECHNIQUE.md`. N'exécute jamais `setup.sh`, `deps` ni ses outils `core/render` ; ne clone pas sa bibliothèque ; ne choisis pas l'un de ses 43 styles (la direction artistique est celle du storyboard, section 1 bis).
- **Motion Design** : *méthode seulement* : carte des temps (`BEATMAP.md`), 4 stills avant le plein rendu, brouillon basse définition avant le master, critiques séparées, aucune image figée hors dernier maintien, pas de coupure franche non prévue. N'utilise pas son moteur `seek(t)`/Playwright. **Ignore tout ce qui est propre à son auteur** : palette Howseen, chemins `~/Desktop/Howseen AI`, logos Howseen, règles de rédaction, banques d'assets personnelles, visages générés.
- **FFmpeg skill** (`ffmpeg-media-processing`) : mixage, loudness, encodage final, ffprobe. Les drafts en `-preset veryfast`, le master en `-preset slow`.
- **OneTake** : *référence de continuité seulement* (chaque temps naît du précédent au lieu de le remplacer ; caméra qui poursuit ce qu'elle cadre ; raccords par cause, par forme, par échelle). Applique-le aux transitions déjà définies dans le storyboard, jamais contre elles. Son propre moteur (`window.__seek`, `lib/motion.js`) n'est pas utilisé : HyperFrames reste le seul moteur. Ses dossiers de démos ne sont pas inclus. Sa licence est PolyForm Noncommercial : l'utilisateur a décidé de l'installer en connaissance de cause ; rappelle-le dans la livraison (`THIRD_PARTY.md`).
- `media-use` : outils locaux gratuits uniquement (étalonnage, détourage, mixage). Pas de génération HeyGen ni de service payant ou à compte sans accord de l'utilisateur. Télémétrie du skill `hyperframes` : n'exécute pas `npx hyperframes events` ; si la CLI affiche une option d'opt-out, active-la.

## 3. Livrables et paramètres

- `out/LKDV_Trailer_60s_16x9_1920x1080_60fps.mp4` : 60,000 s, 3 600 images exactement, H.264 yuv420p, BT.709 limited, `+faststart`, AAC 48 kHz stéréo ≥ 256 kb/s, −14 LUFS intégré, ≤ −1 dBTP.
- `out/LKDV_Trailer_60s_9x16_1080x1920_60fps.mp4` : **recomposé** pour le vertical (skill `/hyperframes`, `references/types/vertical.md`), pas rogné ; l'interface se place sur des zones sûres, les sujets restent dans le tiers central.
- `qa/REVIEW.md`, `qa/contact-sheet-*.png`, `assets/CREDITS.md`.
- Optionnel après acceptation des deux principaux seulement : versions 30 s, 15 s, 6 s (tableau « Déclinaisons » du storyboard).
- Encodage master : CRF 16, `-preset slow`. Drafts : 30 i/s, 960 × 540, CRF 23, `-preset veryfast`.

## 4. Contraintes de contenu (non négociables)

- **Aucune phrase à l'écran.** Seuls mots autorisés : ceux tapés à 0:04 et ceux du logo final (0:52–0:53). Le reste passe par pictos, avatars en initiales, anneaux, barres, quelques chiffres.
- **Vrai design system LKDV** : jetons `--lkv-*` de `src/styles/tokens.css`, matériau Liquid Glass v8 de `src/features/compas/compas.css`, polices `src/app/fonts/`, icônes `public/icons/sf/`, logo `public/assets/logo-mark.svg` et `public/assets/images/lkdv-boot-logo.png`. Dépôt public `TFaraciColbert59/kitduvoyageur_1783951966810`, à cloner **hors** du projet, en lecture seule. Aucune couleur hors jetons. Interdits du design system : `#E4501C`, `#1C2620`, `#A3C4A3`, `#0B1F17`, `#2D6B4A`. Pas de noir pur en ombre claire.
- **Couleurs** : l'identité LKDV passe par l'interface (jetons, verre), le logo fondu dans le décor, les pastilles de provenance et un étalonnage léger et cohérent. Les plans au sol gardent leurs couleurs réelles et vives (aurores, lumière rasante, glace turquoise, sable orange) : ne les uniformise pas et n'impose pas les six couleurs aux paysages ni aux vêtements. Pas de néon artificiel.

- **Jeu d'images au sol (version 3, remplace les lieux du storyboard quand ils diffèrent)** : 21 plans mondiaux dans `assets/footage/` (voir `LISEZ-MOI.txt`). Correspondances : Islande et groupe = 02, 03, 04, 05, 06, 07 ; ciel déchiré = 01 ; **Nora en solo = 08 (Karakoram, K2) à la place de la Patagonie** ; Tom = 09 ; Clara = 10 ; rafale du relais 0:41–0:42 = 11 à 18 (Sahara, Amazonie, Uyuni, Baïkal, Raja Ampat, Antelope Canyon, Népal, Atacama) ; train = 19 ; sentier accessible = 20 ; finale et boucle = 21. Les personnages ont des tenues volontairement différentes. Le logo dans la crête (0:12, 0:35) se cadre à la volée sur le relief disponible, sans le forcer.
- **Logo fondu dans le décor** aux seuls moments du tableau « LKDV fondu dans le décor », jamais plus d'une seconde, puis en entier à 0:52. Pas de signature permanente.
- **Rien d'inventé qui se prétende réel** : ne montre aucune fonction qui n'existe pas dans l'app (vérifie dans `src/`). Le storyboard n'affiche plus de mention « données de démonstration » (règle zéro texte) : ne l'ajoute pas à l'image, et signale dans la livraison qu'elle devra figurer dans la description de la vidéo.
- Pas de marque tierce (avion, van, montre), pas de visage de vraie personne, aucune musique ni image sans licence commerciale documentée dans `assets/CREDITS.md`.
- Beauté : 60 % du cadre en paysage pur, heures magiques, trois plans de profondeur, particules, trois respirations sans interface (0:12, 0:32,5, 0:50). « Correct » n'est pas assez : refais.

## 5. Questions ouvertes du storyboard (section 5) : défauts si aucune réponse

1. Adresse du site sous le logo : **logo seul**.
2. Mots tapés à 0:04 : **conservés** (« Islande · van · 10 jours · 4 »).
3. Balise satellite et montre : **vérifie dans le dépôt** s'ils existent ; sinon remplace 0:26–0:27 par la batterie partagée et la carte hors réseau, et signale-le.
4. Chiffres de points (+25, +40, +60) : proviennent d'une proposition non activée → **remplace par une barre qui monte, sans chiffre**. « 96 », « 88 → 91 », « 8 sur 10 » restent des valeurs de démonstration.

## 6. Phases et portes de qualité

1. **P0 — Audit** : lis le storyboard en entier ; clone le dépôt LKDV ; liste dans `ASSETS.md` chaque ressource requise (plans au sol, musique, textures Terre) avec son état ; recopie polices, icônes, jetons dans `assets/`. **Les plans au sol photographiques et la musique ne sont pas fournis.** Cherche des sources libres pour usage commercial (Pexels, Unsplash, NASA Blue Marble/Black Marble, bibliothèques de musique libres) et documente-les. Pour chaque plan sans source convenable, ne le remplace pas en silence : regroupe-les dans une seule question à l'utilisateur.
2. **P1 — Animatique** : `BEATMAP.md` (120 BPM, chaque événement sur son temps), boîtes grises, pictos principaux, maquette sonore. Porte : `check` sans erreur, durée 60 s exacte, contact sheet d'une image toutes les 0,5 s, `qa-critic` sur le rythme et la lisibilité sans texte.
3. **P2 — Plans héros** : nébuleuse (0:00), logo dans l'aurore (0:03), sortie du nuage (0:12), porte du van (0:22), Patagonie (0:32), logo final (0:52). Porte : 4 stills regardés, `qa-critic`, correction.
4. **P3 — Les 7 actes** dans l'ordre, en parallèle quand les périmètres sont disjoints. Porte par acte : `check`, `snapshot --review`, `qa-critic`, correction.
5. **P4 — Son** : synchro mesurée (< 20 ms d'écart), loudness, boucle sans clic.
6. **P5 — Intégration et contrôle complet** : rendu draft de 60 s, revue complète, puis master. Contrôles : `ffprobe` (3 600 images, 1920 × 1080, 60 i/s, 60,000 s, audio 48 kHz), image 3599 ≈ image 0, deux rendus du même instant identiques, aucun mot hors liste, palette, aucune image figée.
7. **P6 — Vertical 9:16**, même contrôle.
8. **P7 — Livraison** : MP4, `qa/REVIEW.md`, `assets/CREDITS.md`, liste honnête des écarts restants au storyboard.

Honnêteté des résultats : ne déclare une porte franchie qu'avec la preuve (sortie de commande, image, rapport). Un défaut non corrigé est écrit tel quel dans `qa/REVIEW.md`, jamais retouché dans les mots.

## 7. Travail autonome

Ne t'arrête pas pour des points d'étape. Remonte seulement : un vrai blocage, une ressource manquante qui change le résultat (une question, groupée), une décision de direction qui n'appartient qu'à l'utilisateur. Lance les rendus longs en arrière-plan ; pour le master, découpe en tronçons parallèles si la CLI le permet, et rends à nouveau seulement les secondes modifiées.
