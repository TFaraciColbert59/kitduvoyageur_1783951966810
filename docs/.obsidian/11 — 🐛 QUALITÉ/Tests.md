---
title: Stratégie de Tests & Assurance Non-Régression
aliases:
  - Tests
  - Non-Régression
  - Test Suite
tags:
  - qa
  - tests
  - ci-cd
updated: 2026-08-17
---

# 🧪 STRATÉGIE DE TESTS & ASSURANCE NON-RÉGRESSION

> [!abstract] **Le dispositif de vérification automatisé de LKDV**

---

## 🔍 Les 4 Paliers de Validation

1. **Compilation Stricte TypeScript & Next.js :**
   - Exécution systématique de `npm run build` : vérifie le typage des 194 pages avec `ignoreBuildErrors: false`.
2. **Tests d'Isolation RLS :**
   - Scripts de test Node.js simulant des requêtes frauduleuses (`anon`) pour s'assurer du blocage SQL.
3. **Validation de Calcul du Panier :**
   - Tests unitaires garantissant que le recalcul des prix serveur dans `/api/checkout` ne diverge jamais du prix catalogue.
4. **Vérification Graphique & Non-Régression Visuelle :**
   - Contrôle du respect des marges et du non-débordement horizontal (`max-width: 100vw`).

---

> [!tip] **Pour continuer l'exploration :**
> - Découvrir le contexte pour les agents IA : [[12 — 🤖 IA/Contexte IA\|Intelligence Artificielle & Agents]]
