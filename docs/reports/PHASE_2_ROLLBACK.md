# PHASE 2 — Plan de rollback

**Date :** 2026-09-11
**SHAs concernés :** `03595239` (BDD), `c3ed27e5` (serveur)
**Principe :** migrations strictement additives ; le rollback applicatif est un simple `git revert`
sans perte de données. Le rollback BDD n'exige aucune suppression de colonne.

## 1. Couche applicative (sans risque de données)

- `git revert c3ed27e5` (ou revert des commits unitaires) : retire projection, action,
  propagation de corrélation et test d'intégration.
- Effet immédiat après redéploiement Vercel ; aucun schéma modifié.

## 2. Couche BDD (additive, laissable en place)

Les objets ajoutés sont inertes si l'application ne les utilise plus :
- colonnes `selected_route_id`, `correlation_id`, `linked_carnet_id` : valeurs `NULL`, aucun impact ;
- table `adventure_plan_route_selections` : RLS active, aucune donnée si non utilisée ;
- RPC `select_adventure_plan_route` / `attach_adventure_plan_to_trip` : inaccessibles sans appel.

### Désactivation d'urgence sans suppression
```sql
REVOKE EXECUTE ON FUNCTION public.select_adventure_plan_route(uuid, bigint, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_adventure_plan_to_trip(uuid, uuid, uuid) FROM authenticated;
```
Réactivation : re-`GRANT EXECUTE ... TO authenticated`.

### Suppression complète (non recommandée avant stabilisation)
Supprimer les 2 migrations du dossier `supabase/migrations` **ne suffit pas** pour la prod ;
il faudrait un script `DROP` explicite. Interdit par les règles agents (§5 du chantier) :
à réserver à une décision humaine documentée hors incident.

## 3. Données

Aucune donnée migrée ou transformée. Aucun backfill. Aucune suppression.
Les publications historiques sans `linked_carnet_id` restent valides (`NULL` toléré).

## 4. Déploiement production

Au moment de ce rapport, ces migrations ne sont **pas** appliquées en production.
Rollback trivial : ne pas les déployer. Si elles le sont puis nécessitent un retour :
appliquer la section 2 (désactivation) et revert applicatif — la prod reste compatible.
