# PHASE 7 — Plan de rollback

**Date :** 2026-09-11
**Branche/PR :** `feat/phase7-community-privacy` / PR #40
**Principe :** revert applicatif + objets BDD additifs/inertes ; aucune donnée réécrite.

## 1. Application

- `git revert` du ou des commits Phase 7 : retour des anciens composants communauté/UI.
- **Attention** : le retour du défaut `public` est à éviter (régression de sûreté) ;
  si nécessaire, le faire uniquement côté applicatif (schéma conservé).

## 2. BDD

- `carnets.visibility` : seul le DÉFAUT a changé. Restauration :
  `ALTER TABLE public.carnets ALTER COLUMN visibility SET DEFAULT 'public';` (déconseillé).
- `hike_sessions.trip_id` : colonne NULL, inerte si non utilisée.
- `community_posts.snapshot_payload/snapshot_at/snapshot_exclude_location` : colonnes NULL/inertes.
- Trigger `trg_snapshot_community_post_carnet` : désactivation d'urgence
  `ALTER TABLE public.community_posts DISABLE TRIGGER trg_snapshot_community_post_carnet;`
  puis `ENABLE` pour restaurer. Sans le trigger, les nouvelles publications n'ont plus
  de snapshot figé (le contenu publié reste celui inséré, mais le snapshot disparaît).

## 3. Données

Aucune donnée migrée, aucune suppression. Les snapshots déjà pris restent en base.
Les baselines visuelles communauté peuvent être régénérées via le workflow visuel
(`workflow_dispatch` + `update_snapshots=true`).

## 4. Production

Migrations non appliquées en production à ce stade. Rollback trivial : ne pas déployer.
