---
title: Bibliothèque de Composants UI LKDV
aliases:
  - Composants
  - UI Library
  - Atomic Components
tags:
  - components
  - ui
  - react
updated: 2026-08-17
---

# 🧱 BIBLIOTHÈQUE DE COMPOSANTS UI LKDV

> [!abstract] **Le catalogue des briques d'interface standardisées de l'application**
> Tous les composants listés ci-dessous respectent scrupuleusement la palette Forest/Sage/Stone et sont optimisés pour le rendu 60fps.

---

## 📋 Inventaire des Composants Maîtres

### 1. Boutons & Contrôles
- `InteractiveButton.tsx` : Bouton universel avec retour tactile, gestion du statut désactivé et micro-animation de rebond doux.
- `Toggle.tsx` : Interrupteur animé Framer Motion pour les réglages de notifications et préférences.
- `EquipmentFilterChips.tsx` : Filtres horizontaux défilants pour naviguer entre les 5 catégories de matériel.

### 2. Skeletons & Écrans d'Attente
- `Skeleton.tsx` : Brique de base avec animation de balayage lumineux (*shimmer*).
- `SkeletonCard.tsx` : Squelette type pour les cartes de sentiers et de posts communautaires.
- `CardSkeleton.tsx` : Squelette spécifique pour les fiches de matériel et de boutique.

### 3. Modales, Tiroirs & Overlays
- `MobilePageShell.tsx` : Enveloppe de page avec gestion des marges de sécurité et du scroll.
- `ItemHeroModal.tsx` : Volet coulissant de détail d'un équipement.
- `ClubDetailModal.tsx` : Modale instantanée de présentation d'un club.
- `SearchOverlay.tsx` : Panneau plein écran de recherche globale multi-entités.

### 4. Graphiques & Visualisations
- `ElevationChart.tsx` : Graphique SVG / Canvas du profil altimétrique d'un sentier.
- `BaseWeightMeter.tsx` : Jauge interactive du poids du sac avec code couleur dynamique.
- `CountryGlobe.tsx` : Globe 3D interactif Three.js pour explorer les pays.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les directives de design : [[Design System]]
> - Explorer l'architecture technique : [[Architecture globale]]
