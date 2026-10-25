# « Préparer » un sentier → activité complète — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le clic « Préparer » d'un sentier crée une vraie activité (socle réel instantané) dans le hub, puis un job LLM gratuit l'enrichit en direct (itinéraire, moments, transports/hébergements/restos affiliés, descriptions, kit), avec animations framer-motion.

**Architecture:** Route serveur `/preparer-sentier/[id]` (auth + idempotence + usine déterministe `createTripFromAutogenIntent` + platinage) → `/hub` activité active → job `ai_jobs` `activity-enrichment` traité par le cron IA existant (OpenRouter `:free`, JSON strict, anti-invention) → realtime hub + animations.

**Tech Stack:** Next.js 15 (App Router, server components), Supabase (service role + RLS), Zod, framer-motion, Vitest (`renderToStaticMarkup` pour composants), Playwright (e2e + visuel).

**Spec:** `docs/superpowers/specs/2026-09-12-preparer-sentier-activite-complete-design.md`

## Global Constraints

- LLM : **`assertFreeModel` conservé** (`src/lib/ai/providers/openrouter.ts`) — aucun modèle payant, jamais.
- Anti-invention : aucun nom d'établissement/prix présenté comme un fait ; `lat/lng` LLM à **≤ 3 km** du tracé réel sinon item rejeté ; provenance `source` ∈ `deterministic | llm_suggestion | user` sur `trip_steps`/`trip_pois`.
- Migrations **additives uniquement** (audit doublons avant index unique) ; aucune donnée mock/showcase créée.
- Animations : GPU-only (`transform`/`opacity`), jamais `backdrop-filter`/tailles ; `useReducedMotion` → instantané ; haptique anti-rafale (1/800 ms) ; `aria-live="polite"`.
- Tokens DS `--lkv-*` + `.glass*` ; `lg` pour la bascule mobile/desktop ; aucun `env(safe-area-*)` hors shell.
- Staging explicite : le WIP propriétaire (`src/app/hub/[section]/page.tsx`, `src/features/hub/components/HubRealtimeRefresh.tsx`, `docs/atlas/captures/*.png`, fichiers v16) n'est **jamais** commité ; jamais `git add -A`.
- Gates par task : `npx tsc --noEmit` 0 ; `npx vitest run` → seuls les 4 échecs préexistants (a13-backtest-export, a14-healthcheck, a15-rollout, phase10-capacity) ; `npm run lint` 0 erreur.
- Un commit par task, message imposé dans la task.

---

## Phase 1 — Connexion & socle réel

### Task 1: Migration additive `trip_steps`/`trip_pois` + index d'idempotence (audité)

**Files:**
- Create: `supabase/migrations/20260912200000_preparer_activity_enrichment.sql`
- Create: `scripts/db/audit-route-id-duplicates.mjs`
- Test: vérification d'application (script + requêtes)

**Interfaces:**
- Produces: colonnes `trip_steps.metadata jsonb NOT NULL DEFAULT '{}'`, `trip_steps.source text`, `trip_pois.metadata jsonb NOT NULL DEFAULT '{}'`, `trip_pois.source text` ; index `uniq_trips_user_route_active` (unique) **ou** `idx_trips_user_route` (non unique) selon audit.

- [ ] **Step 1: Script d'audit doublons (avant toute écriture)**

`scripts/db/audit-route-id-duplicates.mjs` : client service (`SUPABASE_SERVICE_ROLE_KEY` de `.env.local`), requête SQL via `.rpc` impossible → utiliser `supabase.from('trips').select('user_id, metadata').not('metadata->>route_id','is',null)` puis compter en JS les paires `(user_id, route_id)` en doublon ; sortie JSON `{ duplicates: [...], count }`. Run: `node scripts/db/audit-route-id-duplicates.mjs`.

- [ ] **Step 2: Migration (addition de colonnes inconditionnelle + index conditionnel documenté)**

