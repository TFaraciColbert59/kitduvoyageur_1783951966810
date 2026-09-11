# Adventure Intelligence — Roadmap de finalisation (a10 → a12)

Date : 2026-09-11 · Base : audit `31bdb279`
(`docs/architecture/adventure-intelligence-audit-31bdb279.md`) + ADR-AI-001..008.

> L'audit externe du commit `31bdb279` a établi que le socle est complet en code mais
> partiellement câblé et non validé sur une base réelle. Les tags `a1-done`..`a9-done`
> marquaient des fondations, pas un produit certifié. Cette roadmap reprend les priorités
> P0/P1/P2 de l'audit en trois phases canoniques, avec le même process
> (spec → plan → TDD → subagents → revue → vérification → rapport → tag).

## a10 — P0 · Préproduction (bloquant)

| Lot | Contenu | Références audit |
|---|---|---|
| 10.1 | CI sur `audit/**`, `verify:icons`, actions épinglées SHA, Playwright élargi | #1, #38 |
| 10.2 | Réparation replay lots 7-10, validation base vide + copie, pgTAP, fermeture F1 (`public_profiles`) | #2, #3 |
| 10.3 | GPS horodaté (`PersistedGpsSample`), fin des intervalles artificiels | #4 |
| 10.4 | RPC transactionnelles (`persist_processed_hike_session`, `create_adventure_plan_bundle`), rattachement par clé complète | #5, #8, #9 |
| 10.5 | Lease / retry / `dead_letter` des sessions | #6 |
| 10.6 | RPC batch PostGIS (`a2_match_track_candidates`), fin du N+1 | #7 |
| 10.7 | Consentements imposés au serveur + `consent.revoked` + purge | #11, #12, #25 |
| 10.8 | `/api/adventure/generate` : rate limit, `Idempotency-Key`, génération unique | #10 |
| 10.9 | Profil réel + prédictions persistées (`segment_predictions`, `route_predictions`) | #13 |
| 10.10 | Shadow runners + table `adventure_shadow_runs` | #17, #35 |
| 10.11 | Montage Cockpit/Hub sur données réelles + E2E Adventure Intelligence | #30 |

Gate de sortie : CI verte sur la branche, base vide + copie migrées, pgTAP verts,
F1 fermé, GPS sans artifice, pipelines transactionnels, consentements appliqués,
flags toujours OFF.

## a11 — P1 · Bêta publique

Terrain Live (courses de fusion/confirmation idempotentes, corroboration unique par
utilisateur, photos sécurisées, cache/rate limit de lecture) · agrégats (invalidation
sous seuil/récence, pagination par segment, consentements versionnés) · offline (Dexie
par utilisateur + SHA-256 + worker de synchronisation avec backoff/dead-letter) ·
groupe/trek/entitlements bout-en-bout (persistance, endpoints, écrans) · trois plans
candidats complets · sources vivantes (météo, réglementation, documents, conditions live) ·
cohortes de feature flags (%) · observabilité complète (corrélation, coûts, latences) ·
backtesting réel chiffré · suppression de la clé en dur · protection `main` · tests BDD en CI.

## a12 — P2 · Généralisation 100 %

Charge, batterie, appareils réels iOS/Android, offline terrain réel, calibration
multi-terrains/saisons, validation juridique/RGPD (export, effacement, rétention,
registre), restauration/rollback testés, runbooks, budgets, rollout 1 → 5 → 20 → 50 → 100 %.

## Règles permanentes

- Flags de domaine OFF jusqu'à certification a10 complète.
- `trail_segments` réseau unique ; aucune donnée inventée ; IA jamais calculante.
- Aucune donnée santé ; connecteurs santé interdits avant le lot dédié (audit #44).
- Push par lot sur `audit/adventure-intelligence` pour exécuter la CI.
