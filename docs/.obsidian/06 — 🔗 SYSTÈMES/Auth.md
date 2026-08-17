---
title: Système — Authentification & Gestion des Comptes
aliases:
  - Auth
  - Authentification Système
tags:
  - system
  - auth
  - security
updated: 2026-08-17
---

# 🔐 SYSTÈME — AUTHENTIFICATION & GESTION DES COMPTES

> [!abstract] **Gestion unifiée des identités voyageur**
> Le système d'authentification s'appuie sur Supabase Auth avec Magic Links par email, mots de passe chiffrés et sessions JWT sécurisées.

---

## ⚡ Flux d'Authentification

```mermaid
sequenceDiagram
    actor User as Voyageur
    participant App as Client Next.js
    participant Auth as Supabase Auth
    participant DB as PostgreSQL (public.user_profiles)

    User->>App: Saisit email / mot de passe
    App->>Auth: signInWithPassword()
    Auth-->>App: Retourne JWT & Session Cookie
    Auth->>DB: Trigger `on_auth_user_created` (si 1ère fois)
    DB-->>DB: Crée user_profiles & reward_accounts
    App->>User: Redirection vers /compte ou route d'origine
```

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le modèle de profil : [[Profils]]
> - Explorer la matrice des permissions : [[Permissions]]