```sql
-- 20260912200000_preparer_activity_enrichment.sql
ALTER TABLE public.trip_steps ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trip_steps ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.trip_pois  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trip_pois  ADD COLUMN IF NOT EXISTS source text;
-- Index d'idempotence : n'exécuter la variante UNIQUE que si l'audit (Step 1) renvoie count = 0.
-- Variante retenue écrite dans ce fichier après l'audit (unique si 0 doublon, sinon non unique).
CREATE INDEX IF NOT EXISTS idx_trips_user_route ON public.trips (user_id, (metadata->>'route_id')) WHERE metadata ? 'route_id';
```

- [ ] **Step 3: Appliquer en prod**

Run: `npx supabase db push --linked` (additif). Vérifier : `npx supabase migration list --linked | Select-Object -Last 5` (nouvelle ligne appliquée des deux côtés).

- [ ] **Step 4: Vérifier les colonnes en prod**

Petit script `node -e` (service client) : `select('id, metadata, source').from('trip_steps').limit(1)` → pas d'erreur 42703 ; idem `trip_pois`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912200000_preparer_activity_enrichment.sql scripts/db/audit-route-id-duplicates.mjs
git commit -m "feat(db): migration additive provenance steps/pois + index route_id (audite)"
```

### Task 2: Domaine pur `trailToActivity` (dérivation brief + difficulté + corridor)

**Files:**
- Create: `src/features/trips/domain/trailToActivity.ts`
- Create: `tests/trips/trail-to-activity.spec.ts`
- Consumes: `hiking_routes` (id, name, ref, network, distance_km), `trail_metadata` (difficulty, duration_hours, elevation_gain, terrain_type, season), géométrie GeoJSON `{type:'MultiLineString',coordinates:[...]}`.
- Produces:
  ```ts
  export interface TrailInput { id: number; name: string; ref?: string|null; network?: string|null; distanceKm?: number|null; geom: { type: string; coordinates: unknown }; }
  export interface TrailMetaInput { difficulty?: string|null; durationHours?: number|null; elevationGain?: number|null; terrainType?: string|null; }
  export function mapTrailDifficulty(difficulty: string|null|undefined): 'easy'|'moderate'|'hard'|'expert';
  export function samplePolyline(geom: unknown, maxPoints?: number): { lat: number; lng: number }[];
  export function buildTrailRawInput(trail: TrailInput, meta: TrailMetaInput|null): string;
  export function distanceToCorridorKm(point: {lat:number;lng:number}, polyline: {lat:number;lng:number}[]): number;
  export function isWithinCorridor(point: {lat:number;lng:number}, polyline: {lat:number;lng:number}[], maxKm?: number): boolean;
  ```

- [ ] **Step 1: Tests rouges** — `mapTrailDifficulty` : `'easy'|'facile'→easy`, `'moderate'|'moyen'→moderate`, `'hard'|'difficile'→hard`, `'expert'→expert`, `null→moderate` ; `samplePolyline` : MultiLineString 2 lignes → ≤ maxPoints, points valides, décimation régulière ; `distanceToCorridorKm` : point sur segment ≈ 0, point à ~3,2 km d'un segment droit (calcul haversine vérifié à la main) > 3 ; `buildTrailRawInput` : contient nom, ref, distance, durée, difficulté, « randonnée » — et **jamais** de valeur inventée si `meta=null` (pas de durée).
- [ ] **Step 2: Run FAIL** — `npx vitest run tests/trips/trail-to-activity.spec.ts`
- [ ] **Step 3: Implémenter** (pur TS, haversine déjà dans `src/components/map/engine/camera.ts` — réutiliser `haversineKm`).
- [ ] **Step 4: Run PASS** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(trips): domaine trail->activite (brief, difficulte, corridor 3km)`

### Task 3: Domaine pur `deterministicActivityContent` (dressage instantané)

