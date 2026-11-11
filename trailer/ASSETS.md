# ASSETS — état des ressources du trailer LKDV 60 s

Mis à jour le 2026-11-10 (P0). Les droits de chaque ressource tierce sont dans `assets/CREDITS.md`.

## Décisions de l'utilisateur (2026-11-10)

| Sujet | Décision | Conséquence |
| --- | --- | --- |
| Plans au sol | « Fais tout toi-même à 100 %, sans banque d'images, tu les crées » | Aucune photo de banque. Les 21 plans sont créés par nous (voir « Plans au sol »). Les photos libres téléchargées pendant la recherche ont été supprimées. |
| Musique | Partition synthétisée originale | Aucune musique ni effet tiers. Synthèse Python (`audio/scripts/`). |
| Fonctions absentes de l'app | Garder le storyboard tel quel | Le film montre des fonctions qui n'existent pas dans le code (liste dans `docs/AUDIT-APP.md`). À dire dans la description de la vidéo. |

## Design system (copié du dépôt, lecture seule)

| Ressource | Source dans le dépôt | Copie | État |
| --- | --- | --- | --- |
| Polices Inter, Manrope, Instrument Serif (romain, italique), IBM Plex Mono 400/500/600 | `src/app/fonts/` | `assets/fonts/` (7 fichiers, OFL 1.1) | Disponible |
| Icônes de l'app | `public/icons/sf/` | `assets/icons/sf/` (160 SVG) | Disponible |
| Pictos absents de l'app (van, bouteille, fauteuil, flocon, appareil photo, satellite, montre…) | — | `assets/icons/extra/` | En cours (ui-builder) |
| Logo, tracé des trois montagnes | `public/assets/logo-mark.svg` | `assets/brand/logo-mark.svg` | Disponible |
| Badge final | `public/assets/images/lkdv-boot-logo.png` (256 px) et `public/logo.png` (même dessin, 1024 px) | `assets/brand/lkdv-boot-logo.png`, `assets/brand/lkdv-badge-1024.png` | Disponible. Le 256 px est trop petit pour un plein cadre : le film utilise la version 1024 px du même dessin. |
| Jetons, matériau du Compas | `src/styles/tokens.css`, `src/features/compas/compas.css`, `src/design/tokens.ts` | `assets/design-system/` + `INVENTAIRE.md` | Disponible |

Écarts entre storyboard et dépôt (détail dans `assets/design-system/INVENTAIRE.md`) : Stone `#F5F2EC` n'existe que sous `--cv2-light-page` ; Paper `#FBFAF6` est absent du dépôt ; `LkvChip` n'existe pas (composants réels : `Chip.tsx`, `.cp-chip`) ; `--tracking-caps` vaut 0,04 em ; le Spinner officiel est un rond à bordure, sans SVG.

## Ouverture cosmique et globe (procédural)

| Ressource | Source | Fichier | État |
| --- | --- | --- | --- |
| Terre de jour | NASA Blue Marble Next Generation, SVS 2915 (domaine public) | `assets/textures/earth-bluemarble-nasa-8192.jpg` (8192 × 4096) | Disponible |
| Lune | NASA SVS 4720, CGI Moon Kit (domaine public) | `assets/textures/moon-lroc-color-poles-8k.jpg` | Disponible |
| Terre de nuit (lumières des villes) | NASA Black Marble | — | Manquant : `eoimages.gsfc.nasa.gov` coupe la connexion. En cours : autre page NASA, sinon lumières procédurales. |
| Nuages | — | procéduraux | Décidé |
| Jeu de secours three-globe | paquet npm, provenance des images non documentée | `assets/textures/fallback-three-globe/` | À ne pas livrer : sert seulement aux essais |
| Contours des pays, Islande | Natural Earth via `world-atlas` (domaine public) | `assets/geo/` | Disponible |
| Nébuleuse, disque, planètes, aurore | shaders écrits pour le film | `assets/cosmos/` | En cours (cosmos-vfx) |

## Plans au sol (21)

Aucun n'est fourni. Création par nous, sans banque d'images. Piste évaluée en premier : génération locale par un modèle à poids ouverts sous licence commerciale (banc d'essai dans `qa/tmp/gen/RAPPORT.md`) ; repli : paysages procéduraux peints en shader.

| N° | Fichier attendu | Temps dans le film | État |
| --- | --- | --- | --- |
| 01 | `01_cloud_sea_balloons.png` | 0:10,5–0:11,5 | À créer |
| 02 | `02_iceland_route1_lupines.png` | 0:12–0:15 (héros 0:12) | À créer |
| 03 | `03_van_door_friends.png` | 0:15–0:23, 0:26–0:27 (héros 0:22) | À créer |
| 04 | `04_harbour_handover.png` | 0:24–0:25, 0:44–0:46 | À créer |
| 05 | `05_landmannalaugar_colors.png` | 0:28 | À créer |
| 06 | `06_hot_river_steam.png` | 0:29 | À créer |
| 07 | `07_beach_campfire_midnight.png` | 0:29,5–0:31, 0:43 | À créer |
| 08 | `08_k2_concordia_solo.png` | 0:32–0:35 (héros 0:32) | À créer |
| 09 | `09_lyon_dawn_runner.png` | 0:36–0:39 | À créer |
| 10 | `10_burgundy_autumn_peloton.png` | 0:40 | À créer |
| 11–18 | Sahara, Amazonie, Uyuni, Baïkal, Raja Ampat, Antelope Canyon, Népal, Atacama | 0:41 (0,125 s chacun) | À créer |
| 19 | `19_night_train_alps.png` | 0:42,0–0:42,5 | À créer |
| 20 | `20_accessible_trail_autumn.png` | 0:42,5–0:43,0 | À créer |
| 21 | `21_norway_aurora_final.png` | 0:55–0:58 | À créer |

Plans du storyboard sans image dans le jeu de 21 : la bouteille sur l'océan (0:14–0:15), la vue du ciel sur le Rhône (0:38), le kayak et le bivouac de la rafale d'origine (remplacés par la rafale mondiale). La bouteille est un objet de verre dessiné sur un fond d'océan tiré d'un plan existant ; la vue du ciel est à créer.

## Son

| Ressource | Source | Fichier | État |
| --- | --- | --- | --- |
| Maquette 60 s, 48 kHz stéréo 24 bits, −14,0 LUFS, −1,2 dBTP | Synthèse originale, `audio/scripts/` | `assets/audio/LKDV_mock_PLACEHOLDER.wav` | Livrée, calée sur la grille. Jamais écoutée par un humain. |
| Stems musique, effets, ambiances | idem | `assets/audio/stem_*_PLACEHOLDER.wav` (non suivis par git, régénérables) | Livrés |
| Partition finale (timbres, réverbération commune, dynamique) | Synthèse originale | — | À faire (P4) |

## Outils

HyperFrames 0.9.31 (`npx hyperframes`, télémétrie coupée), Chrome headless, FFmpeg 6.1.1 (libx264, aac, loudnorm, ebur128), GSAP 3.15.1 et three 0.180.0 en local (`assets/vendor/`), Node 22, Python 3.13 (numpy et scipy en venv hors dépôt).
