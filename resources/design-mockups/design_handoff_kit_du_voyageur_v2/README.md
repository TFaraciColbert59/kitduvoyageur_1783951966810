# Handoff V2 — Le Kit du Voyageur · Parcours Boutique

## Overview

Ce paquet complète le handoff V1 (Design System + Home + Recherche + Détail aventure) avec **5 écrans reliés du parcours boutique** :

1. **Boutique** — catalogue éditorial (style Aesop/Patagonia)
2. **Fiche Produit** — page produit XL (sac 45 L en exemple)
3. **Configurateur** — assistant multi-étapes qui compose un sac sur mesure
4. **Panier** — récap et cross-sell
5. **Paiement** — checkout Stripe multi-méthodes

Chaque écran est livré en **desktop 1280 px + mobile 375 px côte à côte** pour couvrir les deux formats. Un fichier `Index.html` mis à jour sert de hub reliant les 9 écrans totaux du produit.

**Prérequis :** ce paquet s'appuie sur `tokens.css` et l'écosystème documenté dans le handoff V1 (`design_handoff_kit_du_voyageur/README.md`). Reprenez d'abord la V1 pour les tokens de base, puis appliquez ce README V2 pour le parcours d'achat.

## About the Design Files

Les fichiers HTML/CSS livrés ici sont des **références de design** — des maquettes montrant l'aspect visuel et le comportement. **Ils ne doivent pas être copiés-collés en production.**

La tâche du développeur est de **recréer ces designs dans l'environnement du produit**. Pour un projet e-commerce de cette envergure, la stack recommandée est :

- **Next.js 14 App Router** (SSR pour SEO produits + performance)
- **Tailwind CSS** avec les tokens repris dans `tailwind.config.ts`
- **shadcn/ui** pour les primitives (button, input, select, radio, dialog)
- **Stripe Elements** pour le paiement (jamais collecter le PAN soi-même)
- **Zustand** ou **Jotai** pour l'état panier + configurateur (client-side, persisté localStorage)
- **Zod** + **react-hook-form** pour la validation formulaires
- **Framer Motion** pour les transitions entre étapes du configurateur

## Fidelity

**Hi-fi (haute fidélité).** Toutes les valeurs (couleurs, spacings, radii, typographies) sont finales et doivent être portées 1:1. Les micro-interactions sont documentées ligne par ligne.

Le fichier `shop.css` embarque les motifs partagés entre les 5 écrans (nav, footer, breadcrumb, artboards responsive) — à extraire en composants réutilisables côté React (`<ShopNav />`, `<ShopFooter />`, `<Breadcrumb />`).

---

## Design Tokens

**Tous les tokens sont hérités du handoff V1** (`tokens.css`). Rappels courts :

- **Primary** : `--lkv-forest-800: #1F4A3A` (hover : `--lkv-forest-700: #2E6F57`)
- **Accent sauge** : `--lkv-sage-500: #6DAA7D` / `--lkv-sage-100: #DDEEE5` (fond éclairci)
- **Accent chaud** : `--lkv-warm-500: #C99B5A` (rating, promotions)
- **Fond page** : `--lkv-paper: #F8FAF8` (principal) / `--lkv-stone-50: #F4F3EE` (secondaire boutique)
- **Body** : `--lkv-ink-900: #111614` / `--lkv-ink-500: #566159` (secondaire) / `--lkv-ink-400: #7A857C` (labels)

