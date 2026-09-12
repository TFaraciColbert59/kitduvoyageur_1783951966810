import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { askAI } from '@/lib/ai/askAI';
import { consumeQuota } from '@/lib/ai/quota';
import {
  ACTIVITY_ENRICHMENT_SPEC,
  ActivityEnrichmentNoTraceError,
  activityEnrichmentJobSchema,
  buildActivityEnrichmentPrompt,
  sanitizeEnrichmentOutput,
  type ActivityEnrichmentOutput,
  type ActivityEnrichmentPoi,
} from '@/lib/ai/features/activityEnrichment';
import {
  isWithinCorridor,
  samplePolyline,
  type TrailInput,
  type TrailMetaInput,
  type TrailPoint,
} from '@/features/trips/domain/trailToActivity';

/**
 * Service d'enrichissement d'activité (Task 7) — traité par le cron
 * `/api/cron/process-ai-jobs` en miroir de `trail-narrative`.
 *
 * Flux : payload → activité (propriétaire vérifié) → idempotence
 * (`trips.metadata.enrichment_version`) → contexte réel (sentier + tracé
 * échantillonné + POI ≤ 750 m + couches blueprint) → quota → `askAI` →
 * sanitizer corridor → purge du contenu LLM précédent → écritures.
 *
 * Règles dures :
 * - validation globale AVANT toute écriture (`sanitizeEnrichmentOutput`) :
 *   erreur JSON/Zod → `failed`, zéro écriture de contenu ;
 * - erreurs provider/transport → `retry` (le cron re-pending avec tentative+1,
 *   miroir exact de `trail-narrative`) — `failed` définitif réservé au tracé
 *   absent, à la sortie hors schéma et à l'activité introuvable ;
 * - le LLM n'écrit JAMAIS `trip_expenses` (aucun montant réel → anti-invention) ;
 * - provenance `source='llm_suggestion'` sur `trip_steps`/`trip_pois` et sur
 *   les ajouts kit (`trip_items.source`, colonne texte additive) ;
 * - rejeu sans doublon : purge du contenu `llm_suggestion` précédent (steps,
 *   POI, items) + ids checklist suivis dans `metadata.enrichment_checklist_ids` ;
 * - quota épuisé → `deferred` SANS brûler de tentative ni écrire ;
 * - tracé absent → `ActivityEnrichmentNoTraceError` → `failed` tracé.
 */

const FEATURE = 'activity-enrichment';
const ENRICHMENT_VERSION = 'v1';
const CHECKLIST_IDS_KEY = 'enrichment_checklist_ids';
/** Corridor réel des POI fournis au prompt (km) — miroir `prepareActivityFromTrail`. */
const POI_CORRIDOR_KM = 0.75;
const POI_BBOX_DEG = 0.01;
const POI_LIMIT = 200;
/** Budget de sortie : un roadbook JSON ≤ 14 jours tient largement sous ce plafond. */
const MAX_ENRICHMENT_TOKENS = 4_096;
const MAX_ERROR_LENGTH = 500;
/** Valeurs admises par l'enum SQL `trip_step_transport` (jamais inventées). */
const TRANSPORT_MODES = new Set(['foot', 'car', 'bus', 'train', 'plane', 'boat', 'bike', 'other']);

/** Matérialisation des moments LLM : titre préfixé + heure de passage réelle. */
const MOMENT_GROUPS = [
  { key: 'matin', prefix: 'Matin', startTime: '08:30' },
  { key: 'apresMidi', prefix: 'Après-midi', startTime: '14:00' },
  { key: 'soir', prefix: 'Soir', startTime: '19:30' },
] as const;

export interface ActivityEnrichmentJobResult {
  outcome: 'done' | 'failed' | 'deferred' | 'retry';
  detail?: string;
}

interface TripRow {
  id: string;
  user_id: string;
  metadata: Record<string, unknown>;
}

interface EnrichmentContext {
  trail: TrailInput;
  meta: TrailMetaInput | null;
  polyline: TrailPoint[];
  pois: ActivityEnrichmentPoi[];
  layers: Record<string, { value?: unknown }> | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `metadata.route_id` canonique : entier fini > 0, sinon `null`. */
function normalizeRouteId(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const parsed = Number(String(raw).trim());
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseGeometry(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw ?? null;
}

function toTrailGeom(value: unknown): TrailInput['geom'] {
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { type?: unknown; coordinates?: unknown };
    return {
      type: typeof candidate.type === 'string' ? candidate.type : 'Unknown',
      coordinates: candidate.coordinates ?? null,
    };
  }
  return { type: 'Unknown', coordinates: null };
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message.length > MAX_ERROR_LENGTH
      ? `${error.message.slice(0, MAX_ERROR_LENGTH - 1)}…`
      : error.message;
  }
  return 'erreur inattendue';
}

