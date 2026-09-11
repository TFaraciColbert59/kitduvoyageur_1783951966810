# A2 — Rapport de vérification (Phase 2 : GPS, segmentation, map-matching)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `f3fb79d7`
Statut : **RÉALISÉ** (validation BDD copie = gate manuelle)

## Livrables

| Livrable | Chemin |
|---|---|
| Spec | `docs/superpowers/specs/2026-09-11-a2-gps-segmentation-map-matching-design.md` |
| Plan | `docs/superpowers/plans/a2-gps-segmentation-map-matching.md` |
| Moteurs purs | `domain/geo.ts`, `domain/trackNormalization.ts`, `domain/mapMatching.ts`, `domain/segmentFeatures.ts` |
| Orchestrateur | `server/processHikeSession.ts` (client injecté, idempotent `a2-v1`) |
| Route cron | `src/app/api/cron/process-hike-sessions/route.ts` (CRON_SECRET) |
| Migration | `supabase/migrations/20260911140000_a2_segment_candidates.sql` |
| Tests | `tests/adventure-intelligence/{track-normalization,map-matching,segment-features,process-hike-session}.spec.ts` (32 tests A2) · pgTAP `supabase/tests/database/a2_segment_processing.test.sql` |

## Preuves

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ **208 fichiers, 1599 tests, 0 échec** (78 tests domaine A1+A2) |
| `npm run type-check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm run verify:invariants` | ✅ |
| Revue contrôleur | 1 défaut Important trouvé (`passage_id` null) → corrigé `f3fb79d7` ; 78/78 après correctif |

## Décisions et limites documentées

1. **Horodatage GeoJSON** : `hike_sessions.positions_geojson` ne porte pas d'horodatage ;
   l'orchestrateur synthétise un pas de 10 s en remontant depuis `ended_at`
   (`GEOJSON_POINT_INTERVAL_S`). Limite connue, documentée dans le module.
2. **Exposition / isolement de segment** laissés `null` : aucune source disponible à cette
   phase ; Phase 4 les dérivera du collectif.
3. **Pondérations de qualité** (0.35/0.25/0.2/0.2) et pénalités de saut : valeurs par défaut
   exportées et surchargeables, non normées par une source externe (assumé).
4. **Aucun agrégat collectif publié** : aucune écriture dans `segment_collective_aggregates`
   (vérifié par grep sur le diff).
5. **Idempotence** : statut + version (`a2-v1`) + contrainte unique passages ; ré-exécution sans
   doublon. Les observations sont liées aux passages par ids persistés (correctif de revue).

## Gate manuelle (copie BDD)

```bash
supabase db push --db-url "<COPIE>"   # + 20260911140000 (RPC candidats + claim)
supabase test db --db-url "<COPIE>"   # a2_segment_processing.test.sql
```

## État

- Traces → passages : **réalisé et testé** (moteurs purs + orchestrateur injecté).
- Map-matching mesurable : score par point, qualité par passage, `eligible_for_collective`.
- Sens montée/descente distingué (`direction forward/reverse`), demi-tours et sorties de trace.
- Aucun agrégat collectif publié (conforme à la gate Phase 2).
