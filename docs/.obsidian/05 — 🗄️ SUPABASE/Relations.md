---
title: Relations & Clés Étrangères BDD LKDV
aliases:
  - Relations
  - Diagramme Entité-Relation
  - Foreign Keys
tags:
  - supabase
  - erd
  - relations
updated: 2026-08-17
---

# 🔗 RELATIONS & CLÉS ÉTRANGÈRES BDD LKDV

> [!abstract] **Le réseau des clés étrangères et contraintes d'intégrité**

---

## 🗺️ Diagramme Entité-Relation (ERD)

```mermaid
erDiagram
    user_profiles ||--o{ gear_items : "possède"
    user_profiles ||--o{ carnets : "publie"
    user_profiles ||--o{ hike_sessions : "enregistre"
    user_profiles ||--o{ group_members : "participe"
    user_profiles ||--|| reward_accounts : "détient"
    user_profiles ||--o{ orders : "commande"

    hiking_routes ||--|{ trail_segments : "découpé en"
    hiking_routes ||--o{ trail_pois : "contient"
    hiking_routes ||--o{ carnets : "associé à"
    hiking_routes ||--o{ hike_sessions : "tracé de"

    carnets ||--|{ carnet_moments : "se compose de"
    
    travel_groups ||--|{ group_members : "compte"
    travel_groups ||--o{ group_expenses : "centralise"
    travel_groups ||--o{ group_polls : "organise"
    travel_groups ||--o{ group_messages : "échange"

    shop_products ||--o{ order_items : "composé dans"
    orders ||--|{ order_items : "contient"

    reward_accounts ||--|{ reward_transactions : "journalise"
```

---

## 🛡️ Règles de Cascade & Intégrité

1. **Suppression d'un utilisateur (`auth.users`) :**
   - `CASCADE` sur `user_profiles`, `user_preferences`, `reward_accounts`.
   - `SET NULL` sur les auteurs de sentiers et produits pour préserver le catalogue public.
2. **Suppression d'un carnet (`carnets`) :**
   - `CASCADE` sur `carnet_moments` et nettoyage automatique des fichiers liés dans Supabase Storage.
3. **Suppression d'un groupe (`travel_groups`) :**
   - `CASCADE` sur `group_members`, `group_expenses`, `group_polls` et `group_messages`.

---

> [!tip] **Notes complémentaires :**
> - Découvrir le contrôle d'accès ligne par ligne : [[RLS]]
> - Explorer les déclencheurs automatiques : [[Triggers]]
