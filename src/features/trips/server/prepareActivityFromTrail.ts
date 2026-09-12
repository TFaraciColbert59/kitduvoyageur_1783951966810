import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { createTrip } from '@/lib/queries-trips';
import { runAutoGenPipeline } from '../engine/autoGenPipeline';
import { createTripFromAutogenIntent } from './createTripFromAutogenIntent';
import {
  buildTrailRawInput,
  isWithinCorridor,
  mapTrailDifficulty,
  samplePolyline,
  type TrailInput,
  type TrailMetaInput,
  type TrailPoint,
} from '../domain/trailToActivity';
import {
  buildDeterministicExpenses,
  buildDeterministicPois,
  buildDeterministicSteps,
} from '../domain/deterministicActivityContent';
import type { CreateTripFromAutogenIntentInput } from '../schemas/autogenTripCreate.schema';
import type { TripBrief } from '../schemas/autoGen.schema';
import { enqueueActivityEnrichment } from './activityEnrichment/enqueue';

/**
 * « Préparer » un sentier → activité complète (Task 4).
 *
 * Chaîne idempotente : normalisation de `route_id` → sentier réel
 * (`hiking_routes` + `trail_metadata` + géométrie `get_route_geojson`) →
 * réutilisation par (`user_id`, `metadata->>'route_id'`) → usine AutoGen
 * (`runAutoGenPipeline` + `createTripFromAutogenIntent`) avec repli minimal
 * `createTrip` → socle déterministe (`trip_steps`/`trip_pois`/`trip_expenses`)
 * → enfilage `activity-enrichment`.
 *
 * Règle dure : aucune valeur inventée ; tout échec non bloquant est journalisé
 * et l'utilisateur conserve une activité réelle dès que possible.
 */

export type PrepareTrailOutcome =
  | { status: 'unavailable'; reason: 'not_found' | 'no_name' | 'no_geometry' }
  | { status: 'reused'; tripId: string; slug: string; title: string }
  | { status: 'created'; tripId: string; slug: string; title: string }
  | { status: 'fallback_created'; tripId: string; slug: string; title: string };

/**
 * Signal interne : le sentier est valide mais aucun utilisateur connecté.
 * La route redirige vers `/connexion?redirect=…` ; jamais de levée vers une 500.
 */
export class PrepareActivityAuthError extends Error {
  constructor() {
    super('Authentification requise pour préparer une activité.');
    this.name = 'PrepareActivityAuthError';
  }
}

interface TripRecord {
  tripId: string;
  slug: string;
  title: string;
}

interface TrailPoiRow {
  id: number;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
}

type LoadedTrail =
  | { status: 'unavailable'; reason: 'not_found' | 'no_name' | 'no_geometry' }
  | {
      status: 'ok';
      trail: TrailInput;
      meta: TrailMetaInput | null;
      polyline: TrailPoint[];
    };

/** Corridor réel maximal des POI autour du tracé (km). */
const POI_CORRIDOR_KM = 0.75;
/** Marge de la bounding box d'interrogation des POI (±°, puis filtre haversine). */
const POI_BBOX_DEG = 0.01;
const POI_LIMIT = 200;
const PREPARE_SOURCE = 'prepare-trail';

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** `route_id` canonique : entier fini > 0, sinon `null` (jamais de write). */
function normalizeRouteId(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Géométrie GeoJSON exploitable, sans invention de type. */
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

function isUniqueRouteViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '23505') return true;
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return /uniq_trips_user_route/.test(message) || /duplicate key value/i.test(message);
}

