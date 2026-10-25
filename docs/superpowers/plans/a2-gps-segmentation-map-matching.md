# A2 — Traitement GPS, segmentation et map-matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> TDD strict. Steps en cases `- [ ]`.

**Goal:** Transformer `hike_sessions.positions_geojson` en passages normalisés sur
`trail_segments`, avec qualité mesurable, sans publier d'agrégat collectif.

**Architecture:** Moteurs purs (`geo`, `trackNormalization`, `mapMatching`,
`segmentFeatures`) + orchestrateur serveur idempotent à client injecté + 1 migration
additive (RPC candidats + claim) + route cron protégée.

**Tech Stack:** TypeScript strict, Zod 4, Vitest 4, PostgreSQL/PostGIS.

**Spec:** `docs/superpowers/specs/2026-09-11-a2-gps-segmentation-map-matching-design.md`

## Global Constraints

- `trail_segments` = réseau unique ; aucune nouvelle table réseau.
- Moteurs purs : aucun accès BDD/réseau ; candidats injectés par fonction.
- Aucun agrégat collectif publié (Phase 4).
- Tests `tests/adventure-intelligence/*.spec.ts`, IDs `TEST-A2-*`, français.
- Migrations additives `20260911140000+`, idempotentes, RLS inchangée.
- `npm run test`, `npm run type-check` verts ; `npm run build` non requis par tâche.

---

### Task 1 — Géométrie et normalisation de trace

**Files:**
- Create: `src/features/adventure-intelligence/domain/geo.ts`
- Create: `src/features/adventure-intelligence/domain/trackNormalization.ts`
- Test: `tests/adventure-intelligence/track-normalization.spec.ts`

**Interfaces (exact):**
```ts
export interface TrackPoint { lat: number; lng: number; ele?: number; timestamp: string; accuracyM?: number; speedMps?: number; }
export function haversineM(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number;
export function bearingDeg(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number;
export function smoothAltitude(values: (number|undefined)[], window: number): (number|undefined)[];
export const NORMALIZATION_DEFAULTS: { maxAccuracyM: 50; maxSpeedMps: 8.34; maxJumpM: 500; altitudeWindow: 5; stopSpeedMps: 0.3; minPauseS: 60; elevationHysteresisM: 3 };
export interface TrackPause { startIndex: number; endIndex: number; startAt: string; endAt: string; durationS: number; }
export interface RejectedPoint { index: number; reason: 'invalid'|'accuracy'|'duplicate'|'teleport'; }
export interface TrackMetrics { distanceM: number; totalDurationS: number; movingDurationS: number; gainM: number; lossM: number; avgSpeedKmh: number; movingSpeedKmh: number; }
export interface NormalizedTrack { points: TrackPoint[]; rejected: RejectedPoint[]; pauses: TrackPause[]; metrics: TrackMetrics; quality: TrackQuality; }
export function normalizeTrack(raw: TrackPoint[], options?: Partial<typeof NORMALIZATION_DEFAULTS>): NormalizedTrack;
```
Comportement : tri temporel ; rejet invalid (lat/lng hors bornes, timestamp non parsable) ;
rejet accuracy > seuil ; doublons d'horodatage (garder la meilleure précision) ;
téléportation (vitesse > max OU saut > maxJump) ; lissage altitude (fenêtre 5) ;
pauses (vitesse < stopSpeed pendant ≥ minPauseS) exclues du temps en mouvement ;
D+/D- avec hystérésis 3 m. `TrackQuality` réutilise le type A1
(`src/features/adventure-intelligence/schemas/terrain.schema.ts` → type exporté `TrackQuality`) ;
pondération overall `0.35 gpsAccuracy + 0.25 temporalContinuity + 0.2 altitudeReliability + 0.2 plausibleMovement` ;
`reasons` non vide si `overall < 0.5`.

- [ ] **Step 1** tests rouges : `TEST-A2-NORM-01..08` (tri, précision, doublon, téléportation vitesse, saut, lissage altitude, pause exclue du moving, D+/D- hystérésis, qualité dégradée justifiée). Commande : `npx vitest run tests/adventure-intelligence/track-normalization.spec.ts` → FAIL.
- [ ] **Step 2** implémenter `geo.ts` + `trackNormalization.ts`.
- [ ] **Step 3** vert + `npm run type-check`.
- [ ] **Step 4** commit : `feat(a2): normalisation de trace GPS et score qualite (moteurs purs)`.

---

### Task 2 — Map-matching progressif et passages

**Files:**
- Create: `src/features/adventure-intelligence/domain/mapMatching.ts`
- Test: `tests/adventure-intelligence/map-matching.spec.ts`

