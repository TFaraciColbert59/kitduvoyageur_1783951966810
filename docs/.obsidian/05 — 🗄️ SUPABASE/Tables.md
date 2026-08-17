---
title: Dictionnaire des Tables Supabase LKDV
aliases:
  - Tables
  - Schéma des Tables
  - Dictionnaire BDD
tags:
  - supabase
  - tables
  - schema
updated: 2026-08-17
---

# 🗃️ DICTIONNAIRE DES TABLES SUPABASE LKDV

> [!abstract] **Inventaire exhaustif des 48+ tables métier et spatiales du projet**
> Chaque table est documentée avec ses colonnes principales, ses relations, son niveau de sécurité RLS et les fonctionnalités applicatives qui l'exploitent.

---

## 👤 1. Tables Utilisateurs & Identité

### `user_profiles`
- **Objectif :** Profil public et préférences de l'utilisateur.
- **Colonnes Clés :** `id` (UUID, FK `auth.users`), `username`, `full_name`, `avatar_url`, `bio`, `role` (`anon`, `authenticated`, `moderator`, `admin`), `created_at`.
- **Utilisé par :** [[Auth]], [[Profils]], [[Communauté]], [[Admin]].
- **RLS :** Lecture publique, modification réservée au propriétaire (`auth.uid() = id`).

### `user_preferences`
- **Objectif :** Préférences de notifications et paramètres d'affichage.
- **Colonnes Clés :** `user_id` (UUID), `email_digests` (bool), `push_enabled` (bool), `sos_contacts` (JSONB).
- **Utilisé par :** [[Notifications]], [[Alertes]].

---

## 🧭 2. Tables Sentiers & PostGIS

### `hiking_routes`
- **Objectif :** Entité consolidée d'un itinéraire de randonnée.
- **Colonnes Clés :** `id` (UUID), `title`, `slug`, `country_code`, `distance_km`, `elevation_gain_m`, `difficulty`, `duration_hours`, `geom` (PostGIS LineString), `created_at`.
- **Utilisé par :** [[Voyages]], [[Cartes]], [[Explorer]].

### `trail_segments`
- **Objectif :** Tracés géométriques haute résolution (115 507 segments).
- **Colonnes Clés :** `id` (BIGINT), `route_id` (FK `hiking_routes`), `geom` (PostGIS Geometry 4326), `elevation_profile` (JSONB).
- **Utilisé par :** [[Cartes]], [[Randonnée Active]].

### `trail_pois`
- **Objectif :** Points d'intérêt géo-localisés le long des traces (abris, eau potable, cols).
- **Colonnes Clés :** `id`, `route_id`, `poi_type`, `title`, `geom` (PostGIS Point 4326), `description`.

---

## 🎒 3. Tables Équipement & Commerce

### `gear_items` (Mon Matériel)
- **Objectif :** Inventaire personnel d'un voyageur.
- **Colonnes Clés :** `id`, `user_id` (FK `auth.users`), `name`, `brand`, `weight_g`, `category`, `compartment`, `condition`, `next_maintenance_date`, `is_loaned`, `loaned_to_user_id`, `image_url`.
- **Utilisé par :** [[Inventaire|Mon Matériel]], [[Configurateur]].
- **RLS :** Strictement isolé par utilisateur (`user_id = auth.uid()`).

### `shop_products`
- **Objectif :** Catalogue officiel des produits et équipements.
- **Colonnes Clés :** `id`, `name`, `slug`, `brand`, `category`, `price_cents`, `weight_g`, `stock_quantity`, `description`, `images` (text[]), `technical_specs` (JSONB), `transaction_type` (`neuf`, `occasion`, `location`, `enchere`).
- **Utilisé par :** [[Boutique]], [[Produits]], [[Stripe]].

### `kit_reports`
- **Objectif :** Rapports de kits générés par l'IA.
- **Colonnes Clés :** `id`, `user_id`, `destination`, `season`, `duration_days`, `total_weight_g`, `items_json` (JSONB), `created_at`.
- **Utilisé par :** [[Configurateur]], [[Rapport-Kit]].

---

## 📸 4. Tables Carnets & Sessions

### `carnets`
- **Objectif :** Récits et journaux d'expéditions.
- **Colonnes Clés :** `id`, `user_id`, `route_id`, `title`, `description`, `visibility` (`public`, `private`, `unlisted`), `cover_image_url`, `published_at`.
- **Utilisé par :** [[Carnets]], [[Communauté]].

### `carnet_moments`
- **Objectif :** Étapes géotaggées dans un carnet.
- **Colonnes Clés :** `id`, `carnet_id` (FK `carnets`), `geom` (PostGIS Point 4326), `media_url`, `caption`, `identified_species` (JSONB), `captured_at`.

### `hike_sessions`
- **Objectif :** Sessions de randonnée active enregistrées en direct.
- **Colonnes Clés :** `id`, `user_id`, `route_id`, `started_at`, `ended_at`, `distance_m`, `avg_speed_kmh`, `elevation_gain_m`, `gps_track_geojson` (JSONB).

---

## 👥 5. Tables Communauté & Groupes

### `travel_groups`
- **Objectif :** Groupes d'expédition et clubs thématiques.
- **Colonnes Clés :** `id`, `name`, `type` (`group`, `club`), `description`, `owner_id`, `visibility` (`public`, `restricted`, `private`), `created_at`.
- **Utilisé par :** [[Groupes]], [[Clubs]].

### `group_members` / `club_members`
- **Objectif :** Adhésions et rôles dans les groupes/clubs.
- **Colonnes Clés :** `id`, `group_id`, `user_id`, `role` (`owner`, `admin`, `member`), `status` (`pending`, `accepted`), `joined_at`.

### `group_expenses`
- **Objectif :** Dépenses partagées type Tricount.
- **Colonnes Clés :** `id`, `group_id`, `payer_id`, `amount_cents`, `description`, `split_type`, `participants_json` (JSONB).

### `posts`, `comments`, `likes`
- **Objectif :** Feed communautaire et interactions sociales.

---

## 💰 6. Tables Reward Engine & Commandes

### `reward_accounts`
- **Objectif :** Solde de points et euros des utilisateurs.
- **Colonnes Clés :** `user_id` (PK), `points_balance`, `cash_balance_cents`, `tier` (`bronze`, `silver`, `gold`, `ambassadeur`), `updated_at`.
- **Utilisé par :** [[Récompenses]], [[Points]].

### `reward_transactions`
- **Objectif :** Grand livre immuable (Ledger) des transactions de récompense.
- **Colonnes Clés :** `id`, `account_id`, `amount_cents`, `points_delta`, `event_type` (`post_like`, `affiliate_sale`, `carnet_view`, `withdrawal`), `idempotency_key`, `created_at`.

### `reward_withdrawals`
- **Objectif :** Demandes de retrait financier en attente ou validées.

### `orders` & `order_items`
- **Objectif :** Commandes e-commerce validées par Stripe.

---

## 🔔 7. Tables Notifications

### `notification_deliveries`
- **Objectif :** File d'attente asynchrone des notifications multi-canaux (in-app, push, email).
- **Colonnes Clés :** `id`, `recipient_id`, `channel` (`in_app`, `push`, `email`), `title`, `body`, `action_url`, `status` (`pending`, `sent`, `failed`), `created_at`.

### `push_subscriptions`
- **Objectif :** Clés VAPID des navigateurs pour les notifications WebPush.

---

> [!tip] **Pour continuer :**
> - Voir les diagrammes de relations : [[Relations]]
> - Découvrir les fonctions stockées : [[Functions]]
> - Explorer les triggers automatiques : [[Triggers]]