/** Charge le sentier réel : route, métadonnées et géométrie échantillonnée. */
async function loadTrail(db: SupabaseClient, routeId: number): Promise<LoadedTrail> {
  const { data: routeRow, error: routeError } = await db
    .from('hiking_routes')
    .select('id, name, ref, network, distance_km')
    .eq('id', routeId)
    .maybeSingle();

  if (routeError) {
    console.error('[LKDV preparer-sentier] lecture hiking_routes en échec:', routeError.message);
    return { status: 'unavailable', reason: 'not_found' };
  }
  if (!routeRow) return { status: 'unavailable', reason: 'not_found' };

  const row = routeRow as Record<string, unknown>;
  const name = toStringOrNull(row.name);
  // Bornes du schéma `trips.title` (3–120) : hors bornes, le nom n'est pas
  // exploitable pour une activité (jamais tronqué ni complété).
  if (!name || name.length < 3 || name.length > 120) {
    return { status: 'unavailable', reason: 'no_name' };
  }

  const [metaResult, geojsonResult] = await Promise.all([
    db
      .from('trail_metadata')
      .select('difficulty, duration_hours, elevation_gain, terrain_type')
      .eq('trail_id', routeId)
      .maybeSingle(),
    db.rpc('get_route_geojson', { p_route_id: routeId }),
  ]);

  if (metaResult.error) {
    console.error(
      '[LKDV preparer-sentier] lecture trail_metadata en échec:',
      metaResult.error.message
    );
  }
  if (geojsonResult.error) {
    console.error(
      '[LKDV preparer-sentier] lecture get_route_geojson en échec:',
      geojsonResult.error.message
    );
  }

  const geometry = parseGeometry(geojsonResult.data);
  const polyline = samplePolyline(geometry);
  if (polyline.length === 0) return { status: 'unavailable', reason: 'no_geometry' };

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
    status: 'ok',
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
  };
}

/** POI réels ≤ 750 m du tracé (bbox ±0,01° puis filtre haversine). */
async function loadTrailPois(db: SupabaseClient, polyline: TrailPoint[]): Promise<TrailPoiRow[]> {
  const lats = polyline.map((point) => point.lat);
  const lngs = polyline.map((point) => point.lng);
  const minLat = Math.min(...lats) - POI_BBOX_DEG;
  const maxLat = Math.max(...lats) + POI_BBOX_DEG;
  const minLng = Math.min(...lngs) - POI_BBOX_DEG;
  const maxLng = Math.max(...lngs) + POI_BBOX_DEG;

  try {
    const { data, error } = await db.rpc('get_trail_pois_bbox', {
      min_lng: minLng,
      min_lat: minLat,
      max_lng: maxLng,
      max_lat: maxLat,
      p_limit: POI_LIMIT,
    });
    if (error) {
      console.error('[LKDV preparer-sentier] POI bbox en échec:', error.message);
      return [];
    }

    const rows: TrailPoiRow[] = [];
    for (const raw of (data ?? []) as Record<string, unknown>[]) {
      const id = toFiniteNumber(raw.id);
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      const lat = toFiniteNumber(raw.lat);
      const lng = toFiniteNumber(raw.lng);
      if (id === null || name === '' || lat === null || lng === null) continue;
      if (!isWithinCorridor({ lat, lng }, polyline, POI_CORRIDOR_KM)) continue;
      rows.push({ id, name, category: toStringOrNull(raw.category), lat, lng });
    }
    return rows;
  } catch (error) {
    console.error('[LKDV preparer-sentier] POI bbox en erreur inattendue:', error);
    return [];
  }
}

/** Réutilisation idempotente par (`user_id`, `metadata->>'route_id'`). */
async function findExistingTrip(
  db: SupabaseClient,
  userId: string,
  routeId: number
): Promise<TripRecord | null> {
  const { data, error } = await db
    .from('trips')
    .select('id, slug, title')
    .eq('user_id', userId)
    .filter('metadata->>route_id', 'eq', String(routeId))
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[LKDV preparer-sentier] recherche activité existante en échec:', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return { tripId: String(row.id), slug: String(row.slug), title: String(row.title) };
}

