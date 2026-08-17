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
  - La route `/boutique` redirige proprement vers `/mon-materiel` en conservant l'indexation SEO et les balises OpenGraph / Schema.org.
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

## ⚠️ Points d'Attention & Chantiers Ouverts

| Item | Niveau de gravité | Diagnostic | Action requise |
| :--- | :---: | :--- | :--- |
| **Chargement LCP Images Mobile** | 🟠 Important | LCP élevé sur certaines connexions lentes dû à de grandes images hero non préchargées. | Appliquer balises `<Image priority />` et WebP systématique. |
| **Code Mort TopBar** | 🟡 Faible | Le composant `TopBar.tsx` est débranché mais le fichier subsiste. | Suppression physique du fichier. |
| **Intégration Hooks Feed Mobile** | 🟡 Faible | Hooks `useInfiniteScroll` et `usePullToRefresh` créés mais non reliés à `/communaute/page.tsx`. | Brancher les hooks dans le feed. |
| **Crons Externes** | 🟡 Faible | Les routes `/api/notifications/digest` et calculs mensuels nécessitent un déclenchement périodique. | Configurer un cron provider (Vercel Cron ou GitHub Action). |

---

> [!tip] **Pour poursuivre l'analyse :**
> - Consulter le détail des bugs : [[Bugs]]
> - Examiner les métriques dans le [[Dashboard]]
> - Explorer la liste des composants dans [[Composants]]
