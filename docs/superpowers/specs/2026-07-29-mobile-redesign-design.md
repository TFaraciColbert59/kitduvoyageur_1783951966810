# Mobile Redesign — Le Kit du Voyageur

**Date :** 2026-07-29
**Statut :** Design validé
**Référence :** `C:\Users\Tony\Downloads\LKDV\Front end\Mobile\`

---

## 1. Design System (à partir de tokens.css référence)

### 1.1 Palette mobile

| Token | Valeur | Usage |
|-------|--------|-------|
| `--lkv-forest-950` | `#06120C` | Fond dark extreme |
| `--lkv-forest-900` | `#0B1F17` | Drawer header, fond hero |
| `--lkv-forest-800` | `#17402C` | **Primaire** — boutons, accents, tab active |
| `--lkv-forest-700` | `#205238` | Hover primaire |
| `--lkv-forest-600` | `#2D6B4A` | Gradients cartes |
| `--lkv-sage-500` | `#A8C8A0` | Badge, dot, accents doux |
| `--lkv-sage-300` | `#C6DCBE` | Fond cartes, états |
| `--lkv-sage-200` | `#DDE9D6` | Fond sections |
| `--lkv-sage-100` | `#EAF1E5` | Fond attributs, promos |
| `--lkv-stone-50` | `#F4F1EA` | Fond inputs, cartes secondaires |
| `--lkv-stone-100` | `#E9E4D9` | Bordures subtiles |
| `--lkv-stone-200` | `#DDD6C6` | Gris chaud |
| `--lkv-ink-900` | `#0B1F17` | Texte principal |
| `--lkv-ink-700` | `#384A42` | Texte secondaire |
| `--lkv-ink-500` | `#6B7A72` | Texte tertiaire |
| `--lkv-ink-400` | `#8B978F` | Meta, labels |
| `--lkv-ink-300` | `#AEB7B1` | Chevrons, séparateurs |
| `--lkv-paper` | `#FBFAF6` | Fond d'écran principal |

### 1.2 Typographie

| Rôle | Font | Détail |
|------|------|--------|
| **Sans (UI)** | `"Söhne", "Inter", -apple-system, sans-serif` | Poids 400/500/600 |
| **Serif (emphase)** | `"GT Alpina", "Cormorant Garamond", Georgia, serif` | Italic 400 — pour mots clés dans titres |
| **Mono (data)** | `"Söhne Mono", "JetBrains Mono", ui-monospace` | Poids 500 — stats, prix, meta |

**Règle d'emphase serif :** Dans tout titre contenant un mot ou groupe clé, ce mot est en `<em>` serif italic. Exemple : `"Six semaines, <em>quatre saisons.</em>"`

### 1.3 Ombres (ink-based, pas black)

```css
--lkv-shadow-xs: 0 1px 2px rgba(11,31,23,0.05), 0 1px 3px rgba(11,31,23,0.04);
--lkv-shadow-sm: 0 2px 6px rgba(11,31,23,0.06), 0 4px 12px rgba(11,31,23,0.05);
--lkv-shadow-md: 0 6px 16px rgba(11,31,23,0.08), 0 12px 32px rgba(11,31,23,0.06);
--lkv-shadow-lg: 0 12px 24px rgba(11,31,23,0.10), 0 24px 56px rgba(11,31,23,0.10);
```

### 1.4 Motion

```css
--lkv-dur: 220ms;
--lkv-ease: cubic-bezier(0.4, 0, 0.2, 1);
--lkv-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
```

### 1.5 Coins & Rayons

| Élément | Rayon |
|---------|-------|
| Artboard mobile | 44px (coque) / 34px (écran) |
| Bottom tab bar | 22px |
| Cartes (aventure, produit, etc.) | 20px |
| Cartes grille accueil | 20px |
| Items de liste | 18px (panier) / 14px (drawer) |
| Boutons | 999px (pills) |
| Petits icônes conteneurs | 8-14px |

---

## 2. Layout & Navigation Mobile

### 2.1 Phone Frame
- Dimensions : 380 × 780px
- Status bar iOS : 40px (9:41, battery, wifi)
- Safe areas : `env(safe-area-inset-*)` systématique

### 2.2 TopBar (`m-topbar`)

Deux variantes :

**Standard** (fond paper, bordure subtile) :
```
height: 52px
padding: 0 16px
background: var(--lkv-paper)
border-bottom: 1px solid rgba(11,31,23,0.05)
center: titre avec serif emphase
m-btn: 38×38px, border-radius 999px, fond rgba(255,255,255,0.9)
```

