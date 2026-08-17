---
title: Politiques de Sécurité Row-Level Security (RLS)
aliases:
  - RLS
  - Row Level Security
  - Sécurité Base de Données
tags:
  - supabase
  - rls
  - security
updated: 2026-08-17
---

# 🛡️ POLITIQUES DE SÉCURITÉ ROW-LEVEL SECURITY (RLS)

> [!abstract] **Le rempart de sécurité au niveau de la donnée**
> 100% des tables publiques du projet possèdent `ENABLE ROW LEVEL SECURITY`. Les accès anonymes en écriture sont systématiquement bloqués et testés en intégration continue.

---

## 🔒 Synthèse des Politiques RLS par Domaine

| Table | SELECT (Lecture) | INSERT (Création) | UPDATE (Modification) | DELETE (Suppression) |
| :--- | :--- | :--- | :--- | :--- |
| **`user_profiles`** | `true` (Public) | `auth.uid() = id` | `auth.uid() = id` | `auth.uid() = id` |
| **`gear_items`** | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| **`hiking_routes`** | `true` (Public) | Admin uniquement | Admin uniquement | Admin uniquement |
| **`trail_segments`** | `true` (Public) | Admin uniquement | Admin uniquement | Admin uniquement |
| **`carnets`** | `visibility = 'public' OR auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| **`travel_groups`** | `visibility = 'public' OR is_member(id)` | Authentifié | Admin du groupe | Owner uniquement |
| **`group_expenses`** | `is_member(group_id)` | `is_member(group_id)` | Auteur ou Admin | Auteur ou Admin |
| **`reward_transactions`** | `auth.uid() = account_id` | Système / Trigger uniquement | ❌ Interdit (Immuable) | ❌ Interdit (Immuable) |
| **`orders`** | `auth.uid() = user_id` | Service Role (Stripe) | Service Role | ❌ Interdit |

---

## 🛡️ Fonctions RLS d'Aide (Helper Functions)

- `public.is_groupe_member(group_id UUID)` : Vérifie en 1 requête indexée si `auth.uid()` possède un statut `accepted` dans le groupe cible.
- `public.can_view_carnet(carnet_id UUID)` : Détermine si l'utilisateur courant a le droit d'accéder aux moments privés d'un carnet.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les fonctions stockées : [[Functions]]
> - Explorer l'historique des migrations : [[Migrations]]
