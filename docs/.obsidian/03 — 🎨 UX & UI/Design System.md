---
title: Design System LKDV & Charte Graphique
aliases:
  - Design System
  - Charte Graphique
  - Tokens Graphiques
tags:
  - ux-ui
  - design-system
  - tailwind
updated: 2026-08-17
---

# 🎨 DESIGN SYSTEM LKDV & CHARTE GRAPHIQUE

> [!abstract] **L'identité visuelle de l'aventure : Pureté, Contraste & Sobriété Minérale**
> LKDV utilise une palette de couleurs inspirée des forêts alpines et des roches granitiques, avec des contrastes certifiés WCAG AAA et une règle absolue d'élimination des teintes criardes.

---

## 🌲 Palette de Couleurs Officielles

```text
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Foreground 900          │ Foreground 800 (Primary)│ Foreground 700          │
│ #0B1F17                 │ #17402C                 │ #2D6B4A                 │
│ (Texte profond & fond)  │ (Boutons CTA & Actifs)  │ (Survols & Accents)     │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ Sage 500                │ Sage 200                │ Stone 50/100            │
│ #A3C4A3                 │ #EDF3ED                 │ #FBFAF6                 │
│ (Bordures douces & tags)│ (Fonds secondaires)     │ (Fond de page naturel)  │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

> [!danger] **RÈGLE PERMANENTE ET INVIOLABLE DU PROJET :**
> **Il est strictement interdit d'introduire la couleur orange `#E4501C` (ou toute variante criarde) dans le code.** Tout bouton ou badge d'action doit impérativement utiliser le vert forêt `#17402C` ou le sauge `#A3C4A3`.

---

## 🔤 Typographie & Hiérarchie

| Rôle | Police de Caractères | Cas d'Usage |
| :--- | :--- | :--- |
| **Interface & Corps (UI)** | **Inter / Söhne** (`font-sans`) | Titres, menus, boutons, descriptions, cartes. |
| **Accents & Poésie Éditoriale** | **Georgia Italic** (`font-serif italic`) | Citations dans les carnets, devises, sous-titres évocateurs en `#17402C`. |
| **Métriques & Chiffres Clés** | **JetBrains Mono** (`font-mono`) | Poids en grammes, dénivelés D+, coordonnées GPS, chronomètres. |

---

## 📐 Rayons de Courbure & Formes

- **Cartes & Conteneurs :** Coins arrondis de **12px** (`rounded-[0.75rem]`).
- **Boutons & Champs de saisie :** Rayon de **10px** (`rounded-xl`).
- **Badges & Filtres (Chips) :** Arrondi complet (`rounded-full`).

---

## 🎬 Courbes d'Animation (Framer Motion)

```css
/* Easings fluides 60fps */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* Entrée d'éléments */
--ease-in: cubic-bezier(0.55, 0, 1, 0.45);      /* Sortie d'éléments */
--spring-snappy: cubic-bezier(0.34, 1.56, 0.64, 1); /* Feedback tactile */
```

Dans les composants React :
```tsx
export const standardSpring = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 0.8
};
```

---

> [!tip] **Notes complémentaires :**
> - Découvrir les principes d'interaction : [[Principes UX]]
> - Voir la bibliothèque de composants : [[Composants]]
> - Consulter la documentation mobile : [[Mobile]]
