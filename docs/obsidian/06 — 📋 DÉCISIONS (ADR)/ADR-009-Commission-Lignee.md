---
title: ADR-009 — Modèle de Rétribution & Commission d'Affiliation par Lignée
aliases:
  - ADR-009
tags:
  - adr
  - monétisation
  - affiliation
  - lignees
  - ledger
date: 2026-09-03
status: Accepté
---

# ADR-009 — Modèle de Rétribution & Commission d'Affiliation par Lignée

### Contexte
LKDV rémunère les concepteurs de kits de randonnée exemplaires lorsque leurs recommandations d'équipements génèrent des achats de matériel. Dans un modèle de lignée (A fork B, qui fork C), comment répartir équitablement la commission entre le créateur originel et les adaptateurs intermédiaires ?

### Décision
Adopter la formule de **Conservation d'Item au Fil des Générations** :
1. La commission d'affiliation sur un article acheté est attribuée prioritairement au créateur qui a **introduit** cet article spécifique dans la lignée.
2. Si l'article est conservé sans altération à travers les forks successifs, une part dégressive (ex: 70% créateur initial / 30% fork actif) rétribue à la fois l'inventeur et l'adaptateur ayant fait découvrir le kit à l'acheteur final.
3. Toutes les transactions sont consignées de manière immuable dans une table de grand livre comptable (*ledger*).

### Conséquences
- **Positives :**
  - Rémunération juste fondée sur le travail réel d'ingénierie et de sélection de matériel.
  - Incitation forte à concevoir des kits ultra-qualitatifs et durables.
- **Négatives :**
  - Calcul de ventilation de commission plus sophistiqué lors des webhooks de commande Stripe.

### Liens & Références
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]
- [[04 — 🏗️ ARCHITECTURE & BACKEND/Intégration Stripe|Intégration Stripe]]