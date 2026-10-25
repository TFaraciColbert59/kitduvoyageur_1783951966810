---
title: Déclencheurs Automatiques (Triggers) BDD LKDV
aliases:
  - Triggers
  - Déclencheurs SQL
tags:
  - supabase
  - triggers
  - automation
updated: 2026-08-17
---

# ⚡ DÉCLENCHEURS AUTOMATIQUES (TRIGGERS) BDD LKDV

> [!abstract] **Automatisation d'intégrité et de notification en base**

---

## 📋 Inventaire des Triggers Actifs

| Trigger Name | Table Déclencheuse | Événement | Action Réalisée |
| :--- | :--- | :--- | :--- |
| **`on_auth_user_created`** | `auth.users` | `AFTER INSERT` | Crée automatiquement la ligne correspondante dans `public.user_profiles` et `public.reward_accounts`. |
| **`on_comment_added_notify`** | `comments` | `AFTER INSERT` | Notifie l'auteur du post commenté via `public.notify()`. |
| **`on_post_liked_reward`** | `likes` | `AFTER INSERT` | Déclenche l'attribution de points au créateur du post (avec contrôle anti-fraude). |
| **`on_group_message_cluster`** | `group_messages` | `AFTER INSERT` | Regroupe les alertes de nouveaux messages sur une fenêtre de 15 minutes. |
| **`update_gear_updated_at`** | `gear_items` | `BEFORE UPDATE` | Met à jour le timestamp `updated_at` automatiquement. |

---

> [!tip] **Notes complémentaires :**
> - Découvrir les compartiments de stockage : [[Storage]]
> - Voir l'historique complet des déploiements SQL : [[Migrations]]
