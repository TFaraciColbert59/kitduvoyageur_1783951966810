# A11 — Terrain Live et agrégats collectifs : rapport d'implémentation

Branche : `audit/adventure-intelligence` (worktree `ai-finalization`).
Audit source : `docs/architecture/adventure-intelligence-audit-31bdb279.md`, constats
#18, #19, #20, #22, #23, #24. Aucun flag activé, migrations additives/idempotentes.

## Commits

| Commit | Sujet | Périmètre |
| --- | --- | --- |
| `21b466f0` | `feat(a11): fusion terrain atomique et corroboration unique` | #18, #19, #20 |
| `778068ea` | `feat(a11): cache et limite de lecture des conditions` | #22 |
| commit C (ce commit) | `feat(a11): invalidation et pagination des agregats` | #23, #24 + ce rapport |

## A. Fusion atomique + corroboration unique (`21b466f0`)

Fichiers :
- `supabase/migrations/20260911310000_a11_terrain_atomic.sql` (nouveau)
- `src/features/adventure-intelligence/server/terrainReports.ts`
- `src/app/api/terrain/reports/[id]/confirm/route.ts`
- `tests/adventure-intelligence/terrain-atomic.spec.ts` (nouveau, TL-01→05b)
- `tests/adventure-intelligence/terrain-confirm-route.spec.ts` (nouveau, TL-04)
- `tests/adventure-intelligence/terrain-reports.server.spec.ts` (adapté au client `mergeReport`)

Décisions :
- `terrain_report_contributors` : PK `(report_id, user_id)`, RLS `FORCE`, policy
  `service_role` seule, `REVOKE ALL` public/anon/authenticated, `GRANT ALL`
  service_role. C'est le registre de corroboration (audit #19).
- La RPC `a11_merge_terrain_report` remplace le read-modify-write : insertion du
  contributeur `ON CONFLICT DO NOTHING` puis `FOUND` ; incrément de
  `report_count` et escalade sévérité/passabilité **uniquement** pour un nouveau
  contributeur ; `updated_at` toujours touché ; `{ merged, report_count }`.
