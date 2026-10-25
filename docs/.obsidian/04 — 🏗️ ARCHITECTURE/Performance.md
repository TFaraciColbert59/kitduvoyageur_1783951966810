---
title: Performance, Core Web Vitals & Optimisations LKDV
aliases:
  - Performance
  - Core Web Vitals
  - Optimisations
tags:
  - architecture
  - performance
  - cwv
updated: 2026-08-17
---

# ⚡ PERFORMANCE, CORE WEB VITALS & OPTIMISATIONS

> [!abstract] **L'excellence technique au service de l'autonomie et de la réactivité**
> LKDV vise un score Lighthouse > 90 sur mobile, un First Input Delay (INP) < 50ms et une empreinte énergétique minimale sur batterie.

---

## 📊 Tableau des Indicateurs Clés (Core Web Vitals)

| Métrique | Cible LKDV | État Actuel | Actions Mises en Place |
| :--- | :---: | :---: | :--- |
| **LCP (Largest Contentful Paint)** | < 2.5s | 🟡 ~3.8s (Mobile) | Remplacement de la cascade client `/` par redirection serveur 302 (3ms), conversion WebP, passage de `/explorer` en Server Component. |
| **INP (Interaction to Next Paint)** | < 100ms | 🟢 < 40ms | État `pressedTab` en 16ms, suppression des `await` bloquants, hooks optimistes. |
| **CLS (Cumulative Layout Shift)** | < 0.1 | 🟢 0.02 | Remplacement des spinners par des Skeletons aux dimensions exactes, dimensions d'images réservées. |
| **Poids First Load JS Partagé** | < 120 kB | 🟢 103 kB | Dynamic imports sur les modales lourdes (`ClubDetailModal`), tree-shaking strict. |

---

## 🛠️ Optimisations Graphiques & WebGL

1. **Bridage WebGL Mobile :** Le ratio de pixel de `CountryGlobe.tsx` est plafonné à `1.0` sur mobile pour éviter la surchauffe et préserver le taux de rafraîchissement à 60fps constant.
2. **GPU-Only Animation :** Seules les propriétés accélérées matériellement (`transform: translate/scale` et `opacity`) sont animées dans Framer Motion.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir l'architecture de la base de données : [[Architecture BDD]]
> - Explorer les rapports de bugs : [[Bugs]]
