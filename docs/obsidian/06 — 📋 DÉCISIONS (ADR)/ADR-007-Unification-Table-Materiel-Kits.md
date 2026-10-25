---
title: ADR-007 — materiel_kits, Entité Vivante Unique de la Lignée
aliases:
  - ADR-007
tags:
  - adr
  - kits
  - materiel
  - architecture
  - bdd
date: 2026-09-03
status: Accepté
---

# ADR-007 — materiel_kits, Entité Vivante Unique de la Lignée

### Contexte
Dans l'architecture historique, deux représentations concurrentes du kit coexistaient :
- `kit_reports` : snapshot statique JSONB généré par le configurateur IA.
- `materiel_kits` : structure relationnelle d'inventaire vivant (articles en lignes, partages, mutations, retours terrain).

Le modèle généalogique des lignées exige des entités qui **mutent** (adaptation, substitution d'éléments) et portent une **preuve terrain**. Un snapshot figé ne pouvait pas porter la filiation.

### Décision
1. Déclarer **`materiel_kits` comme l'unique entité vivante de la lignée**.
2. Réduire `kit_reports` à un simple snapshot d'historique de consultation avec clé de rattachement facultative `kit_id REFERENCES materiel_kits(id)`.
3. Toute mutation, calcul de poids, dérivation ou attribution vit exclusivement dans `materiel_kits` et `kits`.

### Conséquences
- **Positives :**
  - Une source unique de vérité pour tout le système.
  - Cohérence parfaite entre le configurateur, le calcul du Base Weight et la boutique.
  - Élimination des désynchronisations de schémas.
- **Négatives :**
  - Nécessité de migrer toutes les dépendances logicielles qui interrogeaient directement les catalogues découplés.

### Liens & Références
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]
- [[04 — 🏗️ ARCHITECTURE & BACKEND/BDD & Schéma|BDD & Schéma Supabase]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-011-Migration-Configurateur-Materiel-Kits|ADR-011 : Migration Configurateur]]