**Files:**
- Create: `src/features/trips/domain/deterministicActivityContent.ts`
- Create: `tests/trips/deterministic-activity-content.spec.ts`
- Consumes: `TrailInput`, `TrailMetaInput`, POI réels `{ id, name, category, lat, lng }[]` (trail_pois ≤ 750 m, via service), `buildBudgetLines` (`src/features/trips/engine/autogenPreparation.ts`).
- Produces:
  ```ts
  export interface StepDraft { dayNumber: number; orderIndex: number; title: string; description: string; startTime: string|null; latitude: number|null; longitude: number|null; distanceKm: number|null; elevationGainM: number|null; accommodationName: string|null; transportMode: string|null; metadata: Record<string, unknown>; source: 'deterministic'; }
  export interface PoiDraft { name: string; latitude: number; longitude: number; metadata: Record<string, unknown>; source: 'deterministic'; }
  export interface ExpenseDraft { title: string; amountEur: number|null; category: string; metadata: Record<string, unknown>; }
  export function splitDays(totalKm: number|null, durationHours: number|null): number; // Naismith simplifié : km/20 + D+/600, min 1, max 14
  export function buildDeterministicSteps(trail: TrailInput, meta: TrailMetaInput|null, polyline: {lat:number;lng:number}[]): StepDraft[];
  export function buildDeterministicPois(pois: {id:number;name:string;category:string|null;lat:number;lng:number}[]): PoiDraft[];
  export function buildDeterministicExpenses(trail: TrailInput, meta: TrailMetaInput|null, partySize?: number): ExpenseDraft[];
  ```