/** Ids checklist déjà écrits par le LLM (`metadata.enrichment_checklist_ids`). */
function extractChecklistIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
}

type LoadTripResult = { status: 'ok'; trip: TripRow } | { status: 'failed'; detail: string };

/** Charge l'activité et vérifie qu'elle appartient bien au demandeur du job. */
async function loadOwnedTrip(
  db: SupabaseClient,
  tripId: string,
  userId: string
): Promise<LoadTripResult> {
  const { data, error } = await db
    .from('trips')
    .select('id, user_id, metadata')
    .eq('id', tripId)
    .maybeSingle();

  if (error) return { status: 'failed', detail: `lecture activité: ${error.message}` };
  if (!data) return { status: 'failed', detail: 'activité introuvable' };

  const row = data as Record<string, unknown>;
  if (String(row.user_id) !== userId) {
    return { status: 'failed', detail: 'activité hors périmètre du job' };
  }

  return {
    status: 'ok',
    trip: {
      id: String(row.id),
      user_id: String(row.user_id),
      metadata: toRecord(row.metadata),
    },
  };
}

/** POI réels ≤ 750 m du tracé (bbox ±0,01° puis filtre corridor) — jamais inventés. */
async function loadTrailPois(
  db: SupabaseClient,
  polyline: TrailPoint[]
): Promise<ActivityEnrichmentPoi[]> {
  const lats = polyline.map((point) => point.lat);
  const lngs = polyline.map((point) => point.lng);

  try {
    const { data, error } = await db.rpc('get_trail_pois_bbox', {
      min_lng: Math.min(...lngs) - POI_BBOX_DEG,
      min_lat: Math.min(...lats) - POI_BBOX_DEG,
      max_lng: Math.max(...lngs) + POI_BBOX_DEG,
      max_lat: Math.max(...lats) + POI_BBOX_DEG,
      p_limit: POI_LIMIT,
    });
    if (error) {
      console.error('[LKDV activity-enrichment] POI bbox en échec:', error.message);
      return [];
    }

    const pois: ActivityEnrichmentPoi[] = [];
    for (const raw of (data ?? []) as Record<string, unknown>[]) {
      const name = toStringOrNull(raw.name);
      const lat = toFiniteNumber(raw.lat);
      const lng = toFiniteNumber(raw.lng);
      if (name === null || lat === null || lng === null) continue;
      if (!isWithinCorridor({ lat, lng }, polyline, POI_CORRIDOR_KM)) continue;
      pois.push({ name, category: toStringOrNull(raw.category), lat, lng });
    }
    return pois;
  } catch (error) {
    console.error('[LKDV activity-enrichment] POI bbox en erreur inattendue:', error);
    return [];
  }
}

/** Couches blueprint réelles persistées par l'usine AutoGen (`metadata.autogen.layers`). */
function extractLayers(autogen: unknown): Record<string, { value?: unknown }> | null {
  const layers = toRecord(autogen).layers;
  if (typeof layers !== 'object' || layers === null || Array.isArray(layers)) return null;
  return layers as Record<string, { value?: unknown }>;
}

/**
 * Contexte du prompt : uniquement des données réelles (sentier, métadonnées,
 * tracé, POI du vivier, couches). Tracé absent/invalide → erreur typée.
 */