**Typos :**
- General Sans (400/500/600/700) — UI
- Fraunces italic 400 — accents (mots poétiques, numéros d'étapes)

**Radius :**
- Pills : `999px` (boutons, chips, champs, avatar)
- Cartes produit : `28px`
- Champs de saisie beige : `14px`
- Ships options / feats : `16px`
- Cellules internes / thumbnails : `12–16px`
- Card visuelle CB : `18px`

**Ombres :** `--lkv-shadow-xs` (repos) → `--lkv-shadow-md` (hover carte) → `--lkv-shadow-lg` (survol grosse carte). CTA principal ajoute `0 8px 24px rgba(31,74,58,0.28)` au hover.

**Motion :** transitions par défaut 320 ms `cubic-bezier(0.22, 0.61, 0.36, 1)`. Micro-hover : 180 ms.

---

## Composants réutilisables (parcours boutique)

### `<ShopNav />` (desktop)

- **Hauteur** : ~76 px (padding 18 px vertical × 40 px horizontal)
- **Background** : `rgba(255,255,255,0.9)` + `backdrop-filter: blur(24px) saturate(1.2)`
- **Border-bottom** : `1px solid rgba(11,31,23,0.06)`
- **Position** : `sticky; top: 0; z-index: 20;`
- **Structure** : logo (26 px) + wordmark 16 px | liens 14 px | icônes recherche/heart/panier + avatar
- **Badge panier** : cercle 16×16 min, absolute top-4 right-4, background `--lkv-forest-800`, texte blanc 10 px 600
- **Avatar** : 40×40 pill, dégradé `linear-gradient(135deg, --lkv-forest-700, --lkv-sage-500)`, initiales blanches 13 px 600

### `<Breadcrumb />`

- Padding 20 px 40 px 0, font 13 px `--lkv-ink-500`
- Séparateurs : `<span class="sep">/</span>` avec `opacity: 0.35`
- Item actif : `--lkv-ink-900` font-weight 500

### `<ShopFooter />` (léger, mode boutique)

- Padding 60 40 40 px, background `--lkv-forest-950`, texte `rgba(255,255,255,0.72)`
- Grid `2fr 1fr 1fr 1fr`, gap 40 px
- Brand line en display 24 px + Fraunces italic pour "c'est votre voyage"
- Listes : `h5` uppercase 11 px letter-spacing 0.14em, `li` 13 px 3 px vertical

### `<MobileTopBar />` (mobile)

- Padding 12 14 px, background blanc, border-bottom subtle
- 3 zones : retour (36 px pill stone-50) | centre 14 px 500 | action droite
- Badge sur icônes : 14×14 min, top-2 right-2, `--lkv-forest-800` texte blanc 9 px

### `<MobileTabBar />` (mobile)

- Absolute bottom 12 12 12, radius 999 px, glass blanc 90 %
- 5 icônes 34 px, actif = pill `--lkv-forest-800` + icône blanche
- Ordre : accueil / recherche / boutique (panier) / favoris / profil

---

## Screens / Views

### 1. Boutique (`Boutique.html`)

- **Purpose** : catalogue produit style éditorial magazine
- **Layout Desktop 1280 px** :
  - `ShopNav`
  - **Hero** : padding 60 60 40, background `--lkv-stone-50`, grid `1.4fr 1fr` fin
    - Gauche : eyebrow "Boutique · Édition automne 2026" + h1 88 px avec Fraunces sur "rien de plus" + lead 17 px 460 max
    - Droite : compteur "6 pièces" en display 44 px + label descriptif — texte aligné à droite
  - **Sticky filter strip** (top: 76 px, z-index: 15) : padding 24 60
    - Segment pills groupé dans un conteneur `--lkv-paper` radius 999 (Tout / Portage / Couchage / Vêtements / Éclairage / Hydratation)
    - Droite : "Trier par" + 2 buttons pill blanc "Coup de cœur ▾" et "Filtres"
  - **Feat band** : padding 96 60, background `--lkv-forest-900`, grid 1fr/1fr
    - Visuel : aspect 4/5, radius 28
    - Texte : kind chip glass sauge + h2 68 px (Fraunces sur "toile cirée") + lead + price-row (40 px + strike + save chip sauge sur forêt) + 2 CTA
  - **Category header** : padding 96 60 32, h2 44 px + lien "Voir tout · 6 pièces →" (gap augmente au hover)
  - **Grid 3 col** : padding 0 60 96, gap 24 px, cartes produit :
    - Aspect 4/5 photo, radius 28
    - Chip catégorie top-left, heart top-right (36 px pill blanc 90 %)
    - Body : padding 20 24 24, catégorie 11 px 0.14em uppercase + h3 20 px (Fraunces sur mots-clés) + price 20 px + arrow pill 40 px (stone-100 → forest-800 blanc au hover, translate 4px -4px)
    - Dernière cellule = **card CTA vers Configurateur** : bg dégradé forêt, illustration SVG sac linéaire 80 px, "Composer votre sac" (sauge sur "votre sac")
  - **Inspire band** : padding 96 60, background `--lkv-paper`, grid 1fr/1fr
    - Visuel workshop.jpg 4/3 radius 28
    - Texte : eyebrow + h3 52 px + lead + CTA primary
  - `ShopFooter`
- **Layout Mobile 375 px** :
  - Top bar avec burger + "Boutique" + panier badge 3
  - Hero compact : eyebrow 10 px + h1 44 px + lead 13 px + strip tabs scrollable
  - **Feat card mobile** : aspect 4/5, gradient overlay bas, chip + heart en haut, prix + CTA en bas
  - Category header 22 px
  - **Grid 2 col** : cartes 4/5 photo + body compact (catégorie 9 px, nom 13 px 500, prix 14 px)
  - Dernière cellule = même CTA configurateur, dégradé forêt
  - Tab bar en bas

### 2. Fiche Produit (`Fiche Produit.html`)

- **Purpose** : fiche détaillée du sac 45 L (template applicable à tous les produits)
- **Layout Desktop 1280 px** :
  - `ShopNav` + `Breadcrumb`
  - **Body** : padding 40 60 96, background `--lkv-stone-50`, grid `1fr 480px` gap 60
  - **Galerie (sticky top 100 px)** : grid `100px 1fr` gap 16
    - Colonne thumbs : 5 vignettes 100 px carré radius 14, border 2px transparent → forest quand `.on`, hover scale 1.02
    - Main : aspect 4/5 radius 24, chip top-left, bouton zoom 44 px pill glass bottom-right
  - **Buy panel (droite)** :
    - Kind pill : bg sauge-100, texte forest-800, 11 px uppercase 0.14em
    - h1 56 px avec Fraunces italic sur mot-clé
    - Rating line : étoile 14 px chaude + strong "4,9" + "· 128 avis · 47 testeurs terrain"
    - Description 16 px 1.55, séparée par border-bottom
    - **Blocs options** :
      - Coloris : label + valeur, swatch-row de 44 px pills border transparent → forest 2px, padding 3 px interne, fill couleur 100%
      - Volume : boutons pill 10 16, disabled = line-through + `--lkv-ink-400`
      - Sangles : idem
    - **Price block** : padding 20 vertical, borders top/bottom, prix 40 px + "TVA incluse" 14 px `--lkv-ink-400` + stock avec dot sauge pulsée `box-shadow: 0 0 0 4px rgba(109,170,125,0.2)`
    - CTA row : primary lg "Ajouter au panier" avec icône panier + ghost icône heart 48 px avec border
    - **Promises grid 2×2** : icônes carré radius 14 sauge-100 + texte 12 px 500 avec small 10 px description
  - **Narrative band** : padding 96 60, background `--lkv-paper`, grid 1fr/1fr
    - Workshop image aspect 4/5 radius 28
    - h2 56 px + p + stats grid 3 col (32 px + Fraunces italic sur unités + label 12 px uppercase)
  - **Specs band** : padding 0 60 96, section blanche radius 28 padding 48
    - h3 32 px "Spécifications techniques"
    - Grid 2 col × 12 rows, chaque row `display: flex justify-between padding 16 vertical border-bottom subtle` — clé gauche `--ink-500`, valeur droite 900 500
  - **Related** : padding 0 60 96, grid 3 col cards horizontales (thumb 96 + info + prix)
  - `ShopFooter`
- **Layout Mobile 375 px** :
  - Top bar + "Sac 45 L" 12 px `--ink-500` + panier badge
  - Galerie 4/5 avec chip + heart + dots swipe bas (5 dots, actif = pill 16 px)
  - Buy compact : kind pill 10 px + h1 30 px + rate 12 px + desc 13 px + coloris swatches + volume opts
  - Promises 2×2 compact
  - **Bottom CTA bar** absolute bottom : prix 20 px + petit "TTC" + button forêt "Ajouter au panier"

### 3. Configurateur (`Configurateur.html`)

- **Purpose** : assistant 5 étapes qui compose un sac sur mesure
- **Layout Desktop 1280 px** :
  - `ShopNav` (avec bouton "Quitter le configurateur" ghost sm à droite)
  - **Body** : grid `1fr 480px`, min-height 800 px
  - **Colonne gauche (padding 60)** :
    - **Stepper horizontal** : 5 étapes reliées par `.sep` 1 px, chaque étape :
      - `.n` cercle 28 px : done = sauge-100 fond avec check icon, on = forest-800 fond blanc, à venir = stone-100 fond
      - numéro en Fraunces italic 13 px pour étapes non terminées
      - label 13 px, `--ink-900` 500 si actif, sinon `--ink-400`
    - **Step eyebrow** : "03" Fraunces italic 44 px + label "Météo attendue · sélectionnez une réponse"
    - **Question** : h2 56 px avec Fraunces italic sur mot-clé (ex. `attend ?`)
    - **Description** : 16 px 1.55 `--ink-500` 480 max
    - **Options grid 2×2** : cartes `.opt-card` blanches radius 20 padding 24, border 2px transparent → forest quand `.on` + ring `0 0 0 4px rgba(31,74,58,0.08)`
      - icône 40 px carré radius 12 sauge-100 forêt → forêt blanc quand actif
      - h4 20 px + Fraunces sur mot-clé
      - p 13 px `--ink-500`
      - hover : `translateY(-2px)` + shadow-md
    - **Actions row** : border-top, gauche "← Précédent" ghost, droite CTA primary lg "Continuer vers Confort →"
  - **Colonne droite (background `--lkv-forest-900`, texte blanc)** :
    - Overlay workshop image opacity 15 % + grayscale
    - **Result eyebrow** pill glass sauge avec dot pulsée (`@keyframes pulse`)
    - **Result title** 44 px Fraunces italic sur "en cours" `--sage-300`
    - **Result lead** 15 px 460 max
    - **Kit-list** : bloc radius 20 padding 20 24, background `rgba(255,255,255,0.05)` + border `rgba(255,255,255,0.1)`
      - Head : label uppercase 12 px + strong "1,4 kg"
      - Item : cercle 18 px sauge-500 avec check (validé) ou dashed transparent 30 % (en attente), texte 14 px + prix mono 12 px
      - Items en attente : opacity indirect via `--ink-300` équivalent
      - Total : padding-top border-top, label + n 28 px avec Fraunces italic sauge sur "€"
    - **Result meta grid 2×2** : label uppercase 11 px + valeur 16 px 500 (avec Fraunces sur unités)
    - Footnote 12 px `rgba(255,255,255,0.5)`
- **Layout Mobile 375 px** :
  - Top bar + "Composer un sac" + "Quitter"
  - **Progress bar** : 5 pilules 4 px, sauge-500 pour done, forest-800 pour on, stone-100 pour à venir
  - Step info : label uppercase + numéro Fraunces italic 22 px
  - Question 28 px + description 13 px
  - Options empilées `.m-opt-c` : icône 32 px + titre 15 px + description 11 px
  - **Résumé sombre** : bloc `--forest-900` radius 18, kit items compact + total 22 px
  - **Bottom bar** : bouton retour 46 px pill blanc + CTA "Continuer" forêt gros
- **Comportement** :
  - Chaque clic option = state update + auto-scroll suivant (ou wait for CTA)
  - Colonne droite se met à jour en direct : total, poids, items validés/pendants
  - localStorage `lkv_config = { step, usage, duration, weather, comfort }` — reprise si reload
  - Étape 5 = récap avec drag-to-remove sur chaque item + CTA "Ajouter au panier"

### 4. Panier (`Panier.html`)

- **Purpose** : revue du panier + cross-sell + résumé sticky
- **Layout Desktop 1280 px** :
  - `ShopNav` + `Breadcrumb` (Accueil / Boutique / Panier)
  - **Body** : padding 40 60 96, background `--paper`
  - **Cart head** : h1 "Votre panier." (Fraunces sur "panier") 60 px + count "3 articles · 1,4 kg · sous-total 656 €" 15 px `--ink-500`, séparés par border-bottom
  - **Grid `1fr 400px`** gap 40, align-start :
    - **Items (gauche)** :
      - Chaque item `.cart-item` : grid `140px 1fr auto` gap 24 padding 24, blanc radius 24, hover shadow-sm
      - Thumb 140 carré radius 16
      - Info : cat uppercase 11 px `--ink-400` + h4 22 px (Fraunces sur mot-clé) + opts row avec pastilles swatch 14 px + actions "Enregistrer / Retirer" 12 px `--ink-500` (hover forest)
      - Price col : qty pill stone-50 avec boutons cercle blanc 22 px pour -/+ + prix 22 px avec "TVA incluse" 11 px `--ink-400` à droite
    - **Cross-sell** en bas des items : dégradé sauge-100 → paper radius 24, image 100 px + body + CTA pill blanc "84 € →"
    - **Summary (droite, sticky top 100)** : padding 32 radius 28 shadow-sm blanc
      - h3 24 px "Récapitulatif"
      - Rows 14 px : sous-total, poids (dim), livraison (`.free` en `--forest-700` 500), TVA (dim)
      - Promo pill : input stone-50 + button `--ink-900` blanc "Appliquer"
      - Total : border-top, label 16 px 500 + n 32 px 500
      - CTA "Passer au paiement" pill forêt full-width padding 16
      - Safe line : 12 px `--ink-400` avec icône cadenas + "Paiement sécurisé Stripe"
      - Paylogos : 5 pills stone-50 padding 6 10 (VISA / MC / AMEX / Apple Pay / PayPal), 10 px 600
      - **Promises strip** stone-50 radius 16 padding 16 : grid 3, icône 32 px blanche + label 10 px 500 (Garantie à vie / Retour 30 j / 100 % Europe)
  - `ShopFooter`
- **Layout Mobile 375 px** :
  - Top bar avec retour + "Panier" + "3 art."
  - Head compact h1 32 px + count
  - Items empilés `.m-item` : thumb 76 + info compact + qty pill mini + prix
  - Cross-sell compact
  - **Bottom sheet fixe** : rows sous-total + livraison + total 22 px + CTA "Passer au paiement" pill forêt full-width shadow-lg

### 5. Paiement (`Paiement.html`)

- **Purpose** : checkout complet Stripe
- **Layout Desktop 1280 px** :
  - **ShopNav simplifiée** : logo + "Paiement sécurisé · Stripe" (icône cadenas) au centre + "← Retour au panier" ghost droite
  - **Pay progress** : padding 24 60, border-bottom subtle
    - 3 étapes : Panier (done, check icon vert) › Livraison & paiement (on) › Confirmation (à venir)
    - Chip sécurité sauge à droite : "Paiement 100 % sécurisé"
  - **Body** : padding 48 60 96, grid `1fr 400px` gap 40
  - **Colonne gauche** :
    - h1 44 px "Presque parti." Fraunces sur "parti"
    - **Section 01 · Vos coordonnées** : card blanche radius 24 padding 32, shadow-xs
      - Head : h3 20 px avec numéro Fraunces italic 26 px + "Se connecter" 13 px forêt
      - Border-bottom subtle sous head
      - Field grid : email full-width + case à cocher journal (cb 20 px rounded 6 px, on = forêt fond + check blanc)
    - **Section 02 · Livraison** : mêmes patterns
      - Grid 2 col : prénom / nom / adresse full / complément full / CP / ville / pays (select) / téléphone
      - Champs `.field input` padding 14 16 bg stone-50 radius 14, focus = bg blanc + border forêt + shadow ring
      - **Ship options** (3) : cards stone-50 radius 16 padding 20, border 2px transparent → forest quand `.on`
        - Radio custom cercle 20 px avec dot 8 px interne quand actif
        - Label : titre 15 px avec Fraunces sur mot-clé + description 12 px `--ink-500`
        - Prix : "Offerte" en `--forest-700` 500 ou "14 €" en `--ink-900` 500
    - **Section 03 · Paiement** :
      - **Pay methods** : 4 tabs pill stone-50 radius 14 padding 16, 2 lignes (icône + label) — on = blanc + border forest
      - **Card visual** : aspect 1.586/1 max 340 px marge droite, dégradé `--forest-900 → --forest-800`, chip carré 40×30 dégradé warm, numéro mono 20 px lettering, foot avec titulaire + expire + marque VISA italic 20 px
      - **Field grid** : numéro full / expiration / CVC / titulaire full
      - Case "Enregistrer cette carte" activée par défaut
  - **Order review (droite, sticky top 100)** : blanc radius 28 padding 32 shadow-sm
    - h3 20 px "Votre commande"
    - Review items : thumb 56 avec badge quantité (cercle 20 px min padding 5 forest blanc top-right offset -5), info nom 13 px avec Fraunces + opts 11 px `--ink-400` + prix 13 px 500
    - Totals : rows 13 px, `.free` en forêt-700, TVA affichée (20 %, incluse)
    - Total : border-top, label 15 px 500 + n 28 px 500
    - **Pay CTA** : "Payer 656 € par carte" pill forêt full padding 18, hover = forest-700 + translate + shadow
    - Fine 11 px `--ink-400` avec liens forêt soulignés
- **Layout Mobile 375 px** :
  - Top bar : retour + "Paiement" + chip "Sécurisé" sauge-100 forest-800 avec cadenas
  - Progress 3 pilules
  - Step info + h1 30 px
  - Sections `.m-pay-section` compactes : head + fields inline, ship options empilées
  - Pay methods 3 tabs (Carte / Apple / Alma), field grid mobile
  - **Bottom fixe** : rows sous-total + livraison + total + CTA "Payer 656 € par carte" pill forêt shadow

---

## Interactions & Behavior

### Configurateur — flow complet

- State : `{ currentStep: 1-5, usage, duration, weather, comfort, kit: [] }`
- Chaque option sélectionnée met immédiatement à jour le `kit` (produits ajoutés dérivés) et le total à droite
- Boutons CTA : `Continuer` avancé step, `Précédent` recule (garde les choix)
- Étape 5 = récap éditable → CTA "Ajouter au panier" = ajout multiple + navigation `/panier`
- Persistance : `localStorage.lkv_config` (rehydraté au mount, effacé après ajout panier)

### Panier — quantités

- Boutons -/+ : update local + optimistic + mutation API
- Bouton "Retirer" : confirm inline (petit tooltip), soft-delete pour undo 5s
- Bouton "Enregistrer" : move to wishlist (icône reste allumée)
- Champ promo : validation côté serveur, feedback inline erreur/succès
- Cross-sell : algo simple = 1 produit complémentaire non présent dans panier

### Paiement — Stripe integration

- **Ne jamais** collecter le numéro CB en vanilla input — utiliser **Stripe Elements** (le HTML montre l'apparence cible, à styler via `paymentElementOptions`)
- Card visual à gauche est **décorative** — met à jour dynamiquement les 4 derniers chiffres + expiration + brand au fur et à mesure de la saisie (via `paymentMethod` callbacks Stripe)
- Sur soumission : `stripe.confirmPayment` avec `return_url: /paiement/confirmation`
- Erreurs : afficher dans un `<Alert />` en haut de la section 03

### Hover states (tous les écrans)

| Élément | Hover |
|---|---|
| Card produit boutique | `translateY(-4px)` + `shadow-lg` + arrow pill devient forêt blanc + `translate(4px, -4px)` |
| Cart item | `shadow-sm` |
| Thumbnail galerie | `scale(1.02)` |
| Zoom button | `scale(1.05)` |
| Swatch | `scale(1.05)` |
| Opt button (non on) | border-color → forêt |
| Ship option | background → blanc (depuis stone-50) |
| Pay method (non on) | background → blanc |
| CTA principal | `translateY(-1px)` + shadow verte |

### Animations spécifiques

- **Dot pulsé du configurateur** : `@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }`, 2s infinie `--lkv-ease`
- **Stepper** : transition 320 ms sur le fond de `.n` (stone → forest quand on avance)
- **Bottom bars mobile** : `box-shadow: 0 -8px 24px rgba(11,31,23,0.08)` — pas d'anim, juste sticky

### Responsive

Même breakpoint principal `< 900px` qu'en V1. En prod :
- Boutique : grille 3 col → 2 col à 900, 1 col à 640
- Fiche produit : split 1fr/480 → gallery pleine largeur au-dessus, buy panel dessous à 900
- Configurateur : split 1fr/480 → colonne résultat en drawer bottom-sheet toggle sur mobile
- Panier : split 1fr/400 → summary en sticky bottom sheet sur mobile
- Paiement : idem

---

## State Management

### Panier (Zustand recommandé)

```ts
type CartItem = { id, productId, variantId, qty, unitPrice, addedAt };
type CartStore = {
  items: CartItem[];
  add(product, variant, qty), update(id, qty), remove(id),
  saveForLater(id), applyPromo(code),
  subtotal, weight, total, // getters dérivés
};
// Persist middleware localStorage
```

### Configurateur

```ts
type ConfigStore = {
  currentStep: 1|2|3|4|5;
  usage: 'day'|'weekend'|'trek'|'expedition' | null;
  duration: 'day'|'2-3d'|'week'|'longer' | null;
  weather: 'dry-warm'|'cool-mist'|'rainy'|'cold-dry' | null;
  comfort: 'minimal'|'standard'|'premium' | null;
  // Dérivé de tous ces choix (via fonction pure)
  kit: Product[]; totalPrice, totalWeight;
  next(), prev(), reset(), commitToCart()
};
```

### Checkout

- `react-hook-form` avec `zodResolver`
- Schéma Zod : email valide, adresse France (regex CP 5 digits), téléphone international
- **Stripe PaymentIntent** créé côté serveur au premier chargement de `/paiement` (montant = cart.total server-recomputed)
- Sur succès → redirect `/paiement/confirmation?intent=pi_xxx` — page à concevoir dans un prochain lot

---

## Assets

**Nouvelles images IA générées** (dossier `assets/`) :

| Fichier | Dimensions | Usage |
|---|---|---|
| `product-backpack-2.jpg` | 896×1200 | Sac 45L vue 3/4 — hero fiche + feat band boutique + panier |
| `product-sleeping.jpg` | 896×1200 | Duvet 3 saisons — carte catalogue + panier |
| `product-tent.jpg` | 896×1200 | Tente 2 places — carte catalogue |
| `product-bottle.jpg` | 896×1200 | Gourde titane 1L — carte catalogue + panier |
| `product-jacket.jpg` | 896×1200 | Veste 3 couches — carte catalogue |
| `product-headlamp.jpg` | 896×1200 | Frontale 350lm — carte catalogue + cross-sell panier |
| `portrait-1.jpg` | 1024×1024 | Portrait client (réservé lot suivant — communauté) |
| `workshop.jpg` | 1376×768 | Atelier Manosque — inspire band + narrative fiche + configurateur overlay |

**À remplacer par de vraies photos** pour la production. Style à respecter :
- Fond linen beige neutre
- Lumière naturelle latérale
- Négatif généreux (produit ~50 % du cadre)
- Style Patagonia / Filson / Aesop catalog

**Fonts, icônes, Leaflet** : voir handoff V1.

---

## Files

Fichiers de référence inclus :

- `Index.html` — hub mis à jour avec les 9 écrans (4 V1 + 5 V2 + bandeau lot suivant)
- `Boutique.html` — catalogue
- `Fiche Produit.html` — fiche sac 45 L
- `Configurateur.html` — assistant 5 étapes (étape 3 affichée par défaut)
- `Panier.html` — panier + cross-sell
- `Paiement.html` — checkout Stripe
- `tokens.css` — tokens partagés (repris de V1)
- `shop.css` — styles boutique partagés (nav, footer, breadcrumb, artboards)

**À copier depuis le paquet V1** : `Home.html`, `Recherche Carte.html`, `Detail Aventure.html`, `Design System.html`, `tweaks_panel.jsx`, `assets/logo-mark.svg`.

Images `assets/*.jpg` non embarquées (trop volumineuses) — listées ci-dessus.

---

## Ce qui reste à concevoir (lots suivants)

Univers demandés dans le brief initial, non encore livrés :

- **Compte** : profil public + dashboard + paramètres + badges
- **Communauté** : feed + post + profil utilisateur + groupes
- **IA** : chat recommandation + itinéraire généré
- **Journal de voyage** : timeline + album + statistiques + éditeur
- **Marketplace / location** : recherche + fiche annonce + messagerie
- **Guides** : bibliothèque + lecture + téléchargements
- **Admin** : dashboard + gestion users/produits/aventures

Tous ces écrans devront réutiliser strictement `tokens.css` + `shop.css` (et créer `community.css` / `account.css` etc. si besoin de patterns nouveaux).
