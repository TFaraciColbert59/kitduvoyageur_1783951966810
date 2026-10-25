# PHASE 4 — Plan de rollback (brouillon, §10)

**Date :** 2026-09-12
**Branche :** `feat/phase4-coverage` (base `0a5d861e`)
**Principe :** rollback applicatif par revert ; BDD additive et inerte sans données ; le flag de publication est déjà désactivé.

## 1. Application / scripts

- `git revert` des commits `a9bc6a29`, `b6a869cf`, `704bf11d` (ou revert de la branche entière) :
  - le pipeline `scripts/coverage/` n'est plus exécutable ;
  - la projection TS des offres (`offersFreshness.ts`) n'est plus importée ;
  - aucun consommateur UI n'existe en Phase 4.
- Aucune donnée utilisateur migrée, aucun objet existant modifié de façon destructive.

## 2. BDD (additive, laissable sans risque)

- Tables `coverage_licenses`, `coverage_regions`, `coverage_datasets`, `coverage_dataset_events` : vides (aucune donnée insérée par la migration).
- Colonnes ajoutées à `affiliate_offers` (`link_id`, `price_checked_at`, `availability_checked_at`, `expires_at`) : nullables, aucun impact lecture.
- Contraintes `NOT VALID` : n'affectent que les écritures futures ; supprimables sans perte.
- Vue `poi_offers_served` : en lecture seule, non consommée.
- **Désactivation d'urgence** (sans drop) :
```sql
-- Fermer toute lecture publique des couvertures
DROP POLICY IF EXISTS coverage_regions_public_covered_read ON public.coverage_regions;
DROP POLICY IF EXISTS coverage_datasets_public_read ON public.coverage_datasets;
REVOKE EXECUTE ON FUNCTION public.coverage_promote_dataset(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.coverage_rollback_region(uuid, uuid, text, text) FROM authenticated;
-- Garder le flag fermé (déjà false)
UPDATE public.feature_flags SET enabled = false WHERE id = 'coverage_publication_enabled';
```
- **Rollback de dataset** (fonctionnel, sans perte) : `SELECT public.coverage_rollback_region(<region_id>, <dataset_id_précédent>, '<acteur>', '<raison>');` — la version précédente `rolled_back` est repromue, l'historique reste dans `coverage_dataset_events`.

## 3. Feature flag

- `coverage_publication_enabled` = `false` par défaut ; aucun rollback nécessaire.
- Si un humain l'avait activé : le repasser à `false` suffit à bloquer les nouvelles publications (le pipeline refuse, la matrice affiche « désactivé »).

## 4. Snapshots visuels

Aucun snapshot impacté (aucune UI touchée). Aucune régénération de baseline.

## 5. Production

- Migrations non appliquées en production à ce stade. Rollback trivial : ne pas déployer.
- En cas de déploiement partiel : les migrations sont idempotentes ; ré-exécuter la section 2 suffit à neutraliser l'exposition.
