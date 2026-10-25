# A2 — Traitement GPS, segmentation et map-matching — Design

Date : 2026-09-11 · Statut : à implémenter · Plan : `docs/superpowers/plans/a2-gps-segmentation-map-matching.md`
Contraintes : ADR-AI-002 (`trail_segments` unique), ADR-AI-005 (moteurs purs), ADR-AI-006 (jobs idempotents)

## Vision

Transformer les sessions randonnée existantes (`hike_sessions.positions_geojson`) en
passages fiables et normalisés sur les segments de sentier (`session_segment_passages`),
avec un score de qualité explicite. Aucun agrégat collectif n'est publié à cette phase
(Phase 4).

## Pipeline (pur + orchestré serveur)

```text
positions_geojson
→ validation Zod
→ nettoyage (précision, doublons, ordre temporel)
→ rejet des téléportations (vitesse / saut)
→ lissage altitude
→ détection des pauses
→ métriques (distance, D+/D-, durées)
→ score qualité (TrackQuality)
→ candidats PostGIS (RPC a2_segment_candidates)
→ map-matching progressif (proximité, direction, continuité, pénalité de saut)
→ passages segmentés (sens, entrée/sortie, durées, arrêts, qualité)
→ persistance idempotente (service_role) + statut session processed
```

## Moteurs purs (testés, zéro I/O)

`src/features/adventure-intelligence/domain/` :

- `geo.ts` — haversine, bearing, lissage altitude, distance cumulée.
- `trackNormalization.ts` — `normalizeTrack(points, options) → NormalizedTrack`
  (points retenus, pauses, métriques, qualité, rejets motivés).
- `mapMatching.ts` — scoring progressif et construction des passages
  (`matchTrackToSegments`, `buildPassages`) ; candidats injectés via une fonction
  `(point) => SegmentCandidate[]` (aucun accès réseau dans le moteur).
- `segmentFeatures.ts` — `computeSegmentFeatures(geometry, tags) → SegmentFeatures`
  (longueur, pente moyenne/max, D+/D-, altitude min/max, classe technique heuristique ;
  exposition/isolement restent `null` tant qu'aucune source ne les alimente).

## Seuils par défaut (constantes exportées, surchargeables)

| Constante | Valeur |
|---|---|
| Précision GPS maximale | 50 m |
| Vitesse maximale plausible | 30 km/h (8,33 m/s) |
| Saut maximal | 500 m |
| Fenêtre lissage altitude | 5 points |
| Vitesse « arrêt » | 0,3 m/s |
| Pause minimale | 60 s |
| Hystérésis D+/D- | 3 m |
| Distance max point→segment | 35 m |
| Écart de cap max | 60° |
| Score d'acceptation min | 0,5 |
| Pénalité de saut | 0,4 |

## TrackQuality (déjà défini en A1)

`overall`, `gpsAccuracy`, `temporalContinuity`, `altitudeReliability`,
`plausibleMovement`, `reasons[]` — tous [0,1] ; pondération
`0.35 / 0.25 / 0.2 / 0.2`.

## Persistance (idempotence)

- `session_segment_passages` : upsert avec la clé
  `(session_id, segment_id, direction, entered_at, processor_version)` — contrainte créée en A1.
- `performance_observations` : une observation par passage (métriques dérivées,
  champs déclaratifs `null` en Phase 2).
- `hike_sessions` : `processing_status` (`pending → processing → processed → failed`),
  `processor_version`, `processed_at`, `track_quality`.
- `eligible_for_collective` : `gps_quality ≥ 0.6 && map_match_quality ≥ 0.6 && session terminée`.

## SQL (migration additive)

`20260911140000_a2_segment_candidates.sql` :
- RPC `a2_segment_candidates(lat, lng, radius_m)` — segments proches via `ST_DWithin`
  (GIST) + distance géographique + azimut + tags ; `STABLE`, `search_path` verrouillé,
  lecture publique OSM.
- RPC `a2_claim_pending_sessions(limit)` — `FOR UPDATE SKIP LOCKED`, cap tentatives,
  service_role uniquement (pattern `claim_pending_adventure_events`).

## Serveur

- `server/processHikeSession.ts` — orchestrateur idempotent avec client injecté
  (interface minimale `HikeProcessingClient` : `getSession`, `getCandidates`,
  `upsertPassages`, `insertObservations`, `markSession`) → testable sans réseau.
- `src/app/api/cron/process-hike-sessions/route.ts` — POST, `CRON_SECRET`,
  claim des sessions `pending`, traitement séquentiel, résumé JSON.

## Gate de sortie Phase 2

- sessions transformées en passages (engine + orchestrateur testés) ;
- map-matching mesurable (score + ratio de points appariés) ;
- score de qualité produit et persisté ;
- sens montée/descente distingué ;
- **aucun agrégat collectif encore publié** ;
- migration additive + pgTAP candidats/claim.

## Hors périmètre

Agrégation collective (Phase 4), ETA personnelle (Phase 3), UI (Phase 7),
traitement temps réel pendant la sortie.