- [ ] **Step 1: Tests rouges** — `splitDays` : 12 km/4 h → 1 ; 45 km/16 h → 3 ; null/null → 1 ; cap 14 ; `buildDeterministicSteps` : J1 = nom du sentier, `startTime='08:30'`, start = premier point, `source='deterministic'` ; multi-jours répartis (somme `distanceKm` ≈ total ±0,2) ; `buildDeterministicPois` : dédup par nom, cap 20, `source='deterministic'` ; `buildDeterministicExpenses` : catégories hébergement/nourriture présentes seulement si durée > 0, montants `null` autorisés (jamais inventés — la ligne reste « à estimer »).
- [ ] **Step 2: Run FAIL** — `npx vitest run tests/trips/deterministic-activity-content.spec.ts`
- [ ] **Step 3: Implémenter** (pur ; formats `startTime` `'HH:MM'` alignés sur `trip_steps.start_time TIME`).
- [ ] **Step 4: Run PASS** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(trips): dressage deterministe instantane (etapes, poi, depenses)`

### Task 4: Server `prepareActivityFromTrail` + route `/preparer-sentier/[id]` + enfilage IA

**Files:**
- Create: `src/features/trips/server/prepareActivityFromTrail.ts`
- Create: `src/features/trips/server/activityEnrichment/enqueue.ts`
- Create: `src/app/preparer-sentier/[id]/page.tsx`
- Create: `tests/trips/prepare-activity-from-trail.spec.ts`
- Modify: `tests/...` (aucun test existant ne référence ces chemins)
- Consumes: Task 1 colonnes ; Tasks 2-3 ; `runAutoGenPipeline` (`src/features/trips/engine/autoGenPipeline.ts:19`), `createTripFromAutogenIntent` (`src/features/trips/server/createTripFromAutogenIntent.ts:427`), `createTrip` (`src/lib/queries-trips.ts:419`), `getServiceSupabase` (`src/lib/ai/serviceClient.ts`), `createClient` (`src/lib/supabase/server`), cookie `lkv_active_adventure` (`src/features/hub/context/adventureSchema.ts`), `revalidatePath`.
- Produces:
  ```ts
  export type PrepareTrailOutcome =
    | { status: 'unavailable'; reason: 'not_found' | 'no_name' | 'no_geometry' }
    | { status: 'reused'; tripId: string; slug: string; title: string }
    | { status: 'created'; tripId: string; slug: string; title: string }
    | { status: 'fallback_created'; tripId: string; slug: string; title: string };
  export async function prepareActivityFromTrail(trailIdRaw: string): Promise<PrepareTrailOutcome>;
  export async function enqueueActivityEnrichment(tripId: string, userId: string): Promise<void>; // insert ai_jobs (service), best-effort
  ```
  Route `page.tsx` (server, `export const dynamic='force-dynamic'`) : outcome `unavailable` → rendu page honnête ; sinon → cookie aventure active (`id` = uuid réel + slug + titre) → `redirect('/hub')` ; non connecté → `redirect('/connexion?redirect=' + encodeURIComponent('/preparer-sentier/'+id))`.

- [ ] **Step 1: Tests rouges (mocks supabase)** — `tests/trips/prepare-activity-from-trail.spec.ts` : (a) sentier absent → `unavailable/not_found` ; (b) `metadata.route_id` existant pour l'utilisateur → `reused` (aucun insert) ; (c) sentier valide sans activité → `created` et l'enfilage `ai_jobs` est appelé avec `feature='activity-enrichment'` ; (d) usine autogen en échec → `fallback_created` (insert `trips` minimal, titre = nom du sentier) ; (e) pas de geometry → `no_geometry`.
- [ ] **Step 2: Run FAIL** — `npx vitest run tests/trips/prepare-activity-from-trail.spec.ts`
- [ ] **Step 3: Implémenter** :
  - data: `hiking_routes` (service) + `trail_metadata` + RPC `get_route_geojson` (existe en prod) ; `trail_pois` ≤ 750 m (bbox ±0,01° puis filtre haversine) ;
  - idempotence : `trips` select `.eq('user_id').filter('metadata->>route_id','eq',String(trailId))` (si index unique : retry sur conflit → re-select) ;
  - pipeline : `runAutoGenPipeline({ rawInput: buildTrailRawInput(...) })` → `createTripFromAutogenIntent({ ...pipeline, coordinates: polyline, title: trail.name, correlationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), autoSelectRoute: true })` ; échec → `createTrip` minimal `{ title: trail.name, destination_name: trail.name, difficulty: mapTrailDifficulty(meta?.difficulty), primary_activity: 'hiking', status: 'draft', visibility: 'private', metadata: { route_id: trail.id, source: 'prepare-trail' } }` via service ;
  - dressage : inserts `trip_steps`/`trip_pois`/`trip_expenses` (Task 3), best-effort loggé ;
  - enfilage : `ai_jobs` insert service `{ user_id, feature: 'activity-enrichment', payload: { tripId } }` (best-effort, jamais bloquant) ; écrire aussi `trips.metadata.enrichment_status='pending'` ;
  - route : gestion `unavailable` (page « Pas encore de données réelles pour ce sentier » + lien retour explorer), cookie (`serializeActiveAdventure({ nature:'sortie', id: tripId, slug, title })`), `revalidatePath('/hub','layout')`, `redirect('/hub')`.
- [ ] **Step 4: Run PASS** + `npx tsc --noEmit` + e2e anonyme provisoire manuelle : `npx playwright test --config=playwright.config.ts scripts/e2e/atlas-explorer.spec.ts` (non régression).
- [ ] **Step 5: Commit** — `feat(trips): prepareActivityFromTrail + route /preparer-sentier/[id] (auth, idempotence, socle, job IA)`

### Task 5: CTAs « Préparer » → liens + redirect hérité

**Files:**
- Modify: `src/components/explorer/ExplorerMobileHikeCarousel.tsx` (bouton l.234-244 → `<Link href={'/preparer-sentier/'+trail.id}>` avec `onClick` haptique conservé)
- Modify: `src/components/explorer/TrailDetailPanel.tsx:332-340` (idem)
- Modify: `src/components/explorer/ExplorerClient.tsx:808-814` (carte compacte)
- Modify: `src/components/map/InteractiveMap.tsx:1014-1019` (`href`)
- Modify: `src/app/preparer-randonnee/page.tsx` (`routeId` → `redirect('/preparer-sentier/'+routeId)` ; sans → `/hub`)
- Modify: `scripts/e2e/depart-cockpit.spec.ts` (le test « Préparer » actuel attend `/hub/depart` → remplacer par l'attente `/connexion?redirect=%2Fpreparer-sentier%2F` (anonyme))
- Test: `scripts/e2e/preparer-sentier.spec.ts` (créer)
- Produces: tous les CTAs pointent la route serveur ; e2e anonyme prouve la redirection connexion avec reprise.

- [ ] **Step 1: e2e rouge** — `scripts/e2e/preparer-sentier.spec.ts` : (a) `/explorer` mobile → tap « Préparer » (carrousel) → URL `/connexion?redirect=%2Fpreparer-sentier%2F<id>` ; (b) `/preparer-sentier/999999999` → page honnête « Données réelles indisponibles » + zéro pageerror.
- [ ] **Step 2: Run FAIL** — `npx playwright test --config=playwright.config.ts scripts/e2e/preparer-sentier.spec.ts` (config démarre `npm run start` sur 4028 ; builder si `.next` est un build dev).
- [ ] **Step 3: Implémenter** les remplacements + adapter le test depart-cockpit.
- [ ] **Step 4: Run PASS** e2e preparer + depart + atlas 3 specs.
- [ ] **Step 5: Commit** — `feat(explorer): CTA Preparer -> route serveur /preparer-sentier (liens partout)`

## Phase 2 — Enrichissement LLM gratuit live

### Task 6: Contrat d'enrichissement (schéma Zod + prompt + vivier de candidats)

**Files:**
- Create: `src/lib/ai/features/activityEnrichment.ts` (miroir de `src/lib/ai/features/trailNarrative.ts` : `activityEnrichmentJobSchema`, `activityEnrichmentOutputSchema`, `buildActivityEnrichmentPrompt`, `ACTIVITY_ENRICHMENT_SPEC`)
- Create: `tests/ai/activity-enrichment-schema.spec.ts`
- Consumes: `TrailInput`, `samplePolyline`, `isWithinCorridor` (Task 2).
- Produces:
  ```ts
  export const activityEnrichmentJobSchema: ZodType<{ tripId: string }>;
  export const activityEnrichmentOutputSchema: ZodType<{
    days: { day: number; title: string; steps: { title: string; description: string; startTime: string|null; lat: number; lng: number; distanceKm: number|null; transportMode: string|null; accommodation: string|null }[]; moments: { matin: string[]; apresMidi: string[]; soir: string[] } }[];
    suggestions: { category: 'flight'|'hotel'|'activity'|'insurance'|'esim'; label: string; searchTerms: string }[];
    kitAdditions: { name: string; reason: string; category: string }[];
    checklistAdditions: { label: string; dueOffsetDays: number }[];
  }>;
  export function sanitizeEnrichmentOutput(raw: unknown, polyline: {lat:number;lng:number}[]): ReturnType<typeof activityEnrichmentOutputSchema.parse>; // rejette tout step hors corridor 3 km, borne les tableaux (days ≤ 14, steps/jour ≤ 8, additions ≤ 12)
  ```

- [ ] **Step 1: Tests rouges** — schéma : JSON valide accepté ; `days` > 14 rejeté ; step à 4 km du polyline **supprimé** par `sanitizeEnrichmentOutput` (pas d'échec global) ; `startTime` hors format `HH:MM` → `null` ; `suggestions` catégorie inconnue → rejetée.
- [ ] **Step 2: Run FAIL** — `npx vitest run tests/ai/activity-enrichment-schema.spec.ts`
- [ ] **Step 3: Implémenter** (prompt français, candidates réels injectés : tracé échantillonné + POI base + couches blueprint transport/hébergement/food + consignes « aucune donnée inventée ; suggestions = intentions de recherche »).
- [ ] **Step 4: Run PASS** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(ai): contrat enrichissement activite (schema strict, prompt, sanitizer corridor)`

