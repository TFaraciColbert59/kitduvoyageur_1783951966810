# PHASE 8 — Plan de rollback

**Date :** 2026-09-12
**Branche :** `feat/phase8-security-payments` — commit `b43d9ecd` (base `919afdef`)
**Principe :** les migrations Phase 8 sont **additives** (aucune donnée réécrite,
aucun DROP de table/colonne). Le rollback applicatif est un revert ; le rollback
base consiste à retirer les garde-fous — **attention : cela réintroduit des
trous RLS connus**, à ne faire qu'en cas d'incident bloquant et avec traçabilité.

## 1. Application (rollback recommandé)

```bash
git revert b43d9ecd   # retour au comportement 919afdef (Phase 6)
```

Effets :

- Retour au webhook Stripe sans `stripe_events` (idempotence métier par
  `orders.stripe_session_id` conservée) ; la table `stripe_events` reste en base,
  inerte.
- Retour aux routes sans `enforceRateLimit` ajoutés ; les protections Phase 6
  restent.
- Retour de `recordAffiliateConversion` au client session (⚠️ incompatible avec
  les policies Phase 8 : voir §3).
- Les migrations RLS **restent appliquées** : le nouveau code fonctionne avec
  elles (aucune dépendance inverse). C'est le rollback recommandé.

## 2. Base de données (uniquement si nécessaire)

Les migrations ne sont pas destructives ; le retrait des garde-fous est un choix
de sécurité assumé. Script SQL de retour arrière (à exécuter en connaissance de
cause, jamais en production sans validation) :

```sql
-- 1. hike_sessions : revenir aux policies permissives historiques (DÉCONSEILLÉ)
DROP POLICY IF EXISTS hike_sessions_select_owner_or_public_carnet ON public.hike_sessions;
DROP POLICY IF EXISTS hike_sessions_insert_owner ON public.hike_sessions;
DROP POLICY IF EXISTS hike_sessions_update_owner ON public.hike_sessions;
DROP POLICY IF EXISTS hike_sessions_delete_owner ON public.hike_sessions;
-- puis recréer les 4 policies `true` de la baseline si un métier le justifie.

-- 2. user_profiles : retirer le garde-fou (RÉINTRODUIT l'escalade admin)
DROP TRIGGER IF EXISTS guard_user_profile_privileged_columns ON public.user_profiles;
DROP FUNCTION IF EXISTS public.guard_user_profile_privileged_columns();

-- 3. stripe_events : table additive, peut rester inerte
-- DROP TABLE IF EXISTS public.stripe_events;

-- 4. comment_reports : restaurer la lecture publique si nécessaire (DÉCONSEILLÉ)
-- DROP POLICY IF EXISTS comment_reports_select_own_or_moderator ON public.comment_reports;
-- CREATE POLICY comment_reports_select ON public.comment_reports FOR SELECT USING (true);
```

**Règle : ne restaurer une policy `USING (true)` que si une fonctionnalité
produit est cassée et documenter l'incident.**

## 3. Point d'attention affiliation

Si le code est reverté **sans** retirer les policies Phase 8, le postback
Travelpayouts (`recordAffiliateConversion` via client session) échoue sur
`affiliate_conversions` (policies publiques supprimées). Deux options :

1. conserver le code Phase 8 (recommandé) ; ou
2. recréer temporairement une policy d'écriture minimale sur
   `affiliate_conversions` pour le webhook, avec secret HMAC vérifié.

## 4. Stripe

- `STRIPE_WEBHOOK_SECRET` absent → webhook 503 (fail-safe) : aucun événement
  perdu, Stripe retente.
- Table `stripe_events` : purger si l'on revient au code antérieur :
  `DELETE FROM public.stripe_events;` (service_role), ou la laisser (inerte).
- Aucune clé/price réels n'ayant été configurés, aucun état Stripe à défaire.

## 5. Upstash / anti-abus

- Retrait d'urgence : supprimer `UPSTASH_REDIS_REST_URL`/`TOKEN` → repli
  mémoire immédiat, sans changement de code.
- WAF/bot management Vercel : non configuré (aucun rollback).

## 6. Données utilisateurs

- Aucune donnée réécrite par les migrations Phase 8 (policies + triggers +
  nouvelle table vide).
- Aucune suppression, anonymisation ou migration de contenu.

## 7. Baselines visuelles

- **Aucune UI modifiée → aucune baseline visuelle impactée.** Aucune
  régénération, ni au déploiement, ni au rollback.

## 8. Production

- Rien n'est déployé à ce stade : branche poussée pour revue, pas de PR,
  pas de production touchée. Rollback = ne pas déployer `b43d9ecd`, ou
  `git revert` si déjà déployé.
- Gate Phase 8 (validation juridique) **toujours fermé** : aucun lancement
  public autorisé par ce lot.
