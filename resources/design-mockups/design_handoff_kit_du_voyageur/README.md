# Handoff : Le Kit du Voyageur — Design System & 4 écrans

## Overview

**Le Kit du Voyageur** est une plateforme premium de voyage outdoor (refuges, bivouacs, cabanes, vans) inspirée d'Airbnb, AllTrails, Patagonia et Arc'teryx. Ce paquet contient le design system complet ainsi que quatre écrans hi-fi entièrement conçus :

1. **Index / Hub** — page d'accueil de navigation entre les livrables
2. **Design System** — tokens, typographie, composants (référence)
3. **Home** — page marketing d'accueil avec hero, recherche, sections
4. **Recherche + Carte** — split liste/carte interactive (Leaflet)
5. **Détail aventure** — fiche immersive d'une cabane/refuge

Chaque page cliente (Home / Recherche / Détail) est présentée en **desktop 1280 px + mobile 375 px côte à côte** pour couvrir les deux formats.

## About the Design Files

Les fichiers HTML/CSS livrés ici sont des **références de design** — des maquettes / prototypes montrant l'aspect visuel et le comportement attendu. **Ils ne doivent pas être copiés-collés directement en production.**

La tâche du développeur est de **recréer ces designs dans l'environnement du produit** : si le codebase existe déjà, respecter ses conventions (React + Tailwind, Next.js, Nuxt, Vue, SwiftUI, Flutter, …) et son design system technique ; s'il n'y a pas encore de codebase, choisir la stack la plus adaptée (recommandation par défaut : **Next.js 14 App Router + Tailwind CSS + shadcn/ui + Leaflet**).

Les décisions visuelles (couleurs, typo, spacing, radius) sont finales et documentées ci-dessous — elles doivent être portées 1:1. Le HTML/CSS des fichiers de référence est juste un vecteur pour communiquer ces décisions.

## Fidelity

**Hi-fi (haute fidélité).** Chaque hex, chaque taille de police, chaque radius, chaque ombre est arrêté et documenté. Les proportions desktop 1280 px et mobile 375 px doivent être respectées au pixel près. Les micro-interactions (hover : `translateY(-1px)`, ombre douce ; transitions 320 ms `cubic-bezier(0.22,0.61,0.36,1)`) sont également finales.

**En bref : recréez pixel-perfect en utilisant les composants du codebase, mais reprenez les tokens tels quels.**

---

## Design Tokens

Tous les tokens sont définis dans `tokens.css` (fichier joint).

### Couleurs

| Token | Hex | Usage |
|---|---|---|
| `--lkv-forest-950` | `#0B1F17` | Backgrounds sombres, footer |
| `--lkv-forest-900` | `#12281E` | Backgrounds éditoriaux sombres |
| `--lkv-forest-800` | `#1F4A3A` | **Primary** — CTA, logo, accents forts |
| `--lkv-forest-700` | `#2E6F57` | Primary hover, variantes |
| `--lkv-forest-600` | `#405E48` | Mousse |
| `--lkv-sage-500` | `#6DAA7D` | Accent secondaire, points de statut |
| `--lkv-sage-300` | `#AECBB4` | Accent sur fonds sombres |
| `--lkv-sage-200` | `#C8DDCC` | Emphases serif sur photo |
| `--lkv-sage-100` | `#DDEEE5` | Brume, backgrounds doux |
| `--lkv-ink-950` | `#0B0F0D` | Texte extrême |
| `--lkv-ink-900` | `#111614` | **Body text principal** |
| `--lkv-ink-700` | `#2A322E` | Body secondaire |
| `--lkv-ink-500` | `#566159` | Métadonnées, sous-titres |
| `--lkv-ink-400` | `#7A857C` | Placeholders, labels discrets |
| `--lkv-ink-300` | `#A8B0A9` | Séparateurs texte |
| `--lkv-stone-100` | `#EFEEE9` | Backgrounds secondaires |
| `--lkv-stone-50` | `#F4F3EE` | Champs de recherche |
| `--lkv-paper` | `#F8FAF8` | **Background page principal** |
| `--lkv-warm-500` | `#C99B5A` | Chaud (couchers de soleil, données ponctuelles) |
| `--lkv-warm-300` | `#E4C695` | Accent chaud clair, étoiles rating |

### Typographie

Deux familles seulement :

- **General Sans** (400 / 500 / 600 / 700) — corps de texte, titres, UI
  Source : `https://fonts.cdnfonts.com/s/95723/GeneralSans-*.woff2`