**Interfaces (exact):**
```ts
export interface SegmentCandidate { segmentId: number; distanceM: number; bearingDeg?: number; highway?: string | null; surface?: string | null; sacScale?: string | null; }
export interface MatchOptions { maxDistanceM: number; maxBearingDeltaDeg: number; minScore: number; jumpPenalty: number; continuityBonus: number; }
export const MATCH_DEFAULTS: MatchOptions; // 35, 60, 0.5, 0.4, 0.25
export interface SegmentMatch { pointIndex: number; segmentId: number | null; distanceM: number | null; direction: 'forward'|'reverse'|null; score: number; }
export function matchTrackToSegments(points: TrackPoint[], candidatesFor: (point: TrackPoint, index: number) => SegmentCandidate[], options?: Partial<MatchOptions>): SegmentMatch[];
export interface MatchedPassage { segmentId: number; direction: 'forward'|'reverse'; enteredAt: string; exitedAt: string; durationS: number; movingS: number; stoppedS: number; distanceM: number; gainM: number; lossM: number; offRoute: boolean; uturnDetected: boolean; mapMatchQuality: number; }
export function buildPassages(matches: SegmentMatch[], points: TrackPoint[], pauses: TrackPause[]): MatchedPassage[];
```
Score : `0.5*proximité + 0.3*direction + 0.2*continuité − pénalité de saut` ;
proximité = `max(0, 1 - distance/maxDistance)` ; direction = `1 - min(delta/180, 1)`
avec delta = écart cap trace/candidat (fallback 0,5 sans cap) ; continuité = bonus si
même segment que le point précédent, `0.5*bonus` si candidat différent mais dans 25 m ;
pénalité si le point est rejeté (téléportation) ou si la distance au segment précédent
dépasse `jumpPenaltyM`. Acceptation si `score ≥ minScore` ET `distance ≤ maxDistance`.
`buildPassages` : groupes consécutifs même `(segmentId, direction)` de longueur ≥ 2 ;
`offRoute` si ≥ 2 points non appariés entre deux passages du même segment ;
`uturnDetected` si direction opposée pour le même segment dans la fenêtre de 10 min ;
`mapMatchQuality` = points appariés / points retenus.

- [ ] **Step 1** tests rouges : `TEST-A2-MATCH-01..08` (acceptation proximité, rejet éloigné, cap opposé ⇒ reverse, continuité, pénalité de saut, scoring ordonné, passages groupés, demi-tour détecté, off-route).
- [ ] **Step 2** implémenter.
- [ ] **Step 3** vert + `npm run type-check`.
- [ ] **Step 4** commit : `feat(a2): map-matching progressif et extraction de passages`.

---

### Task 3 — Caractéristiques de segment

**Files:**
- Create: `src/features/adventure-intelligence/domain/segmentFeatures.ts`
- Test: `tests/adventure-intelligence/segment-features.spec.ts`

**Interfaces (exact):**
```ts
export interface SegmentGeometryInput { segmentId: number; points: { lat: number; lng: number; ele?: number }[]; highway?: string | null; surface?: string | null; sacScale?: string | null; }
export interface SegmentFeaturesResult { segmentId: number; lengthM: number; gainM: number; lossM: number; meanGradePct: number; maxGradePct: number; altitudeMinM: number | null; altitudeMaxM: number | null; surface: string | null; technicalClass: 0|1|2|3|4|5; exposureClass: null; isolationClass: null; source: 'computed'; }
export function computeSegmentFeatures(input: SegmentGeometryInput): SegmentFeaturesResult;
export function technicalClassFromTags(tags: { highway?: string|null; sacScale?: string|null; surface?: string|null }): 0|1|2|3|4|5;
```
Heuristique technique : `sac_scale hiking→1, mountain_hiking→2, demanding_mountain_hiking→3, alpine_hiking→4, demanding_alpine_hiking→5` ;
sinon `highway path→1, track→1, footway→0, bridleway→1, steps→2` ; surface `rock/scree→+1` (plafonné 5) ;
défaut 1 si inconnu. `meanGradePct = (gain − loss) / length × 100` (0 si length 0) ;
`maxGradePct` = pente max lissée sur fenêtres ≥ 20 m ; exposition/isolement restent `null`
(aucune source à cette phase — honnête et documenté).

- [ ] **Step 1** tests rouges : `TEST-A2-FEAT-01..06`.
- [ ] **Step 2** implémenter.
- [ ] **Step 3** vert + `npm run type-check`.
- [ ] **Step 4** commit : `feat(a2): caracteristiques derivees de segment (pente, D+/D-, classe technique)`.

---

### Task 4 — Migration RPC candidats + claim sessions

**Files:**
- Create: `supabase/migrations/20260911140000_a2_segment_candidates.sql`
- Create: `supabase/tests/database/a2_segment_processing.test.sql`

