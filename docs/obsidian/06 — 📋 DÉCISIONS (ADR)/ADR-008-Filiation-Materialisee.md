---
title: ADR-008 — Matérialisation Récursive de la Filiation des Kits
aliases:
  - ADR-008
tags:
  - adr
  - kits
  - lignees
  - postgresql
  - performance
date: 2026-09-03
status: Accepté
---

# ADR-008 — Matérialisation Récursive de la Filiation des Kits

### Contexte
La traversée récursive à la volée (`WITH RECURSIVE`) de l'arbre généalogique des kits sur chaque affichage de page produit ou de profil générait une charge inutile sur la base de données PostgreSQL lorsque la profondeur de dérivation augmentait.

### Décision
1. Stocker explicitement dans la table `kits` :
   - `root_kit_id UUID` : Clé de l'ancêtre fondateur de la lignée.
   - `generation INTEGER` : Distance générationnelle par rapport à la racine.
2. Pour les calculs complexes de transmission d'articles entre générations, utiliser une vue matérialisée ou une fonction PostgreSQL indexée `get_kit_ancestors(kit_id)`.

### Conséquences
- **Positives :**
  - Requêtes de regroupement de lignée instantanées (`WHERE root_kit_id = $1`).
  - Complexité de requête réduite de $O(D)$ à $O(1)$ pour l'identification de la famille de kits.
- **Négatives :**
  - Maintien rigoureux de la cohérence de `root_kit_id` lors de la création d'un fork.

### Liens & Références
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-005-Gestion-Filiation-Lignees|ADR-005 : Filiation & Généalogie]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-010-Securisation-Triggers-Lignees|ADR-010 : Sécurisation Triggers]]