async function loadEnrichmentContext(
  db: SupabaseClient,
  metadata: Record<string, unknown>
): Promise<EnrichmentContext> {
  const routeId = normalizeRouteId(metadata.route_id);
  if (routeId === null) throw new ActivityEnrichmentNoTraceError();

  const { data: routeRow, error: routeError } = await db
    .from('hiking_routes')
    .select('id, name, ref, network, distance_km')
    .eq('id', routeId)
    .maybeSingle();
  if (routeError) throw new Error(`lecture sentier: ${routeError.message}`);
  if (!routeRow) throw new ActivityEnrichmentNoTraceError();

  const row = routeRow as Record<string, unknown>;
  const name = toStringOrNull(row.name);
  if (name === null) throw new ActivityEnrichmentNoTraceError();

  const [metaResult, geojsonResult] = await Promise.all([
    db
      .from('trail_metadata')
      .select('difficulty, duration_hours, elevation_gain, terrain_type')
      .eq('trail_id', routeId)
      .maybeSingle(),
    db.rpc('get_route_geojson', { p_route_id: routeId }),
  ]);
  if (metaResult.error) throw new Error(`lecture métadonnées sentier: ${metaResult.error.message}`);
  if (geojsonResult.error) throw new Error(`lecture tracé: ${geojsonResult.error.message}`);

  const geometry = parseGeometry(geojsonResult.data);
  const polyline = samplePolyline(geometry);
  if (polyline.length === 0) throw new ActivityEnrichmentNoTraceError();

  const metaRow = (metaResult.data ?? null) as Record<string, unknown> | null;
  const meta: TrailMetaInput | null = metaRow
    ? {
        difficulty: toStringOrNull(metaRow.difficulty),
        durationHours: toFiniteNumber(metaRow.duration_hours),
        elevationGain: toFiniteNumber(metaRow.elevation_gain),
        terrainType: toStringOrNull(metaRow.terrain_type),
      }
    : null;

  return {
    trail: {
      id: routeId,
      name,
      ref: toStringOrNull(row.ref),
      network: toStringOrNull(row.network),
      distanceKm: toFiniteNumber(row.distance_km),
      geom: toTrailGeom(geometry),
    },
    meta,
    polyline,
    pois: await loadTrailPois(db, polyline),
    layers: extractLayers(metadata.autogen),
  };
}

/** Fusionne un patch dans `trips.metadata` (best-effort, jamais bloquant). */
async function updateTripMetadata(
  db: SupabaseClient,
  trip: TripRow,
  patch: Record<string, unknown>
): Promise<boolean> {
  try {
    const { error } = await db
      .from('trips')
      .update({
        metadata: { ...trip.metadata, ...patch },
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.id)
      .eq('user_id', trip.user_id);
    if (error) {
      console.error('[LKDV activity-enrichment] métadonnées en échec:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[LKDV activity-enrichment] métadonnées en erreur inattendue:', error);
    return false;
  }
}

/** Échec définitif : trace la raison dans `trips.metadata` puis retourne `failed`. */
async function traceFailure(
  db: SupabaseClient,
  trip: TripRow,
  detail: string
): Promise<ActivityEnrichmentJobResult> {
  await updateTripMetadata(db, trip, {
    enrichment_status: 'failed',
    enrichment_error: detail,
    enrichment_at: new Date().toISOString(),
  });
  return { outcome: 'failed', detail };
}

function isAlreadyEnriched(metadata: Record<string, unknown>): boolean {
  const version = metadata.enrichment_version;
  return typeof version === 'string' && version.trim() !== '';
}

/** Mode de transport admis par l'enum SQL, tout le reste → `null` (jamais inventé). */
function toTransportMode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  return TRANSPORT_MODES.has(normalized) ? normalized : null;
}

async function insertRows(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`insertion ${table}: ${error.message}`);
}

/**
 * Purge du contenu LLM précédent (rejeu sans doublon) : steps/POI par
 * `metadata->>'source'`, items par `source`, checklist par ids suivis.
 * Si aucun id checklist n'est suivi (jamais écrit ou métadonnées perdues),
 * la suppression est ignorée (ruling).
 */
async function purgePreviousLlmContent(db: SupabaseClient, trip: TripRow): Promise<void> {
  const purgeByMetadata = async (table: string) => {
    const { error } = await db
      .from(table)
      .delete()
      .eq('trip_id', trip.id)
      .filter('metadata->>source', 'eq', 'llm_suggestion');
    if (error) throw new Error(`purge ${table}: ${error.message}`);
  };

  await purgeByMetadata('trip_steps');
  await purgeByMetadata('trip_pois');

  const { error: itemsError } = await db
    .from('trip_items')
    .delete()
    .eq('trip_id', trip.id)
    .eq('source', 'llm_suggestion');
  if (itemsError) throw new Error(`purge trip_items: ${itemsError.message}`);

  const checklistIds = extractChecklistIds(trip.metadata[CHECKLIST_IDS_KEY]);
  if (checklistIds.length > 0) {
    const { error: checklistError } = await db
      .from('trip_checklist_items')
      .delete()
      .eq('trip_id', trip.id)
      .in('id', checklistIds);
    if (checklistError) throw new Error(`purge trip_checklist_items: ${checklistError.message}`);
  }
}

