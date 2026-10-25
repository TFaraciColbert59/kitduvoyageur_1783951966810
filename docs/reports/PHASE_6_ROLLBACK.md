# PHASE 6 — Plan de rollback

**Date :** 2026-09-12
**Branche :** `feat/phase6-cockpit-offline` — commit `2e1b7379` (base `fa2042a5`)
**Principe :** rollback applicatif pur. **Aucune migration, aucune donnée serveur produite** : tout est additif côté code (nouvelles abstractions, validations, durcissements). Aucune écriture production.

## 1. Application

- `git revert 2e1b7379` : retour au comportement `fa2042a5` (Phase 5).
  - Rate limiting : les routes reviennent au comportement antérieur (token bucket mémoire pour `/api/terrain/conditions`, quotas DB existants ailleurs).
  - Pack hors-ligne : plus de validation de version (comportement A13 d'origine).
  - Sync : retour au last-write-wins global sur `createdAt`.
  - Cockpit : `aheadBehindMinutes` reste `null`, aucune ligne « Charge consommée ».
  - Reroutage : l'action `rerouteAdventurePlanRoute` disparaît (elle n'est importée nulle part dans l'UI — inerte sans rollback).
- Autonome optionnel (sans revert) : ne pas configurer `UPSTASH_REDIS_REST_URL`/`TOKEN` → repli mémoire immédiat ; rien à défaire côté infra.

## 2. Données locales (point d'attention)

- Le coffre chiffre le brouillon de session active (`localStorage['lkdv_active_hike_session']`) sous forme d'enveloppe `__lkdv_vault: 1`.
- **Après rollback**, l'ancien code ne sait pas lire cette enveloppe : le brouillon en cours de session devient illisible (échec de relecture, aucune donnée inventée). Actions :
  - terminer ou relancer la session avant rollback ; ou
  - purger la clé locale : `localStorage.removeItem('lkdv_active_hike_session')` et, si souhaité, supprimer la base `lkdv-local-vault` (clé non extractible) via les outils navigateur.
- Aucun impact sur les données serveur (le brouillon local n'est jamais la source de vérité).

## 3. Upstash

- Désactivation d'urgence : supprimer les variables `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` et redéployer → retour au repli mémoire, sans changement de code.
- Les compteurs Upstash sont des clés TTL courtes : rien à nettoyer.

## 4. BDD

- **Aucune migration Phase 6.** Les RPC utilisées (`phase3_route_navigable`, `phase3_search_navigable_routes`, `select_adventure_plan_route`) et la table `offline_sync_operations` préexistent (Phases 2/3/A13).
- Le durcissement de fusion champ par champ n'écrit que des colonnes existantes de `hike_sessions` / `adventure_plan_decisions` ; un revert laisse les lignes déjà fusionnées valides.

## 5. Snapshots visuels

- Aucun snapshot impacté (aucun spec visuel ne couvre le cockpit/randonnée). Aucune régénération nécessaire au rollback.

## 6. Production

- Rien n'est déployé à ce stade : branche locale poussée pour revue, pas de PR, pas de production touchée. Rollback = ne pas déployer `2e1b7379`, ou `git revert` si déjà déployé.
