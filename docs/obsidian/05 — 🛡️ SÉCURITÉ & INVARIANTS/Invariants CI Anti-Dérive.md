---
title: Invariants CI & Garde-Fous Anti-Dérive — LKDV
description: Spécification des vérifications automatisées en intégration continue, tokens interdits et isolation physique
tags:
  - sécurité
  - ci
  - qualité
  - automatisation
  - invariants
aliases:
  - Invariants CI
  - Garde-Fous Anti-Dérive
  - ci_invariants
date: 2026-09-04
status: active
---

# 🛡️ Invariants CI & Garde-Fous Anti-Dérive

Pour préserver la pureté de la base de code et empêcher toute régression humaine ou par modèle d'IA, **Le Kit du Voyageur** dispose d'un automate de contrôle pré-commit et CI : `scripts/verify/ci_invariants.mjs`.

> [!important] Règle Permanente
> Aucun commit ou pull request ne peut être validé si `npm run verify:invariants` ne sort pas avec le code de succès **0**.

---

## 🔍 Les Trois Invariants Inviolables

```mermaid
flowchart TD
    Run[npm run verify:invariants] --> Test1{1. Analyse Tokens Interdits}
    Run --> Test2{2. Contrôle Dossier Migrations}
    Run --> Test3{3. Vérification Types & Build}

    Test1 -->|[PROJET_FANTÔME_OBSOLÈTE] trouvé| Fail[Échec CI]
    Test1 -->|#0B1F17 ou #2D6B4A trouvé| Fail
    Test2 -->|Migration Lot 6 dans migrations/| Fail
    Test3 -->|Erreur TypeScript| Fail

    Test1 -->|Zéro token banni| OK[Succès Code 0]
    Test2 -->|Lot 6 hermétique dans migrations_frozen/| OK
    Test3 -->|0 erreur tsc| OK
```

### 1. Bannissement des Tokens Interdits
Le script scanne récursivement l'ensemble des fichiers sources (`.ts`, `.tsx`, `.sql`, `.json`, `.md`) à la recherche de deux catégories d'anomalies :
- **Identifiant Projet Supabase Fantôme** : Toute présence de `[PROJET_FANTÔME_OBSOLÈTE]` entraîne l'interruption immédiate de la CI. Seul l'identifiant officiel **`icxyvwzfjbflcbqukpfz`** est toléré.
- **Teintes Chromatiques Désuètes** : Les codes couleur `#0B1F17` et `#2D6B4A` sont formellement bannis pour garantir la cohérence absolue de la [[03 — 🎨 DESIGN SYSTEM & MOBILE/Tokens & Palette v2|Palette v2.0]].

### 2. Isolation Physique des Migrations Gelées (ADR-006)
`supabase db push` appliquant aveuglément tous les scripts présents dans `supabase/migrations/` :
- Les 18 migrations gelées du Lot 6 sont obligatoirement confinées dans le répertoire dédié `supabase/migrations_frozen/`.
- La présence d'une seule migration appartenant au Lot 6 dans `supabase/migrations/` fait immédiatement échouer le test d'invariant.

### 3. Contrôle Statique des Types TypeScript
- Exécution de `tsc --noEmit` en mode strict.
- Zéro `any` implicite et zéro avertissement toléré.

---

## 💻 Exécution en Local

Pour contrôler l'intégrité avant chaque push :
```bash
npm run verify:invariants
```

---

## 🔗 Voir Aussi
- [[00 — 🗺️ CARTE & NAVIGATION/Dashboard|Tableau de Bord Exécutif]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-006-Separation-Migrations-Gelees|ADR-006 : Séparation Migrations Gelées]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-003-Design-System-Palette-v2|ADR-003 : Normalisation Palette v2.0]]