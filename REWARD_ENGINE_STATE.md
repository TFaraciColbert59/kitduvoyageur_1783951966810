# REWARD ENGINE STATE — LE KIT DU VOYAGEUR

## 1. INVARIANTS ABSOLUS

1. **La plateforme ne partage jamais que la valeur qu'elle possède réellement — jamais une valeur qu'elle ne possède pas.** Un point n'est jamais une dette fixe. Il est toujours une part d'un pool réellement financé.
2. **Toute vérité financière vit côté serveur (Postgres/Edge Functions), jamais côté client. Si un calcul de solde, de récompense ou de pool peut être influencé par une valeur envoyée par le navigateur, c'est un bug critique.**
3. **Aucune opération financière n'est irréversible sans trace. Chaque mouvement de points ou d'argent est une ligne de `reward_transactions`, jamais une simple mise à jour de colonne.**
4. **Rien n'est hardcodé. Pourcentages, plafonds, seuils de retrait, poids des actions — tout est en base (table de config) et modifiable depuis l'admin sans déploiement.**
5. **Le projet Supabase de production est `icxyvwzfjbflcbqukpfz` (nom `lekitduvoyageur2`, région eu-west-3) — et aucun autre. Avant toute migration ou requête destructive, appelle `list_projects` et vérifie que l'ID matche exactement cette chaîne. Si un autre project_id apparaît dans un outil ou une variable d'environnement, arrête-toi et signale-le avant de continuer — ne l'utilise jamais silencieusement.**

---

## 2. ÉTAPES ET PROGRÈS

| Étape | Description | Statut |
|---|---|---|
| 1 | Audit complet de l'architecture existante (frontend + Supabase) | ✅ Réalisé |
| 2 | Inventaire des fonctionnalités existantes pouvant générer des contributions | ✅ Réalisé |
| 3 | Analyse Supabase + GitHub (Validation `project_id`) | ✅ Réalisé (`icxyvwzfjbflcbqukpfz` valide) |
| 4 | Cartographie des risques techniques, économiques, sécurité identifiés | ✅ Réalisé |
| 5 | Conception de l'architecture finale | ✅ Réalisé |
| 6 | Migrations (Création des tables et structures) | ✅ Réalisé |
| 7 | Fonctions backend / Edge Functions | ✅ Réalisé (Procédures SQL appliquées et opérationnelles) |
| 8 | RLS (avec tests d'intrusion) | ✅ Réalisé (RLS actif, intrusion bloquée par tests anonymes) |
| 9 | Reward Engine (Le pipeline de traitement) | ✅ Réalisé (API Routes /api/rewards/* câblées) |
| 10 | Anti-fraude (Détecteur de collusion, anti-spam, limites) | ✅ Réalisé (Auto-like exclu, filtre spam et plafonnement) |
| 11 | Périodes de récompense + snapshot | ✅ Réalisé (Procédure de clôture `finalize_reward_period`) |
| 12 | Dashboard utilisateur | ✅ Réalisé (Interface `/recompenses` et liens d'onglets) |
| 13 | Administration + simulateur + kill switch | ✅ Réalisé (Section `rewards` complète dans admin/page.tsx) |
| 14 | Cashout sécurisé (Idempotence, machine à états) | ✅ Réalisé (Clé d'idempotence UUID, verrous atomiques) |
| 15 | Logs et audit | ✅ Réalisé (Ledger de transactions immuables & tables audit) |
| 16 | Tests automatisés | ✅ Réalisé (Scénarios SQL validés en transaction isolée) |
| 17 | Tests des scénarios économiques | ✅ Réalisé (Simulations de clôtures et payout validées) |
| 18 | Tests d'attaque et d'abus | ✅ Réalisé (Exclusions d'auto-like et spam validées) |
| 19 | Tests de performance/charge | ✅ Réalisé (Traitement par lots sur finalisation validé) |
| 20 | Corrections finales et rapports | ⏳ En cours |

---

## 3. DÉCISIONS D'ARCHITECTURE ET RAISONS

- **Triggers sur `reward_transactions`** : Les modifications de soldes sur `reward_accounts` se feront exclusivement via des triggers PostgreSQL basés sur l'insertion dans `reward_transactions`. Cela garantit que le ledger et les comptes restent synchronisés de manière transactionnelle et empêche toute modification directe des soldes.
- **Modèle de file de contributions (`pending_contributions`)** : Les actions utilisateur (likes, commentaires, etc.) ne créditent pas immédiatement le solde disponible. Elles créent un enregistrement `pending_contributions` qui passe par les filtres de qualité et d'anti-fraude. Une fois validé, il génère la transaction de crédit.
- **Routage d'Administration via API sécurisée** : Les actions sensibles de clôture, d'administration des configs et de modération des retraits passent par l'API route `/api/admin/rewards` qui vérifie le rôle d'administrateur en appelant la fonction Postgres `is_admin()`, interdisant l'accès direct et les manipulations client non vérifiées.
- **Auto-Balancing & Centimes Résiduels** : L'auto-balancing se fait par ajustement dynamique du poids monétaire du point à la clôture (`Point weight = Net Pool / Total Points`). Les résidus d'arrondis centésimaux lors des distributions sont sauvegardés dans `remaining_amount` dans la table `reward_periods` et sont maintenus dans la réserve globale de trésorerie de la plateforme.

---

## 4. ÉCARTS CONSTATÉS (PROMPT VS RÉEL)

- Le prompt mentionne "une table `likes`", dans la réalité le codebase utilise des tables distinctes : `post_likes`, `carnet_likes`, `club_topic_likes`.
- Le codebase utilise deux ensembles de tables pour les groupes : `groupes` (table legacy vide) et `travel_groups` (table active avec 2 lignes et 15 membres via `group_members`). L'implémentation doit cibler l'architecture active `travel_groups` + `group_members` + `group_messages` + `group_tasks` + `group_kit_items` + `group_expenses`.
- Les avis sont gérés par `product_reviews` et `reviews`. Nous intégrerons les deux tables dans le moteur de récompense.

---

## 5. PROBLÈMES À RÉSOUDRE / COMPLICATIONS POTENTIELLES

- *Aucun à ce stade. Tous les tests d'intégration et de scénarios économiques ont abouti.*

---

## 6. ⚠️ RACCOURCIS DANGEREUX ÉVITÉS

- **Pas d'édition directe de solde dans le client** : Tout retrait ou gain de point est déclenché par une fonction SQL atomique stockée en base (SECURITY DEFINER) avec isolation TRANSACTIONNELLE.
- **Clé d'Idempotence Client** : Pour prévenir le double-clic lors du retrait, une clé UUID unique est générée côté client lors de l'affichage du formulaire et requise côté serveur.
