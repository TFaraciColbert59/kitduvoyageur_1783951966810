# Plan motion & vidéo LKDV

> Rédigé le 16/11/2026, après le trailer « Une phrase suffit » (`video/trailer-lkdv`, PR #163).
> Statut au 16/11/2026 : lot 1 en partie fait (`video/MOTION.md`, `video/brand.md`, scripts `video/scripts/`) ; lot 2 fait (version 9:16, teaser, son à −14 LUFS, textes `video/PUBLICATION.md`). Les lots 3 à 5 attendent les points du § 3. Budget 0 €.

## 1. Ce que j'ai appris

Sources : les 11 vidéos envoyées par Tony (9 récupérées, 2 TikTok indisponibles), transcrites et relues image par image ; les dépôts des outils cités.

- **Une seule chaîne de rendu suffit : HyperFrames** (HeyGen, Apache-2.0). On écrit la vidéo en HTML/CSS/GSAP (+ Three.js), le rendu MP4 est déterministe et local. Son catalogue compte 448 blocs ; pour LKDV : `vfx-iphone-device` (vrai iPhone 3D avec écran HTML), `ios26-liquid-glass`, `parallax-device-dive`, `screen-flow-carousel`, `cursor-zoom-follow`, `ui-focus-zoom`, `nyc-paris-flight` (vol sur carte), `logo-outro`, `caption-highlight` (sous-titres type TikTok), `tiktok-follow` / `instagram-follow`, `grain-overlay`.
- **Les « 8 outils » des vidéos se rangent en 5 usages.** Installés dans `.claude/skills/` (MIT, relus, sans clé ni appel réseau) :

| Usage | Skill installé | Rôle pour LKDV |
| --- | --- | --- |
| Films de lancement | `product-launch-motion`, `launch-video`, `motion-effects`, `title-sequence-3d` | une forme qui ne coupe jamais, un curseur qui fait chaque action, des ressorts, les données réelles, la musique d'abord |
| Formats sociaux | `reel-export`, `hyperframes-motion-reel`, `milestone-reveal`, `animated-chart` | 9:16 propre (zone sûre, H.264 bt709), montages sur le temps, chiffres animés |
| Explications animées | `animate` (7 styles, storyboard d'abord), `vox-explainer` | tutoriels et histoires courtes |
| Animer le site | `motion` (motion.dev, ex-Framer Motion, déjà en dépendance), `gsap-*` (8 skills officiels) | micro-interactions, transitions de page, performances |
| Fondations | `motion-design` (LottieFiles, 12 principes Disney), `brand-intake`, `motion-brief-writer`, `reference-to-motion` | goût, charte de mouvement, brief |

- **Écartés** : Remotion (licence payante pour les entreprises), l'artefact « Claude Motion » (offres Team/Enterprise), `claude-motion` (dépend de son propre dépôt), le B-roll sur vidéo face caméra (pas de rushs filmés), les voix et avatars HeyGen (compte payant), Motion+ et Motion Studio (payants).
- **Méthode retenue** (commune à toutes les sources) : inspiration d'abord ; la musique avant la chorégraphie ; un storyboard avant d'animer ; de vraies données et de vrais écrans ; une image par temps fort relue avant le rendu ; la durée de lecture respectée ; le son mesuré.

## 2. Ce que je propose de faire

### Lot 1 — Socle commun (à faire en premier)

1. `brand-intake` sur LKDV : `video/brand.md` + `video/MOTION.md`, tirés de `src/styles/tokens.css` et `DESIGN_SYSTEM.md` (Liquid Glass, Forest/Sage/Stone, italique Georgia, durées et ressorts du Compas, interdits).
2. Kit de scènes partagées `video/_kit/` : panneau de verre, capsule d'étapes, téléphone avec captures, carte satellite cuite + tracé, sac 3D (les 10 `.glb` et les modules), badge de fin, style de sous-titres, plancher sonore. Chaque film part de ce kit.
3. Captures 3× de tous les écrans réels par Playwright (`scripts/video/capture-screens.mjs`), sur la préproduction avec un compte de démo (voir § 3).
4. Une bibliothèque de musiques CC0 / CC BY vérifiées, avec leur attribution (`video/MUSIQUES.md`).

### Lot 2 — Le trailer décliné

- Version verticale 9:16 de 30 à 35 s, recomposée scène par scène (pas un simple bandeau noir), pour TikTok, Reels et Shorts.
- Teaser de 15 s et pré-roll de 6 s.
- Vidéo d'accueil du site : boucle muette de 12 s, ~4 Mo, avec image d'attente, dans le héros de la page d'accueil et du manifeste (respect de `prefers-reduced-motion`).

### Lot 3 — Un film par pilier (20 à 30 s chacun, en 16:9 et 9:16)

1. **Compas** : une phrase → le voyage complet, avec un vrai voyage enregistré (pas le jeu de démo).
2. **Kit Studio** : tour à 360° des 10 sacs, coloris, modules, « Commander ».
3. **Terrain** : cockpit GPS, hors ligne, SOS, retour de sortie.
4. **Carnets** : un carnet public qui se raconte (consentement, aucune coordonnée exposée, RGPD).
5. **Communauté** : clubs, sorties, lignées de kits (« gardé par X voyageurs sur 10 », jamais de vocabulaire génétique).
6. **Aperçus App Store / Google Play** pour l'app Capacitor (formats imposés par les stores).

### Lot 4 — Série récurrente automatisée

Modèles HyperFrames à variables, rendus en lot (en local ou sur les minutes GitHub Actions gratuites) :

- « Destination de la semaine » : vol satellite + parcours proposé par le Compas.
- « Le kit pour… » : sac 3D + liste et poids.
- « Chiffre du mois » (`milestone-reveal`), avec des chiffres réels seulement.
- « Mini-guide » (`animate` / `vox-explainer`) tiré des guides du site (règles bagages des compagnies, préparer un trek).

### Lot 5 — Le site qui bouge (skills `motion`, `motion-design`, `gsap-*`)

Appliqué aux règles du dépôt : `transform` et `opacity` seulement, `prefers-reduced-motion`, cibles ≥ 44 px, tests et `npm run perf:budget` :

- « Préparer mon aventure » → ouverture de la carte (la transition du trailer, en vrai) ;
- préparation visible `CompasPrep` animée ;
- indicateur liquide de la capsule d'étapes ;
- tiroirs à trois hauteurs sur ressort ;
- puces d'étapes qui tombent et tracé qui se dessine ;
- module qui se fixe dans le Kit Studio ;
- apparition des cartes Explorer et Communauté.

Audit des animations existantes avec les bonnes pratiques gratuites du skill `motion` (l'audit MotionScore est payant).

## 3. Ce qui ne dépend que de Tony

1. **Un compte de démonstration qui marche** : en production, `/api/auth/demo` répond `demo_login_failed`. Il faut corriger `DEMO_LOGIN_EMAIL` et `DEMO_LOGIN_PASSWORD` dans Vercel, ou me donner un compte de capture sur la préproduction. Sans lui, les écrans connectés restent les anciennes captures 1×.
2. **La voix** : sans voix (texte à l'écran, comme aujourd'hui), voix locale gratuite (Kokoro, voix française), ou la tienne enregistrée.
3. **La musique** : CC BY avec crédit en description (gratuit), ou une connexion gratuite au catalogue HeyGen (`npx hyperframes auth login`, à lancer par toi).
4. **La publication** : je ne publie pas sur TikTok ou Instagram ; je livre les fichiers prêts à poster et leurs textes.
5. **Le domaine affiché** : lekitduvoyageur.fr sert aujourd'hui un autre site (hébergé chez o2switch) ; à confirmer avant de l'afficher en fin de film.

## 4. Ordre et contrôles

Lot 1 → Lot 2 → Lot 3 (Compas puis Kit Studio en premier) → Lot 5 → Lot 4. Chaque vidéo sort avec `SPEC.md`, `REVIEW.md`, `hyperframes check` sans erreur, une planche de contrôle (une image par seconde) et des mesures de son. Le son est mesuré, et dit « non écouté ».
