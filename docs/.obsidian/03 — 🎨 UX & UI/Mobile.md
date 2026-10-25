---
title: Expérience Mobile & Shell Adaptatif LKDV
aliases:
  - Mobile
  - MobilePageShell
  - BottomTabBar
tags:
  - mobile
  - responsive
  - ux
updated: 2026-08-17
---

# 📱 EXPÉRIENCE MOBILE & SHELL ADAPTATIF

> [!abstract] **73/76 pages (~96%) intégrées sous le `MobilePageShell`**
> LKDV est pensé d'abord pour l'usage sur smartphone, avec une attention méticuleuse portée aux encoches d'écran (Notch / Dynamic Island) et à la barre de navigation inférieure.

---

## 🛡️ Le Composant `MobilePageShell`

Le wrapper standard `src/components/layout/MobilePageShell.tsx` encapsule les pages de l'application :

```tsx
<MobilePageShell
  title="Mon Matériel"
  showHeader={false}
  noPaddingBottom={false}
  className="bg-[#FBFAF6]"
>
  {/* Contenu spécifique de la page */}
</MobilePageShell>
```

### Caractéristiques Techniques
1. **Gestion des Safe Areas :**
   - Haut : `padding-top: env(safe-area-inset-top, 0px)`.
   - Bas : `padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem)` (espace réservé pour la `BottomTabBar`).
2. **Élimination de l'Overflow Horizontal :**
   - `max-width: 100vw` et `overflow-x: hidden` appliqués pour supprimer tout décalage intempestif de l'écran lors du défilement.
3. **Suppression de la TopBar :**
   - La barre d'en-tête statique (`TopBar.tsx`) a été entièrement retirée pour maximiser la surface utile d'affichage.

---

## ⚡ La `BottomTabBar` Réactive

Située en bas de l'écran, elle propose :
- 4 onglets majeurs avec retour tactile haptique (`useHapticFeedback`).
- 1 bouton Hamburger contextuel ouvrant la recherche globale, les alertes et le panier.
- Préchargement intelligent (`router.prefetch`) au survol pour garantir une ouverture quasi-instantanée de la page cible.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le comportement grand écran : [[Desktop]]
> - Explorer la bibliothèque de composants : [[Composants]]