/** Métadonnées de préparation : `route_id` (nombre), provenance, statut job. */
async function writeTripPrepareMetadata(
  writer: SupabaseClient,
  tripId: string,
  userId: string,
  routeId: number
): Promise<void> {
  try {
    const { data } = await writer
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .eq('user_id', userId)
      .maybeSingle();

    const current =
      data && typeof (data as { metadata?: unknown }).metadata === 'object' && data.metadata
        ? ((data as { metadata: Record<string, unknown> }).metadata ?? {})
        : {};

    const { error } = await writer
      .from('trips')
      .update({
        metadata: {
          ...current,
          route_id: routeId,
          source: PREPARE_SOURCE,
          enrichment_status: 'pending',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .eq('user_id', userId);

    if (error) {
      console.error('[LKDV preparer-sentier] métadonnées route_id en échec:', error.message);
    }
  } catch (error) {
    console.error('[LKDV preparer-sentier] métadonnées route_id en erreur inattendue:', error);
  }
}

interface PlateInput {
  writer: SupabaseClient;
  userId: string;
  tripId: string;
  trail: TrailInput;
  meta: TrailMetaInput | null;
  polyline: TrailPoint[];
  pois: TrailPoiRow[];
  layers: CreateTripFromAutogenIntentInput['layers'] | null;
  partySize: number;
}

/** Dressage best-effort : chaque insert est isolé, jamais bloquant. */
async function plateDeterministicContent(input: PlateInput): Promise<void> {
  const { writer, userId, tripId, trail, meta, polyline, pois, layers, partySize } = input;

  const steps = buildDeterministicSteps(trail, meta, polyline);
  if (steps.length > 0) {
    try {
      const { error } = await writer.from('trip_steps').insert(
        steps.map((step) => ({
          trip_id: tripId,
          day_number: step.dayNumber,
          order_index: step.orderIndex,
          title: step.title,
          description: step.description,
          start_time: step.startTime,
          latitude: step.latitude,
          longitude: step.longitude,
          distance_km: step.distanceKm,
          elevation_gain_m: step.elevationGainM,
          accommodation_name: step.accommodationName,
          transport_mode: step.transportMode,
          metadata: step.metadata,
          source: step.source,
        }))
      );
      if (error) {
        console.error('[LKDV preparer-sentier] insertion trip_steps en échec:', error.message);
      }
    } catch (error) {
      console.error('[LKDV preparer-sentier] insertion trip_steps en erreur inattendue:', error);
    }
  }

  const poiDrafts = buildDeterministicPois(pois);
  if (poiDrafts.length > 0) {
    try {
      const { error } = await writer.from('trip_pois').insert(
        poiDrafts.map((poi) => ({
          trip_id: tripId,
          name: poi.name,
          category:
            typeof poi.metadata.category === 'string' ? poi.metadata.category : null,
          latitude: poi.latitude,
          longitude: poi.longitude,
          metadata: poi.metadata,
          source: poi.source,
        }))
      );
      if (error) {
        console.error('[LKDV preparer-sentier] insertion trip_pois en échec:', error.message);
      }
    } catch (error) {
      console.error('[LKDV preparer-sentier] insertion trip_pois en erreur inattendue:', error);
    }
  }

  const expenses = buildDeterministicExpenses(trail, meta, partySize, layers);
  if (expenses.length > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await writer.from('trip_expenses').insert(
        expenses.map((expense) => ({
          trip_id: tripId,
          payer_id: userId,
          title: expense.title,
          amount: expense.amountEur,
          currency: 'EUR',
          category: expense.category,
          expense_date: today,
          split_type: 'equal',
          is_planned: true,
          metadata: expense.metadata,
        }))
      );
      if (error) {
        console.error('[LKDV preparer-sentier] insertion trip_expenses en échec:', error.message);
      }
    } catch (error) {
      console.error('[LKDV preparer-sentier] insertion trip_expenses en erreur inattendue:', error);
    }
  }
}

function partySizeFromBrief(brief: unknown): number {
  if (!brief || typeof brief !== 'object') return 1;
  const party = (brief as { party?: { value?: { adults?: unknown; minors?: unknown } } }).party;
  const adults = toFiniteNumber(party?.value?.adults) ?? 0;
  const minors = toFiniteNumber(party?.value?.minors) ?? 0;
  const total = Math.trunc(adults + minors);
  return total > 0 ? total : 1;
}

/**
 * Prépare (ou réutilise) l'activité réelle liée à un sentier.
 *
 * Ne réalise aucune écriture si le sentier est inconnu/sans nom/sans tracé.
 * Lève `PrepareActivityAuthError` si le sentier est valide mais l'utilisateur
 * non connecté (la route redirige vers la connexion).
 */
export async function prepareActivityFromTrail(trailIdRaw: string): Promise<PrepareTrailOutcome> {
  const routeId = normalizeRouteId(trailIdRaw);
  if (routeId === null) return { status: 'unavailable', reason: 'not_found' };

  const session = await createClient();
  const service = getServiceSupabase();
  const db: SupabaseClient = service ?? session;

  const loaded = await loadTrail(db, routeId);
  if (loaded.status === 'unavailable') {
    return { status: 'unavailable', reason: loaded.reason };
  }

  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) throw new PrepareActivityAuthError();

  const existing = await findExistingTrip(db, user.id, routeId);
  if (existing) return { status: 'reused', ...existing };

  const { trail, meta, polyline } = loaded;
  const writer: SupabaseClient = service ?? session;

  let record: TripRecord | null = null;
  let layers: CreateTripFromAutogenIntentInput['layers'] | null = null;
  let brief: TripBrief | null = null;
  let status: 'created' | 'fallback_created' = 'created';

  const rawInput = buildTrailRawInput(trail, meta);
  try {
    const pipeline = await runAutoGenPipeline(rawInput);
    layers = pipeline.layers as CreateTripFromAutogenIntentInput['layers'];
    brief = pipeline.brief;
    const created = await createTripFromAutogenIntent({
      rawInput,
      brief: pipeline.brief,
      layers,
      coordinates: polyline,
      title: trail.name,
      correlationId: randomUUID(),
      idempotencyKey: randomUUID(),
      autoSelectRoute: true,
    });
    if (created.ok) {
      record = { tripId: created.tripId, slug: created.slug, title: created.title };
    } else {
      console.error(
        '[LKDV preparer-sentier] usine autogen non-ok:',
        created.status,
        created.error
      );
    }
  } catch (error) {
    console.error(
      '[LKDV preparer-sentier] usine autogen en échec:',
      error instanceof Error ? error.message : error
    );
  }

  if (!record) {
    try {
      const trip = await createTrip(
        {
          title: trail.name,
          destination_name: trail.name,
          difficulty: mapTrailDifficulty(meta?.difficulty),
          primary_activity: 'hiking',
          status: 'draft',
          visibility: 'private',
          metadata: { route_id: routeId, source: PREPARE_SOURCE },
        },
        user.id
      );
      record = {
        tripId: String((trip as { id: string }).id),
        slug: String((trip as { slug: string }).slug),
        title: String((trip as { title: string }).title),
      };
      status = 'fallback_created';
    } catch (error) {
      if (isUniqueRouteViolation(error)) {
        const raced = await findExistingTrip(db, user.id, routeId);
        if (raced) return { status: 'reused', ...raced };
      }
      throw error;
    }
  }

  const tripId = record.tripId;

  await writeTripPrepareMetadata(writer, tripId, user.id, routeId);

  const pois = await loadTrailPois(db, polyline);
  await plateDeterministicContent({
    writer,
    userId: user.id,
    tripId,
    trail,
    meta,
    polyline,
    pois,
    layers,
    partySize: partySizeFromBrief(brief),
  });

  await enqueueActivityEnrichment(tripId, user.id);

  return { status, ...record };
}