/**
 * Écritures de succès (validation déjà passée) : purge du contenu LLM
 * précédent, puis étapes (roadbook + moments), POI géolocalisés, ajouts kit
 * et checklist, enfin métadonnées `done` (ids checklist suivis pour le rejeu).
 * Une erreur d'écriture remonte `retry` (métadonnées `v1` non posées, donc
 * rejouable sans doublon grâce à la purge).
 */
async function persistEnrichment(
  db: SupabaseClient,
  trip: TripRow,
  output: ActivityEnrichmentOutput,
  model: string,
  processedAt: string
): Promise<void> {
  await purgePreviousLlmContent(db, trip);

  const { data: stepData, error: stepError } = await db
    .from('trip_steps')
    .select('day_number, order_index')
    .eq('trip_id', trip.id);
  if (stepError) throw new Error(`lecture étapes existantes: ${stepError.message}`);

  const maxOrderByDay = new Map<number, number>();
  for (const raw of (stepData ?? []) as Record<string, unknown>[]) {
    const day = toFiniteNumber(raw.day_number);
    const order = toFiniteNumber(raw.order_index);
    if (day === null || order === null) continue;
    maxOrderByDay.set(day, Math.max(maxOrderByDay.get(day) ?? -1, order));
  }

  const { data: checklistData, error: checklistError } = await db
    .from('trip_checklist_items')
    .select('position')
    .eq('trip_id', trip.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (checklistError) throw new Error(`lecture checklist existante: ${checklistError.message}`);
  const basePosition =
    (toFiniteNumber((checklistData as Record<string, unknown> | null)?.position) ?? -1) + 1;

  const provenance = { source: 'llm_suggestion', model, enrichmentVersion: ENRICHMENT_VERSION };

  const stepRows: Record<string, unknown>[] = [];
  const poiRows: Record<string, unknown>[] = [];
  for (const day of output.days) {
    const baseOrder = (maxOrderByDay.get(day.day) ?? -1) + 1;
    day.steps.forEach((step, index) => {
      stepRows.push({
        trip_id: trip.id,
        day_number: day.day,
        order_index: baseOrder + index,
        title: step.title,
        description: step.description,
        start_time: step.startTime,
        latitude: step.lat,
        longitude: step.lng,
        distance_km: step.distanceKm,
        accommodation_name: step.accommodation,
        transport_mode: toTransportMode(step.transportMode),
        metadata: provenance,
        source: 'llm_suggestion',
      });
      // Chaque étape géolocalisée (corridor validé) devient un repère de carte réel.
      poiRows.push({
        trip_id: trip.id,
        name: step.title,
        category: null,
        latitude: step.lat,
        longitude: step.lng,
        visited: false,
        metadata: provenance,
        source: 'llm_suggestion',
      });
    });

    // Moments : une ligne roadbook par moment réel, après les étapes du jour.
    let momentOrder = baseOrder + day.steps.length;
    for (const group of MOMENT_GROUPS) {
      for (const label of day.moments[group.key]) {
        stepRows.push({
          trip_id: trip.id,
          day_number: day.day,
          order_index: momentOrder,
          title: `${group.prefix} — ${label}`,
          description: null,
          start_time: group.startTime,
          latitude: null,
          longitude: null,
          distance_km: null,
          accommodation_name: null,
          transport_mode: null,
          metadata: { ...provenance, kind: 'moment' },
          source: 'llm_suggestion',
        });
        momentOrder += 1;
      }
    }
  }

  await insertRows(db, 'trip_steps', stepRows);
  await insertRows(db, 'trip_pois', poiRows);
  await insertRows(
    db,
    'trip_items',
    output.kitAdditions.map((addition) => ({
      trip_id: trip.id,
      item_name: addition.name,
      category: addition.category,
      quantity: 1,
      status: 'needed',
      notes: addition.reason,
      source: 'llm_suggestion',
    }))
  );

  const checklistRows = output.checklistAdditions.map((addition, index) => ({
    trip_id: trip.id,
    label: addition.label,
    due_offset_days: addition.dueOffsetDays,
    done: false,
    position: basePosition + index,
  }));

  let checklistIds: string[] = [];
  if (checklistRows.length > 0) {
    const { data, error } = await db
      .from('trip_checklist_items')
      .insert(checklistRows)
      .select('id');
    if (error) throw new Error(`insertion trip_checklist_items: ${error.message}`);
    checklistIds = ((data ?? []) as Record<string, unknown>[])
      .map((entry) => (typeof entry.id === 'string' ? entry.id : ''))
      .filter((id) => id !== '');
  }

  const stored = await updateTripMetadata(db, trip, {
    enrichment_version: ENRICHMENT_VERSION,
    enrichment_status: 'done',
    enrichment_model: model,
    enrichment_at: processedAt,
    enrichment_suggestions: output.suggestions,
    [CHECKLIST_IDS_KEY]: checklistIds,
  });
  if (!stored) throw new Error('métadonnées de succès non persistées');
}

/**
 * Traite un job `activity-enrichment` (payload `{ tripId }`).
 *
 * Retourne `done` (enrichi ou déjà enrichi), `failed` (définitif : tracé
 * absent, sortie hors schéma, activité introuvable — tracé dans
 * `trips.metadata.enrichment_status='failed'`), `deferred` (quota épuisé,
 * zéro écriture — le cron re-pending sans tentative) ou `retry` (provider/
 * transport/écriture : le cron re-pending avec tentative+1, miroir
 * `trail-narrative`).
 */
export async function processActivityEnrichmentJob(job: {
  id: string;
  user_id: string;
  payload: unknown;
}): Promise<ActivityEnrichmentJobResult> {
  const parsed = activityEnrichmentJobSchema.safeParse(job.payload);
  if (!parsed.success) return { outcome: 'failed', detail: 'payload invalide' };

  const db = getServiceSupabase();
  if (!db) return { outcome: 'retry', detail: 'service IA indisponible' };

  const loaded = await loadOwnedTrip(db, parsed.data.tripId, job.user_id);
  if (loaded.status === 'failed') return { outcome: 'failed', detail: loaded.detail };

  const trip = loaded.trip;
  if (isAlreadyEnriched(trip.metadata)) {
    return { outcome: 'done', detail: 'déjà enrichi' };
  }

  try {
    const context = await loadEnrichmentContext(db, trip.metadata);
    const { system, prompt } = buildActivityEnrichmentPrompt({
      trail: context.trail,
      meta: context.meta,
      polyline: context.polyline,
      pois: context.pois,
      layers: context.layers,
    });

    // Quota testé ICI (avant askAI, sans userId passé à askAI — sinon double
    // consommation), en miroir exact de `trail-narrative`.
    const allowed = await consumeQuota(
      job.user_id,
      ACTIVITY_ENRICHMENT_SPEC.tier,
      FEATURE,
      ACTIVITY_ENRICHMENT_SPEC.maxPerUserPerDay
    );
    if (!allowed) return { outcome: 'deferred', detail: 'quota' };

    let result;
    try {
      result = await askAI({
        feature: FEATURE,
        tier: ACTIVITY_ENRICHMENT_SPEC.tier,
        system,
        prompt,
        maxTokens: MAX_ENRICHMENT_TOKENS,
        reasoningBudget: ACTIVITY_ENRICHMENT_SPEC.maxReasoningBudget,
        cacheTtlSeconds: ACTIVITY_ENRICHMENT_SPEC.cacheTtlSeconds,
      });
    } catch (error) {
      console.error(
        '[LKDV activity-enrichment] provider en échec (retry):',
        errorDetail(error),
        trip.id
      );
      return { outcome: 'retry', detail: 'provider indisponible' };
    }

    // Le fallback du registre est `degraded` (provider en panne) → réessayable.
    if (result.degraded) {
      console.error('[LKDV activity-enrichment] provider dégradé (retry):', trip.id);
      return { outcome: 'retry', detail: 'provider dégradé' };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(result.text);
    } catch {
      return traceFailure(db, trip, 'sortie IA non JSON');
    }

    let output: ActivityEnrichmentOutput;
    try {
      output = sanitizeEnrichmentOutput(raw, context.polyline);
    } catch (error) {
      const detail =
        error instanceof ActivityEnrichmentNoTraceError
          ? error.message
          : 'sortie IA invalide (schéma)';
      return traceFailure(db, trip, detail);
    }

    try {
      await persistEnrichment(db, trip, output, result.model, new Date().toISOString());
    } catch (error) {
      console.error(
        '[LKDV activity-enrichment] écriture en échec (retry):',
        errorDetail(error),
        trip.id
      );
      return { outcome: 'retry', detail: 'écriture en échec' };
    }

    return { outcome: 'done', detail: result.model };
  } catch (error) {
    if (error instanceof ActivityEnrichmentNoTraceError) {
      return traceFailure(db, trip, error.message);
    }
    console.error(
      '[LKDV activity-enrichment] contexte en échec (retry):',
      errorDetail(error),
      trip.id
    );
    return { outcome: 'retry', detail: 'contexte indisponible' };
  }
}
