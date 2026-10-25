---
title: Historique des Migrations Supabase LKDV
aliases:
  - Migrations
  - Historique SQL
  - DB Push
tags:
  - supabase
  - migrations
  - changelog
updated: 2026-08-17
---

# 📜 HISTORIQUE DES MIGRATIONS SUPABASE LKDV

> [!abstract] **86+ Migrations Appliquées et Synchronisées sur `icxyvwzfjbflcbqukpfz`**
> Chaque étape de l'évolution de la base de données est versionnée et reproductible via Supabase CLI (`npx supabase db push`).

---

## 📅 Chronologie des Lots Majeurs

```mermaid
timeline
    title Évolution du Schéma de Données LKDV
    2026-07-10 : 20260710110000 : Socle initial tables Admin et logs pays
    2026-07-13 : 20260713000000 : Produits, kits, ambassadeurs, codes promo
    2026-07-15 : 20260715200000 : Création de shop_products (80 articles) et gestion des stocks
    2026-07-16 : 20260716000000 : Architecture complète Groupes, Tricount, Dépenses et Sondages
    2026-07-17 : 20260717100000 : Intégration PostGIS trails et vue explore_trails
    2026-07-31 : 20260731170000 : Sécurisation RLS drastique des Clubs et demandes d'adhésion
    2026-08-09 : 20260809200000 : Hike Sessions et moments de carnet géolocalisés
    2026-08-10 : 20260810200000 : Déploiement des Lots 1 à 10 (kit_reports, inventory, validations)
    2026-08-11 : 20260811000000 : Géodonnées Natural Earth Phase 2 (continents, pays, divisions)
    2026-08-16 : 20260816000000 : Reward Engine (Ledger) et Système Multi-canal de Notifications
    2026-08-21 : 20260821000000 : Kits intelligents et système de préparation au départ
```

---

> [!tip] **Notes complémentaires :**
> - Découvrir le schéma actuel : [[Architecture BDD]]
> - Examiner les règles d'intégrité : [[Relations]]
