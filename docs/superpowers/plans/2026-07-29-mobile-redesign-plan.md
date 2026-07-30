# Mobile Redesign LKDV — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complète de l'expérience mobile LKDV vers un design premium outdoor (inspiration AllTrails + Apple + Patagonia).

**Architecture:** Mise à jour du design system (tokens → palette forest/sage/stone/ink), refonte des composants de navigation (TopBar, BottomTabBar, Drawer), puis refonte des 7 écrans principaux (Accueil, Aventures, Fiche Produit, Panier, Checkout, Journal). Approche CSS via inline styles pour les valeurs exactes des nouveaux tokens.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 3.4, Framer Motion 12

## Global Constraints

- Couleur primaire : `#17402C` (forest-800) — pas d'orange
- Fond d'écran : `#FBFAF6` (paper) — pas `#EDEAE0`
- Ombres : `rgba(11,31,23, x%)` — pas de noir
- Tout titre important contient un `<em>` serif italic sur le mot clé
- Cartes : `border: 1px solid rgba(11,31,23,0.06)`, `border-radius: 20px`
- BottomTabBar : glassmorphism flottant avec `backdrop-filter: blur(24px) saturate(1.5)`
- Drawer : 88% largeur, header forest-900, sections Naviguer/Mon compte/Maison
- Aucune nouvelle dépendance npm — utiliser Framer Motion déjà installé
- Tous les composants en 'use client' (cohérent avec l'existant)

---

### Task 1: Design System Foundation — Tokens + UI Primitives

**Files:**
- Modify: `src/design/tokens.ts` — étendre avec palettes LKV, ombres ink-based
- Create: `src/components/ui/LkvButton.tsx` — boutons variants (primary, light, ghost-light, lg)
- Create: `src/components/ui/LkvChip.tsx` — chip glassmorphism avec dot optionnel
- Create: `src/components/ui/LkvIcon.tsx` — SVG icon map, icônes standardisées 20×20

**Interfaces:**
- Consumes: rien (première tâche)
- Produces: `LkvButton` (props: variant, size, children, icon), `LkvChip` (props: label, dot, variant), `LkvIcon` (props: name, size), tokens exportés

- [ ] **Step 1: Étendre `src/design/tokens.ts` avec les nouvelles palettes**

```typescript
// Ajouter après l'existant
export const forest = {
  950: '#06120C', 900: '#0B1F17', 800: '#17402C',
  700: '#205238', 600: '#2D6B4A',
} as const;

export const sage = {
  500: '#A8C8A0', 300: '#C6DCBE', 200: '#DDE9D6', 100: '#EAF1E5',
} as const;

export const stone = {
  50: '#F4F1EA', 100: '#E9E4D9', 200: '#DDD6C6',
} as const;

export const ink = {
  900: '#0B1F17', 700: '#384A42', 500: '#6B7A72',
  400: '#8B978F', 300: '#AEB7B1',
} as const;

export const paper = '#FBFAF6';

// Remplacer les ombres
export const shadows = {
  xs: '0 1px 2px rgba(11,31,23,0.05), 0 1px 3px rgba(11,31,23,0.04)',
  sm: '0 2px 6px rgba(11,31,23,0.06), 0 4px 12px rgba(11,31,23,0.05)',
  md: '0 6px 16px rgba(11,31,23,0.08), 0 12px 32px rgba(11,31,23,0.06)',
  lg: '0 12px 24px rgba(11,31,23,0.10), 0 24px 56px rgba(11,31,23,0.10)',
} as const;

// Mettre à jour le theme export
export const theme = { colors, forest, sage, stone, ink, paper, typography, spacing, radius, shadows, transition };
```

- [ ] **Step 2: Créer `src/components/ui/LkvButton.tsx`**

```tsx
'use client';
import React from 'react';

interface LkvButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'light' | 'ghost-light' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

const STYLES = {
  primary: { background: '#17402C', color: '#fff' },
  light: { background: '#fff', color: '#0B1F17' },
  'ghost-light': { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' },
  ghost: { background: 'transparent', color: '#0B1F17' },
};

const SIZES = {
  sm: { padding: '8px 14px', fontSize: '12px' },
  md: { padding: '11px 20px', fontSize: '14px' },
  lg: { padding: '14px 26px', fontSize: '15px' },
};

export default function LkvButton({ variant = 'primary', size = 'md', icon, children, style, ...props }: LkvButtonProps) {
  return (
    <button
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        borderRadius: '999px', fontWeight: 500, whiteSpace: 'nowrap',
        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
        transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        ...STYLES[variant], ...SIZES[size], ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Créer `src/components/ui/LkvChip.tsx`**

```tsx
'use client';
import React from 'react';

interface LkvChipProps {
  label: string;
  dot?: boolean;
  variant?: 'light' | 'dark';
}

export default function LkvChip({ label, dot, variant = 'light' }: LkvChipProps) {
  const isLight = variant === 'light';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px',
        background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(11,31,23,0.5)',
        backdropFilter: 'blur(8px)',
        borderRadius: '999px',
        fontSize: '11px', fontWeight: 500,
        color: isLight ? '#0B1F17' : '#fff',
        border: isLight ? '1px solid rgba(11,31,23,0.05)' : '1px solid rgba(255,255,255,0.2)',
      }}
    >
      {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A8C8A0' }} />}
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Créer `src/components/ui/LkvIcon.tsx`**

Exporter des icônes SVG standardisées (20×20, stroke 1.6, round caps) utilisées dans tout le design. Structure :

```tsx
'use client';
import React from 'react';

interface LkvIconProps {
  name: 'home' | 'mountain' | 'bag' | 'doc' | 'user' | 'search' | 'chevron-left' | 'chevron-right' | 'heart' | 'bookmark' | 'bell' | 'map-pin' | 'star' | 'minus' | 'plus' | 'close' | 'menu' | 'arrow-right' | 'lock' | 'filter';
  size?: number;
  color?: string;
}

// Map SVG paths from the référence (tokens.css + pages HTML)
const PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z',
  mountain: 'M3 20l4-14 5 8 3-4 6 10z',
  bag: 'M5 7h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7z M9 7V5a3 3 0 0 1 6 0v2',
  doc: 'M4 5a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 9h5 M8 13h8',
  user: 'M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 4-6 8-6s8 2 8 6',
  search: 'M11 11a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M21 21l-3.5-3.5',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6l-12 12',
  menu: 'M4 6h16M4 12h16M4 18h10',
  star: 'M12 2l3 7h7l-6 4 2 8-6-4-6 4 2-8-6-4h7z',
  lock: 'M8 10V7a4 4 0 0 1 8 0v3 M4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
};
```

Rassembler les paths exacts depuis les SVG dans `Mobile - Pages principales.html` et `tokens.css`. Chaque icône utilise le même viewBox `0 0 24 24`, strokeLinecap="round", strokeLinejoin="round".

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds (ignore les TS errors comme configuré dans next.config)

---

### Task 2: BottomTabBar — Glassmorphism flottant 5 onglets

**Files:**
- Modify: `src/components/mobile-nav/BottomTabBar.tsx`

**Interfaces:**
- Consumes: LkvIcon (icônes), usePathname (router)
- Produces: composant BottomTabBar refondu avec 5 tabs

- [ ] **Step 1: Remplacer les icônes SVG actuelles par les icônes du design référence**

Utiliser les 5 icônes exactes de la référence :
1. **Accueil** — icône maison (path: `M3 11l9-7 9 7v9...`)
2. **Aventures** — icône montagne (path: `M3 20l4-14 5 8 3-4 6 10z`)
3. **Boutique** — icône sac (path: `M5 7h14l-1.5 11...`)
4. **Carnet** — icône document (path: `M4 5a2 2 0 012-2h10l4 4v14...`)
5. **Compte** — icône personne (path: `M4 21c0-4 4-6 8-6...`)

- [ ] **Step 2: Restructurer le conteneur en glassmorphism flottant**

```tsx
<nav style={{
  position: 'fixed', left: '12px', right: '12px', bottom: '12px',
  zIndex: 50,
}}>
  <div style={{
    height: '62px',
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
    borderRadius: '22px',
    border: '1px solid rgba(11,31,23,0.06)',
    boxShadow: '0 10px 30px rgba(11,31,23,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '0 8px',
  }}>
    {/* 5 TabLink */}
  </div>
</nav>
```

TabLink redesign :
```tsx
// État inactif
color: '#6B7A72' // ink-500

// État actif
color: '#17402C' // forest-800
// + petit dot indicateur : width 4px, height 4px, bg forest-800, position absolute bottom 8px
```

- [ ] **Step 3: Changer la route `/ai-configurator` → `/boutique` et `/profil` → `/compte`**

Mettre à jour les TABS pour correspondre aux 5 onglets de la référence.

- [ ] **Step 4: Nettoyer l'ancien orange et animations superflues**

Retirer toute référence à `#E4501C`, `rgba(228,80,28,...)` dans ce composant. Simplifier l'animation (garder le spring sur le dot actif, retirer le layoutId "tab-pill").

---

### Task 3: TopBar — Deux variantes (standard + on-image)

**Files:**
- Modify: `src/components/mobile-nav/TopBar.tsx`

**Interfaces:**
- Consumes: rien (auto-content)
- Produces: composant TopBar refondu avec prop `variant: 'standard' | 'on-image'`

- [ ] **Step 1: Restructurer le composant**

```tsx
interface TopBarProps {
  variant?: 'standard' | 'on-image'; // nouveau
  showBack?: boolean;
  title?: string;
  cartCount?: number;
}
```

- [ ] **Step 2: Appliquer les styles de la variante standard**

```tsx
// standard
height: 52px
padding: '0 16px',
background: '#FBFAF6', // paper
borderBottom: '1px solid rgba(11,31,23,0.05)',
```

- [ ] **Step 3: Appliquer les styles de la variante on-image**

```tsx
// on-image
background: 'transparent',
position: 'absolute', top: '40px', left: 0, right: 0,
zIndex: 2,
```

- [ ] **Step 4: Refondre les boutons `m-btn`**

```tsx
// Bouton standard
style={{
  width: '38px', height: '38px', borderRadius: '999px',
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(11,31,23,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#0B1F17',
}}

// Bouton on-image (overlay)
style={{
  background: 'rgba(255,255,255,0.16)',
  backdropFilter: 'blur(20px)',
  borderColor: 'rgba(255,255,255,0.28)',
  color: '#fff',
}}
```

- [ ] **Step 5: Refondre le titre avec emphase serif**

Le titre centré : `"Le Kit du <em>Voyageur</em>"` avec la règle d'emphase serif. Pour l'accueil, un composant `center` avec span normal + `<em>` serif italic.

---

### Task 4: MobileDrawer — Menu latéral premium

**Files:**
- Create: `src/components/mobile-nav/MobileDrawer.tsx`

**Interfaces:**
- Consumes: useAuth (user info), usePathname (active item)
- Produces: composant MobileDrawer avec props `isOpen`, `onClose`

- [ ] **Step 1: Structure du drawer**

```tsx
interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}
```

Rendu conditionnel avec AnimatePresence :
- Scrim : `position: absolute; inset: 0; background: rgba(11,31,23,0.55); backdrop-filter: blur(2px); z-index: 10`
- Drawer panel : `position: absolute; top: 0; left: 0; bottom: 0; width: 88%; background: #FBFAF6; z-index: 11; box-shadow: 20px 0 60px rgba(11,31,23,0.25)`
- Animation Framer Motion : slide depuis left, spring damping

- [ ] **Step 2: Header du drawer**

```tsx
<header style={{
  background: '#0B1F17', color: '#fff',
  padding: '40px 20px 22px', position: 'relative', overflow: 'hidden',
}}>
  {/* glow circle decoration */}
  <div style={{
    position: 'absolute', bottom: '-50px', right: '-30px',
    width: '180px', height: '180px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168,200,160,0.4) 0%, transparent 65%)',
  }} />
  
  {/* Close button */}
  <button onClick={onClose} style={{
    position: 'absolute', top: '12px', right: '12px',
    width: '34px', height: '34px', borderRadius: '999px',
    background: 'rgba(255,255,255,0.14)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6l-12 12"/>
    </svg>
  </button>

  {/* Logo + Brand */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px', position: 'relative', zIndex: 2 }}>
    <div className="lkv-mark" style={{ /* marque maison SVG */ }} />
    <div>
      <div style={{ fontSize: '14px', fontWeight: 500 }}>Le Kit du Voyageur</div>
      <em style={{ display: 'block', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#C6DCBE', fontSize: '12px' }}>
        édition automne · 2026
      </em>
    </div>
  </div>

  {/* User */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div className="avatar" style={{
      width: '44px', height: '44px', borderRadius: '999px',
      background: '#A8C8A0', color: '#06120C',
      fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '18px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid rgba(255,255,255,0.2)',
    }}>
      {userInitial}
    </div>
    <div>
      <div style={{ fontSize: '15px', fontWeight: 500 }}>{userName}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: 'ui-monospace, monospace' }}>
        MEMBRE · CHARTREUSE 47
      </div>
    </div>
  </div>
</header>
```

- [ ] **Step 3: Drawer body — sections + items**

Sections avec label (ex: "Naviguer", "Mon compte", "Maison") et items cliquables avec icône + titre + sous-titre + chevron.

Utiliser les 3 sections exactes de la référence.

- [ ] **Step 4: Drawer footer — promo CTA + version**

```tsx
<footer style={{
  padding: '14px 16px 20px',
  borderTop: '1px solid rgba(11,31,23,0.06)',
  background: '#F4F1EA',
}}>
  <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#FBFAF6', borderRadius: '14px', border: '1px solid rgba(11,31,23,0.05)' }}>
    {/* Promo content */}
  </a>
  <div style={{ fontSize: '10px', color: '#8B978F', textAlign: 'center', marginTop: '14px', fontFamily: 'ui-monospace, monospace' }}>
    v.2026.4 · GRENOBLE · FR
  </div>
</footer>
```

- [ ] **Step 5: Intégrer dans le layout**

Dans `app/layout.tsx`, ajouter `MobileDrawer` et le faire apparaître via le bouton hamburger de la TopBar.

---

### Task 5: Accueil — Hero + QuickGrid + Editorial + Stats + Strip

**Files:**
- Modify: `src/components/mobile-nav/MobileHomePage.tsx` — refonte complète
- Create: `src/components/home/HomeHeroSection.tsx`
- Create: `src/components/home/QuickGrid.tsx`
- Create: `src/components/home/EditorialCard.tsx`
- Create: `src/components/home/StatsRow.tsx`
- Create: `src/components/home/StripCTA.tsx`

- [ ] **Step 1: Créer `HomeHeroSection.tsx`** — hero immersif 460px

```tsx
<div style={{
  position: 'relative', height: '460px',
  padding: '90px 20px 24px', color: '#fff', overflow: 'hidden',
}}>
  {/* Background gradient */}
  <div style={{
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, #1a2f24 0%, #0B1F17 100%)',
  }} />
  {/* Radial overlays */}
  <div style={{
    position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(168,200,160,0.25) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(45,107,74,0.4) 0%, transparent 50%)',
  }} />
  {/* Mountains SVG (deux calques) */}
  <div style={{
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '240px',
    backgroundImage: `url("data:image/svg+xml,...")`, // SVG des montagnes
    backgroundSize: 'cover', backgroundPosition: 'center bottom',
  }} />
  
  {/* Content */}
  <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    {/* Eye badge */}
    <div style={{
      alignSelf: 'flex-start',
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '5px 12px',
      background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '999px',
      fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C6DCBE' }} />
      Édition automne · 2026
    </div>
    {/* Title + CTAs */}
    <div>
      <h1 style={{ fontSize: '46px', fontWeight: 500, letterSpacing: '-0.035em', lineHeight: '0.96', margin: '16px 0 12px' }}>
        Ce que vous emportez,<br/><em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#C6DCBE', fontWeight: 400 }}>c'est votre voyage.</em>
      </h1>
      <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}>
        Six objets testés en Chartreuse. Des refuges choisis à la main.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {/* 2 LkvButton: primary-light + ghost-light */}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Créer `QuickGrid.tsx`** — grille 2×2

```tsx
<div style={{ padding: '20px 16px 8px' }}>
  <div className="quick-h" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
    <h2 style={{ fontSize: '20px', letterSpacing: '-0.015em' }}>Par où <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C' }}>commencer.</em></h2>
    <a href="#" style={{ fontSize: '12px', color: '#17402C', fontWeight: 500 }}>Tout voir →</a>
  </div>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
    {/* 4 quick-card avec leurs styles spécifiques (qc-1 green gradient, qc-2 stone, qc-3 sage, qc-4 dark) */}
    {/* Chaque card: aspect-ratio 1/1, border-radius 20px, padding 14px, flex column, space-between */}
  </div>
</div>
```

- [ ] **Step 3: Créer `EditorialCard.tsx`** — carte éditoriale

```tsx
<div style={{
  position: 'relative', borderRadius: '22px', overflow: 'hidden',
  height: '200px', color: '#fff', display: 'flex', flexDirection: 'column',
  justifyContent: 'flex-end', padding: '16px',
  background: 'linear-gradient(160deg, #3d5548 0%, #1e2f27 100%)',
}}>
  {/* topo overlay + gradient overlay */}
  {/* kind label, h3, meta */}
</div>
```

- [ ] **Step 4: Créer `StatsRow.tsx`** — barre stats 3 colonnes

Grille 3 colonnes avec gap 1px, border-radius 18px, fond de séparation `rgba(11,31,23,0.06)`.

- [ ] **Step 5: Créer `StripCTA.tsx`** — CTA "Composer votre sac"

`background: #06120C`, flex row, icône 42×42, texte + flèche sage-500.

- [ ] **Step 6: Refondre `MobileHomePage.tsx`**

Assembler tous les composants dans l'ordre : Hero → QuickGrid → EditorialCard → StatsRow → StripCTA.

---

### Task 6: Aventures / Explorer — Search + Map + Card List

**Files:**
- Create: `src/components/explorer/AventuresHero.tsx` — search bar + chips
- Create: `src/components/explorer/AventuresMiniMap.tsx` — carte topo stylisée
- Create: `src/components/explorer/AventureCard.tsx` — carte résultat
- Modify: `src/app/explorer/page.tsx` — intégration

- [ ] **Step 1: Créer `AventuresHero.tsx`**

```tsx
<div style={{ padding: '12px 16px 16px', background: '#FBFAF6' }}>
  <div className="lkv-eyebrow" style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7A72', fontWeight: 500 }}>
    48 itinéraires · Chartreuse & Vercors
  </div>
  <h1 style={{ fontSize: '30px', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, margin: '4px 0' }}>
    Où voulez-vous<br/><em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>dormir ce soir ?</em>
  </h1>
  {/* Search pill */}
  <div style={{
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px 14px', background: '#F4F1EA',
    border: '1px solid rgba(11,31,23,0.05)', borderRadius: '999px',
    color: '#6B7A72', fontSize: '13px',
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
    </svg>
    <span style={{ flex: 1 }}>Massif, refuge, distance…</span>
    <button style={{ /* filtre button avec badge */ }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M7 12h10M10 18h4"/>
      </svg>
    </button>
  </div>
  {/* Category chips - scrollable horizontal */}
  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '12px 0 4px' }}>
    {['Tout', 'Refuge', 'Itinéraire', 'Bivouac', 'Escalade', 'Multi-jours'].map(cat => (
      <button key={cat} style={{
        padding: '8px 14px', borderRadius: '999px',
        background: cat === 'Tout' ? '#17402C' : '#FBFAF6',
        border: `1px solid ${cat === 'Tout' ? '#17402C' : 'rgba(11,31,23,0.06)'}`,
        color: cat === 'Tout' ? '#fff' : '#384A42',
        fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
      }}>{cat}</button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Créer `AventuresMiniMap.tsx`**

Carte stylisée 180px avec fond gradient, grille SVG superposée, contours topo, pins numérotés + pin sélectionné avec glow, controls zoom, legend.

- [ ] **Step 3: Créer `AventureCard.tsx`**

```tsx
<a style={{
  background: '#FBFAF6', border: '1px solid rgba(11,31,23,0.06)',
  borderRadius: '20px', overflow: 'hidden', display: 'flex',
}}>
  <div className="im" style={{ width: '110px', flexShrink: 0, background: 'linear-gradient(160deg, #2D6B4A 0%, #17402C 60%, #0B1F17 100%)', position: 'relative' }}>
    <span className="diff" style={{ position: 'absolute', top: '8px', left: '8px', padding: '3px 8px', background: 'rgba(255,255,255,0.9)', borderRadius: '999px', fontSize: '9px', fontWeight: 600, color: '#17402C', textTransform: 'uppercase' }}>
      {difficulty}
    </span>
  </div>
  <div className="body" style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <div>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8B978F' }}>{location}</div>
      <h3 style={{ fontSize: '15px', fontWeight: 500, margin: '2px 0 0' }}>{title}</h3>
    </div>
    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace' }}>
      <span>{distance} km</span>
      <span>+{elevation} m</span>
      <span>{duration}</span>
    </div>
  </div>
</a>
```

- [ ] **Step 4: Intégrer dans `app/explorer/page.tsx`**

Assembler les composants AventuresHero → AventuresMiniMap → ResultsHeader → AventureCard[] dans un scrollable `m-body`.

---

### Task 7: Fiche Produit — Gallery + Info + Attributs + Buy Bar

**Files:**
- Modify: `src/app/produit/[slug]/ProductDetailClient.tsx` — refonte majeure
- Create: `src/components/produit/ProductBuyBar.tsx` — barre achat flottante

- [ ] **Step 1: Refondre la galerie produit**

Section 380px avec :
- Gradient forest background
- Chips overlay (Nouveauté, -14%)
- SVG produit au centre
- Pagination dots (4 dots, premier actif)

- [ ] **Step 2: Section info produit**

Brand-line (ex: "LE KIT · N°01 · PORTAGE"), H1 avec emphase serif, prix + strike + save badge, stars avec avis count.

- [ ] **Step 3: Grille d'attributs 2×2**

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 20px' }}>
  {/* Chaque attribut */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#F4F1EA', borderRadius: '14px' }}>
    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EAF1E5', color: '#17402C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* icône */}
    </div>
    <div>
      <div className="lbl" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B7A72' }}>Capacité</div>
      <div className="val" style={{ fontSize: '12px', fontWeight: 500 }}>45 <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C' }}>litres</em></div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Sélecteur couleur + description**

Cercle de 5 swatches 44×44px, border-radius 14px, active avec border forest-800.

- [ ] **Step 5: Créer `ProductBuyBar.tsx` — barre achat flottante**

```tsx
<div style={{
  position: 'sticky', bottom: 0, left: '12px', right: '12px',
  padding: '12px 14px', background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(24px) saturate(1.5)',
  borderRadius: '22px', border: '1px solid rgba(11,31,23,0.06)',
  boxShadow: '0 12px 30px rgba(11,31,23,0.12)',
  display: 'flex', alignItems: 'center', gap: '10px',
  zIndex: 3, margin: '0 12px 12px',
}}>
  {/* Qty selector */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px', background: '#F4F1EA', borderRadius: '999px' }}>
    <button style={{ width: '26px', height: '26px', borderRadius: '999px', background: '#FBFAF6' }}>-</button>
    <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '14px', fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>1</span>
    <button style={{ width: '26px', height: '26px', borderRadius: '999px', background: '#FBFAF6' }}>+</button>
  </div>
  {/* Add to cart button */}
  <button style={{
    flex: 1, background: '#17402C', color: '#fff', padding: '12px 16px',
    borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer',
  }}>
    <span>Ajouter au panier</span>
    <span className="p" style={{ fontFamily: 'ui-monospace, monospace', opacity: 0.85 }}>340 €</span>
  </button>
</div>
```

---

### Task 8: Panier — Items + Promo + Summary + CTA

**Files:**
- Modify: `src/app/panier/page.tsx` — refonte complète

- [ ] **Step 1: Header panier**

```tsx
<div style={{ padding: '12px 16px 16px', borderBottom: '1px solid rgba(11,31,23,0.05)' }}>
  <h1 style={{ fontSize: '28px', letterSpacing: '-0.025em', margin: 0 }}>
    3 pièces<br/><em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>prêtes à partir.</em>
  </h1>
  <div style={{ fontSize: '12px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', marginTop: '2px' }}>
    MSA-CH-2026-047 · panier ouvert
  </div>
</div>
```

- [ ] **Step 2: Cart item design**

Chaque item : image gradient 76×92px, cat/titre/options, qty selector, prix, delete button. Utiliser le design exact de la référence.

- [ ] **Step 3: Promo banner + Summary + Bottom CTA**

Promo : fond sage-100, dashed border sage-500. Summary : fond paper, border. CTA : forest-800 + sage-500 pill "Suivant".

---

### Task 9: Checkout — Steps + Adresse + Livraison + Paiement

**Files:**
- Modify: `src/app/checkout/page.tsx` — refonte complète

- [ ] **Step 1: Progress steps + header**

```tsx
<div style={{ padding: '12px 16px 20px' }}>
  <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
    {[0,1,2,3].map(i => (
      <div key={i} style={{
        flex: 1, height: '3px', borderRadius: '999px',
        background: i < 2 ? '#A8C8A0' : i === 2 ? '#17402C' : 'rgba(11,31,23,0.08)',
      }} />
    ))}
  </div>
  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6B7A72' }}>
    Étape 3 · 4 · Paiement
  </div>
  <h1 style={{ fontSize: '26px', letterSpacing: '-0.025em', margin: 0 }}>
    Un dernier <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>geste.</em>
  </h1>
</div>
```

- [ ] **Step 2: Address section**

Carte adresse avec icône, nom, adresse, tag "MAISON".

- [ ] **Step 3: Shipping options + Payment methods**

Shipping : 2 options radio avec design custom (cercle 18px, remplissage forest-800 quand actif).
Payment : 4 cards (CB, Apple Pay, Google Pay, 3x) + card input.

- [ ] **Step 4: Total card + Pay CTA**

Total card : fond `#06120C`, texte blanc, breakdown détaillé, total large.
Pay CTA : bouton forest-800 avec lock icon + montant.

---

### Task 10: Journal / Carnet — Hero + Featured + Tabs + List

**Files:**
- Modify: `src/app/carnets/page.tsx` — refonte

- [ ] **Step 1: Hero journal**

Eye badge "Édition N°08 · automne 2026", H1 "Récits du terrain."

- [ ] **Step 2: Featured article**

Card 220px gradient forest avec montagnes SVG, "À la une · Reportage", titre, author avatar, temps de lecture.

- [ ] **Step 3: Category tabs + Article list**

Tabs scrollables (Tout, Reportages, Tests matériel, Refuges, Méthode).
Article list : horizontal cards 80×90px image + body (kind, title, meta).