### Task 7: Service d'enrichissement + branchement cron

**Files:**
- Create: `src/features/trips/server/activityEnrichment/service.ts`
- Modify: `src/app/api/cron/process-ai-jobs/route.ts` (dispatch : `if (feature === 'activity-enrichment')` → service, en miroir de `trail-narrative`)
- Modify: `src/app/api/ai/jobs/route.ts` (schéma : `z.union([trailNarrativeJobSchema, activityEnrichmentJobSchema])`)
- Create: `tests/trips/activity-enrichment-service.spec.ts`
- Consumes: Task 6 ; `askAI` (`src/lib/ai/askAI.ts`), `consumeQuota` (`src/lib/ai/quota.ts`), `getServiceSupabase`.
- Produces: `export async function processActivityEnrichmentJob(job: { id: string; user_id: string; payload: unknown }): Promise<{ outcome: 'done'|'failed'|'deferred'; detail?: string }>`.

- [ ] **Step 1: Tests rouges (provider mocké)** — (a) sortie valide → insert `trip_steps` (avec `start_time`, `metadata.source='llm_suggestion'`, `metadata.model`) + `trip_pois` + `trip_expenses` prévisionnelles + `trip_checklist_items` + mise à jour `trips.metadata.enrichment_version='v1'` ; (b) item hors corridor → non écrit ; (c) quota épuisé → `deferred` sans écriture ; (d) JSON invalide → `failed` + `enrichment_status='failed'`, **aucune** écriture partielle (transaction logique : tout valider avant d'écrire).
- [ ] **Step 2: Run FAIL** — `npx vitest run tests/trips/activity-enrichment-service.spec.ts`
- [ ] **Step 3: Implémenter** le service (best-effort par table mais validation globale d'abord ; idempotence : si `trips.metadata.enrichment_version` → skip) + dispatcher cron + schéma route jobs.
- [ ] **Step 4: Run PASS** + `npx vitest run tests/ai` + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(ai): job enrichissement activite (service, cron, idempotence, provenance)`

## Phase 3 — Affiliation au hub

### Task 8: Liens de réservation par étape + affiliation dans le hub

**Files:**
- Create: `src/features/affiliation/engine/stepBookingLink.ts`
- Create: `tests/affiliation/step-booking-link.spec.ts`
- Modify: `src/features/hub/server/getHubAdventureData.ts` (remonter `affiliateLinks` pertinents + `bookingByStepId`)
- Modify: rendu hub overview desktop (`src/features/hub/components/menu/SortieMenu.tsx`) et mobile (`src/features/hub/components/mobile/moments/SortieMoment.tsx` ou `MobileAdventureHub`) : `<TripAffiliateSection links={…} tripId={…} />` + liens par étape dans la timeline (`ItineraryDayTimeline`, `TripItineraryTab`)
- Consumes: `affiliateEngine.buildAffiliateUrl` + allowlist (`src/features/affiliation/engine/affiliateEngine.ts:46-92`), `AffiliateLinkCard`/`TripAffiliateSection`, `getAffiliateLinks`.
- Produces:
  ```ts
  export function buildStepBookingLink(step: { accommodationName?: string|null; transportMode?: string|null; latitude?: number|null; longitude?: number|null; dayNumber: number }, context: { destinationName: string; startDate?: string|null; endDate?: string|null }): { category: 'hotel'|'flight'; label: string; searchTerms: string } | null;
  ```

- [ ] **Step 1: Tests rouges** — hébergement → `hotel` (searchTerms = nom d'hébergement + destination) ; `transportMode in ('plane','train')` → `flight` (recherche destination) ; sinon `null` ; jamais d'URL brute (l'URL est construite par l'engine au rendu).
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** (réutiliser le filtrage existant `getAffiliateLinks` par catégorie ; `rel="sponsored nofollow"` conservé par `AffiliateLinkCard`).
- [ ] **Step 4: Run PASS** + tests affiliation existants verts (`npx vitest run tests/affiliation`).
- [ ] **Step 5: Commit** — `feat(affiliation): liens reservation par etape + section au hub (hors token)`

## Phase 4 — Animations live (chantier 5)

### Task 9: Socle animations (bus realtime, reveal, compteur, squelettes)

**Files:**
- Create: `src/features/hub/components/live/useActivityLiveArrivals.ts`
- Create: `src/features/hub/components/live/ArrivalReveal.tsx`
- Create: `src/features/hub/components/live/AnimatedNumber.tsx`
- Create: `src/features/hub/components/live/ActivitySectionSkeleton.tsx`
- Create: `tests/hub/activity-live-arrivals.spec.ts` (+ tests markup des composants)
- Consumes: `supabase` realtime déjà utilisé par `HubRealtimeRefresh.tsx:22-36` (mêmes tables ; ne pas créer un 2e canal global : le hook s'abonne au même canal via un event bus `window`: `CustomEvent('lkdv:activity-arrival', { detail: { table, id } })` émis par `HubRealtimeRefresh` étendu — modification **du fichier WIP propriétaire interdite** : émettre depuis un nouveau composant `ActivityLiveBridge.tsx` qui réutilise `supabase.channel` nommé `hub-live-bridge` (canal dédié, pas de doublon de refresh)).
- Produces: `useActivityLiveArrivals(): { arrivals: { table: string; id: string }[]; phase: ActivityPreparationPhase }` ; `ArrivalReveal({ children, index })` ; `AnimatedNumber({ value, decimals? })` ; `ActivitySectionSkeleton({ variant: 'timeline'|'moments'|'affiliate'|'kit' })`.

- [ ] **Step 1: Tests rouges** — dérivation de phase depuis compteurs d'arrivées (`steps>0 → 'itinerary'`, `moments → 'moments'`, … jusqu'à `'done'`) ; ids déjà vus non ré-émis ; markup `ArrivalReveal` porte `data-arrival` et n'anime qu'une fois (prop `initial=false` après premier cycle) ; `AnimatedNumber` rend des chiffres tabulaires.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** (respect strict des durées/easings de la spec §4.5 ; `useReducedMotion` → aucune transition).
- [ ] **Step 4: Run PASS** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(hub): socle animations live (bus realtime, reveal, compteur, squelettes)`

### Task 10: Rail de préparation + intégrations animées + aperçu visuel dev

**Files:**
- Create: `src/features/hub/components/live/ActivityPreparationStatus.tsx`
- Modify: `src/features/hub/components/menu/SortieMenu.tsx` (rail en tête desktop), `src/features/hub/components/mobile/MobileAdventureHub.tsx` (rail mobile), `src/features/hub/components/mobile/itinerary/ItineraryDayTimeline.tsx` (ArrivalReveal sur étapes + moments), `src/features/trips/components/TripItineraryTab.tsx` (idem desktop), checklist/kit (reveal des items ajoutés), couche POI carte (fondu par lots)
- Create: `src/app/preparer-sentier/apercu/page.tsx` (**dev-only** : `if (process.env.NODE_ENV === 'production') notFound()` — fixtures locales pour capture visuelle du rail/squelettes, jamais servie en prod)
- Create: `tests/visual/preparer-live.spec.ts` (captures `docs/preparer/apercu-<project>.png` via la page d'aperçu dev + `/hub` non régressé)
- Consumes: Task 9.

- [ ] **Step 1: Tests rouges** — markup rail (phases, `aria-live="polite"`, coche présente quand phase terminée) ; `data-phase` exposé ; aperçu dev interdit en prod (`notFound`) — test unitaire sur la garde.
- [ ] **Step 2: Run FAIL** → **Step 3: Implémenter** + intégrations (stagger ≤ 0.3 s, 1 haptique/vague, IntersectionObserver gate).
- [ ] **Step 4: Run PASS** + captures visuelles : `npx playwright test --config=playwright.visual.config.ts tests/visual/preparer-live.spec.ts` (3/3) + vérifier `/hub` non régressé (suite atlas/depart vertes).
- [ ] **Step 5: Commit** — `feat(hub): rail de preparation live + reveals itineraire/moments + apercu dev`

## Phase 5 — Gates, clôture & reliquats explorer

### Task 11: Gates complets + rapport + merge

- [ ] **Step 1:** `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` (4 échecs préexistants seulement) · `npm run build` 0.
- [ ] **Step 2:** e2e : `preparer-sentier` + `depart-cockpit` + `atlas-explorer` (prod auto-géré) ; visuel complet (seuls échecs préexistants documentés).
- [ ] **Step 3:** Entrée `MISSION_LOG.md` (causes, tasks, sorties brutes, rollback, actions propriétaire : secret webhook + redéploiement Drive).
- [ ] **Step 4:** `git checkout main; git pull --ff-only; git merge --no-ff chantier/preparer-activite; git push origin main`.

### Task 12 (reliquat volet 2): E2+E3 géolocalisation native + repli globe

**Files:** branche `chantier/explorer-mobile-native` (T14 déjà commité `4a318b56`) — Modify `src/components/explorer/ExplorerClient.tsx` (wrapper `src/lib/native/geolocation.ts`), `ios/App/App/Info.plist` (+`NSLocationWhenInUseUsageDescription`), `android/app/src/main/AndroidManifest.xml` (+`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`), `src/components/map/UnifiedExplorerMap.tsx` (`handleToggleGlobe` sans position → rester sur le globe + message non bloquant, dernière position `localStorage` si dispo), `docs/explorer-mobile/protocole-native.md`.

- [ ] **Step 1:** Preuve du cul-de-sac actuel (capture + logs : sans GPS → bbox Chamonix, 0 sentier).
- [ ] **Step 2:** Correctif minimal (wrapper natif + permissions + repli globe) ; `npx tsc --noEmit` 0 ; e2e atlas vert.
- [ ] **Step 3:** Protocole manuel téléphone documenté (build `CAPACITOR_SERVER_URL` requis) + commit `fix(explorer): geoloc native + repli globe sans GPS`.

### Task 13 (reliquat volet 2): E4+E5 SW natif + config serveur + merge

**Files:** Modify `src/app/layout.tsx` (garde `isNative()` autour de l'enregistrement `/sw.js`), `docs/mobile/ANDROID_RELEASE.md` + `capacitor.config.ts` (exiger `CAPACITOR_SERVER_URL`).

- [ ] **Step 1:** Preuve (lecture `layout.tsx:221-239` + `isNative()`).
- [ ] **Step 2:** Correctif + doc ; gates ; commit `fix(native): pas de SW dans l'app Capacitor + config server.url exigee`.
- [ ] **Step 3:** `git checkout main; git merge --no-ff chantier/explorer-mobile-native; git push origin main`.

---

## Self-Review (fait à la rédaction)

- **Couverture spec** : §4.1→T4/T5 ; §4.2→T3/T4 ; §4.3→T6/T7 ; §4.4→T8 ; §4.5→T9/T10 ; §5 migrations→T1 ; §6 erreurs→T4/T7 ; §7 tests→chaque task + T11 ; §10 reliquats→T12/T13. Aucun gap.
- **Placeholders** : aucun ; chaque task liste fichiers exacts, interfaces, tests et commits.
- **Cohérence des types** : `PrepareTrailOutcome`, `StepDraft`, `activityEnrichmentOutputSchema`, `buildStepBookingLink`, `useActivityLiveArrivals` définis une fois et consommés tels quels.
- **Note d'exécution** : T12/T13 se déroulent sur la branche existante `chantier/explorer-mobile-native` (T14 `4a318b56` déjà commité), puis merge séparé.
