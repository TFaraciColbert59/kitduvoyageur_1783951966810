---
title: État Actuel & Réalité du Code LKDV
aliases:
  - État actuel
  - Statut réel
  - État des lieux
tags:
  - audit
  - codebase
  - reality
updated: 2026-08-17
---

# 🔍 ÉTAT ACTUEL & RÉALITÉ DU PROJET

> [!important] **Principe de Vérification Permanente**
> Cette page synthétise l'état **réel et vérifié dans le code source** et sur l'instance **Supabase distante** (`icxyvwzfjbflcbqukpfz`). Aucune hypothèse non testée ne figure dans ce document.

---

## 🚦 Bilan Exhaustif par Sous-Système

### 1. 🗄️ Supabase, PostGIS & Sécurité (RLS)
- **Statut :** 🟢 **Fonctionnel & Sécurisé (Vérifié)**
- **Faits réels :**
  - 86 migrations appliquées avec succès.
  - Tables de randonnée (`trail_segments`, `hiking_routes`, `trail_metadata`, `trail_pois`, `trail_scores`) blindées contre l'écriture anonyme par RLS (erreur 42501 confirmée en test d'intrusion).
  - Vues d'exploration `explore_trails` et `featured_hiking_routes` reconstruites en mode sécurisé.
  - Fonctions stockées sécurisées avec `SET search_path = public, pg_temp;`.
  - Tables de géodonnées Natural Earth (`geo_continents`, `geo_regions`, `geo_countries`, `geo_divisions`, `geo_places`, `geo_pois`) peuplées et indexées spatialement (SP-GIST / GIST).

