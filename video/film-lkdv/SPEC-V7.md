# SPEC v7 — « Le W », un film, pas un diaporama

Demande de Tony (17/11/2026) : « tu as accès à des photos, vidéos et modèles 3D en assets… tu devrais t'en sortir avec bien plus qu'un simple diaporama animé. » Relectures : v1 5/10, v2 6,5/10 (`boards/RELECTURE-1.md`, `RELECTURE-2.md`) — reproche central : même gabarit sur 17 plans (titre en haut à gauche, téléphone fixe à droite, photo en fond), écrans qui changent comme des photos.

## Principe
Le monde d'abord, l'app dedans. Les images qui font rêver sont de **vraies vidéos** (pas des photos figées) et le produit est montré en **vraie 3D** (maillages publiés du Kit Studio). L'app n'est plus un téléphone posé sur un fond : elle **sort du monde ou y retourne** (le téléphone monte du paysage, la caméra plonge dans l'écran, une carte touchée devient le plan suivant, un élément d'interface est extrait et agrandi en carte flottante). Chaque plan a une **idée de mise en scène différente** ; pas plus de 4 plans de suite avec le même gabarit.

## Grille (inchangée, le son est calé dessus)
128 BPM ; 1 temps = 0,46875 s ; 1 mesure = 1,875 s ; 32 mesures = 60 s ; 23 plans (`boards/frames.py` : ordre, débuts, durées, titres et légendes v6 restent la référence du TEXTE). La piste s'ouvre à 11,25 s (iris) ; demi-mesure de silence 32,81–33,75 s ; lever de soleil à 33,75 s ; badge calé à 54,575 s.

