---
title: Dashboard & Cockpit LKDV
aliases:
  - Dashboard
  - Cockpit
  - Statut Live
tags:
  - cockpit
  - status
  - metrics
updated: 2026-08-17
---

# 📊 DASHBOARD & COCKPIT LKDV

> [!info] **État du Projet au 17 Août 2026**
> LKDV est actuellement en production locale et pré-production Supabase. L'ensemble des 86+ migrations de base de données sont appliquées, le serveur de développement Next.js 15 tourne avec succès et les modules clés sont unifiés.

---

## 🚦 Tableau de Bord des Systèmes

| Système | Statut | Dernière mise à jour | Responsable / Pod | Note Liée |
| :--- | :---: | :--- | :--- | :--- |
| **Authentification & RLS** | 🟢 Fonctionnel | 16 août 2026 | Security Pod | [[Auth]], [[RLS]] |
| **Mon Matériel / Inventaire** | 🟢 Fonctionnel (Unifié) | 17 août 2026 | Programming Pod | [[Inventaire]], [[Produits]] |
| **Boutique & Catalogue** | 🟢 Fonctionnel (Unifié) | 17 août 2026 | Business Pod | [[Boutique]], [[Stripe]] |
| **Randonnée Active & Traces PostGIS** | 🟢 Fonctionnel | 16 août 2026 | Platform & Ops | [[Voyages]], [[Cartes]] |
| **Carnets de Voyage & AI Vision** | 🟢 Fonctionnel | 16 août 2026 | Data & AI Pod | [[Carnets]] |
| **Groupes & Expéditions** | 🟢 Fonctionnel | 16 août 2026 | Product & Policy | [[Groupes]] |
| **Clubs Thématiques & Modération** | 🟢 Fonctionnel | 16 août 2026 | Product & Policy | [[Clubs]], [[Modération]] |
| **Communauté & Feed Mobile** | 🟢 Fonctionnel | 16 août 2026 | Design Pod | [[Communauté]] |
| **Moteur de Récompenses (Reward Engine)** | 🟢 Fonctionnel (Phase 1) | 16 août 2026 | Business Pod | [[Récompenses]] |
| **Système de Notifications & WebPush** | 🟢 Fonctionnel | 16 août 2026 | Platform & Ops | [[Notifications]] |
| **Performance WebGL & Mobile LCP** | 🟡 En optimisation | 17 août 2026 | Design Pod | [[Performance]], [[Problèmes critiques]] |
| **Mode Hors-Ligne Avancé (IndexedDB)** | 🔵 En développement | 17 août 2026 | Programming Pod | [[Roadmap]] |

---

## 💻 Environnement d'Exécution & Métriques

- **Framework :** Next.js 15 (App Router) + React 19 + TypeScript 5
- **Style :** TailwindCSS v3.4 + Framer Motion (Transitions 60fps)
- **Base de données :** Supabase PostgreSQL 15 + Extension PostGIS (`icxyvwzfjbflcbqukpfz`, `eu-west-3`)
- **Port de développement actif :** `http://localhost:4000` (ou `4028`)
- **Pages compilées au build :** 323 pages statiques (vérifié 01/09/2026 — dont ~195 variantes `/pays/[code]` via `generateStaticParams`)
- **First Load JS partagé :** ~103 kB
- **Total Tables Supabase actives :** 48+ tables métier et géodonnées

---

## 🎯 Focus & Priorités Immédiates (mis à jour 01/09/2026 — audit vérifié)

1. **[🔴] Migration BDD de rattrapage :** Créer `is_conversation_member`, `is_conv_owner`, `is_conv_admin` + table `user_blocks` (absentes des migrations, présentes en prod) et rejouer les 15 tests pgTAP.
2. **[🟠] Upload pièces jointes messagerie :** Aligner le path d'upload sur la policy storage (2 segments) — uploads actuellement rejetés par RLS.
3. **[🟠] Réconcilier les redirects :** Une seule cible pour `/boutique` (le code réel pointe vers `/explorer`) — mettre à jour CLAUDE.md + Obsidian + middleware.
4. **[🟠] Nettoyer le code mort réel :** Supprimer les 3 modales communaute orphelines + mettre le CI documenté en cohérence (.github/ci.yml inexistant → workflows réels GitHub Pages).
5. **Optimisation LCP Images :** `<Image priority />` + WebP systématique (toujours d'actualité).
6. **Validation des Crons Distants :** `/api/notifications/digest` + auto-balancing Reward Engine.

---

> [!tip] **Pour aller plus loin :**
> - Voir les dépendances entre fonctionnalités : [[Dépendances système]]
> - Explorer toutes les routes disponibles : [[Carte des routes]]
> - Consulter le détail des bugs et chantiers : [[Bugs]]
