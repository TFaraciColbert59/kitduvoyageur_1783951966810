---
title: ADR-004 — Unification de Mon Matériel & de la Boutique
aliases:
  - ADR-004
tags:
  - adr
  - inventory
  - shop
date: 2026-08-17
status: Accepté
---

# ADR-004 — UNIFICATION DE MON MATÉRIEL & DE LA BOUTIQUE

### Contexte
L'existence séparée de `/boutique` et `/mon-materiel` créait une duplication de code (`useEquipment.ts` vs `useOwnedEquipment.ts`) et désorientait l'utilisateur entre son inventaire et les achats.

### Décision
Unifier l'expérience dans `/mon-materiel` (source unique d'équipement avec état de possession visuel) et rediriger `/boutique` en HTTP 308 permanent tout en conservant les balises SEO et Schema.org. Purgée de la table morte `products` au profit de `shop_products`.

### Conséquences
- **Positives :** Suppression de 1 200 lignes de code dupliqué, expérience utilisateur fluide en 1 clic, clarté architecturale totale.
