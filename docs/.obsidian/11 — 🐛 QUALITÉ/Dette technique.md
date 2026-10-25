---
title: Dette Technique & Refactoring Backlog LKDV
aliases:
  - Dette technique
  - Refactoring
  - Backlog Tech
tags:
  - qa
  - tech-debt
  - refactoring
updated: 2026-08-17
---

# 🧹 DETTE TECHNIQUE & REFACTORING BACKLOG LKDV

> [!abstract] **Le registre des améliorations structurelles pour maintenir un code sain**

---

## 📋 Chantiers de Nettoyage & Refactoring

1. **Suppression du Fichier Mort `TopBar.tsx` :**
   - Retirer physiquement `src/components/mobile-nav/TopBar.tsx` (11.8 kB) qui n'est plus importé.
2. **Déplacement du Schéma PostGIS :**
   - Migrer l'extension `postgis` du schéma `public` vers un schéma dédié `extensions`.
3. **Purger les Traces Synthétiques Anciennes :**
   - Vérifier la suppression définitive des anciens faux sentiers synthétiques au profit des 1 139 itinéraires réels OpenStreetMap.
4. **Standardisation des Skeletons :**
   - Remplacer les 3 derniers spinners isolés par des composants `<SkeletonCard />`.

---

> [!tip] **Notes complémentaires :**
> - Découvrir le volet sécurité : [[Sécurité]]
> - Explorer la stratégie de tests : [[Tests]]