**On-image** (transparent, position absolute) :
```
background: transparent
position: absolute; top: 40px
m-btn: fond rgba(255,255,255,0.16), backdrop-filter blur(20px)
color: white
```

### 2.3 BottomTabBar (`m-tabbar`)

Design glassmorphism flottant :
```
position: absolute; left: 12px; right: 12px; bottom: 12px
height: 62px
background: rgba(255,255,255,0.85)
backdrop-filter: blur(24px) saturate(1.5)
border-radius: 22px
border: 1px solid rgba(11,31,23,0.06)
box-shadow: 0 10px 30px rgba(11,31,23,0.1)
```

**5 onglets :**
1. **Accueil** — icône maison
2. **Aventures** — icône montagne
3. **Boutique** — icône sac
4. **Carnet** — icône document
5. **Compte** — icône personne

État actif : `color: var(--lkv-forest-800)` + petit dot `4px` sous l'icône.

### 2.4 Menu Drawer

Premium side drawer, 88% largeur :
```
Header forest-900 avec:
  - Logo mark (marque maison SVG)
  - Avatar user (44px, cercle, sage-500)
  - Nom + statut membre
  - Close button

Body avec sections:
  - "Naviguer" : Accueil, Aventures&refuges, Boutique, Journal, Communauté
  - "Mon compte" : Mon carnet, Commandes, Paramètres
  - "Maison" : Notre méthode, Atelier Grenoble

Footer:
  - Promo CTA "Composer votre sac"
  - Version tag
```

---

## 3. Écrans — Spécifications Détaillées

### 3.1 Accueil

```
┌─ Status Bar ──────────────────┐
├─ TopBar (on-image) ───────────┤
├─ Hero ────────────────────────┤
│  height: 460px                │
│  fond: gradient forest 180deg │
│  + montagnes SVG bottom       │
│  + eye "Édition automne 2026" │
│  H1: "Ce que vous emportez,   │
│       c'est votre voyage."    │
│  + sub text + 2 CTA buttons   │
├─ Quick Grid 2×2 ──────────────┤
│  4 cartes (aventures, refuges,│
│  boutique, carnet)            │
│  aspect-ratio 1/1, 20px round │
├─ Editorial Card ──────────────┤
│  Journal featured article     │
│  200px, gradient forest       │
│  + topo overlay SVG           │
├─ Stats Row 3-col ─────────────┤
│  "47 testeurs · 14 refuges ·  │
│   6 pièces"                   │
│  border-radius 18px           │
├─ Strip CTA ───────────────────┤
│  "Composer votre sac"         │
│  forest-950 bg, flèche sage   │
├─ BottomTabBar ────────────────┤
└───────────────────────────────┘
```

**Composants :**
- `MobileHomePage.tsx` — refonte complète
- `HomeHeroSection.tsx` — nouveau
- `QuickGrid.tsx` — nouveau (grille 2×2)
- `EditorialCard.tsx` — nouveau
- `StatsRow.tsx` — nouveau
- `StripCTA.tsx` — nouveau

### 3.2 Aventures / Recherche

```
┌─ TopBar (standard) ───────────┐
├─ Hero Search ─────────────────┤
│  H1: "Où voulez-vous          │
│       dormir ce soir ?"       │
│  lead text + search pill      │
│  (icône + placeholder +       │
│   filtre bouton avec badge 3) │
├─ Category Chips ──────────────┤
│  scrollable horizontal        │
│  "Tout" "Refuge" "Itinéraire" │
│  "Bivouac" "Escalade" "Multi" │
├─ Mini Map ────────────────────┤
│  180px, contours topo SVG     │
│  pins numbered + selected     │
│  zoom controls + legend       │
├─ Results Header ──────────────┤
│  "À moins de 90 min" + sort   │
├─ Adventure Cards ─────────────┤
│  HList d'av-card              │
│  image 110px + body           │
│  body: loc, titre, stats      │
│  (distance, dénivelé, durée)  │
├─ BottomTabBar ────────────────┤
└───────────────────────────────┘
```

**Composants :**
- `AventuresHero.tsx` — nouveau (search + chips)
- `AventuresMap.tsx` — nouveau (mini carte topo stylisée)
- `AventureCard.tsx` — nouveau (remplace carte existante)
- Adaptation de l'existant dans `app/explorer/`

### 3.3 Fiche Produit

