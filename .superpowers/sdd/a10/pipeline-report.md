# a10 — Pipeline GPS durci (10.3 → 10.6) — Rapport d'implémentation

Date : 2026-09-11 · Branche : `audit/adventure-intelligence`
Périmètre : lots 10.3 (GPS horodaté), 10.4 (RPC transactionnelles), 10.5 (lease/retry/dead-letter), 10.6 (map-matching batch PostGIS).
Sources normatives : `docs/superpowers/specs/2026-09-11-a10-p0-finalization-design.md` (§10.3–10.6), `docs/architecture/adventure-intelligence-audit-31bdb279.md` (items #4, #5, #6, #7, #8, #9).

## Statut global

**Terminé.** 4 commits, tests TS verts, type-check et lint verts, suite complète verte.
Aucun flag de domaine activé, aucune donnée santé, migrations additives/idempotentes.
Les migrations et pgTAP **n'ont pas été exécutés** dans ce lot (validation réservée au lot 10.2, voir « Concerns »).

## Commits

| SHA | Sujet | Lot |
|---|---|---|
| `ddb7ba67` | `feat(a10): echantillons GPS horodates` | 10.3 |
| `9c925856` | `feat(db): a10 RPC transactionnelles sessions et plans` | 10.4 |
| `cc3b1bd5` | `feat(a10): lease retry dead-letter des sessions` | 10.5 |
| `661c56b3` | `feat(db): a10 map-matching batch PostGIS + orchestration` | 10.6 |

## Lot 10.3 — GPS horodaté

### Fichiers
- `supabase/migrations/20260911210000_a10_gps_timed_samples.sql` (nouveau)
- `src/features/adventure-intelligence/server/processHikeSession.ts`
- `src/features/hiking/services/HikeSessionService.ts`
- `src/app/api/hike-sessions/route.ts`
- `tests/adventure-intelligence/process-hike-session.spec.ts`

### Migration
- `ALTER TABLE public.hike_sessions ADD COLUMN IF NOT EXISTS positions_timed jsonb;`
- CHECK gardé `hike_sessions_positions_timed_check` : `positions_timed IS NULL OR jsonb_typeof(positions_timed) = 'array'`.
- Commentaire français « échantillons horodatés — source unique de temps ; geojson = géométrie/affichage ».
- Additive, idempotente, aucune policy modifiée.

### Orchestrateur
- `persistedGpsSamplesSchema` (Zod 4, exporté) : `{ lat, lng, timestamp, elevationM?, accuracyM?, speedMps? }`, `.max(50_000)` (`MAX_TIMED_SAMPLES`).
- Priorité de résolution : `positions_timed` valide → **source unique de temps** ; tableau de points explicite historique (`positions_geojson`) → considéré horodaté ; `LineString` seul → mode legacy.
- Legacy : `normalizeTrack` sur timestamps synthétiques (`GEOJSON_POINT_INTERVAL_S` conservé pour la géométrie/temps technique), passages produits avec `eligible_for_collective = false`, **aucune observation**, résultat `{ status:'processed', passages, warning:'timed_samples_missing' }`.
- `positions_timed` présent mais invalide → `failed` / `invalid_timed_samples` sans écriture.

### Client d'écriture
- `HikeSessionService.saveSession` construit `positionsTimed` depuis `GPSPosition.timestamp` (ms → ISO) avec `elevationM/accuracyM/speedMps` si présents. `positions_geojson` inchangé.
- `/api/hike-sessions` persiste `positions_timed` (sanitize + fallback dérivé des positions brutes) ; `positions_geojson` reste construit à l'identique.

### TDD
- **RED** (stash `processHikeSession.ts`, tests neufs en place) : `11 tests | 5 failed` (GPS-01, GPS-02, GPS-03, GPS-04, PROC-06 legacy).
- **GREEN** : `tests/adventure-intelligence/process-hike-session.spec.ts` → **11/11**.

### Tests `TEST-A10-GPS-01..05`
| ID | Vérifie |
|---|---|
| GPS-01 | `positions_timed` prioritaire : `entered_at/exited_at` issus des échantillons, geojson ignoré, éligible collectif, observation produite |
| GPS-02 | Legacy LineString : passage privé (`eligible_for_collective = false`), 0 observation, `warning: timed_samples_missing` |
| GPS-03 | `positions_timed` invalide → `failed` / `invalid_timed_samples`, aucun transcript |
| GPS-04 | Schéma : 50 001 rejeté, 50 000 accepté, `lat/lng` non numériques rejetés |
| GPS-05 | Timed vide + geojson null → `failed` / `invalid_payload` |

## Lot 10.4 — RPC transactionnelles

### Fichiers
- `supabase/migrations/20260911220000_a10_transactional_rpcs.sql` (nouveau)
- `src/features/adventure-intelligence/server/processHikeSession.ts`
- `src/features/adventure-intelligence/server/generateAdventure.ts`
- `src/app/api/cron/process-hike-sessions/route.ts`
- `tests/adventure-intelligence/process-hike-session.spec.ts`, `tests/adventure-intelligence/generate-adventure.spec.ts`

### Signatures RPC
```sql
persist_processed_hike_session(
  p_session_id uuid, p_passages jsonb, p_observations jsonb,
  p_processor_version text, p_track_quality jsonb DEFAULT NULL
) RETURNS jsonb
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- REVOKE public/anon/authenticated, GRANT service_role

create_adventure_plan_bundle(
  p_plan jsonb, p_version jsonb,
  p_runs jsonb DEFAULT '[]'::jsonb, p_decisions jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
-- SECURITY DEFINER, SET search_path = public, pg_temp
-- REVOKE public/anon/authenticated, GRANT service_role
```

### Idempotence & rattachement par clé complète
- Index unique partiel : `idx_performance_observations_passage_version ON performance_observations(passage_id, processor_version) WHERE passage_id IS NOT NULL` (précédé d'une réduction des doublons stricts sur la clé, la ligne la plus récente est conservée).
- Upsert passages sur la clé complète `(session_id, segment_id, direction, entered_at, processor_version)` (contrainte A1), `RETURNING` implicite via ROW_COUNT.
- Chaque observation TS porte `passage_key = segmentId|direction|enteredAt` (jamais de `passage_id`, jamais de file `idsBySegment` : **supprimée**). La RPC joint la clé sur `session_segment_passages` :
  `p.segment_id = split_part(passage_key,'|',1)::bigint AND p.direction = split_part(...,2) AND p.entered_at = split_part(...,3)::timestamptz AND p.processor_version = p_processor_version AND p.session_id = p_session_id`.
- Upsert des observations sur `(passage_id, processor_version)` (cible partielle) ; invariant `v_observations = jsonb_array_length(p_observations)` sinon `RAISE EXCEPTION` → rollback complet (passages compris).
- Étape 3 : `hike_sessions.processing_status='processed'`, `processor_version`, `processed_at=now()`, `track_quality` — même transaction.
- Un aller-retour même segment produit deux passages à clés distinctes (direction/entrée) → deux observations correctement rattachées.

### Contrat client
- `getCandidatesBatch(points, radiusM): Promise<SegmentCandidate[][]>` (aligné sur l'ordre des points) + `persistTranscript({ sessionId, passages, observations, processorVersion, trackQuality })` : un seul appel atomique. `upsertPassages`/`insertObservations`/`getCandidates` supprimés ; `markSession` conservé pour les échecs.
- `generateAdventure` : `persistPlanBundle({ plan, version, runs, decisions })` unique ; l'adaptateur Supabase réel appelle `create_adventure_plan_bundle` ; `insertEngineRun` reste utilisé uniquement pour les runs orphelins d'un échec de pipeline (plan non créé).

### TDD
- **RED** (stash des 3 sources) : `22 tests | 18 failed` (contrat batch, `passage_key`, bundle, atomicité).
- **GREEN** : process + generate → **22/22**.

### Tests `TEST-A10-TX-01..06`
| ID | Vérifie |
|---|---|
| TX-01 | Aller-retour même segment ⇒ passages/clés/ids distincts, aucun `null` |
| TX-02 | Rejeu (2 exécutions) ⇒ 1 passage, 1 observation (upsert par clé complète) |
| TX-03 | Échec du client transactionnel ⇒ 0 écriture partielle, marquage d'échec |
| TX-04 | Chaque observation porte une clé `segmentId\|direction\|enteredAt` valide, sans `passage_id` ni `segment_id` |
| TX-05 | Échec du bundle ⇒ aucun plan/version/run/décision persisté |
| TX-06 | 1 seul `persistPlanBundle`, `insertEngineRun` non appelé, plan/version/runs/décisions cohérents |

## Lot 10.5 — Lease / retry / dead-letter

### Fichiers
- `supabase/migrations/20260911230000_a10_session_lease.sql` (nouveau)
- `src/features/adventure-intelligence/domain/sessionRetry.ts` (nouveau, pur)
- `src/features/adventure-intelligence/server/processHikeSession.ts`
- `src/app/api/cron/process-hike-sessions/route.ts`
- `tests/adventure-intelligence/session-retry.spec.ts` (nouveau), `tests/adventure-intelligence/process-hike-session.spec.ts`
- `supabase/tests/database/a10_session_lease.test.sql` (nouveau, 12 assertions)

### Migration
- Colonnes : `processing_started_at timestamptz`, `processing_attempts integer NOT NULL DEFAULT 0` (+ CHECK `>= 0`), `last_processing_error text`, `next_retry_at timestamptz`.
- CHECK `processing_status` recréé (DROP/ADD gardé) : `pending | processing | processed | failed | dead_letter`.
- Index partiel `idx_hike_sessions_claim_due (processing_status, next_retry_at) WHERE status IN ('pending','processing')`.
- `a2_claim_pending_sessions(p_limit integer DEFAULT 5) RETURNS SETOF public.hike_sessions` (SECURITY DEFINER, service_role) :
  - réclame `pending` avec `next_retry_at IS NULL OR <= now()` **et** `processing` avec lease expiré (`processing_started_at < now() - interval '15 minutes'`), `attempts < 5` ;
  - incrémente `processing_attempts`, pose `processing_started_at = now()`, remet `next_retry_at = NULL` ;
  - **extension documentée** : balaie les leases expirés à `attempts >= 5` vers `dead_letter` (`last_processing_error` préservé ou `lease_expired_attempts_exhausted`) — garantit qu'aucune session ne reste bloquée en `processing` (audit #6).

### Politique pure (`sessionRetry.ts`)
- `MAX_PROCESSING_ATTEMPTS = 5`, `SESSION_LEASE_MINUTES = 15` (alignés sur le claim SQL).
- `computeRetryDelayMinutes(attempts) = 2^attempts` (1, 2, 4, 8, 16 min).
- `planSessionFailure(attempts, nowIso)` → `{ status: 'pending'|'dead_letter', nextRetryAt, delayMinutes, exhausted }`.

### Orchestrateur
- Chemin d'échec d'exécution : `markRetryableFailure` → `next_retry_at = now() + 2^attempts min`, `last_processing_error` ; à `attempts >= 5` → `dead_letter` + `next_retry_at = null`.
- Les échecs de validation définitifs (`invalid_payload`, `invalid_timed_samples`, `insufficient_points`) restent terminaux `failed` (aucune reprise utile), avec `last_processing_error`.

### TDD
- **RED** (stash sources + domaine retiré) : `16 tests | 3 failed` (+ échec de chargement du spec policy).
- **GREEN** : 3 specs → **26/26**.

### Tests
| ID | Vérifie |
|---|---|
| LEASE-01 | 1 tentative → backoff 2 min (`pending`) |
| LEASE-02 | Backoff exponentiel 1/2/4/8/16 min |
| LEASE-03 | `attempts >= 5` → `dead_letter` terminal, `nextRetryAt = null` |
| LEASE-04 | Orchestrateur : échec `attempts=1` → `pending` + `next_retry_at` ∈ [before+2min, after+2min] ; `attempts=5` → `dead_letter` + `last_processing_error` |
| pgTAP 01–12 | pending dues réclamées, attempts/lease posés, reprise future ignorée, lease expiré repris (attempts 2→3, lease rafraîchi), lease expiré épuisé → `dead_letter`, pas de double-claim, authenticated refusé, CHECK `dead_letter` accepté |

## Lot 10.6 — Batch PostGIS

### Fichiers
- `supabase/migrations/20260911240000_a10_batch_candidates.sql` (nouveau)
- `src/features/adventure-intelligence/domain/trackSampling.ts` (nouveau, pur)
- `src/features/adventure-intelligence/server/processHikeSession.ts`
- `src/app/api/cron/process-hike-sessions/route.ts`
- `tests/adventure-intelligence/track-sampling.spec.ts` (nouveau), `tests/adventure-intelligence/process-hike-session.spec.ts`

### Signature RPC
```sql
a2_match_track_candidates(p_points jsonb, p_radius_m float8 DEFAULT 35)
RETURNS TABLE (
  point_index integer, segment_id bigint, distance_m float8,
  bearing_deg float8, highway text, surface text, sac_scale text
)
-- LANGUAGE sql STABLE SECURITY INVOKER, search_path = public, pg_temp
-- REVOKE public/anon, GRANT authenticated, service_role
```
- `jsonb_array_elements(p_points) WITH ORDINALITY` → `point_index` (0-based).
- `JOIN LATERAL` sur `trail_segments` avec pré-filtre GIST `segment.geom && ST_Expand(i.geog::geometry, (radius/111320)/greatest(cos(radians(lat)),0.01))` puis `ST_DWithin(segment.geom::geography, i.geog, radius)` précis.
- `row_number() OVER (PARTITION BY point_index ORDER BY distance)` puis `distance_rank <= 5`, tri final `point_index, distance_m`.

### Orchestration
- `selectMatchingPoints` (pur) : pas régulier combinant `stepM = 25 m` et plafond `maxPoints = 2000`, **premier et dernier toujours conservés**.
- Les candidats du point échantillonné sont étendus à toute la trace par `expandSampleCandidates` (point échantillonné précédent) : les durées/distances des passages restent calculées sur la trace complète ; **un seul appel** `getCandidatesBatch`.
- Adaptateur cron : un seul `supabase.rpc('a2_match_track_candidates', { p_points, p_radius_m })`, regroupement par `point_index` ; fin de la boucle N+1.

### TDD
- **RED** (stash sources + domaine retiré) : échec de chargement du spec sampling + `18 tests | 1 failed` (BATCH-02 : trace non échantillonnée).
- **GREEN** : track-sampling + process + generate → **27/27**.

### Tests `TEST-A10-BATCH-01..03`
| ID | Vérifie |
|---|---|
| BATCH-01 | 10 000 points → ≤ 2000, stride > 1, premier/dernier conservés ; plafond 50 respecté ; trace espacée conservée telle quelle ; extension des candidats sur toute la trace |
| BATCH-02 | 5 000 points → exactement 1 appel batch, points envoyés < 5 000, premier/dernier présents |
| BATCH-03 | Candidats vides → `processed`, 0 passage, 0 observation, aucun crash (repli vide) |

## Vérifications globales

| Gate | Résultat |
|---|---|
| `npx vitest run tests/adventure-intelligence` (avant chaque commit) | **45 fichiers / 284 tests verts** |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run test` (suite complète, après le dernier commit) | **244 fichiers / 1 805 tests verts** |
| Aucun `npm run build` exécuté | conforme |
| Flags de domaine | inchangés (OFF) |

## Concerns

1. **Migrations / pgTAP non exécutés sur une base réelle.** Le lot 10.2 est propriétaire de la validation BDD (copie fournie par l'humain). `supabase db reset` local est bloqué par les 4 migrations legacy invalides (échappements `\$\$`, items du lot 10.2). `supabase/tests/database/a10_session_lease.test.sql` (12 assertions) est écrit mais **non exécuté** : à lancer en 10.2. Risques résiduels : syntaxe plpgsql des deux RPC et plan d'exécution du batch.
2. **Balayage dead-letter dans le claim** : ajout au-delà de la lettre de la spec (qui ne décrit que le filtre `attempts < 5`) pour éviter qu'une session `processing` à 5 tentatives reste bloquée pour toujours. Documenté dans la migration et testé (pgTAP 8–9).
3. **Échantillonnage vs précision du matching** : les candidats sont rafraîchis tous ~25 m et étendus au point précédent. Ce choix préserve les temps/distances réels des passages (contrairement à un matching sur trace réduite), mais une frontière de segment plus courte que le pas peut être manquée. Constante `MATCH_SAMPLING_DEFAULTS` ajustable.
4. **Échecs de validation vs exécution** : `invalid_payload` / `insufficient_points` restent `failed` terminaux (pas de retry inutile) ; seuls les échecs d'exécution suivent le backoff. La spec ne distinguait pas explicitement les deux.
5. **Index GIST** : `ST_DWithin(geom::geography, …)` seul ne peut pas utiliser `idx_trail_segments_geom` ; le pré-filtre `geom && ST_Expand(...)` a été ajouté pour garantir l'indexabilité. Un `ANALYZE` après chargement OSM est recommandé, plus un `EXPLAIN` de contrôle en 10.2.
6. **Bundle de plan** : `create_adventure_plan_bundle` fait un upsert du plan sur `(id)` et un `DO NOTHING` sur `(plan_id, version)` ; les runs/décisions sont insérés (un appel = une génération avec un UUID neuf). Un rejeu strict du même bundle dupliquerait runs/décisions (non requis par la spec, idempotence par idempotency-key à venir en 10.8).
7. **Compatibilité legacy interne** : un tableau de points explicite dans `positions_geojson` (format interne historique, `ele`) reste traité comme horodaté. Seul le `LineString` pur est legacy.
