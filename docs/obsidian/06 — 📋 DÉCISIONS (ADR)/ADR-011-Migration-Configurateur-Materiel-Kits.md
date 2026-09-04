---
title: ADR-011 — Migration du Configurateur IA vers materiel_kits & Gestes HIG
aliases:
  - ADR-011
tags:
  - adr
  - configurateur
  - materiel_kits
  - apple-hig
  - refactor
date: 2026-09-04
status: Accepté
---

# ADR-011 — Migration du Configurateur IA vers materiel_kits & Gestes HIG

### Contexte
Bien que l'ADR-007 ait acté `materiel_kits` comme entité vivante unique de la lignée, certaines portions du code applicatif du configurateur (`src/lib/recommendation/`) et des composants de modal continuaient d'exploiter d'anciens schémas ou simulaient des inventaires disjoints. De plus, la fiche modale `KitSheetModal` présentait des saccades lors de la fermeture sur iPhone et manquait d'inertie physique naturelle.

### Décision
1. **Unification Intégrale dans `materiel_kits`** :
   - Décommissionnement et purge définitive de toute requête vers `materiel_catalogue`.
   - Les moteurs de recommandation et de calcul calorique/poids lisent et écrivent exclusivement sur la table vivante `materiel_kits`.
2. **Implémentation Gestuelle Apple HIG sur `KitSheetModal`** :
   - Intégration d'une poignée de drag supérieure avec seuil de fermeture à 120px ou flick rapide (> 0.5 px/ms).
   - Friction élastique progressive ($0.2 \times \Delta Y$) en cas d'overscroll vers le haut.
   - Respect strict des marges `env(safe-area-inset-bottom)` et verrouillage du scroll arrière-plan (`overflow: hidden`).
3. **Mise à Jour de la Suite de Tests** :
   - Consolidation de l'intégralité des 54 suites de tests Vitest (339/339 tests au vert).

### Conséquences
- **Positives :**
  - Architecture applicative 100% alignée sur les principes directeurs LKDV.
  - Expérience utilisateur tactile de niveau natif iOS.
  - Zéro dette technique résiduelle sur la couche d'inventaire.
- **Négatives :**
  - Aucune régression identifiée.

### Liens & Références
- [[02 — 🎒 MATÉRIEL & KITS/Configurateur IA|Configurateur IA]]
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Gestes Apple HIG|Gestes Apple HIG & Friction Tactile]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-007-Unification-Table-Materiel-Kits|ADR-007 : Table Unique materiel_kits]]