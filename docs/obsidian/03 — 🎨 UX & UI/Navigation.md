---
title: Directives de Navigation & Micro-Interactions UI
aliases:
  - Directives Navigation
  - Micro-Interactions
tags:
  - navigation
  - interaction-design
  - ui
updated: 2026-08-17
---

# 🧭 DIRECTIVES DE NAVIGATION & MICRO-INTERACTIONS UI

> [!abstract] **Le guide pratique pour l'implémentation des transitions et liens dans LKDV**

---

## ⚡ Principes d'Implémentation

1. **Instant Navigation Pattern :**
   - Ne jamais faire d'`await` avant d'exécuter un `router.push()`.
   - Utiliser systématiquement `<Link prefetch={true} />` de Next.js sur les routes critiques (`/mon-materiel`, `/explorer`, `/carnets`).
2. **Micro-Feedback au Tap :**
   - Ajouter `whileTap={{ scale: 0.97 }}` sur les boutons interactifs via Framer Motion.
3. **Transition de Page :**
   - Utiliser le composant `<PageTransition />` (`src/components/ui/PageTransition.tsx`) pour assurer un fondu enchaîné délicat de 220ms entre les routes.

---

> [!tip] **Notes reliées :**
> - Découvrir le plan de navigation global : [[00 — 🗺️ CARTE ULTIME/Navigation\|Plan de Navigation]]
> - Explorer la liste des composants : [[Composants]]
