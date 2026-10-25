# A5 — Rapport de vérification (Phase 5 : Terrain Live)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `76030f4f`
Statut : **RÉALISÉ**

## Livrables

| Livrable | Chemin |
|---|---|
| Spec + plan | `docs/superpowers/specs/2026-09-11-a5-terrain-live-design.md` |
| Moteurs purs | `domain/terrainLive.ts` (cycle de vie, confiance, dédup, modération, expiration), `domain/terrainReportFlow.ts` (3 gestes), `domain/terrainAutoDetection.ts` (shadow) |
| Serveur | `server/terrainReports.ts` (création, fusion corroborée, confirmations, expiration, cooldown) |
| APIs | `POST /api/terrain/reports`, `POST /api/terrain/reports/[id]/confirm`, `GET /api/terrain/conditions`, `POST /api/cron/expire-terrain-reports` |
| Migration | `supabase/migrations/20260911170000_a5_terrain_nearby.sql` (geog générée + GiST + RPC proximité + `report_count` + flag shadow) |
| UI mobile | `src/features/terrain-live/` : QuickReportSheet, TerrainReportCard, TerrainReportsList, TerrainLiveLayer, `useTerrainReports`, `toTerrainGeoJson` |
| Tests | 5 suites A5 (+2 correctifs) · 222 fichiers / **1701 tests** verts |

## Preuves

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ 222 fichiers, 1701 tests, 0 échec |
| `npm run type-check` / `npm run lint` | ✅ exit 0 |
| Garde-fou design U-D62 | ✅ rayons/ombres système uniquement (corrigé) |
| Grep `Math.random` / publication auto | ✅ aucune publication automatique (shadow uniquement) |

## Revue indépendante (subagent-driven)

- Spec ✅ moteurs, shadow, serveur, migration. UI ✅ (44 px, safe-area, reduced motion,
  transform/opacity, tokens, drag-to-dismiss, ARIA).
- **Verdict initial : Rejected (narrow)** — 2 défauts Importants :
  1. cooldown de confirmation (2/5 min) non appliqué ;
  2. fusion sans corroboration (`report_count` absent).
- Correctif `76030f4f` : cooldown 5 min (429 + `confirmation_cooldown`) ; colonne
  `report_count` (migration + schéma + RPC + serveur + carte UI « signalé N fois ») ;
  `severity` requise à l'API ; `expires_at` par défaut par catégorie ; libellé
  « confirmé par N » conditionné à `presentCount > 0`.
- Vérifié après correctif : suite complète verte, tests fusion (`report_count: 2`) et
  cooldown présents.

## Mineurs / notes (ledger)

- La RPC `a5_terrain_reports_near` est `SECURITY INVOKER` + RLS : l'octroi `anon` est un
  no-op ; la lecture publique passe par l'API service-role. Assumé (défense en profondeur).
- Haptique légère et drag natif `vaul` non implémentés (framer-motion `drag="y"` utilisé).
- Détection automatique non branchée à un cron (flag `terrain_auto_detection_shadow` OFF) —
  conforme « shadow d'abord » ; branchement prévu Phase 9.
- La spec A4 a été committée pendant cette phase (document en retard, sans code).

## Gate de sortie Phase 5

- ✅ Création (< 5 s, 3 gestes), confirmation (1 par utilisateur), expiration, déduplication.
- ✅ Modération (rate limit, cooldown, réputation plafonnée, description, source officielle).
- ✅ Carte (couche Leaflet + GeoJSON sans identité), liste verticale, API filtrée.
- ✅ Aucune identité de contributeur exposée ; auto-détection strictement en shadow.
