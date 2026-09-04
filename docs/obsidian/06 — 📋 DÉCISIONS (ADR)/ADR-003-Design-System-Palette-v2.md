---
title: ADR-003 — Normalisation Palette v2.0 & Bannissement des Teintes Désuètes
aliases:
  - ADR-003
tags:
  - adr
  - design-system
  - palette-v2
  - ui
date: 2026-07-22
status: Accepté
---

# ADR-003 — Normalisation Palette v2.0 & Bannissement des Teintes Désuètes

### Contexte
La multiplication non contrôlée des codes couleurs (anciens verts d'encre `#0B1F17`, teintes intermédiaires `#2D6B4A`, classes génériques `emerald-500`) entraînait une dégradation de l'identité visuelle de LKDV et des ruptures de contraste en conditions de fort ensoleillement.

### Décision
1. Adopter officiellement la **Palette v2.0** comme unique charte graphique :
   - **Vert Forêt (Primary) :** `#17402C`
   - **Fond Pierre (Background) :** `#FBFAF6`
   - **Sauge Pâle (Surface/Cartouches) :** `#EDF3ED`
   - **Sauge Médium (Bordures/Accents) :** `#A3C4A3`
2. Bannir définitivement du dépôt `#0B1F17` et `#2D6B4A`.
3. Automatiser la détection de toute réintroduction via le script d'invariants CI `scripts/verify/ci_invariants.mjs`.

### Conséquences
- **Positives :**
  - Contraste WCAG AAA (11.8:1) garanti sur fond papier/pierre.
  - Cohérence visuelle parfaite sur l'ensemble des composants mobiles.
  - Zéro régression possible grâce au verrouillage en intégration continue.
- **Négatives :**
  - Nécessité de refactoriser les composants et maquettes préexistants.

### Liens & Références
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Tokens & Palette v2|Tokens & Palette v2]]
- [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Invariants CI Anti-Dérive|Invariants CI Anti-Dérive]]