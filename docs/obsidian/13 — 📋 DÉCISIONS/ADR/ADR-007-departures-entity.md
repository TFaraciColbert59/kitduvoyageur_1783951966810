---
title: ADR-007 — Persistance de l'Entité Départ (departures vs materiel_kits)
aliases:
  - ADR-007
tags:
  - adr
  - architecture
  - database
  - depart
date: 2026-08-31
status: Proposé
---

# ADR-007 — PERSISTANCE DE L'ENTITÉ DÉPART (DÉPART RÉEL VS DÉCOR)

### Contexte
Le cockpit `/materiel/depart/...` a besoin d'afficher un départ concret avec une date réelle (`starts_at`, `ends_at`), un tracé GPX associé (`trail_id` lié à `hiking_routes`), des participants réels et un statut opérationnel (`draft` | `ready` | `active` | `done`).
Actuellement, le cockpit prend arbitrairement le premier kit de l'utilisateur et simule une date à `J+3` ainsi qu'un tracé de secours silencieux (`EXAMPLE_TRAIL`).

### Problème
Sans persistance d'un lien explicite entre un kit, un tracé et une date :
- Le compte à rebours est artificiel.
- La météo n'est pas interrogée sur les vrais jours du trek.
- L'autonomie en eau/vivres ne peut pas être calculée sur la distance et le dénivelé réels.
- Le tracé affiché peut être incohérent avec le nom du kit.

### Options envisagées

1. **Option A : Table dédiée `departures`**
   - Schéma : `id`, `user_id`, `kit_id` (FK `materiel_kits`), `trail_id` (FK `hiking_routes`), `starts_at`, `ends_at`, `participants_count`, `status`.
   - *Avantages :* Modélisation propre 1-N (un même kit peut servir à plusieurs départs successifs dans l'historique), traçabilité des treks passés/actifs.
   - *Inconvénients :* Nécessite une table supplémentaire et des jointures.

2. **Option B : Extension directe de `materiel_kits`**
   - Colonnes ajoutées : `starts_at timestamptz`, `ends_at timestamptz`, `trail_id bigint references hiking_routes(id)`, `status text default 'draft'`.
   - *Avantages :* Zéro jointure supplémentaire, rétrocompatibilité immédiate avec les requêtes existantes sur `materiel_kits`.
   - *Inconvénients :* Lie 1 départ à 1 kit (un kit ne peut pas avoir plusieurs départs programmés en parallèle).

3. **Option C : Stratégie Hybride Progressive (Recommandée)**
   - Phase 0 : Équiper `materiel_kits` des colonnes `starts_at`, `ends_at`, `trail_id`, `status` pour une intégration immédiate et sans friction.
   - Prévoir la transition transparente vers la table `departures` lors de la Phase 5 (historique des départs et archivage des expéditions passées).

### Décision
Adopter **l'Option C (Hybride)** :
- Ajouter immédiatement les colonnes `starts_at`, `ends_at`, `trail_id`, `status` sur `materiel_kits` avec index et contraintes de clés étrangères.
- Fournir un contrat d'interface `DepartDetail` strict côté TypeScript garantissant que `startsAt` et `trail` reflètent la donnée réelle, sans jamais injecter de fausses données de secours.

### Conséquences
- **Positives :** Données 100% réelles, suppression du tracé fictif `EXAMPLE_TRAIL`, météo synchronisée aux jours réels, calculs d'autonomie véridiques.
- **Négatives :** Nécessite une gestion rigoureuse des états vides lorsque l'utilisateur n'a pas encore lié de tracé ou de date à son kit.
