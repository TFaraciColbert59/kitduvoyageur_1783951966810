---
title: Compartiments de Stockage (Storage Buckets) LKDV
aliases:
  - Storage
  - Buckets Supabase
  - Médias et Fichiers
tags:
  - supabase
  - storage
  - media
updated: 2026-08-17
---

# 📦 COMPARTIMENTS DE STOCKAGE (STORAGE BUCKETS) LKDV

> [!abstract] **Gestion sécurisée des médias, photos de trek et traces GPX**

---

## 🗂️ Les 4 Buckets Supabase Storage

| Nom du Bucket | Type d'Accès | Contenu Stocké | RLS & Restrictions |
| :--- | :---: | :--- | :--- |
| **`avatars`** | Public en lecture | Photos de profil des voyageurs | Écriture autorisée uniquement dans son propre sous-dossier `user_id/*`. Max 2 Mo. |
| **`carnet-media`** | Public en lecture | Photos et vidéos courtes des récits d'expédition | Téléversement réservé aux membres connectés. Formats : JPG, PNG, WebP. Max 10 Mo. |
| **`gear-photos`** | Public en lecture | Photos du matériel possédé et annonces d'occasion | Téléversement lié à un `gear_item_id`. Max 5 Mo. |
| **`trail-gpx`** | Restreint | Fichiers bruts GPX/KML des sentiers de randonnée | Téléversement réservé aux administrateurs. |

---

> [!tip] **Pour continuer la lecture :**
> - Consulter l'historique des migrations SQL : [[Migrations]]
> - Explorer les systèmes d'authentification et de profils : [[06 — 🔗 SYSTÈMES/Profils\|Profils]]