```
┌─ TopBar (on-image) ───────────┐
├─ Gallery ─────────────────────┤
│  380px, gradient forest       │
│  chips overlay (new/ -14%)   │
│  SVG produit + pagination     │
├─ Info ────────────────────────┤
│  brand-line "LE KIT · N°01"  │
│  H1 + prix + strike + save    │
│  stars + avis count           │
├─ Attributes Grid 2×2 ────────┤
│  capacité, poids, étanchéité  │
│  fabrication                  │
│  chaque: icône 30px + lbl+val │
├─ Description ─────────────────┤
│  h4 + p serif emphase         │
├─ Color Selector ──────────────┤
│  h4 "Coloris" + 5 swatches    │
│  44×44px, border-radius 14px  │
├─ Bottom Buy Bar ──────────────┤
│  position absolute bottom     │
│  qty selector + "Ajouter" btn │
│  glassmorphism bg             │
└───────────────────────────────┘
```

### 3.4 Boutique (détaillé dans reference/Front end/Boutique.html)

À analyser séparément, mais suit le même pattern design.

### 3.5 Panier

```
┌─ TopBar ──────────────────────┐
│  back + "Votre panier" + vid  │
├─ Header ──────────────────────┤
│  "3 pièces prêtes à partir."  │
│  ref mono "MSA-CH-2026-047"   │
├─ Cart Items ──────────────────┤
│  chaque: image gradient +     │
│  cat, titre, option, qty, prix│
│  delete button                │
├─ Promo Banner ────────────────┤
│  "Encore 40€ pour livraison   │
│   offerte" dashed border      │
├─ Summary ─────────────────────┤
│  sous-total, remise, livraison│
│  total (large)                │
├─ Bottom CTA ──────────────────┤
│  "Passer commande 4 articles" │
│  + "Suivant" sage pill        │
└───────────────────────────────┘
```

### 3.6 Paiement / Checkout

```
┌─ TopBar ──────────────────────┤
│  back + "Paiement sécurisé"   │
│  + lock icon                  │
├─ Header ──────────────────────┤
│  progress steps 4             │
│  "Un dernier geste."          │
├─ Address ─────────────────────┤
│  section with edit            │
│  addr-card + icône maison     │
├─ Livraison ───────────────────┤
│  2 options radio design       │
│  "Standard Colissimo 12€"     │
│  "Retrait atelier Offert"     │
├─ Payment Method ──────────────┤
│  4 cards: CB, Apple Pay,      │
│  Google Pay, 3× sans frais    │
│  card input                   │
├─ Total ───────────────────────┤
│  dark card forest-950         │
│  breakdown + total large      │
├─ Bottom CTA ──────────────────┤
│  "Confirmer & payer 544€"     │
│  avec lock icon               │
└───────────────────────────────┘
```

### 3.7 Journal / Carnet

```
┌─ TopBar ──────────────────────┤
│  hamburger + "Journal"        │
│  + search icon                │
├─ Hero ────────────────────────┤
│  eye "Édition N°08"           │
│  H1 "Récits du terrain."      │
├─ Featured Article ────────────┤
│  220px, gradient forest       │
│  "À la une · Reportage"       │
│  "Six semaines, 4 saisons"    │
│  author avatar + read time    │
├─ Category Tabs ───────────────┤
│  scrollable pills             │
│  Tout, Reportages, Tests,     │
│  Refuges, Méthode             │
├─ Article List ────────────────┤
│  horizontal cards             │
│  image 80×90 + body           │
│  kind, title, meta            │
├─ BottomTabBar ────────────────┤
└───────────────────────────────┘
```

---

## 4. Pages Additionnelles (à intégrer)

Références complètes disponibles dans `reference/Front end/` :

| Fichier | Page | Priorité |
|---------|------|----------|
| `Boutique.html` | Boutique (grille produits) | Haute |
| `Communauté.html` | Fil communauté | Haute |
| `Carnet.html` | Carnet de voyage détaillé | Haute |
| `Clubs.html` + `Club - Détail.html` | Clubs & détail | Moyenne |
| `Compte - Dashboard.html` + `Paramètres.html` | Compte | Haute |
| `Configurateur.html` | Configurateur équipement | Haute |
| `Dashboard - Aventures.html` | Dashboard aventures | Moyenne |
| `Dashboard - Carnets.html` | Dashboard carnets | Moyenne |
| `Dashboard - Commandes.html` | Dashboard commandes | Moyenne |

---