- **Fraunces** (variable, italic 400) — accents éditoriaux (mots poétiques dans les titres, numéros de jours, etc.)
  Source : Google Fonts `Fraunces:opsz,wght@9..144,300..600`

**Échelle typographique :**

| Nom | Taille | Poids | Letter-spacing | Line-height | Usage |
|---|---|---|---|---|---|
| Display 1 | 96 px (hero desktop → 108 px sur Home) | 500 | -0.038em | 0.94 | Hero title principal |
| Display 2 | 64 px | 500 | -0.03em | 1 | Titres de section XL |
| Serif accent | 56 px | 400 italic (Fraunces) | -0.02em | 1.02 | Mot mis en valeur dans un titre |
| Heading 1 | 44 px | 500 | -0.02em | 1.08 | Titres de page secondaires |
| Heading 2 | 32 px | 500 | -0.015em | 1.15 | Sous-sections |
| Heading 3 | 24 px | 500 | -0.01em | 1.25 | Cartes titres |
| Body | 16 px | 400 | 0 | 1.55 | Corps de texte |
| Lead | 18 px | 400 | 0 | 1.5 | Paragraphes d'intro |
| Eyebrow | 12 px | 500 | 0.18em uppercase | — | Labels de section |
| Mono | 12 px | 400 | 0.02em | — | Numéros de section, tokens |

Le titre desktop en Home est **108 px** (encore plus grand que le token Display 1 générique) — c'est intentionnel pour l'impact photo XL.

### Espacements (grille 4 pt)

```
--s-1: 4    --s-2: 8    --s-3: 12   --s-4: 16   --s-5: 20
--s-6: 24   --s-8: 32   --s-10: 40  --s-12: 48  --s-16: 64
--s-20: 80  --s-24: 96  --s-32: 128
```

### Rayons

```
--r-xs: 6px      // très rare, tags mono
--r-sm: 10px     // inputs compacts
--r-md: 16px     // cellules internes
--r-lg: 24px     // panels
--r-xl: 28px     // cartes standard, glass panels
--r-2xl: 36px    // grandes cartes photo
--r-full: 999px  // pills, boutons, chips, avatars
```

### Ombres (toujours douces, jamais dures)

```css
--shadow-xs:    0 1px 2px rgba(11,31,23,0.04);
--shadow-sm:    0 2px 8px rgba(11,31,23,0.06);
--shadow-md:    0 8px 24px rgba(11,31,23,0.08);
--shadow-lg:    0 20px 48px rgba(11,31,23,0.14);
--shadow-xl:    0 30px 80px rgba(11,31,23,0.22);
--shadow-glass: 0 8px 32px rgba(11,31,23,0.12), inset 0 1px 0 rgba(255,255,255,0.4);
```

### Motion

