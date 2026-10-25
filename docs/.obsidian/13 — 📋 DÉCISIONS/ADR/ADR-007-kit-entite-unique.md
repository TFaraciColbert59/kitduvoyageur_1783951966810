---
title: ADR-007 — materiel_kits, entité vivante unique de la lignée
aliases:
  - ADR-007
tags:
  - adr
  - kits
  - lignees
  - architecture
date: 2026-09-03
status: Proposé
---

# ADR-007 — MATERIEL_KITS, ENTITÉ VIVANTE UNIQUE (KIT_REPORTS = SNAPSHOT)

### Contexte

Deux représentations du « kit » coexistent dans LKDV :

- **`kit_reports`** est un **snapshot figé** produit par le configurateur IA
  (`selected_items/alternatives/consumables` en jsonb, `status` draft/saved/purchased).
  Il ne référence **aucun** `materiel_kits` (audit §1.4).
- **`materiel_kits`** est un objet **vivant** : articles en lignes, partage
  (`share_tokens`), duplication (`fork`), historique (`materiel_kit_history`).

Le chantier « lignées de kits » exige des objets qui **mutent** (fork = adaptation,
pas photocopie), portent une **preuve terrain** (hike_sessions) et donnent droit à une
**attribution** (order_items). La métrique fondatrice (conservation par item à travers les
générations) n'a de sens que sur une entité dont on peut suivre la filiation et les
mutations — un snapshot ne peut pas être la « lignée ».

### Décision

**`materiel_kits` est l'entité vivante unique de la lignée.** `kit_reports` reste le
snapshot du configurateur et gagne une simple colonne de rattachement
`kit_id uuid REFERENCES materiel_kits(id) ON DELETE SET NULL` :

- Lorsque l'utilisateur « emporte » un rapport configurateur comme kit, la route
  `/api/materiel/kits` pose `kit_reports.kit_id = <nouveau kit>`.
- On ne reconstruit **jamais** un `materiel_kit` à partir d'un snapshot (les items du
  snapshot n'ont pas d'identité catalogue fiable : noms libres, pas de `product_id`) —
  le rattachement est un acte utilisateur, pas une rétro-ingénierie.
- La lignée, la preuve terrain et la commission vivent sur `materiel_kits` et ses
  descendants (items, histoire). `kit_reports` est une photo de départ, rien de plus.

### Alternatives écartées

1. **Faire de `kit_reports` l'entité lignée** — impossible : figé après génération,
   pas de fork réel, pas de filiation, pas de personnalisation terrain.
2. **Fusionner les deux tables** — destructif : l'historique du configurateur (sessions,
   réglages, versions) serait perdu ; les schémas ne sont pas compatibles.
3. **Troisième entité « kit en circulation »** — surcomplexité : deux objets à maintenir
   en synchronisation pour un même concept.

### Conséquences

**Positives :**
- Une seule source de vérité pour la lignée / le terrain / la commission (le checkout ne
  lit qu'un chemin : `materiel_kits` → `ancestors` → `order_items`).
- `kit_reports` reste stable (snapshot), aucun risque de corruption par les mutations.

**Négatives :**
- Nécessite le rattachement utilisateur (acte d'adoption) — le configurateur ne produit
  pas directement une lignée.
- Un rapport configurateur sans rattachement ne participe pas à la conservation.

### Références

- Audit des lignées de kits (Lot 0) — `docs/reports/AUDIT_KITS_LIGNEE.md` §1.4
- ADR-008 (filiation matérialisée) — le rattachement alimente l'axe de filiation.