## Matériaux réels disponibles (dans `video/film-lkdv/assets/`)
- **Vidéos réelles** (`footage/`, sans son, issues de `public/` de l'app) :
  - `sunrise-ridge.mp4` 1280×720, 10 s : lever de soleil sur une mer de nuages, sentier de crête au premier plan, oiseaux vers 4–6 s.
  - `freedom-1.mp4` 540×960, 10 s : même lever de soleil, vertical.
  - `freedom-2.mp4` 540×960, 6 s : randonneur de dos, sac au dos, marche vers des pics enneigés.
  - `freedom-3.mp4` 540×960, 6 s : kayak sur un lac glaciaire turquoise, vu d'en haut.
  - `freedom-4.mp4` 540×960, 6 s : petit-déjeuner sur une table, montagnes dans la brume.
  Les verticales (540 px) ne doivent jamais être agrandies plein cadre 1920 : en panneaux verticaux (≈ 600×1080, échelle ≤ 1,15), en triptyque, en fenêtre.
- **3D réelle** (`3d/`, GLB publiés du Kit Studio) : `lkdv-one-45/60/80.glb` (+ `.zones.webp`, carte des zones textiles pour la teinte), modules `lkdv-m01…m06.glb`, `lkdv-m04.glb`, `lkdv-m13.glb`. Moteur : `lib/three-bundle.js` (Three r180 + GLTFLoader + MeshoptDecoder + RoomEnvironment). Référence qui marche : `video/trailer-lkdv/compositions/kit3d.html` (rendu déterministe piloté par le temps du timeline, teinte par coloris via la carte de zones : Forêt `#2d482a`, Sauge `#789972`, Pierre `#b5aba0`).
- **Cartes réelles** (`map/`) : `w-patagonie.mp4` (vol satellite globe → Torres del Paine, 5 s, dernière image = `w-patagonie-end.jpg`, centre −73,03 / −51,005, zoom 11,4, 1920×1080, Web Mercator 512·2^z), `globe-chili-japon.mp4` (6 s).
- **Écrans réels** (`app/`, 1206×2622) et enregistrements (`app/video/` : `compas-creation-w-804.mp4` frappe + clic + préparation, `live.mp4` chrono, `kit-studio.mp4`).
- **Photos** (`photos/`, `img/`) : matériel (`gear-boots`, `gear-headlamp`, `gear-stove`, `gear-sleepingbag`, `gear-tent-small`), paysages (`hero-misty`, `mountain-2`, `journal-trail`, `forest-1`, `camp-golden`…).
- **Musique et bruitages** : `audio/` (le monteur son recalera après la refonte).

## Plans (temps du film ; texte = frames.py v6)
| # | Temps | Idée de mise en scène |
|---|---|---|
| 1 | 0–3,75 | **Ouverture sur le monde** : `sunrise-ridge.mp4` plein cadre, vitesse réelle, image 0 complète avec le titre « Là où la carte / se termine. » posé en grand. Mesure 2 : un téléphone monte du bas du cadre, incliné en perspective (rotateX ≈ 20° → 0), le fil réel de la Communauté y défile. Le monde reste derrière, net. |
| 2 | 3,75–5,6 | **Plongée dans l'écran** : la caméra avance dans le téléphone jusqu'à ce que l'écran remplisse presque le cadre (le paysage s'efface autour) ; `carnet-semaine.jpg` ; le pouce touche « Bivouac dans les Hautes Fagnes · 2 j ». |
| 3 | 5,6–7,5 | **La carte touchée devient le plan** : la fiche `carnet-ouvert.jpg` à gauche ; à droite, les vraies photos du carnet (découpées dans `carnet-photos.jpg` / `carnet-stories.jpg`) s'étalent en cartes en profondeur (perspective, ombres). Le bandeau « Chamonix-Mont-Blanc → … » ne doit pas se lire. |
| 4 | 7,5–9,4 | **Le message seul** : la bulle réelle « On fait le W de Torres del Paine fin novembre ? Le Compas a déjà tout préparé. » extraite de `messagerie-w.jpg` et agrandie en carte flottante au centre, sur fond flou ; rien de la liste des conversations. |
| 5 | 9,4–11,25 | **La phrase** : typographie cinétique plein cadre, la phrase exacte s'écrit en grand au rythme de la vraie frappe, avec le vrai enregistrement du Compas dans un téléphone plus petit ; le pouce touche la flèche. |
| 6–7 | 11,25–16,9 | **Iris → le vol** : iris depuis la flèche sur `w-patagonie.mp4` plein cadre (vrai). Quand il se pose (~13,4 s), **le parcours du Compas se dessine sur la carte satellite** (trait qui avance, étapes qui s'allument sur les temps : Refugio Chileno, Hostería Pehoé, Villa Monzino, Torres del Paine — positions réelles projetées). Le téléphone `compas-voyage.jpg` glisse ensuite au bord : « 5 jours · 61,5 km · 3 personnes ». |
| 8 | 16,9–18,75 | **Le sac** : `compas-sac.jpg` (2,9 kg, 14 objets) et, autour, les photos réelles de matériel qui tombent en grille sur les temps. |
| 9 | 18,75–20,6 | **Le budget** : « 4 194 € » en très grand qui compte jusqu'à sa valeur, « 1 398 € par personne », le tiroir budget réel à côté. |
| 10 | 20,6–24,4 | **TEMPS FORT 1 — le sac en vraie 3D**, plein cadre : `lkdv-one-45.glb` sur le sol pierre, orbite lente ; mesure 1 : deux modules (`m04`, `m13`) se clipsent sur des temps ; mesure 2 : le corps change sur les temps 45 → 60 → 80 L (vrais GLB), poids/prix réels en légende (1,2 · 1,5 · 2,0 kg ; 471 · 501 · 541 €). |
| 11 | 24,4–26,25 | **Météo** : panneau vidéo vertical `freedom-4.mp4` (brume sur les montagnes) + le tiroir météo réel. |
| 12 | 26,25–28,1 | **En route** : `freedom-2.mp4` (randonneur qui marche vers les pics) en grand panneau ; le suivi en direct (`live.mp4`, chrono qui avance, SOS) en surimpression de téléphone. |
| 13 | 28,1–30 | **La story** : la vraie photo de la story (feu de camp) quasi plein cadre, sans titre, avec l'en-tête « Léa Fontaine » de l'app. |
| 14 | 30–31,9 | **Le carnet se remplit** : les 4 médias du carnet se rangent en grille. |
| 15 | 31,9–33,75 | **Un club** : `freedom-3.mp4` (kayak) en panneau + la liste réelle des sorties ; dernière demi-mesure : silence, image qui ralentit. |
| 16 | 33,75–39,4 | **TEMPS FORT 2 — le lever de soleil** : `sunrise-ridge.mp4` (autre passage que l'ouverture, avec les oiseaux) ou triptyque des trois verticales ; deux mesures sans aucune interface ; puis le fil de la Communauté remonte. |
| 17 | 39,4–41,25 | **Ailleurs** : « Explorateurs du Japon », carte du club réelle. |
| 18 | 41,25–43,1 | **Une trace partagée** : la carte « Mon repérage — Bavella » extraite de la conversation (sans la liste). |
| 19 | 43,1–45 | **À six** : le carnet du Tour du Mont-Blanc. |
| 20 | 45–46,9 | **Ta couleur — vraie 3D** : le même sac 3D tourne, coloris Forêt → Sauge → Pierre sur les temps. |
| 21 | 46,9–48,75 | **L'empreinte** : le profil réel. |
| 22 | 48,75–54,4 | **Le globe** : `globe-chili-japon.mp4` plein cadre, téléphones Explorer Chili puis Japon. |
| 23 | 54,4–60 | **La marque** : badge calé sur l'impact (54,575 s), « Le Kit du Voyageur », « Préparer · Explorer · Partager ». Pas d'adresse. |

## Règles
- Vrai uniquement : vraies vidéos, vrais maillages, vrais écrans, vraies positions ; rien d'inventé dans l'interface ; aucun repère dessiné qui passe pour de l'interface (les étapes du parcours sur la carte satellite sont un graphisme du film, clairement distinct de l'UI : trait et pastilles aux couleurs de la marque).
- Charte : Forest `#17402C`, Sage `#5B7F55`, Stone `#FAF8F5`, ombres `rgba(11,31,23,…)`, Inter + EB Garamond italique. Liquid Glass pour les cartes extraites.
- Lisibilité : légendes posées à barre + 0,35 s ; titres complets en ≤ 0,3 s ; rien d'important hors 90 % du cadre.
- Vie privée : jamais la liste des conversations (deux lignes réelles floutées dans les captures) ; extraire seulement la bulle / la carte partagée.
- Déterminisme HyperFrames : tout est fonction du temps du timeline ; les vidéos se temporisent elles-mêmes (`data-start`, `data-media-start`, `data-playback-rate`) ; la 3D se rend depuis le temps du timeline (comme `kit3d.html`).