### 2. 🎒 Mon Matériel / Inventaire & Boutique Unifiée
- **Statut :** 🟢 **Fonctionnel & Unifié (Vérifié)**
- **Faits réels :**
  - Fusion totale achevée le 17 août 2026 : `/mon-materiel` est la source unique d'équipement, connectée au hook `useEquipment.ts`.
  - La table morte `products` a été purgée au profit strict de `shop_products` et `gear_items`.
  - Le hook obsolète `useOwnedEquipment.ts` a été supprimé physiquement.
  - La route `/boutique` redirige (301 permanent) vers `/explorer` via `next.config.mjs` (vérifié 01/09/2026 — l'ancienne doc « → /mon-materiel » est obsolète).
  - Gestion complète des 5 sous-catégories, des états d'usure, alertes d'entretien et prêts de matériel entre utilisateurs.

### 3. 🗺️ GPS, Cartes & Randonnée Active
- **Statut :** 🟢 **Fonctionnel (Vérifié)**
- **Faits réels :**
  - Écran `/randonnee-active` opérationnel : calcul en temps réel de distance (Haversine), vitesse moyenne, dénivelé cumulé et tracé interactif.
  - Détection de déviation d'itinéraire (`/api/trails` et fonctions spatiales).
  - Page `/explorer` migrée en Server Component Next.js 15 (chargement instantané SSR) avec cache ISR 60s sur `/api/hikes`.
  - Limitation du ratio pixel WebGL à 1.0 sur mobile pour garantir 60fps constants sans surchauffe.

### 4. 📖 Carnets de Voyage & Vision IA
- **Statut :** 🟢 **Fonctionnel (Vérifié)**
- **Faits réels :**
  - Routes `/carnets`, `/carnets/nouveau` et `/carnets/[id]` opérationnelles.
  - Prise en charge des moments multimédias géolocalisés (`carnet_moments`).
  - Route API `/api/carnet/identify-species` pour l'identification assistée par IA de la faune et de la flore photographiées en expédition.

### 5. 👥 Groupes & Expéditions Partagées
- **Statut :** 🟢 **Fonctionnel (Vérifié)**
- **Faits réels :**
  - Pages `/groupes`, `/groupes/[groupId]` et `/nouveau-groupe`.
  - Gestion des rôles (`owner`, `admin`, `member`), sondages décisionnels (`group_polls`), partage de frais type Tricount (`group_expenses`) et répartition des tâches d'expédition (`group_tasks`).
  - RLS isolant strictement les messages et dépenses aux seuls membres acceptés.

### 6. 🛡️ Clubs Thématiques & Communauté
- **Statut :** 🟢 **Fonctionnel (Vérifié)**
- **Faits réels :**
  - Pages `/clubs`, `/clubs/[id]`, `/clubs/nouveau`, `/communaute`.
  - Modal de détail instantané `ClubDetailModal`.
  - Sécurisation contre l'élévation de privilèges dans `club_members` et `club_join_requests` (validation vérifiée par migration SQL).
  - Système de signalement universel `comment_reports`.

### 7. 💰 Reward Engine & Affiliation
- **Statut :** 🟢 **Fonctionnel en Phase 1 (Vérifié)**
- **Faits réels :**
  - Tables de grand livre (`reward_transactions`), soldes (`reward_accounts`), demandes de retrait (`reward_withdrawals`) et logs de parrainage multi-niveaux.
  - Fonctions d'anti-fraude (rejet auto-like, détection de boucles de commentaires, plafonnement quotidien).
  - Tableau de bord utilisateur `/recompenses` et espace d'administration `/admin`.

### 8. 🔔 Système de Notifications & WebPush
- **Statut :** 🟢 **Fonctionnel (Vérifié)**
- **Faits réels :**
  - Moteur centralisé `public.notify()`, file asynchrone `notification_deliveries`.
  - Service Worker local `/public/sw.js` et souscription push VAPID.
  - Page `/alertes` avec préférences fines par canal et bypass d'urgence SOS.
  - Regroupement des messages de chat sur fenêtre glissante de 15 minutes.

---

## ⚠️ Points d'Attention & Chantiers Ouverts (mis à jour 01/09/2026 — audit vérifié)

| Item | Niveau de gravité | Diagnostic | Action requise |
| :--- | :---: | :--- | :--- |
| **Fonctions SQL helper absentes du repo** | 🔴 Critique | `is_conversation_member`, `is_conv_owner`, `is_conv_admin` référencées ~15× dans la migration canonique messagerie mais jamais créées dans les migrations (existantes en prod via SQL Editor). | Nouvelle migration de rattrapage + rejouer les 15 tests pgTAP. |
| **Table `user_blocks` non versionnée** | 🔴 Critique | Absente des migrations, requêtée par `messagingService.ts` + MISSION_LOG Phase 4. | L'ajouter avec la migration de rattrapage (RLS par `auth.uid()`). |
| **Upload pièces jointes → refus RLS** | 🟠 Majeur | Path upload app (1 segment) ≠ policy storage INSERT (2 segments) → uploads rejetés silencieusement. | Aligner path ou policy ; URLs signées au lieu de `getPublicUrl`. |
| **Redirects : 3 sources contradictoires** | 🟠 Majeur | Code : `/boutique`→`/explorer` ; CLAUDE.md : `→/boutique` ; Obsidian : `→/mon-materiel`. Aucune ne décrit le réel. | Choisir une cible, mettre à jour CLAUDE.md + Obsidian + middleware. |
| **Code mort réel (non documenté)** | 🟠 Majeur | 3 modales communaute (`CarnetFormModal`, `ClubFormModal`, `ClubDetailModal`) importées nulle part. | Suppression physique. (Le « code mort TopBar » documenté était déjà supprimé — commit `9ac0eae`.) |
| **CI documenté inexistant** | 🟠 Majeur | Pas de `.github/ci.yml`, pas de `validate-country-cache.mjs`. CI réel = GitHub Pages + lighthouse/css regression. | Mettre à jour CLAUDE.md, ou créer les gates réels. |
| **`useInfiniteScroll` orphelin** | 🟡 Faible | Existe (37 lignes), importé nulle part. (`usePullToRefresh` est **branché** depuis août via MobileCommunityHub.) | Brancher sur `/communaute` ou supprimer. |
| **Crons Externes** | 🟡 Faible | Les routes `/api/notifications/digest` et calculs mensuels nécessitent un déclenchement périodique. | Configurer un cron provider (Vercel Cron ou GitHub Action). |

---

> [!tip] **Pour poursuivre l'analyse :**
> - Consulter le détail des bugs : [[Bugs]]
> - Examiner les métriques dans le [[Dashboard]]
> - Explorer la liste des composants dans [[Composants]]
