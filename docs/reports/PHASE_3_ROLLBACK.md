# PHASE 3 — Plan de rollback

**Date :** 2026-09-11
**Branche/PR :** `feat/phase3-autogen-chain` / PR #39
**Principe :** revert applicatif simple ; objets BDD additifs et inertes sans appel.

## 1. Application

- `git revert` du commit serveur/UI (`c0769076`) : AutoGen revient au comportement minimal,
  le gate navigation retombe au comportement « routeId seul » (déconseillé),
  les nouveaux composants/engines ne sont plus importés.
- Aucune donnée migrée. Le voyage créé par la commande reste un voyage normal.

## 2. BDD (additive, laissable)

- `phase3_route_navigable(bigint)` et `phase3_search_navigable_routes(...)` : fonction pure/lecture seule.
- Désactivation d'urgence :
```sql
REVOKE EXECUTE ON FUNCTION public.phase3_route_navigable(bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.phase3_search_navigable_routes(double precision, double precision, integer, text, integer) FROM authenticated;
```
- Sans ces RPC, le hub retombe en `routeNavigable=false` → gate fermé (fail-safe).

## 3. Snapshots visuels

Si le rollback change le rendu du hub, régénérer les baselines Linux via le workflow
`visual-regression.yml` (`workflow_dispatch` + `update_snapshots=true`) sur la branche concernée,
puis committer l'artefact `visual-snapshots-linux`.

## 4. Production

Migrations non appliquées en production à ce stade. Rollback trivial : ne pas déployer.
