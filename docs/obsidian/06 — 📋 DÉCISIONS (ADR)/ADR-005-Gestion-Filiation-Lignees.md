---
title: ADR-005 — Filiation des Kits & Modèle des Lignées Généalogiques
aliases:
  - ADR-005
tags:
  - adr
  - kits
  - lignees
  - généalogie
date: 2026-08-10
status: Accepté
---

# ADR-005 — Filiation des Kits & Modèle des Lignées Généalogiques

### Contexte
Les paquetages outdoor sont le fruit d'itérations progressives (adaptation d'un kit estival vers des conditions polaires, allègement d'un kit refuge vers un kit bivouac). Les utilisateurs souhaitent dupliquer des kits de référence tout en préservant le lien d'attribution avec le kit créateur originel.

### Décision
Structurer les kits en **arbres généalogiques (Lignées)** :
1. Ajout des colonnes de filiation dans la table `kits` :
   - `forked_from UUID` : Référence vers le kit parent direct.
   - `generation INTEGER` : Profondeur dans l'arbre (`0` pour le kit racine).
   - `root_kit_id UUID` : Référence directe vers la racine de la lignée.
2. Tout fork hérite des articles de son parent tout en permettant l'ajout, le retrait ou la substitution d'articles dans [[06 — 📋 DÉCISIONS (ADR)/ADR-007-Unification-Table-Materiel-Kits|materiel_kits]].

### Conséquences
- **Positives :**
  - Traçabilité complète des évolutions d'un paquetage.
  - Reconnaissance du travail de conception des créateurs originaux.
  - Base pour le système d'attribution et de commission d'affiliation.
- **Négatives :**
  - Nécessité d'empêcher formellement les cycles de filiation récursifs.

### Liens & Références
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-010-Securisation-Triggers-Lignees|ADR-010 : Sécurisation Triggers Lignées]]