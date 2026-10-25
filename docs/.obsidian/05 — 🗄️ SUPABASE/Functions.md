---
title: Fonctions Stockées PL/pgSQL LKDV
aliases:
  - Functions
  - Fonctions SQL
  - PLpgSQL
tags:
  - supabase
  - sql
  - plpgsql
updated: 2026-08-17
---

# ⚙️ FONCTIONS STOCKÉES PL/PGSQL LKDV

> [!abstract] **La logique transactionnelle exécutée au cœur du moteur PostgreSQL**
> Toutes les fonctions sont déclarées avec `SECURITY INVOKER` ou `SECURITY DEFINER` explicite et `SET search_path = public, pg_temp;`.

---

## 📋 Catalogue des Fonctions Majeures

### 1. Moteur de Notification (`public.notify`)
- **Signature :** `notify(recipient_id UUID, channel TEXT, title TEXT, body TEXT, action_url TEXT)`
- **Rôle :** Insère de façon asynchrone une notification dans `notification_deliveries` en respectant les préférences utilisateur.

### 2. Moteur de Récompenses Anti-Fraude
- `distribute_reward_for_action(user_id UUID, action_type TEXT, amount_cents INT)` : Enregistre la transaction et incrémente le solde en appliquant les plafonds quotidiens et le blocage de l'auto-like.
- `calculate_monthly_cashout_pool()` : Clôture financière mensuelle et calcul du taux de conversion des points.

### 3. Calculs Géospatiaux PostGIS
- `get_nearby_trails(lat FLOAT, lng FLOAT, radius_meters INT)` : Retourne les 20 sentiers les plus proches avec distance exacte.
- `detect_trail_deviation(session_id UUID, current_point GEOMETRY)` : Calcule la distance orthogonale minimale entre le randonneur et la trace de référence.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les déclencheurs automatiques : [[Triggers]]
> - Explorer le stockage de fichiers : [[Storage]]
