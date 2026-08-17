---
title: Authentification, Sessions & Rôles LKDV
aliases:
  - Authentification
  - Auth
  - Rôles et Droits
tags:
  - architecture
  - auth
  - security
updated: 2026-08-17
---

# 🔐 AUTHENTIFICATION, SESSIONS & RÔLES LKDV

> [!abstract] **Sécurité Zero-Trust basée sur Supabase Auth & JWT**
> LKDV gère les sessions utilisateur via des cookies HTTP-only sécurisés, avec synchronisation automatique entre la table système `auth.users` et le profil applicatif `public.user_profiles`.

---

## 🛡️ Matrice des Rôles (RBAC)

| Rôle (`user_profiles.role`) | Permissions & Accès |
| :--- | :--- |
| **`anon` (Visiteur anonyme)** | Lecture des pages publiques (`/explorer`, `/carnets`, `/mon-materiel`), ajout au panier local, simulation de kit IA. |
| **`authenticated` (Membre)** | Gestion de son inventaire personnel, création de carnets, publication dans le feed, adhésion aux clubs, création de groupes, cagnotte récompenses. |
| **`moderator` (Modérateur)** | Traitement de la file des signalements de commentaires (`comment_reports`), modération des publications abusives. |
| **`admin` (Administrateur)** | Accès complet au dashboard `/admin`, gestion des stocks `/admin/produits`, simulation financière des récompenses, modification des traces sentiers. |

---

## 🔒 Protection par Middleware Next.js

Le fichier `src/middleware.ts` intercepte chaque requête vers `/admin` :
1. Extraction du token de session depuis les cookies chiffrés.
2. Vérification de validité auprès de Supabase Auth.
3. Requête sur `user_profiles` pour vérifier `role = 'admin'`.
4. En cas d'échec ou d'absence de droits : redirection immédiate vers `/connexion?redirect=/admin`.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les politiques de sécurité au niveau de la base : [[RLS]]
> - Explorer les performances de l'application : [[Performance]]