- Escalade seulement (jamais d'atténuation) : `info < warning < critical`,
  `passable < difficult < impassable`, `unknown` neutre.
- Course de confirmation (#20) : l'adaptateur convertit `error.code === '23505'`
  en `UniqueViolationError` ; `confirmTerrainReport` la traduit en
  `{ status: 'duplicate' }` et la route répond **200** `{ status: 'duplicate' }`.

Signature RPC :
```sql
public.a11_merge_terrain_report(
  p_report_id uuid,
  p_contributor_id uuid,
  p_severity text DEFAULT NULL,
  p_passability text DEFAULT NULL,
  p_now timestamptz DEFAULT now()
) RETURNS jsonb  -- { merged: boolean, report_count: integer }
-- SECURITY DEFINER, SET search_path = public, pg_temp, EXECUTE service_role only
```

## B. Lecture conditions protégée (`778068ea`)

Fichiers :
- `src/features/adventure-intelligence/domain/requestLimiter.ts` (nouveau, pur)
- `src/app/api/terrain/conditions/route.ts`
- `tests/adventure-intelligence/request-limiter.spec.ts` (nouveau, LIM-01→04)
- `tests/adventure-intelligence/terrain-conditions.server.spec.ts` (nouveau, TL-06→07)

Décisions :
- Rayon par défaut de la route : **5 000 m** (`CONDITIONS_DEFAULT_RADIUS_M`),
  borné à 50 km par le schéma ; le défaut serveur `DEFAULT_NEARBY_RADIUS_M`
  reste 2 000 m pour ne pas changer le contrat de `listNearbyTerrainReports`.
- `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- Seau à jetons par IP en `Map` module-level (best-effort) : capacité 30,
  rechargement 0,5 jeton/s (≈ 30 req/min), clé `x-forwarded-for` puis
  `x-real-ip`, à défaut `inconnue`. Dépassement ⇒ 429 + `Retry-After` calculé.
- `consumeToken(bucket, now)` est pur, sans horloge implicite, non mutant :
  recharge linéaire plafonnée, horloge inversée sans recharge.
- Forme de réponse 200 inchangée (`{ reports }`).

## C. Invalidation + pagination des agrégats (commit C)

Fichiers :
- `supabase/migrations/20260911320000_a11_aggregation_pagination.sql` (nouveau)
- `src/features/adventure-intelligence/server/aggregateSegments.ts`
- `src/app/api/cron/aggregate-segments/route.ts`
- `tests/adventure-intelligence/aggregate-invalidation.spec.ts` (nouveau, AGG-01→05)
- `tests/adventure-intelligence/aggregate-segments.server.spec.ts` (fakes étendus)

Décisions :
- `aggregateSegments` purge d'abord (`deleteStaleAggregates`) les lignes
  persistées de plus de `AGGREGATE_MAX_AGE_DAYS = 90` jours, **même sans
  passage éligible** ; puis, pour chaque agrégat recalculé sous le seuil
  (`distinct_user_count < 5`, confiance ou récence), supprime la clé persistée
  `(segment, bucket, direction)` (`deleteAggregates`) avant l'upsert.
- Nouveau compteur `aggregatesInvalidated` (purge + sous-seuil), propagé au
  cron (`invalidated`), sans casser `aggregatesSuppressed`.
- Adaptateur cron : suppression exacte groupée par segment via filtre PostgREST
  `.or(and(condition_bucket.eq.<v>,direction.eq.<v>), …)` — valeurs contraintes
  par la base, jamais d'entrée utilisateur. L'interface client ajoute
  `deleteAggregates` et `deleteStaleAggregates`.
- Migration : `a4_recent_eligible_segments` conserve sa signature exacte
  (`CREATE OR REPLACE`, aucun appelant cassé) ; `row_number()` partitionné
  (500 passages/segment, départage par id) puis `row_number()` global
  (5 000 passages max, ordre récence/segment/id) ; `REVOKE` public/anon/
  authenticated et `GRANT EXECUTE` service_role.

Signature RPC (inchangée) :
```sql
public.a4_recent_eligible_segments(
  p_since interval DEFAULT '90 days',
  p_limit integer DEFAULT 500
) RETURNS TABLE (segment_id bigint, last_exited_at timestamptz, eligible_passage_count bigint)
-- STABLE, SECURITY DEFINER, SET search_path = public, pg_temp, service_role only
```

## Preuves TDD / vérifications

- Commit A : `npx vitest run tests/adventure-intelligence` → **331 tests, 53 fichiers verts** ;
  `npm run type-check` et `npm run lint` → exit 0.
- Commit B : mêmes portes → **337 tests, 55 fichiers verts** ; type-check/lint exit 0.
- Commit C : `npx vitest run tests/adventure-intelligence` → **342 tests, 56 fichiers verts** ;
  `npm run test` complet → **1 863 tests, 255 fichiers verts** ; type-check/lint exit 0.
- Tests ajoutés : `TEST-A11-TL-01..05b`, `TEST-A11-TL-06..07`,
  `TEST-A11-LIM-01..04`, `TEST-A11-AGG-01..05` (+ TL-04 route niveau HTTP).
- Un timeout pré-existant et instable (`tests/trips/chantier-z5.spec.ts`,
  import dynamique) est apparu au premier run complet puis est passé au
  deuxième ; il est sans lien avec A11.

## Réserves / concerns

1. Le limiteur est best-effort **par instance** (mémoire processus) : il amortit
   les rafales, ne remplace ni un quota partagé ni un WAF.
2. Le trigger `adventure_touch_updated_at` réécrit `updated_at = now()` après la
   RPC ; `p_now` n'est donc pas la valeur finale en base (utile aux tests, sans
   effet fonctionnel).
3. Le plafond per-segment de la RPC contraint la **sélection des segments**
   (volume éligible plafonné à 500/segment puis 5 000 au total). La requête
   passages du cron conserve, elle, son `LIMIT 5000` global trié par récence,
   sans plafond par segment : un segment très fréquenté peut donc encore
   monopoliser les passages chargés. Une évolution (RPC passages paginée)
   reste possible sans casser l'interface actuelle.
4. Aucun pgTAP n'a été exécuté localement (job CI opt-in) : les migrations sont
   vérifiées par lecture structurelle dans les tests Vitest A11-TL-05b/AGG-05.