**Contenu normatif :**
- `a2_segment_candidates(p_lat float8, p_lng float8, p_radius_m float8 DEFAULT 50)`
  RETURNS TABLE(`segment_id bigint, distance_m float8, bearing_deg float8, highway text, surface text, sac_scale text`) —
  `STABLE SECURITY INVOKER`, `SET search_path = public, pg_temp`, `ST_DWithin(geom::geography, point::geography, radius)`,
  azimut via `degrees(ST_Azimuth(ST_StartPoint(geom), ST_EndPoint(geom)))`, `ORDER BY distance_m LIMIT 5` ;
  `GRANT EXECUTE TO authenticated, service_role` (lecture de données OSM publiques).
- `a2_claim_pending_sessions(p_limit integer DEFAULT 5)` RETURNS SETOF `public.hike_sessions` —
  `SET status='processing'` via sous-requête `FOR UPDATE SKIP LOCKED` sur `processing_status='pending'` ;
  `SECURITY DEFINER` + `search_path` ; `REVOKE` anon/authenticated, `GRANT` service_role.
- pgTAP `a2_segment_processing.test.sql` : gain du claim réservé service_role, claim traite
  des sessions pending, candidats trouvés pour un segment proche (fixtures geom), pas de fuite hors rayon.

- [ ] **Step 1** écrire la migration (additive, idempotente).
- [ ] **Step 2** écrire la suite pgTAP (pattern a1).
- [ ] **Step 3** commit : `feat(db): a2 candidats segments et claim de sessions a traiter`.

---

### Task 5 — Orchestrateur serveur + route cron

**Files:**
- Create: `src/features/adventure-intelligence/server/processHikeSession.ts`
- Create: `src/app/api/cron/process-hike-sessions/route.ts`
- Test: `tests/adventure-intelligence/process-hike-session.spec.ts`

**Interfaces (exact):**
```ts
export interface HikeSessionRow { id: string; user_id: string; positions_geojson: unknown; processing_status: string; processor_version: string | null; ended_at: string; }
export interface HikeProcessingClient {
  getSession(id: string): Promise<HikeSessionRow | null>;
  getCandidates(lat: number, lng: number, radiusM: number): Promise<SegmentCandidate[]>;
  upsertPassages(rows: unknown[]): Promise<void>;
  insertObservations(rows: unknown[]): Promise<void>;
  markSession(id: string, patch: { processing_status: 'processing'|'processed'|'failed'; processor_version: string; processed_at?: string; track_quality?: unknown }): Promise<void>;
}
export const PROCESSOR_VERSION = 'a2-v1';
export async function processHikeSession(sessionId: string, client: HikeProcessingClient): Promise<{ status: 'processed'|'skipped'|'failed'; passages: number; reason?: string }>;
```
Flux : idempotence (`processing_status==='processed' && processor_version===PROCESSOR_VERSION` → skipped) ;
validation Zod des points (payload invalide → failed) ; `normalizeTrack` ; candidats par point
avec cache par coordonnées arrondies (~11 m) et pas d'échantillonnage (chaque point) ;
`matchTrackToSegments` + `buildPassages` ; `eligible_for_collective = gpsQuality≥0.6 && mapMatchQuality≥0.6` ;
`upsertPassages(..., onConflict ignore)` ; 1 observation par passage (métriques + `processor_version`,
déclaratifs null) ; `markSession(processed)`. Route cron : `POST`, Bearer `CRON_SECRET`,
`dynamic='force-dynamic'`, claim via RPC service, traitement séquentiel, réponse
`{ processed, skipped, failed }` ; erreurs par session n'interrompent pas le lot.

- [ ] **Step 1** tests rouges avec client factice (pas de mock supabase) : `TEST-A2-PROC-01..06` (skipped idempotent, payload invalide → failed, passages écrits + observation par passage, passage du seuil collectif, erreur candidats → failed, route non couverte par vitest).
- [ ] **Step 2** implémenter orchestrateur + route.
- [ ] **Step 3** vert + `npm run type-check`.
- [ ] **Step 4** commit : `feat(a2): orchestrateur de traitement de session + cron protege`.

---

### Task 6 — Vérification, rapport, tag

- [ ] **Step 1** `npm run test`, `npm run type-check`, `npm run lint`, `npm run verify:invariants` verts.
- [ ] **Step 2** `docs/reports/A2_VERIFICATION.md` + commit `docs(a2): rapport de verification phase 2` + `git tag a2-done`.

## Self-Review

- Couverture roadmap 2.1-2.6 : normalisation (T1), qualité (T1), features segments (T3),
  map-matching (T2), passages (T2), idempotence (T4/T5). ✅
- Aucun agrégat collectif publié : aucune écriture dans `segment_collective_aggregates`. ✅
- Pas de placeholder : seuils, interfaces et commits exacts.
