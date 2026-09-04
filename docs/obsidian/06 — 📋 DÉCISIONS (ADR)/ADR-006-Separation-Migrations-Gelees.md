---
title: ADR-006 — Isolation Physique des Migrations Gelées du Lot 6
aliases:
  - ADR-006
tags:
  - adr
  - migrations
  - supabase
  - devops
  - ci
date: 2026-08-20
status: Accepté
---

# ADR-006 — Isolation Physique des Migrations Gelées du Lot 6

### Contexte
La commande CLI `supabase db push` ne propose aucun filtre unitaire ou flag `--include` : elle applique indistinctement l'intégralité des fichiers SQL présents dans le dossier `supabase/migrations/` par ordre chronologique.
Or, le **Lot 6** contient des évolutions structurelles avancées dont l'application prématurée sur l'instance de production `icxyvwzfjbflcbqukpfz` risquait d'altérer la base en cours d'exploitation.

### Décision
1. **Isoler physiquement** les 18 migrations SQL du Lot 6 dans un dossier distinct : `supabase/migrations_frozen/`.
2. Ne conserver dans `supabase/migrations/` que les migrations stables et validées pour la production.
3. Développer un runner d'exécution autonome pour appliquer les migrations gelées uniquement sur commande explicite lors de tests en environnement isolé.
4. Intégrer une vérification automatique dans `scripts/verify/ci_invariants.mjs` pour bloquer tout commit comportant une migration du Lot 6 dans le dossier actif `supabase/migrations/`.

### Conséquences
- **Positives :**
  - Immunité totale contre les déploiements accidentels lors de `supabase db push`.
  - Intégrité garantie de l'environnement de production.
- **Négatives :**
  - Nécessité de manipuler deux dossiers de migrations lors du dégel ultérieur du lot.

### Liens & Références
- [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Invariants CI Anti-Dérive|Invariants CI Anti-Dérive]]
- [[01 — 🎯 PRODUIT & VISION/Roadmap 2026-2027|Roadmap & Lots]]