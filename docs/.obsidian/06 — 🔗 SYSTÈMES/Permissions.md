---
title: Système — Matrice des Permissions & Rôles
aliases:
  - Permissions
  - RBAC
  - Droits d'Accès
tags:
  - system
  - permissions
  - security
updated: 2026-08-17
---

# 🛡️ SYSTÈME — MATRICE DES PERMISSIONS & RÔLES

> [!abstract] **Contrôle d'accès basé sur les rôles (Role-Based Access Control - RBAC)**

---

## 📋 Matrice des Droits d'Accès par Action

| Action Métier | Invité (`anon`) | Membre Connecté | Modérateur | Administrateur |
| :--- | :---: | :---: | :---: | :---: |
| **Consulter sentiers & carnets publics** | ✅ | ✅ | ✅ | ✅ |
| **Simuler un kit avec l'IA** | ✅ | ✅ | ✅ | ✅ |
| **Gérer son sac personnel (`gear_items`)** | ❌ (Local) | ✅ (Synchronisé) | ✅ | ✅ |
| **Publier un post ou un carnet** | ❌ | ✅ | ✅ | ✅ |
| **Créer une expédition de groupe** | ❌ | ✅ | ✅ | ✅ |
| **Rejoindre un club privé** | ❌ | Sur validation | Sur validation | ✅ (Bypass) |
| **Traiter les signalements d'abus** | ❌ | ❌ | ✅ | ✅ |
| **Modifier le catalogue boutique** | ❌ | ❌ | ❌ | ✅ |
| **Simuler le Reward Engine (`/admin`)** | ❌ | ❌ | ❌ | ✅ |

---

> [!tip] **Pour continuer l'exploration :**
> - Découvrir le domaine commerce : [[07 — 🛒 COMMERCE/Produits\|Commerce & Matériel]]
