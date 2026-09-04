---
title: Tokens de Design & Palette v2.0 — LKDV
description: Spécification des couleurs officielles, règles de contraste, typographie SF Pro et tokens Tailwind
tags:
  - design-system
  - ui
  - palette-v2
  - tokens
  - tailwind
aliases:
  - Palette v2
  - Tokens Design
  - Couleurs LKDV
date: 2026-09-04
status: active
---

# 🎨 Tokens de Design & Palette v2.0

Le design system de **Le Kit du Voyageur** incarne une esthétique outdoor contemporaine, sobre et fonctionnelle, inspirée des grands espaces alpins et des standards de lisibilité rigoureux d'Apple Human Interface Guidelines.

---

## 🌲 Palette v2.0 Officielle

> [!important] Règle Permanente Anti-Régression (ADR-003)
> Les anciennes teintes sombres désuètes (`#0B1F17`, `#2D6B4A`) ainsi que les verts génériques non calibrés (ex: `emerald-500`) sont **strictement interdits** dans toute l'application. La conformité est surveillée par les invariants CI.

```
┌─────────────────────────────────────────────────────────────┐
│ 🌲 Vert Forêt (Primary)   : #17402C (Action, structure, emphase)│
│ 🪨 Pierre (Background)    : #FBFAF6 (Fond d'écran chaleureux)  │
│ 🌿 Sauge (Surface/Accent) : #EDF3ED (Cartouches, surfaces, tags)│
│ 🍃 Sauge Médium (Bordure) : #A3C4A3 (Séparateurs & contours)   │
└─────────────────────────────────────────────────────────────┘
```

### Table des Tokens Fondamentaux

| Token Tailwind | Code Hex | Rôle & Usage | Ratio Contraste WCAG |
| :--- | :--- | :--- | :--- |
| `forest-primary` | `#17402C` | Boutons principaux, titres majeurs, icônes d'action | 11.8:1 sur fond Pierre (AAA) |
| `stone-background`| `#FBFAF6` | Arrière-plan global de l'application | Référence de fond |
| `sage-surface` | `#EDF3ED` | Cartouches de contenu, cartes de matériel, champs | Douceur visuelle |
| `sage-border` | `#A3C4A3` | Délimitation subtile des composants | 3.2:1 sur fond clair |
| `text-primary` | `#1C2024` | Texte courant, haute lisibilité plein soleil | 13.5:1 (AAA) |
| `text-muted` | `#687076` | Légendes, métadonnées, unités (g, kg, €) | 4.8:1 (AA) |

---

## 🔤 Typographie & Échelle de Texte

LKDV s'appuie sur la typographie système native iOS / Apple : **SF Pro Text** (corps < 20px) et **SF Pro Display** (titres >= 20px), avec repli élégant sur *system-ui*.

| Niveau | Taille | Graisse | Interlettrage (Tracking) | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Large Title** | 34px | Bold (700) | -0.4px | En-têtes d'écrans majeurs |
| **Title 1** | 28px | SemiBold (600) | -0.3px | Titres de section |
| **Headline** | 17px | SemiBold (600) | -0.2px | Noms d'articles et totaux |
| **Body** | 16px | Regular (400) | -0.1px | Texte de lecture courant |
| **Callout** | 14px | Regular (400) | 0.0px | Remarques et badges |
| **Caption 1** | 12px | Medium (500) | +0.2px | Poids en grammes, timestamps |

---

## 📐 Rayons de Courbure (Border Radius)

Pour conférer une sensation tactile fluide et chaleureuse :
- **Composants Standards (`rounded-2xl`)** : 16px pour les cartes de matériel et boutons.
- **Feuilles Modales (`rounded-t-3xl`)** : 28px au sommet des modales coulissantes (`KitSheetModal`).
- **Pills / Badges (`rounded-full`)** : 9999px pour les pastilles de catégories et FieldSeal.

---

## 🔗 Voir Aussi
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Gestes Apple HIG|Gestes Apple HIG & Interactions Tactiles]]
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Composants Mobiles|Composants d'Itinérance]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-003-Design-System-Palette-v2|ADR-003 : Normalisation Palette v2.0]]