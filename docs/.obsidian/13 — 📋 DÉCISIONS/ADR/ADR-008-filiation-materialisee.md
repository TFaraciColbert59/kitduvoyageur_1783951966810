---
title: ADR-008 — Filiation matérialisée sur materiel_kits (ancestors uuid[])
aliases:
  - ADR-008
tags:
  - adr
  - kits
  - lignees
  - base-de-donnees
date: 2026-09-03
status: Proposé
---

# ADR-008 — FILIATION MATÉRIALISÉE (ancestors uuid[]) PLUTÔT QUE ltree OU CTE RÉCURSIVE

### Contexte

La lignée d'un kit (fork d'un kit, lui-même forké…) doit être lue **au moment du
checkout** (attribution par remontée sur 3 générations maximum, ADR-009) et au rendu du
`KitSheet` (génération courante, racine, chemins). Deux approches classiques :

- **ltree** (extension PostgreSQL) : puissant pour les chemins, mais introduit une
  dépendance d'extension, un type dédié, et l'ordre/morphologie dictée par la lib.
- **CTE récursive à la lecture** : zéro stockage, mais coût `O(profondeur)` par lecture
  et requêtes complexes (récursion, garde anti-cycle) à chaque accès chaud.

Le volume attendu (kits × forks × lectures au checkout) rend les lectures O(n) coûteuses :
le checkout ne doit pas payer une récursion SQL pour attribuer une commission.

### Décision

**Matérialiser la filiation sur `materiel_kits`** avec 5 colonnes dérivées **uniquement**
par trigger serveur (jamais par le client — toute valeur fournie est écrasée) :

- `forked_from uuid REFERENCES materiel_kits(id) ON DELETE SET NULL` — le parent direct.
- `lineage_root_id uuid REFERENCES materiel_kits(id) ON DELETE SET NULL` — la souche.
- `generation smallint NOT NULL DEFAULT 0` — distance à la racine.
- `ancestors uuid[] NOT NULL DEFAULT '{}'` — chemin complet ordonné (racine → parent).
- garde-fous : profondeur max 50, anti-cycle (`NEW.id = ANY(NEW.ancestors)` interdite),
  `lineage_root_id`/`generation`/`ancestors` non modifiables par le client.

L'attribution se lit en accès direct : `ancestors[1..3]` par ordre décroissant de
génération (le dernier élément = parent direct). Index : B-tree sur `lineage_root_id` et
`forked_from`, **GIN sur `ancestors`** (requêtes « kits de telle lignée »).

### Alternatives écartées

1. **ltree** — dépendance d'extension (épaisseur d'exploitation), type exotique,
   pas de bénéfice net pour une profondeur bornée à 50 avec lecture directe des 3 premiers
   ancêtres.
2. **CTE récursive à la lecture** — coût en lecture à chaque checkout/rendu,
   complexité anti-cycle reportée dans chaque requête, indexation limitée.

### Conséquences

**Positives :**
- Lecture d'attribution en **O(1)** (accès tableau), le checkout ne paie rien.
- Index GIN pour les agrégations de lignée (Lot 4, matviews).
- La suppression d'un kit intermédiaire (`ON DELETE SET NULL`) ne casse pas la lignée :
  `ancestors` conserve l'uuid disparu — **voulu**, trace historique.

**Négatives :**
- Redondance écrite par trigger → la désynchronisation est impossible tant que le trigger
  est la seule écriture (contrainte forte du Lot 1).
- Un trigger `SECURITY DEFINER` supplémentaire sur `materiel_kits` (à écrire avec
  `SET search_path = public, pg_temp`, à la différence de la norme actuelle).

### Références

- Audit des lignées de kits (Lot 0) — `docs/reports/AUDIT_KITS_LIGNEE.md` §1.1-1.3
- ADR-009 (commission) — la remontée d'ancestors limite la répartition à 3 générations.