- Durées : `--dur-fast: 180ms`, `--dur: 320ms`, `--dur-slow: 560ms`
- Easings : `--ease: cubic-bezier(0.22, 0.61, 0.36, 1)` (défaut), `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- **Règle** : les cartes montent de `-4px` au hover avec passage `shadow-sm → shadow-lg`. Les boutons montent de `-1px`. Chips flottantes du hero : `keyframes floatY` de ±6px sur 6s, easings en série (délai -2s, -4s).

---

## Composants clés

### Bouton (`.lkv-btn`)

- **Hauteur** : 48 px par défaut (`--btn-sm: 36`, `--btn-lg: 56`)
- **Radius** : `999px` (pill)
- **Padding X** : 22 px (sm: 14, lg: 28)
- **Font** : General Sans 500, 15 px, letter-spacing -0.005em
- **Gap icône/texte** : 8 px
- **Variantes** :
  - **Primary** : bg `--forest-800`, texte blanc. Hover : bg `--forest-700` + `shadow: 0 8px 24px rgba(31,74,58,0.28)`
  - **Light** : bg blanc, texte `--ink-900`. Hover : `shadow-md`
  - **Ghost** : transparent, texte `--ink-900`. Hover : bg `rgba(11,22,18,0.06)`
  - **Ghost-light** (sur fond sombre) : transparent, border `rgba(255,255,255,0.28)`, texte `rgba(255,255,255,0.9)`. Hover : bg `rgba(255,255,255,0.12)` + border `rgba(255,255,255,0.5)`
- **Micro-anim** : hover `translateY(-1px)`, active `translateY(0)`, transitions 180 ms

### Chip (`.lkv-chip`) — pill glass flottante

- **Hauteur** : 36 px, padding 0 14 px
- **Radius** : `999px`
- **Background** : `rgba(255,255,255,0.72)` + `backdrop-filter: blur(20px)`
- **Border** : `1px solid rgba(255,255,255,0.4)`
- **Shadow** : `shadow-sm`
- **Point de statut** (`<span class="dot">`) : 6×6 px cercle, couleur `--sage-500` par défaut, `--warm-500` pour signaler autre chose
- **Hover** : `translateY(-1px)` + `shadow-md`

### Card (`.lkv-card` / `.ds-preview-card`)

- **Background** : blanc
- **Radius** : 28 px
- **Shadow** : `shadow-sm` au repos → `shadow-lg` au hover
- **Hover** : `translateY(-4px)`, transition 320 ms `--ease-out`
- **Image** : ratio 320×200, radius top matching parent
- **Padding body** : 20 px
- **Structure interne** : titre (18/500), sous-titre (13/regular ink-500), separator top 1px `rgba(11,31,23,0.06)`, prix (20/500) à gauche, rating à droite

### Glass panels

**Clair** (`.lkv-glass`) : `rgba(255,255,255,0.62)` + `blur(24px) saturate(1.2)` + border blanc 50 %
**Sombre** (`.lkv-glass-dark`) : `rgba(11,22,18,0.42)` + `blur(28px) saturate(1.15)` + border blanche 14 %, texte blanc

### Search bar (Home + Recherche)

- **Container** : blanc, radius 999 px, shadow-md, padding 8 px, hauteur 76 px (desktop)
- **Field** : border-right 1 px `rgba(11,31,23,0.08)` sauf le dernier ; label eyebrow 11 px `--ink-400` + valeur 14 px `--ink-900`
- **Bouton loupe** : 60×60 px cercle `--forest-800`, icône blanche 22 px

### Navigation top (Home)

- **Style** : flottante glass, radius 999 px, backdrop-blur 24 px + saturate 1.4
- **Background** : `rgba(255,255,255,0.65)` + border `rgba(255,255,255,0.5)`
- **Shadow** : `0 8px 24px rgba(11,31,23,0.08)`
- **Padding** : 10 px 10 px 10 px 24 px (le CTA à droite est un bouton primary sm)
- **Liens actifs** : underline `--sage-500` 2 px, texte `--forest-800`

---

## Screens / Views

### 1. Index / Hub (`Index.html`)

- **Purpose** : navigation entre les 4 livrables, vue d'ensemble du système
- **Layout** :
  - Container `max-width: 1400px`, padding 80 60 100 60 px
  - Header en 2 colonnes 1.4fr / 1fr (titre à gauche, meta à droite), séparé par un `border-bottom 1px rgba(11,31,23,0.08)` avec `margin-bottom: 60px`
  - Grille de cartes : 6 cellules — hero pleine largeur (rangée 1), puis 2 rangées de `1.5fr 1fr`, rows de 380 px, gap 20 px
- **Cartes** :
  - Radius 32 px, padding 32 px
  - Cartes photo : background-image + overlay `linear-gradient(180deg, rgba(11,31,23,0.15) 0%, rgba(11,31,23,0.75) 100%)`
  - Titre bas (44 px) + sous-titre mono 12 px
  - Flèche haut-droite : cercle 52 px `rgba(255,255,255,0.15)` blur 12 px, se translate `translate(6px,-6px)` au hover
  - La carte "Design System" est claire (blanc + texte `--ink-900`) et affiche une mini-grille de swatches en bas

### 2. Design System (`Design System.html`)

- **Purpose** : doc interne — tokens et composants
- **Layout** :
  - Sidebar sticky 260 px + main
  - Main : padding 64 80 160, max 1240 px
- **Sections** : Colors, Typography, Spacing, Radius, Shadows, Buttons, Inputs, Chips, Cards, Glass, Navigation, Icons
- **Contenu** : voir Design Tokens ci-dessus. Chaque section est un `<section>` avec `.ds-section-head` (h2 40 px + numéro mono 12 px + border-bottom 1 px).

### 3. Home (`Home.html`)

- **Purpose** : page d'accueil marketing
- **Layout Desktop 1280 px** :
  - **Hero band 900 min-height** : nav flottante en haut (padding 20 px), photo pleine bande, overlay linear-gradient `rgba(11,31,23,0.25)` → `rgba(11,31,23,0.55)`, contenu en 2 col (1.15fr / 0.85fr)
    - Colonne gauche : badge "édition automne · 47 refuges partenaires" (chip glass), titre 108 px avec un mot en Fraunces italic `--sage-200`, lead 18 px `rgba(255,255,255,0.86)` (max 480 px), 2 CTA, block rating (étoile Fraunces 60 px + "1 800+ voyageurs racontent leur séjour")
    - Colonne droite : **carte de réservation glass-dark** — eyebrow, titre 26 px, 2 rangées de 2 champs (arrivée/départ + check-in/out), ligne prix (32 px) + capacité, CTA blanc large
  - **Chips flottantes** absolute right 60 top 130, colonne de 3, animation `floatY` de ±6px en 6s décalée
  - **Section "Trois façons de se perdre"** : padding 96 60, `.sub-head` titre 52 px + description 380 px à droite, grille `2fr 1fr 1fr` de 480 px avec overlay dégradé bas, chip catégorie top-left + flèche glass top-right
  - **Editorial band** : bg `--forest-900`, padding 96 60, 2 colonnes 1fr/1fr, à gauche : eyebrow sauge + h2 68 px avec accent Fraunces `--sage-300` + lead + CTA light + grille de 4 stats (48 px, unités Fraunces italic sauge), à droite : photo hikers en side-card avec caption bas-gauche
  - **Product band** : bg `--stone-50`, padding 96 60, 2 col — visuel produit ratio 1:1 radius 28 avec chip édition, texte + specs 2×2 + prix 40 px + 2 CTA
  - **Footer** : bg `--forest-950`, texte `rgba(255,255,255,0.75)`, brand statement 44 px avec Fraunces, 4 col (newsletter / Découvrir / Boutique / Maison)
- **Layout Mobile 375 px** :
  - Screen 812 px, radius 34 px dans bezel noir 12 px padding
  - Hero photo pleine hauteur avec overlay identique, nav pill glass (logo + burger), titre 44 px, lead 13 px, 3 chips, carte réservation glass-dark en bas, **tab bar bottom** flottante glass (accueil / recherche / carte / favoris / profil, actif = pill `--forest-800`)
- **Tweaks** : 3 variantes de hero (misty/solar/editorial) + 3 voix de titre (poétique/action/lieux) via panneau flottant

### 4. Recherche + Carte (`Recherche Carte.html`)

- **Purpose** : découvrir des refuges sur carte, liste synchronisée
- **Layout Desktop 1280 × 900 px** :
  - **Top bar** : padding 16 20, background blanc, border-bottom, logo + search pill (4 fields + bouton loupe forêt) + avatar
  - **Filters row** : padding 12 20, chips pilules 34 px, chip "Tous les filtres" avec icône, séparateurs 1 px 24 px verticaux
  - **Split** : grid `480px 1fr` fill remaining height
    - **Liste** : bg `--paper`, padding 20, overflow-y auto, header sticky (28 places · zone), items 12 px gap avec thumb 120×120 radius 14, heart 26 px cercle blanc top-right, contenu 4 lignes (titre, sub, facts en icônes texte, foot prix+rating)
    - **Item actif** : border `--forest-800` + ring `0 0 0 3px rgba(31,74,58,0.1)`
  - **Map (Leaflet)** :
    - Tiles CARTO Voyager (`{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`)
    - Marqueurs custom `.pin` : 42 px cercle blanc, border 1.5 px `--forest-800`, texte prix, hover/actif → bg `--forest-800` + texte blanc + scale 1.15
    - Overlays : "Massif de la Chartreuse" chip top-left, contrôles + / - / recenter top-right, légende bottom-left, carte du lieu actif bottom-right (glass 94% blanc, blur 20, 340 px)
- **Layout Mobile 375 px** :
  - Top : bouton retour + search pill (labels 2 lignes)
  - Tabs horizontaux scrollables (Refuges / Bivouac / etc.)
  - Map fullscreen sous les tabs
  - **Bottom sheet** absolute bottom 240 px, radius top 24, handle 44×4, header count + tri, card active, dots swipe
- **Comportement** :
  - Click sur item liste OU pin → `selectPlace(id)`
  - `selectPlace()` : active la liste, active le pin (pin actif au-dessus), pan la carte vers `[lat, lng]`, met à jour la carte overlay avec l'image/titre/prix
  - Auto-scroll de la liste vers l'item sélectionné (`scrollTo top`, comportement `smooth`)
  - Sur mobile, la même sélection est répliquée sur la seconde instance Leaflet

### 5. Détail aventure (`Detail Aventure.html`)

- **Purpose** : fiche d'une cabane/refuge, avec itinéraire et réservation
- **Layout Desktop 1280 px** :
  - **Hero band 620 px** : photo (`detail-hero.jpg`), overlay 3-stops, contient : breadcrumb 24 40 (Accueil / Aventures / Chartreuse / **Grand Vaneau**), boutons glass 42 px top-right (home / share / heart), title area padding 60 60 40 (chips catégorie glass, titre 88 px avec Fraunces italic sauge, meta ligne avec icônes 14 px et dots séparateurs), **stat panel** absolute bottom-right : 3 tuiles glass-dark 140 px min (Distance 27,4 km / Dénivelé +1 620 m / Difficulté 3/5) avec unités en Fraunces italic sauge
  - **Body band** : padding 80 60, 2 col `1.4fr 1fr` gap 60 px
    - Colonne principale : eyebrow, h2 44 px, lead 19 px (620 max), **feat-grid 2×3** (icônes 44 px carré radius 14 dans sauge-100, texte 15 px + description 13 px ink-500), séparateurs border-top et border-bottom, **itinéraire** avec 3 jours (numéro Fraunces italic 44 px `--forest-800` + titre 18 + body 14 ink-500 + distance mono à droite)
    - Colonne latérale : **side-card sticky** top 40, padding 28, radius 28, shadow-lg — head-row (prix 40 px + rating avec étoile 12 px chaude), side-form beige stone-50 avec cellules blanches interactives, side-details (récap prix), CTA `--forest-800` large, note "Vous ne paierez que 24 h avant l'arrivée" ; **host-block** en dessous : bg `--forest-900`, avatar 52 px dégradé warm+sage, texte blanc/rgba, bouton message rond
  - **Gallery band** : padding 0 60 96, h3 32 avec Fraunces, grille 5 photos `2fr 1fr 1fr` × 2 rows 260 px avec la grande à gauche full-height, dernière avec overlay "+ 24 photos"
- **Layout Mobile 375 px** :
  - Hero 380 px : boutons haut glass 36 px, contenu bas overlay : chips + titre 30 px + méta
  - Corps scrollable : stats 3-cells stone-50 radius 16, section eyebrows, feats 2×2 cards blanches, itinéraire compact
  - **CTA bar** absolute bottom 12 12, pill blanc shadow-lg : prix à gauche + bouton "Réserver" à droite

---

## Interactions & Behavior

### Hover states (obligatoires)

| Élément | Hover |
|---|---|
| Bouton primary | `translateY(-1px)` + shadow verte + bg vers `--forest-700` en 320 ms |
| Bouton light | `translateY(-1px)` + shadow-md |
| Bouton ghost | bg `rgba(11,22,18,0.06)` |
| Chip | `translateY(-1px)` + shadow-md |
| Carte (produit/aventure) | `translateY(-4px)` + shadow-lg (320 ms) + flèche interne translate |
| Item liste (place) | `translateY(-2px)` + shadow-md, border transparent → coloré si actif |
| Icône (design system) | border-color `--forest-800` + `translateY(-2px)` |
| Pin carte | scale 1.15 + bg `--forest-800` + texte blanc |
| Filtre chip | border et texte → `--forest-800` (ou état on = bg forêt) |
| Lien nav | color `--forest-800` |

### Focus (accessibilité)

Inputs (`.ds-input`) : `outline: none` + `border-color: --forest-800` + `box-shadow: 0 0 0 4px rgba(31,74,58,0.08)`.

### Animations

- **Chips flottantes du hero** (`.float-chips .lkv-chip`) : `@keyframes floatY { 0%,100% { translateY(0); } 50% { translateY(-6px); } }`, 6 s infini avec délais -2 s et -4 s pour désynchroniser les 3 chips.
- **Cartes de résultat sur la carte Leaflet** : le pin actif passe en `z-index: 1000` et scale 1.15 (`translate(-25px,-25px) scale(1.15)`) au lieu de `translate(-21px,-21px)`.
- **Auto-pan carte** : `map.panTo([lat,lng], { animate: true, duration: 0.6 })` à chaque `selectPlace`.
- **Auto-scroll liste** : `list.scrollTo({ top: item.offsetTop - 20, behavior: 'smooth' })`.

### Responsive breakpoints

Les fichiers de référence présentent desktop 1280 et mobile 375 côte à côte pour comparaison. **En production**, le seul vrai breakpoint est **`900px`** (mobile-first considéré, mais la V1 desktop-first est acceptable) :

- `< 900px` : grille de cartes hub passe en 1 colonne, hero titre → 56 px, meta row → 1 col

Un breakpoint intermédiaire (tablette ~768 px) est à définir par le développeur en respectant les mêmes règles.

---

## State Management

Aucun backend n'est branché — les données sont statiques dans les fichiers. Pour la production, prévoir :

- **Recherche/Carte** :
  - État courant : `{ selectedPlaceId, filters, mapBounds, sort }`
  - Sélection synchronisée liste ↔ carte via un store (Zustand / Redux Toolkit / Context React)
  - Data fetch : places par bounds carte (debounced 300 ms), refetch quand `mapBounds` change ou quand un filtre est modifié
- **Home Tweaks** : les 3 variantes de hero sont un mécanisme de design-time — en production, choisir une seule variante (celle validée avec le client) ou une A/B test simple.
- **Détail aventure** :
  - Form réservation : `{ checkInDate, checkOutDate, guests }` — mêmes contraintes qu'Airbnb (dates rangées, min 1 nuit)
  - Total = `pricePerNight × nights + fees` recalculé côté client, validé côté serveur
- **Favoris (heart)** : toggle optimiste, mutation vers l'API `/api/favorites/:placeId`

---

## Assets

Tous les assets sont dans le dossier `assets/` du projet source. Ce sont des images IA générées (modèle nano-banana-2), **libres de droit interne** au projet ; à remplacer par de vraies photos éditoriales pour la production.

| Fichier | Dimensions | Usage |
|---|---|---|
| `hero-misty.jpg` | 1376×768 | Hero variante Brumeux (Home) + carte 1 (Recherche) + gallery Détail |
| `hero-solar.jpg` | 1376×768 | Hero variante Solaire (Home) + carte 3 (Recherche) |
| `hero-editorial.jpg` | 1376×768 | Hero variante Éditorial (Home) + carte 4 (Recherche) + gallery Détail |
| `detail-hero.jpg` | 1376×768 | Hero pleine largeur Détail aventure |
| `adventure-hiking.jpg` | 896×1200 | Carte aventure "Chartreuse" + editorial band side + gallery |
| `adventure-bivouac.jpg` | 896×1200 | Carte aventure "Vercors" + carte 2 (Recherche) + gallery |
| `adventure-kayak.jpg` | 896×1200 | Carte aventure "Serre-Ponçon" + carte 5 (Recherche) + gallery |
| `product-backpack.jpg` | 1024×1024 | Product band Home (sac 45L) |
| `logo-mark.svg` | 32×32 | Logo — trois montagnes stylisées + soleil (dot). Inline SVG, `stroke: currentColor` |

### Fonts (à charger côté prod)

- **General Sans** — via CDN Fontshare ou self-host. Poids nécessaires : 400, 500, 600, 700.
- **Fraunces** — Google Fonts, axe italique. Utilisé uniquement pour des accents (jamais pour du body).

### Cartographie

- **Leaflet 1.9.4** (CSS + JS via unpkg avec `integrity`)
- **Tiles** : CARTO Voyager rastertiles (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`, subdomains `abcd`, attribution OSM + CARTO). Alternative Mapbox si le client en dispose.
- **Marker custom** : `L.divIcon` avec HTML `<div class="pin">…€</div>`, iconSize [42,42], iconAnchor [21,21]
- Le lat/lng des places est **fictif mais géographiquement cohérent** avec le massif de la Chartreuse — à remplacer par les vraies coordonnées.

---

## Files

Fichiers de référence inclus dans ce paquet :

- `Index.html` — hub
- `Design System.html` — doc du système
- `Home.html` — accueil avec Tweaks
- `Recherche Carte.html` — split liste + Leaflet
- `Detail Aventure.html` — fiche
- `tokens.css` — tokens partagés (utilisés par les 5 HTML ci-dessus)
- `tweaks_panel.jsx` — panneau de tweaks utilisé sur Home (à ne pas porter tel quel ; c'est un outil de design-time)

Assets binaires : voir dossier `assets/` du projet source (non embarqué dans ce paquet — trop volumineux).

---

## Ce qui n'est pas encore conçu (à venir V2)

Le client a explicitement demandé une V1 courte pour valider la direction. Pages à concevoir dans une V2 :

- Fiche produit + configurateur de sac
- IA / chat de recommandation
- Journal de voyage
- Profil / dashboard
- Communauté (feed)
- Marketplace / location entre particuliers
- Guides longs (lecture)
- Administration

Toutes ces pages devront réutiliser **strictement les mêmes tokens** définis ici.