## 5. Architecture Technique

### 5.1 Gestion des tokens

Le fichier `src/design/tokens.ts` existe déjà avec une palette proche mais pas identique :
- `primary: '#132219'` ≈ forest-900 ✓
- `surface: '#FAF8F5'` ≈ paper ✓
- `background: '#F5F3ED'` ≈ stone-50
- `accent: '#82C39B'` ≈ sage-500
- **Shadows** utilisent `rgba(0,0,0,...)` → à migrer vers `rgba(11,31,23,...)`

**Stratégie :** Étendre `tokens.ts` avec les nouvelles valeurs LKV plutôt que de créer un fichier séparé. Ajouter les nouvelles palettes (forest, sage, stone, ink) sous forme d'objets exportés, et mettre à jour les ombres.

### 5.2 Structure des fichiers
├── components/
│   ├── mobile-nav/
│   │   ├── TopBar.tsx           ← REFONTE (deux variantes, couleurs LKV)
│   │   ├── BottomTabBar.tsx     ← REFONTE (5 onglets, glassmorphism)
│   │   └── MobileDrawer.tsx     ← NOUVEAU (menu latéral premium)
│   │   └── MobileHomePage.tsx   ← REFONTE (hero, quick grid, etc)
│   └── ui/
│       ├── LkvButton.tsx        ← NOUVEAU (pills, variantes)
│       ├── LkvChip.tsx          ← NOUVEAU (glassmorphism chip)
│       └── LkvIcon.tsx          ← NOUVEAU (mapping SVG icons)
├── app/
│   ├── page.tsx                 ← REFONTE (nouvel accueil mobile)
│   ├── explorer/page.tsx        ← REFONTE (Aventures screen)
│   ├── produit/[slug]/page.tsx  ← REFONTE (fiche produit)
│   ├── panier/page.tsx          ← REFONTE
│   ├── checkout/page.tsx        ← REFONTE
│   └── ...
```

### 5.2 Dépendances

- **Framer Motion** déjà installé (`framer-motion ^12.42.2`) — utiliser pour :
  - Transitions de pages
  - Spring animations tab bar
  - Drawer slide
  - Micro-interactions (boutons, cartes)
- **Aucune nouvelle dépendance** requise

### 5.3 Approche CSS

- Utiliser Tailwind pour le layout de base (flex, grid, spacing)
- **Inline styles ou CSS modules** pour les valeurs exactes des tokens (les couleurs LKV ne sont pas dans tailwind.config.js actuel)
- Compatible avec l'existant `<style jsx>` et Tailwind

---

## 6. Ordre d'Implémentation

### Phase 1 — Fondations (Design System)
1. Créer `src/design/mobile-tokens.ts` avec tous les tokens
2. Créer `src/components/ui/LkvButton.tsx`
3. Créer `src/components/ui/LkvChip.tsx`
4. Créer `src/components/ui/LkvIcon.tsx` (SVG mapping)

### Phase 2 — Navigation
5. Refondre `TopBar.tsx` (deux variantes, couleurs LKV)
6. Refondre `BottomTabBar.tsx` (5 onglets, glassmorphism, dot actif)
7. Créer `MobileDrawer.tsx`

### Phase 3 — Écrans principaux (priorité haute)
8. Refondre Accueil (`page.tsx` + composants section)
9. Refondre Aventures / Explorer
10. Refondre Fiche Produit
11. Refondre Panier
12. Refondre Checkout / Paiement
13. Créer Journal / Carnet screen

### Phase 4 — Écrans secondaires
14. Refondre Boutique (grille)
15. Refondre Communauté
16. Refondre Compte (dashboard + paramètres)
17. Refondre Configurateur

### Phase 5 — Finitions
18. Animations et micro-interactions
19. Tests responsive
20. Audit de consistances couleurs/tokens

---

## 7. Règles d'Or

1. **Tout titre important** contient un `<em>` serif italic sur le mot clé
2. **Les ombres** utilisent `rgba(11,31,23, x%)` — pas de noir
3. **Le fond d'écran** est `#FBFAF6` (paper) — pas `#EDEAE0`
4. **Les cartes** ont `border: 1px solid rgba(11,31,23,0.06)`
5. **Les boutons principaux** sont `forest-800` — pas orange
6. **Les badges** sont `sage-500` avec texte `forest-950`
7. **La BottomTabBar** est flottante (pas collée au bord) avec glassmorphism
8. **Le drawer** fait 88% de largeur avec header forest-900
