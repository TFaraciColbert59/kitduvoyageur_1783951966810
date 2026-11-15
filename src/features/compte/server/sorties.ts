import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/api/serviceClient';
import type { TraceProjectionError } from '../domain/traceProjection';
import {
  SHARED_SUMMARY_METRICS,
  averagePaceMinPerKm,
  movingTimeSeconds,
  observedMaxAltitudeM,
  parseMetricVisibility,
  projectOutingMetrics,
  projectTraceMetrics,
  resolveOutingMetricVisibility,
  type OutingMetricVisibility,
} from '../domain/metricVisibility';
import { readOutingMetricPolicy } from './outingShareMetrics';
import {
  isBlockedBetween,
  loadActivePrivacyZonesForProjection,
  readOutingTracePrivacy,
  resolveOutingShareToken,
  revokeAllOutingShareLinks,
} from './privacyZones';
import {
  isFollowerTraceVisibility,
  projectTraceSampleSegments,
  resolveTraceMasks,
  type TraceViewer,
} from './tracePrivacy';
import {
  loadOutingWeather,
  parseStoredWeather,
  weatherForViewer,
  type OutingWeather,
} from './weather';
import { TRACE_IMPORT_LIMITS } from '@/features/hiking/import/model';
import { TRACE_IMPORT_MAX_PAYLOAD_SAMPLES } from '@/features/hiking/import/series';
import { isActivityShareActive, parseActivityShareMeta } from '@/features/community/g01/activityShare';
import { revokeActivityShare } from '@/features/community/g01/activityShareService';
import type { LifecycleActivityRecord } from '@/features/activity/lifecycle';

/**
 * Drawer Sortie — lecture et écriture des données réelles.
 *
 * Aucune valeur inventée : une sortie sans titre, sans photo ou sans météo
 * expose `null` / `[]`, et l'UI affiche son état vide. Les écritures sont
 * bornées au propriétaire par la RLS (`own_sessions`, policies filles) et par
 * un filtre `user_id` explicite côté serveur.
 */

export type OutingStatus = 'planned' | 'ongoing' | 'done';
export type OutingVisibility = 'private' | 'followers' | 'public' | 'collective_anonymized';

export interface OutingPoint {
  lat: number;
  lng: number;
  elevationM: number | null;
  timestamp: string | null;
}

export type OutingImportSource = 'fit' | 'tcx' | 'gpx';

/**
 * Provenance réellement persistée par `trace_imports` pour un import de trace.
 * Les champs de l'aperçu local (sport, créateur, produit, série, fuseaux,
 * sections ignorées) ne sont volontairement pas repris : ils ne sont pas
 * stockés et ne peuvent donc pas être restitués après rechargement.
 */
export interface OutingImportProvenance {
  source: OutingImportSource;
  fingerprint: string;
  fileName: string | null;
  byteLength: number | null;
  importedAt: string;
}

/**
 * Tour source réellement persisté dans `trace_import_laps`.
 *
 * `origin` conserve la distinction du fichier : `device` pour un lap déclaré
 * par l'appareil (FIT `lap` ou TCX `Lap`), `synthetic` pour le tour unique
 * reconstruit depuis le message FIT `session`. Ce n'est jamais un split
 * calculé : les km/mile et tours manuels Explorer restent dans `ActivitySplit`.
 */
export interface OutingImportLap {
  index: number;
  origin: 'device' | 'synthetic';
  startedAt: string | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  averageSpeedMps: number | null;
  maxSpeedMps: number | null;
  caloriesKcal: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageCadenceRpm: number | null;
  averageCadenceSpm: number | null;
  averagePowerW: number | null;
  maxPowerW: number | null;
  intensity: string | null;
  triggerMethod: string | null;
  pointCount: number;
  trackCount: number;
}

/**
 * Résumé `session` FIT réellement conservé dans `trace_import_summaries`.
 * `origin` vaut `fit_session` : ces valeurs viennent du message `session` du
 * fichier, jamais d'une moyenne calculée à partir des points.
 */
export interface OutingImportSummary {
  origin: 'fit_session';
  startedAt: string | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  averageSpeedMps: number | null;
  maxSpeedMps: number | null;
  caloriesKcal: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageCadenceRpm: number | null;
  averageCadenceSpm: number | null;
  averagePowerW: number | null;
  maxPowerW: number | null;
  activityTimerSeconds: number | null;
}

/**
 * Mesure de point conservée dans `trace_import_samples`.
 *
 * `origin` vaut `device` : la valeur est recopiée du fichier, jamais dérivée.
 * Les champs absents restent `null` ; `0` est une mesure réelle et n'est jamais
 * confondu avec une absence. Aucune coordonnée n'est dupliquée ici : la trace
 * reste dans `hike_sessions`.
 */
export interface OutingImportSample {
  index: number;
  origin: 'device';
  recordedAt: string | null;
  lapIndex: number | null;
  distanceM: number | null;
  altitudeM: number | null;
  speedMps: number | null;
  heartRateBpm: number | null;
  cadenceRpm: number | null;
  cadenceSpm: number | null;
  powerW: number | null;
  temperatureC: number | null;
}

export interface OutingPhoto {
  id: string;
  url: string;
  caption: string | null;
  position: number;
}

export interface OutingParticipant {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  role: string;
  isOwner: boolean;
}

export interface OutingGearItem {
  id: string;
  name: string;
  weightG: number | null;
  kitId: string | null;
  /** Lien stable vers `gear_items`, `null` pour un objet de kit non inventorié. */
  gearItemId: string | null;
  photoUrl?: string | null;
  category?: string | null;
  condition?: string | null;
  inventoryStatus?: string | null;
  listingMode?: string | null;
  isLent?: boolean;
  priceCents?: number | null;
}

export interface OutingKit {
  id: string;
  name: string;
  totalWeightG: number | null;
  items: { name: string; weightG: number | null }[];
}

export interface OutingComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; handle: string; avatarUrl: string | null };
  mine: boolean;
}

export interface OutingKudos {
  count: number;
  mine: boolean;
  users: { id: string; name: string; avatarUrl: string | null }[];
}

export interface OutingDetail {
  id: string;
  title: string;
  date: string | null;
  startedAt: string | null;
  endedAt: string | null;
  massif: string | null;
  routeName: string | null;
  /** Sport de la séance (`rando` pour l'historique sans séance multi-sport). */
  sport: string | null;
  /** Métriques projetées : `null` signifie masquée ou réellement absente. */
  km: number | null;
  dplus: number | null;
  maxAlt: number | null;
  durationS: number | null;
  /** Allure calculée côté serveur, jamais recalculée par le client. */
  paceMinPerKm: number | null;
  movingTimeS: number | null;
  heartRateBpm: number | null;
  powerW: number | null;
  cadenceRpm: number | null;
  caloriesKcal: number | null;
  /** Politique appliquée ; permet à l'UI de ne rien dériver d'une métrique masquée. */
  metricVisibility: OutingMetricVisibility;
  /**
   * Choix de partage effectif : ce qu'un tiers verrait si la sortie était
   * partagée. Pour le propriétaire, c'est sa politique persistée (ou le socle
   * agrégé par défaut) ; pour un tiers, c'est la politique déjà projetée.
   */
  shareMetricVisibility: OutingMetricVisibility;
  /** Vrai si le propriétaire a enregistré une ligne de choix explicite. */
  shareMetricsConfigured: boolean;
  metricsMasked: boolean;
  status: OutingStatus;
  visibility: OutingVisibility;
  verified: boolean;
  coverUrl: string | null;
  notes: string;
  /** Ressenti RPE déclaré (1..10) par le propriétaire, ou `null`/`undefined`. */
  rpe?: number | null;
  weather: OutingWeather | null;
  photos: OutingPhoto[];
  /** `hike_session_photos` illisible : ne pas présenter la sortie sans photo. */
  photosUnavailable: boolean;
  participants: OutingParticipant[];
  gear: OutingGearItem[];
  kit: OutingKit | null;
  missingGear: number;
  kudos: OutingKudos;
  comments: OutingComment[];
  /**
   * Trace brute du propriétaire. Vide pour un visiteur : la seule source
   * affichable/exportable est alors `traceSegments`, afin qu'un consommateur
   * qui tracerait `points` d'un seul trait ne puisse pas recoller une coupure.
   */
  points: OutingPoint[];
  /** Morceaux visibles, jamais recollés à travers un masque. */
  traceSegments: OutingPoint[][];
  traceMasked: boolean;
  traceFullyMasked: boolean;
  traceError: TraceProjectionError;
  canEdit: boolean;
  /**
   * Provenance privée d'un import FIT/TCX/GPX. `null` pour une sortie GPS,
   * pour un lecteur non propriétaire, ou si le registre n'est pas disponible :
   * le détail de la sortie reste alors entièrement lisible.
   */
  provenance: OutingImportProvenance | null;
  /**
   * Tours source d'un import FIT/TCX, dans l'ordre du fichier.
   *
   * - `null` : registre indisponible, lecteur non propriétaire, ou import
   *   dont la provenance n'est pas lisible ; aucun tour n'est exposé.
   * - `[]` : registre présent mais aucun tour conservé (import antérieur à la
   *   persistance des tours, ou fichier sans tour).
   *
   * Les splits calculés ne sont jamais mélangés à ce tableau.
   */
  laps: OutingImportLap[] | null;
  /**
   * Résumé `session` FIT conservé pour cet import.
   *
   * - `null` : registre indisponible, lecteur non propriétaire, import sans
   *   résumé (TCX, FIT sans `session`) ou import antérieur à cette passe.
   * - objet : valeurs réellement lues dans le message `session`, `null` par
   *   champ absent.
   */
  summary: OutingImportSummary | null;
  /**
   * Mesures de point conservées pour cet import.
   *
   * - `null` : registre indisponible, lecteur non propriétaire ou provenance
   *   illisible ; aucune mesure n'est exposée.
   * - `[]` : registre présent mais aucune mesure conservée (import antérieur,
   *   ou fichier sans FC/cadence/puissance/température/distance de point).
   *
   * Les coordonnées ne sont jamais dupliquées dans ce tableau.
   */
  samples: OutingImportSample[] | null;
  /** Lot A02 : temps écoulé total (y compris pauses) en secondes (S2.01). */
  elapsedS?: number | null;
  /** Lot A02 : tags d'activité normalisés (S1.20). */
  tags?: string[];
  /** Lot A02 : révision monotone du cycle de vie. */
  revision?: number | null;
  /** Lot A02 : invite d'édition rapide post-sync active (S1.18). */
  quickEditPending?: boolean;
  /** Lot A02 : correction distance/D+ appliquée (S1.23). */
  correctedMetrics?: boolean;
  /** Lot A02 : nombre de pics GPS lissés (K5.10). */
  gpsSpikesRemoved?: number;
}

type TraceImportRow = {
  source: string | null;
  source_fingerprint: string | null;
  source_file_name: string | null;
  source_byte_length: number | string | null;
  imported_at: string | null;
};

type TraceImportLapRow = {
  lap_index: number | string | null;
  lap_origin: string | null;
  started_at: string | null;
  elapsed_seconds: number | string | null;
  distance_m: number | string | null;
  average_speed_mps: number | string | null;
  max_speed_mps: number | string | null;
  calories_kcal: number | string | null;
  average_heart_rate_bpm: number | string | null;
  max_heart_rate_bpm: number | string | null;
  average_cadence_rpm: number | string | null;
  average_cadence_spm: number | string | null;
  average_power_w: number | string | null;
  max_power_w: number | string | null;
  intensity: string | null;
  trigger_method: string | null;
  point_count: number | string | null;
  track_count: number | string | null;
};

type TraceImportSummaryRow = {
  summary_origin: string | null;
  started_at: string | null;
  elapsed_seconds: number | string | null;
  distance_m: number | string | null;
  average_speed_mps: number | string | null;
  max_speed_mps: number | string | null;
  calories_kcal: number | string | null;
  average_heart_rate_bpm: number | string | null;
  max_heart_rate_bpm: number | string | null;
  average_cadence_rpm: number | string | null;
  average_cadence_spm: number | string | null;
  average_power_w: number | string | null;
  max_power_w: number | string | null;
  activity_timer_seconds: number | string | null;
};

type TraceImportSampleRow = {
  sample_index: number | string | null;
  sample_origin: string | null;
  recorded_at: string | null;
  lap_index: number | string | null;
  distance_m: number | string | null;
  altitude_m: number | string | null;
  speed_mps: number | string | null;
  heart_rate_bpm: number | string | null;
  cadence_rpm: number | string | null;
  cadence_spm: number | string | null;
  power_w: number | string | null;
  temperature_c: number | string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  route_id: number | null;
  title: string | null;
  started_at: string | null;
  ended_at: string | null;
  distance_km: number | string | null;
  activity_session_id: string | null;
  duration_seconds: number | null;
  elevation_gain_m: number | string | null;
  max_altitude_m: number | null;
  positions_timed: unknown;
  positions_geojson: unknown;
  visibility: string | null;
  kit_id: string | null;
  weather: unknown;
  notes: string | null;
  rpe?: number | null;
};

function parseValidRpe(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  if (raw < 1 || raw > 10) return null;
  return raw;
}

function readStoredOutingRpe(session: Pick<SessionRow, 'rpe' | 'weather'>): number | null {
  const direct = parseValidRpe(session.rpe);
  if (direct !== null) return direct;
  if (session.weather && typeof session.weather === 'object') {
    const fallback = (session.weather as Record<string, unknown>)._rpe;
    return parseValidRpe(fallback);
  }
  return null;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

const PROFILE_COLUMNS = 'id, full_name, handle, avatar_url';

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Validation stricte d'une ligne `trace_imports`. Une valeur inattendue ne
 * devient jamais une provenance approximative : on préfère ne rien afficher.
 */
export function parseImportProvenance(
  row: Partial<TraceImportRow> | null | undefined
): OutingImportProvenance | null {
  if (!row) return null;
  const source =
    typeof row.source === 'string' ? row.source.trim().toLowerCase() : '';
  if (source !== 'fit' && source !== 'tcx' && source !== 'gpx') return null;

  const fingerprint =
    typeof row.source_fingerprint === 'string'
      ? row.source_fingerprint.trim().toLowerCase()
      : '';
  if (!/^sha256:[0-9a-f]{64}$/.test(fingerprint)) return null;

  const importedAt = typeof row.imported_at === 'string' ? row.imported_at.trim() : '';
  if (!importedAt) return null;

  const fileName =
    typeof row.source_file_name === 'string' ? row.source_file_name.trim() : '';
  const rawBytes = row.source_byte_length;
  let bytes = NaN;
  if (typeof rawBytes === 'number') {
    bytes = rawBytes;
  } else if (typeof rawBytes === 'string' && rawBytes.trim() !== '') {
    bytes = Number(rawBytes);
  }

  return {
    source,
    fingerprint,
    fileName: fileName ? fileName.slice(0, 255) : null,
    byteLength:
      Number.isFinite(bytes) && bytes > 0 ? Math.min(Math.round(bytes), 16_777_216) : null,
    importedAt,
  };
}

/**
 * Lit la provenance d'un import pour **son propriétaire uniquement**.
 *
 * - `owner_id` et `session_id` sont filtrés ensemble ; la RLS de
 *   `trace_imports` ne laisse de toute façon lire que `auth.uid()`.
 * - Une table absente (code déployé avant la migration) ou une lecture
 *   refusée retourne `null`, jamais une erreur : le détail de la sortie ne
 *   doit pas dépendre du registre de provenance.
 * - Le nom de fichier n'est jamais journalisé ici.
 */
async function readImportProvenance(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<OutingImportProvenance | null> {
  try {
    const { data, error } = await supabase
      .from('trace_imports')
      .select(
        'source,source_fingerprint,source_file_name,source_byte_length,imported_at'
      )
      .eq('owner_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) return null;
    return parseImportProvenance(data as TraceImportRow | null);
  } catch {
    return null;
  }
}

function isImportLapOrigin(value: string): value is OutingImportLap['origin'] {
  return value === 'device' || value === 'synthetic';
}

/**
 * Validation stricte d'une ligne `trace_import_laps`. Une ligne inattendue est
 * ignorée : on ne fabrique jamais un tour approximatif à partir d'un index ou
 * d'une valeur manquante.
 */
export function parseImportLap(
  row: Partial<TraceImportLapRow> | null | undefined
): OutingImportLap | null {
  if (!row) return null;

  const index = numericOrNull(row.lap_index);
  if (index === null || !Number.isInteger(index) || index < 0 || index > 9_999) {
    return null;
  }

  const origin =
    typeof row.lap_origin === 'string' ? row.lap_origin.trim().toLowerCase() : '';
  if (!isImportLapOrigin(origin)) return null;

  const startedAt =
    typeof row.started_at === 'string' && row.started_at.trim() !== ''
      ? row.started_at
      : null;
  if (startedAt !== null && !Number.isFinite(Date.parse(startedAt))) return null;

  const pointCount = numericOrNull(row.point_count);
  const trackCount = numericOrNull(row.track_count);
  if (
    pointCount === null
    || !Number.isInteger(pointCount)
    || pointCount < 0
    || trackCount === null
    || !Number.isInteger(trackCount)
    || trackCount < 0
  ) {
    return null;
  }

  return {
    index,
    origin,
    startedAt,
    elapsedSeconds: numericOrNull(row.elapsed_seconds),
    distanceM: numericOrNull(row.distance_m),
    averageSpeedMps: numericOrNull(row.average_speed_mps),
    maxSpeedMps: numericOrNull(row.max_speed_mps),
    caloriesKcal: numericOrNull(row.calories_kcal),
    averageHeartRateBpm: numericOrNull(row.average_heart_rate_bpm),
    maxHeartRateBpm: numericOrNull(row.max_heart_rate_bpm),
    averageCadenceRpm: numericOrNull(row.average_cadence_rpm),
    averageCadenceSpm: numericOrNull(row.average_cadence_spm),
    averagePowerW: numericOrNull(row.average_power_w),
    maxPowerW: numericOrNull(row.max_power_w),
    intensity:
      typeof row.intensity === 'string' && row.intensity.trim() !== ''
        ? row.intensity.slice(0, 64)
        : null,
    triggerMethod:
      typeof row.trigger_method === 'string' && row.trigger_method.trim() !== ''
        ? row.trigger_method.slice(0, 64)
        : null,
    pointCount,
    trackCount,
  };
}

const IMPORT_LAP_PAGE_SIZE = 1_000;
const IMPORT_LAP_MAX = TRACE_IMPORT_LIMITS.maxLaps;
const IMPORT_SAMPLE_PAGE_SIZE = 1_000;
const IMPORT_SAMPLE_MAX = TRACE_IMPORT_MAX_PAYLOAD_SAMPLES;
const IMPORT_LAP_INDEX_MAX = 9_999;

/**
 * Lit les tours d'un import pour **son propriétaire uniquement**.
 *
 * `owner_id` et `session_id` sont filtrés ensemble ; la RLS de
 * `trace_import_laps` ne laisse de toute façon lire que `auth.uid()`. La
 * lecture est paginée car PostgREST plafonne une réponse (1 000 lignes par
 * défaut) alors qu'un fichier peut porter 10 000 tours. Une table absente
 * (code déployé avant la migration), une erreur ou un refus retourne `null` :
 * le détail de la sortie reste lisible sans tours.
 */
async function readImportLaps(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<OutingImportLap[] | null> {
  try {
    const laps: OutingImportLap[] = [];
    for (let offset = 0; offset < IMPORT_LAP_MAX; offset += IMPORT_LAP_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('trace_import_laps')
        // `*` garde la lecture compatible avec une base où la migration des
        // métriques (colonne `average_power_w`) n'est pas encore appliquée :
        // les tours existants restent lisibles au lieu de disparaître.
        .select('*')
        .eq('owner_id', userId)
        .eq('session_id', sessionId)
        .order('lap_index', { ascending: true })
        .range(offset, offset + IMPORT_LAP_PAGE_SIZE - 1);

      if (error) return null;
      const batch = Array.isArray(data) ? (data as TraceImportLapRow[]) : [];
      for (const row of batch) {
        const lap = parseImportLap(row);
        if (lap) laps.push(lap);
      }
      if (batch.length < IMPORT_LAP_PAGE_SIZE) break;
    }
    return laps;
  } catch {
    return null;
  }
}

/**
 * Validation stricte d'une ligne `trace_import_summaries`. Un résumé
 * inattendu est ignoré : on ne fabrique jamais une valeur à partir d'une ligne
 * incomplète. `0` reste une mesure valide.
 */
export function parseImportSummary(
  row: Partial<TraceImportSummaryRow> | null | undefined
): OutingImportSummary | null {
  if (!row) return null;
  const origin =
    typeof row.summary_origin === 'string' ? row.summary_origin.trim() : '';
  if (origin !== 'fit_session') return null;

  const startedAt =
    typeof row.started_at === 'string' && row.started_at.trim() !== ''
      ? row.started_at
      : null;
  if (startedAt !== null && !Number.isFinite(Date.parse(startedAt))) return null;

  const summary: OutingImportSummary = {
    origin: 'fit_session',
    startedAt,
    elapsedSeconds: numericOrNull(row.elapsed_seconds),
    distanceM: numericOrNull(row.distance_m),
    averageSpeedMps: numericOrNull(row.average_speed_mps),
    maxSpeedMps: numericOrNull(row.max_speed_mps),
    caloriesKcal: numericOrNull(row.calories_kcal),
    averageHeartRateBpm: numericOrNull(row.average_heart_rate_bpm),
    maxHeartRateBpm: numericOrNull(row.max_heart_rate_bpm),
    averageCadenceRpm: numericOrNull(row.average_cadence_rpm),
    averageCadenceSpm: numericOrNull(row.average_cadence_spm),
    averagePowerW: numericOrNull(row.average_power_w),
    maxPowerW: numericOrNull(row.max_power_w),
    activityTimerSeconds: numericOrNull(row.activity_timer_seconds),
  };

  const hasMetric = [
    summary.elapsedSeconds,
    summary.distanceM,
    summary.averageSpeedMps,
    summary.maxSpeedMps,
    summary.caloriesKcal,
    summary.averageHeartRateBpm,
    summary.maxHeartRateBpm,
    summary.averageCadenceRpm,
    summary.averageCadenceSpm,
    summary.averagePowerW,
    summary.maxPowerW,
    summary.activityTimerSeconds,
  ].some((value) => value !== null);
  return hasMetric ? summary : null;
}

/**
 * Validation stricte d'une ligne `trace_import_samples`. Une ligne inattendue
 * est ignorée : aucune mesure approximative n'est exposée.
 */
export function parseImportSample(
  row: Partial<TraceImportSampleRow> | null | undefined
): OutingImportSample | null {
  if (!row) return null;

  const index = numericOrNull(row.sample_index);
  if (index === null || !Number.isInteger(index) || index < 0 || index > IMPORT_SAMPLE_MAX - 1) {
    return null;
  }

  const origin =
    typeof row.sample_origin === 'string' ? row.sample_origin.trim().toLowerCase() : '';
  if (origin !== 'device') return null;

  const recordedAt =
    typeof row.recorded_at === 'string' && row.recorded_at.trim() !== ''
      ? row.recorded_at
      : null;
  if (recordedAt !== null && !Number.isFinite(Date.parse(recordedAt))) return null;

  const lapIndexRaw = numericOrNull(row.lap_index);
  const lapIndex =
    lapIndexRaw !== null
    && Number.isInteger(lapIndexRaw)
    && lapIndexRaw >= 0
    && lapIndexRaw <= IMPORT_LAP_INDEX_MAX
      ? lapIndexRaw
      : null;

  return {
    index,
    origin: 'device',
    recordedAt,
    lapIndex,
    distanceM: numericOrNull(row.distance_m),
    altitudeM: numericOrNull(row.altitude_m),
    speedMps: numericOrNull(row.speed_mps),
    heartRateBpm: numericOrNull(row.heart_rate_bpm),
    cadenceRpm: numericOrNull(row.cadence_rpm),
    cadenceSpm: numericOrNull(row.cadence_spm),
    powerW: numericOrNull(row.power_w),
    temperatureC: numericOrNull(row.temperature_c),
  };
}

/**
 * Lit le résumé FIT d'un import pour **son propriétaire uniquement**. Une table
 * absente, une erreur ou un refus retourne `null` : le détail reste lisible.
 */
async function readImportSummary(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<OutingImportSummary | null> {
  try {
    const { data, error } = await supabase
      .from('trace_import_summaries')
      .select(
        'summary_origin,started_at,elapsed_seconds,distance_m,average_speed_mps,'
        + 'max_speed_mps,calories_kcal,average_heart_rate_bpm,max_heart_rate_bpm,'
        + 'average_cadence_rpm,average_cadence_spm,average_power_w,max_power_w,'
        + 'activity_timer_seconds'
      )
      .eq('owner_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) return null;
    return parseImportSummary(data as TraceImportSummaryRow | null);
  } catch {
    return null;
  }
}

/**
 * Lit les mesures de point d'un import pour **son propriétaire uniquement**.
 * La lecture est paginée (plafond PostgREST) jusqu'à 10 000 mesures. Une table
 * absente, une erreur ou un refus retourne `null` ; `[]` signifie que la table
 * est lisible mais ne contient aucune mesure.
 */
async function readImportSamples(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<OutingImportSample[] | null> {
  try {
    const samples: OutingImportSample[] = [];
    for (let offset = 0; offset < IMPORT_SAMPLE_MAX; offset += IMPORT_SAMPLE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('trace_import_samples')
        .select(
          'sample_index,sample_origin,recorded_at,lap_index,distance_m,altitude_m,'
          + 'speed_mps,heart_rate_bpm,cadence_rpm,cadence_spm,power_w,temperature_c'
        )
        .eq('owner_id', userId)
        .eq('session_id', sessionId)
        .order('sample_index', { ascending: true })
        .range(offset, offset + IMPORT_SAMPLE_PAGE_SIZE - 1);

      if (error) return null;
      const batch = Array.isArray(data) ? (data as unknown as TraceImportSampleRow[]) : [];
      for (const row of batch) {
        const sample = parseImportSample(row);
        if (sample) samples.push(sample);
      }
      if (batch.length < IMPORT_SAMPLE_PAGE_SIZE) break;
    }
    return samples;
  } catch {
    return null;
  }
}

export function normalizeVisibility(value: unknown): OutingVisibility {
  if (
    value === 'followers' ||
    value === 'public' ||
    value === 'collective_anonymized'
  ) {
    return value;
  }
  return 'private';
}

export function computeStatus(row: Pick<SessionRow, 'started_at' | 'ended_at'>, now = Date.now()): OutingStatus {
  const start = row.started_at ? Date.parse(row.started_at) : NaN;
  const end = row.ended_at ? Date.parse(row.ended_at) : NaN;
  if (Number.isFinite(start) && start > now) return 'planned';
  if (Number.isFinite(end) && end > now) return 'ongoing';
  return 'done';
}

function pointFromCoordinate(coordinate: unknown): OutingPoint | null {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
  const lng = numericOrNull(coordinate[0]);
  const lat = numericOrNull(coordinate[1]);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    elevationM: coordinate.length > 2 ? numericOrNull(coordinate[2]) : null,
    timestamp: null,
  };
}

function geojsonSegments(value: unknown): OutingPoint[][] {
  if (!value || typeof value !== 'object') return [];
  const geometry = value as {
    type?: unknown;
    coordinates?: unknown;
    geometry?: unknown;
  };
  if (geometry.type === 'Feature') return geojsonSegments(geometry.geometry);

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const points = geometry.coordinates
      .map(pointFromCoordinate)
      .filter((point): point is OutingPoint => point !== null);
    return points.length > 0 ? [points] : [];
  }

  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .map((line) => {
        if (!Array.isArray(line)) return [];
        return line
          .map(pointFromCoordinate)
          .filter((point): point is OutingPoint => point !== null);
      })
      .filter((segment) => segment.length > 0);
  }

  return [];
}

/**
 * Deux formats coexistent en base : `positions_timed` (échantillons horodatés
 * `{lat,lng,timestamp,elevationM}`) et `positions_geojson` (LineString ou
 * MultiLineString). Les morceaux d'un MultiLineString restent séparés : une
 * frontière n'est jamais recollée.
 */
export function parsePositionSegments(timed: unknown, geojson: unknown): OutingPoint[][] {
  const timedPoints: OutingPoint[] = [];

  if (Array.isArray(timed)) {
    for (const sample of timed) {
      if (!sample || typeof sample !== 'object') continue;
      const row = sample as Record<string, unknown>;
      const lat = numericOrNull(row.lat ?? row.latitude);
      const lng = numericOrNull(row.lng ?? row.lon ?? row.longitude);
      if (lat === null || lng === null) continue;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      timedPoints.push({
        lat,
        lng,
        elevationM: numericOrNull(row.elevationM ?? row.altitude ?? row.ele),
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
      });
    }
  }

  if (timedPoints.length > 0) return [timedPoints];
  return geojsonSegments(geojson);
}

/** Points aplatis, pour les consommateurs qui ne dessinent pas de morceaux. */
export function parsePositions(timed: unknown, geojson: unknown): OutingPoint[] {
  return parsePositionSegments(timed, geojson).flat();
}

function displayName(profile: ProfileRow | undefined, fallbackId: string) {
  return (
    profile?.full_name?.trim() ||
    profile?.handle?.trim() ||
    `Voyageur ${fallbackId.slice(0, 4)}`
  );
}

function displayHandle(profile: ProfileRow | undefined, fallbackId: string) {
  return profile?.handle?.trim() || fallbackId.slice(0, 8);
}

/**
 * Vérifie une relation de suivi réelle avant d'accorder le rôle `follower`.
 * La visibilité `friends`/`followers` seule ne prouve jamais l'autorisation.
 */
async function viewerFollowsOwner(
  supabase: SupabaseClient,
  viewerId: string,
  ownerId: string | null
): Promise<boolean> {
  if (!viewerId || !ownerId || viewerId === ownerId) return false;
  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', viewerId)
    .eq('following_id', ownerId)
    .maybeSingle();
  return Boolean((data as { follower_id?: string | null } | null)?.follower_id);
}

function firstCoordinate(points: OutingPoint[]): { lat: number; lon: number } | null {
  if (points.length === 0) return null;
  return { lat: points[0].lat, lon: points[0].lng };
}

async function signedPhotoUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const { data, error } = await supabase.storage
    .from('outing-media')
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function fetchSessionRow(client: SupabaseClient, outingId: string) {
  let res = await client
    .from('hike_sessions')
    .select(
      'id,user_id,route_id,title,started_at,ended_at,distance_km,activity_session_id,duration_seconds,elevation_gain_m,max_altitude_m,positions_timed,positions_geojson,visibility,kit_id,weather,notes,rpe'
    )
    .eq('id', outingId)
    .maybeSingle();

  if (res.error?.code === '42703') {
    // Environnement antérieur au lien capture→résumé : on relit sans la
    // colonne, le sport retombe alors sur « rando ».
    res = await client
      .from('hike_sessions')
      .select(
        'id,user_id,route_id,title,started_at,ended_at,distance_km,duration_seconds,elevation_gain_m,max_altitude_m,positions_timed,positions_geojson,visibility,kit_id,weather,notes'
      )
      .eq('id', outingId)
      .maybeSingle();
  }
  return res;
}

export async function loadOutingDetail(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  options?: {
    /**
     * Politique déjà lue dans un stockage de confiance, pour un appelant qui
     * l'a chargée lui-même. Le chemin de production lit désormais
     * `outing_share_metrics` automatiquement (propriétaire) ou via
     * `service_role` après vérification du rôle (tiers). Cette option sert de
     * surcharge explicite (tests, futur aperçu signé), jamais d'entrée brute.
     */
    metricPolicy?: unknown;
    shareToken?: string | null;
  }
): Promise<OutingDetail | null> {
  const hasRequestedShareToken =
    typeof options?.shareToken === 'string' && options.shareToken.trim().length > 0;
  const resolvedShareToken =
    hasRequestedShareToken && options?.shareToken
      ? await resolveOutingShareToken(options.shareToken)
      : null;

  let readClient: SupabaseClient = supabase;
  let sessionResult = await fetchSessionRow(supabase, outingId);

  if (
    !sessionResult.data &&
    resolvedShareToken &&
    resolvedShareToken.sessionId === outingId &&
    !(await isBlockedBetween(supabase, userId, resolvedShareToken.ownerId))
  ) {
    const service = createServiceClient();
    if (service) {
      const serviceResult = await fetchSessionRow(service, outingId);
      if (serviceResult.data) {
        sessionResult = serviceResult;
        readClient = service;
      }
    }
  }

  const { data: sessionData, error: sessionError } = sessionResult;
  if (sessionError || !sessionData) return null;
  const session = sessionData as SessionRow;
  // La provenance est privée au propriétaire, même si un futur rôle de
  // collaboration élargit un jour `canEdit`.
  const isProvenanceOwner = session.user_id === userId;
  const canEdit = isProvenanceOwner;
  const isOwner = canEdit;
  const rawSessionVisibility = typeof session.visibility === 'string' ? session.visibility : null;
  const blocked = !isOwner ? await isBlockedBetween(supabase, userId, session.user_id) : false;

  const validShareLink = Boolean(
    !isOwner &&
      !blocked &&
      hasRequestedShareToken &&
      resolvedShareToken &&
      resolvedShareToken.sessionId === session.id &&
      resolvedShareToken.ownerId === session.user_id &&
      rawSessionVisibility !== 'private'
  );
  if (!isOwner && hasRequestedShareToken && !validShareLink) {
    return null;
  }

  // Lot A02 — Lecture optionnelle de la surcouche versionnée (cycle de vie,
  // recadrage, corrections, corbeille 30 j). Tolérante aux environnements sans table.
  type LifecycleOverlay = {
    lifecycle_status?: string | null;
    revision?: number | null;
    record?: Partial<LifecycleActivityRecord> | null;
  };
  let lifecycleOverlay: LifecycleOverlay | null = null;
  try {
    const candidateIds = [session.id, session.activity_session_id].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    if (candidateIds.length > 0 && isProvenanceOwner) {
      const { data: overlayData, error: overlayError } = await supabase
        .from('activity_lifecycle_records')
        .select('lifecycle_status,revision,record')
        .eq('user_id', session.user_id)
        .in('activity_id', candidateIds)
        .limit(1)
        .maybeSingle();
      if (!overlayError && overlayData) {
        lifecycleOverlay = overlayData as unknown as LifecycleOverlay;
      }
    }
  } catch {
    lifecycleOverlay = null;
  }
  if (lifecycleOverlay?.lifecycle_status === 'deleted') {
    return null;
  }
  const overlayRecord =
    lifecycleOverlay?.record && typeof lifecycleOverlay.record === 'object'
      ? lifecycleOverlay.record
      : null;

  // Le sport vient de la séance multi-sport liée ou de la surcouche A02.
  let sport = 'rando';
  if (typeof overlayRecord?.sport === 'string' && overlayRecord.sport.trim()) {
    sport = overlayRecord.sport.trim().toLowerCase();
  } else if (session.activity_session_id) {
    const { data: activity } = await readClient
      .from('activity_sessions')
      .select('sport')
      .eq('id', session.activity_session_id)
      .maybeSingle();
    const declared = (activity as { sport?: string | null } | null)?.sport;
    if (typeof declared === 'string' && declared.trim()) sport = declared.trim().toLowerCase();
  }

  const [
    routeRes,
    photoRes,
    participantRes,
    gearRes,
    kudosRes,
    commentRes,
    provenance,
    laps,
    summary,
    samples,
  ] = await Promise.all([
    session.route_id
      ? readClient.from('hiking_routes').select('id,name,region').eq('id', session.route_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    readClient
      .from('hike_session_photos')
      .select('id,storage_path,caption,position')
      .eq('session_id', session.id)
      .order('position', { ascending: true }),
    readClient
      .from('hike_session_participants')
      .select('user_id,role')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
    readClient
      .from('hike_session_gear')
      .select('id,item_name,weight_g,kit_id,gear_item_id')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
    readClient
      .from('hike_session_kudos')
      .select('user_id')
      .eq('session_id', session.id),
    readClient
      .from('hike_session_comments')
      .select('id,user_id,body,created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true }),
    // La provenance et les tours ne sont lus que pour le propriétaire. Un
    // participant ne reçoit jamais le nom du fichier, l'empreinte, la taille
    // source, les tours ni les mesures cardio.
    isProvenanceOwner
      ? readImportProvenance(supabase, userId, session.id)
      : Promise.resolve(null),
    isProvenanceOwner
      ? readImportLaps(supabase, userId, session.id)
      : Promise.resolve(null),
    isProvenanceOwner
      ? readImportSummary(supabase, userId, session.id)
      : Promise.resolve(null),
    isProvenanceOwner
      ? readImportSamples(supabase, userId, session.id)
      : Promise.resolve(null),
  ]);

  const route = routeRes.data as { name?: string | null; region?: string | null } | null;

  const photoRows = (photoRes.data ?? []) as Array<{
    id: string;
    storage_path: string;
    caption: string | null;
    position: number | null;
  }>;
  const photos: OutingPhoto[] = [];
  for (const row of photoRows) {
    const url = await signedPhotoUrl(readClient, row.storage_path);
    if (!url) continue;
    photos.push({
      id: row.id,
      url,
      caption: row.caption,
      position: Number(row.position ?? 0),
    });
  }
  // Une lecture en échec ou des lignes sans URL signable ne sont pas une
  // sortie réellement sans photo : le drawer doit pouvoir le dire.
  const photosUnavailable =
    photoRes.error != null || (photoRows.length > 0 && photos.length === 0);

  const participantRows = (participantRes.data ?? []) as Array<{
    user_id: string;
    role: string | null;
  }>;
  const kudosRows = (kudosRes.data ?? []) as Array<{ user_id: string }>;
  const commentRows = (commentRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    body: string;
    created_at: string;
  }>;

  const profileIds = [
    ...new Set([
      session.user_id,
      ...participantRows.map((row) => row.user_id),
      ...kudosRows.map((row) => row.user_id),
      ...commentRows.map((row) => row.user_id),
    ]),
  ].filter(Boolean);

  const profilesRes = profileIds.length
    ? await readClient.from('public_profiles').select(PROFILE_COLUMNS).in('id', profileIds)
    : { data: [] as ProfileRow[], error: null };
  const profiles = new Map<string, ProfileRow>(
    ((profilesRes.data ?? []) as ProfileRow[]).map((row) => [row.id, row])
  );

  const ownerRow = profiles.get(session.user_id);
  const participants: OutingParticipant[] = [];
  participants.push({
    id: `owner_${session.user_id}`,
    userId: session.user_id,
    name: displayName(ownerRow, session.user_id),
    handle: displayHandle(ownerRow, session.user_id),
    avatarUrl: ownerRow?.avatar_url ?? null,
    role: 'organisateur',
    isOwner: true,
  });
  for (const row of participantRows) {
    if (row.user_id === session.user_id) continue;
    const profile = profiles.get(row.user_id);
    participants.push({
      // La table n'a pas d'id : la clé est (session_id, user_id).
      id: row.user_id,
      userId: row.user_id,
      name: displayName(profile, row.user_id),
      handle: displayHandle(profile, row.user_id),
      avatarUrl: profile?.avatar_url ?? null,
      role: row.role === 'guest' ? 'invité' : row.role || 'invité',
      isOwner: false,
    });
  }

  const kitRes = session.kit_id
    ? await readClient
        .from('materiel_kits')
        .select('id,name,total_weight_g')
        .eq('id', session.kit_id)
        .maybeSingle()
    : { data: null, error: null };
  const kitRow = kitRes.data as { id: string; name: string | null; total_weight_g: number | null } | null;
  const kitItemsRes = session.kit_id
    ? await readClient
        .from('materiel_kit_items')
        .select('name,weight_g')
        .eq('kit_id', session.kit_id)
        .order('created_at', { ascending: true })
    : { data: [] as Array<{ name: string | null; weight_g: number | null }>, error: null };
  const kitItems = (kitItemsRes.data ?? []).map((row) => ({
    name: row.name?.trim() || 'Objet',
    weightG: row.weight_g,
  }));
  const kit: OutingKit | null = kitRow
    ? {
        id: kitRow.id,
        name: kitRow.name?.trim() || 'Kit',
        totalWeightG: kitRow.total_weight_g,
        items: kitItems,
      }
    : null;

  let gearData: unknown[] = gearRes.data ?? [];
  if (
    gearRes.error &&
    (gearRes.error.code === '42703' || /gear_item_id/i.test(gearRes.error.message ?? ''))
  ) {
    // Environnement antérieur à la migration du lot : la sortie reste lisible,
    // simplement sans lien stable vers l'inventaire.
    const retry = await supabase
      .from('hike_session_gear')
      .select('id,item_name,weight_g,kit_id')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
    gearData = retry.data ?? [];
  }

  const gearRows = gearData as Array<{
    id: string;
    item_name: string;
    weight_g: number | null;
    kit_id: string | null;
    gear_item_id: string | null;
  }>;
  const productByName = new Map<
    string,
    {
      photo_url: string | null;
      category: string | null;
      condition: string | null;
      status: string | null;
      listing_mode: string | null;
      is_lent: boolean | null;
      price_cents: number | null;
    }
  >();
  if (canEdit && gearRows.length > 0) {
    const names = Array.from(new Set(gearRows.map((row) => row.item_name.trim()))).filter(Boolean);
    if (names.length > 0) {
      const { data: products } = await supabase
        .from('product_ownership')
        .select('name,photo_url,category,condition,status,listing_mode,is_lent,price_cents')
        .eq('user_id', userId)
        .in('name', names);
      for (const product of (products ?? []) as Array<{
        name: string;
        photo_url: string | null;
        category: string | null;
        condition: string | null;
        status: string | null;
        listing_mode: string | null;
        is_lent: boolean | null;
        price_cents: number | null;
      }>) {
        productByName.set(product.name.trim().toLowerCase(), product);
      }
    }
  }
  const gear: OutingGearItem[] = gearRows.map((row) => {
    const product = productByName.get(row.item_name.trim().toLowerCase());
    return {
      id: row.id,
      name: row.item_name,
      weightG: row.weight_g,
      kitId: row.kit_id,
      gearItemId: row.gear_item_id,
      photoUrl: product?.photo_url ?? null,
      category: product?.category ?? null,
      condition: product?.condition ?? null,
      inventoryStatus: product?.status ?? null,
      listingMode: product?.listing_mode ?? null,
      isLent: product?.is_lent === true,
      priceCents: product?.price_cents ?? null,
    };
  });

  const gearNames = new Set(
    gear.map((item) => item.name.trim().toLowerCase()).filter(Boolean)
  );
  const missingGear =
    gear.length > 0 && kit
      ? kit.items.filter((item) => !gearNames.has(item.name.trim().toLowerCase())).length
      : 0;

  const kudosUsers = kudosRows
    .map((row) => {
      const profile = profiles.get(row.user_id);
      return {
        id: row.user_id,
        name: displayName(profile, row.user_id),
        avatarUrl: profile?.avatar_url ?? null,
      };
    })
    .slice(0, 24);

  const comments: OutingComment[] = commentRows.map((row) => {
    const profile = profiles.get(row.user_id);
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      author: {
        id: row.user_id,
        name: displayName(profile, row.user_id),
        handle: displayHandle(profile, row.user_id),
        avatarUrl: profile?.avatar_url ?? null,
      },
      mine: row.user_id === userId,
    };
  });

  const baseRawSegments = parsePositionSegments(session.positions_timed, session.positions_geojson);
  const overlayPoints = Array.isArray(overlayRecord?.points)
    ? overlayRecord.points
        .filter((pt) => Boolean(pt) && typeof pt.lat === 'number' && typeof pt.lng === 'number')
        .map((pt) => ({
          lat: pt.lat,
          lng: pt.lng,
          elevationM: pt.elevationM ?? null,
          timestamp: pt.timestamp ?? null,
        }))
    : [];
  const rawSegments = overlayPoints.length >= 2 ? [overlayPoints] : baseRawSegments;
  const rawPoints = rawSegments.flat();
  const isParticipant = participantRows.some((row) => row.user_id === userId);

  const rawVisibility = blocked
    ? 'private'
    : typeof overlayRecord?.visibility === 'string'
      ? overlayRecord.visibility
      : rawSessionVisibility;
  const visibility = normalizeVisibility(rawVisibility);
  /*
   * Le rôle de lecture suit une autorisation réelle : propriétaire, participant
   * inscrit, ou abonné vérifié pour une visibilité `friends`/`followers`.
   * Un utilisateur bloqué reste toujours `visitor` avec `rawVisibility = 'private'`.
   */
  const viewer: TraceViewer = isOwner
    ? 'owner'
    : blocked
      ? 'visitor'
      : isParticipant
        ? 'participant'
        : isFollowerTraceVisibility(rawVisibility) &&
            (await viewerFollowsOwner(supabase, userId, session.user_id))
          ? 'follower'
          : validShareLink && rawVisibility === 'followers'
            ? 'follower'
            : 'visitor';
  const hasFullAccess = viewer === 'owner' || viewer === 'participant';
  /*
   * S6.15 — politique de métriques résolue avant toute projection. Le rôle
   * `viewer` vient d'une autorisation réelle ; la politique persistée est lue
   * dans `outing_share_metrics` (propriétaire avec sa session, tiers avec le
   * client service après autorisation). Sans ligne, le socle agrégé déjà publié
   * par un partage explicite s'applique ; sans partage explicite, rien.
   */
  const metricPolicyRead = await readOutingMetricPolicy(
    supabase,
    session.id,
    viewer,
    rawVisibility
  );
  const persistedPolicy =
    options?.metricPolicy !== undefined
      ? options.metricPolicy
      : metricPolicyRead.visibility;
  const metricVisibility = resolveOutingMetricVisibility({
    viewer,
    visibility: rawVisibility,
    policy: persistedPolicy,
  });
  /*
   * Le propriétaire voit toutes les métriques, mais l'interface de réglage a
   * besoin de ses choix réels. Une ligne absente signifie « socle par défaut »,
   * jamais « tout autoriser ».
   */
  const shareMetricVisibility = isOwner
    ? options?.metricPolicy !== undefined
      ? parseMetricVisibility(options.metricPolicy)
      : metricPolicyRead.configured
        ? parseMetricVisibility(metricPolicyRead.visibility)
        : SHARED_SUMMARY_METRICS
    : metricVisibility;
  const [privacyZones, tracePrivacy] = hasFullAccess
    ? [[], null]
    : await Promise.all([
        loadActivePrivacyZonesForProjection(supabase, session.user_id),
        readOutingTracePrivacy(supabase, session.id),
      ]);
  const projection = projectTraceSampleSegments(
    rawSegments,
    resolveTraceMasks({
      viewer,
      visibility: rawVisibility,
      privacyZones,
      tracePrivacy,
    })
  );
  /*
   * Les métadonnées de trace sont retirées quand une métrique masquée
   * permettrait de les déduire (altitude, heure). Les coordonnées, elles, sont
   * déjà projetées par `tracePrivacy` : les deux masquages sont indépendants.
   */
  const traceMetricProjection = projectTraceMetrics(
    projection.segments,
    metricVisibility
  );
  const traceSegments: OutingPoint[][] = traceMetricProjection.segments.map((segment) =>
    segment.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      elevationM: point.elevationM ?? null,
      timestamp: point.timestamp ?? null,
    }))
  );
  const visiblePoints = traceSegments.flat();
  /*
   * Pour un visiteur, `points` reste vide : un ancien consommateur qui ne
   * connaît pas `traceSegments` ne doit pas pouvoir retracer la trace brute.
   * Le propriétaire et les participants gardent leurs points d'origine, avec
   * les mêmes métadonnées projetées.
   */
  const projectedRawPoints =
    projectTraceMetrics([rawPoints], metricVisibility).segments[0] ?? [];
  const points = projection.masked ? [] : projectedRawPoints;

  /*
   * Météo : le propriétaire garde les coordonnées exactes. Un visiteur ne les
   * reçoit jamais, même quand la météo vient du cache stocké — et ne reçoit
   * aucune météo quand la trace est totalement masquée ou ne laisse aucun
   * point visible. Aucun appel tiers n'est fait pour un visiteur.
   */
  const coordinate = firstCoordinate(visiblePoints);
  const stored = parseStoredWeather(session.weather);
  let weather = stored;
  if (hasFullAccess) {
    if (!weather && coordinate) {
      weather = await loadOutingWeather(coordinate.lat, coordinate.lon, session.started_at);
    }
  } else {
    const canSeeStoredWeather =
      !projection.fullyMasked && visiblePoints.length > 0;
    weather = canSeeStoredWeather
      ? weatherForViewer(stored, viewer, rawVisibility)
      : null;
  }

  /*
   * Notes : le propriétaire et les participants les lisent. Un visiteur ne les
   * reçoit que pour une sortie explicitement `collective_anonymized` ; un
   * abonné d'une sortie `friends`/`followers` n'y a pas droit — le partage de
   * la trace ne vaut pas partage du carnet intime.
   */
  const notes =
    hasFullAccess || rawVisibility === 'collective_anonymized'
      ? typeof overlayRecord?.notes === 'string'
        ? overlayRecord.notes
        : text(session.notes)
      : '';

  /*
   * Valeurs sources calculées avant masquage : la politique décide ensuite de
   * ce qui sort. L'allure et le temps en mouvement ne sont jamais recalculés
   * côté client, sinon une métrique masquée pourrait être redérivée.
   */
  const overlayStats = overlayRecord?.stats;
  const rawDistanceKm =
    typeof overlayStats?.distanceM === 'number' && Number.isFinite(overlayStats.distanceM)
      ? Math.round((overlayStats.distanceM / 1000) * 100) / 100
      : numericOrNull(session.distance_km);
  const rawDurationS =
    typeof overlayStats?.movingTimeS === 'number' && Number.isFinite(overlayStats.movingTimeS)
      ? overlayStats.movingTimeS
      : session.duration_seconds;
  const rawElapsedS =
    typeof overlayStats?.elapsedTimeS === 'number' && Number.isFinite(overlayStats.elapsedTimeS)
      ? overlayStats.elapsedTimeS
      : rawDurationS;
  const rawElevationGainM =
    typeof overlayStats?.elevationGainM === 'number' && Number.isFinite(overlayStats.elevationGainM)
      ? overlayStats.elevationGainM
      : numericOrNull(session.elevation_gain_m);
  const rawMaxAltitudeM =
    typeof overlayStats?.maxAltitudeM === 'number' && Number.isFinite(overlayStats.maxAltitudeM)
      ? overlayStats.maxAltitudeM
      : session.max_altitude_m ?? observedMaxAltitudeM(rawPoints);
  const rawMovingTimeS =
    typeof overlayStats?.movingTimeS === 'number' && Number.isFinite(overlayStats.movingTimeS)
      ? overlayStats.movingTimeS
      : movingTimeSeconds(rawPoints);
  const projectedMetrics = projectOutingMetrics(
    {
      distanceKm: rawDistanceKm,
      elevationGainM: rawElevationGainM,
      maxAltitudeM: rawMaxAltitudeM,
      durationS: rawDurationS,
      paceMinPerKm: averagePaceMinPerKm(rawDurationS, rawDistanceKm),
      movingTimeS: rawMovingTimeS,
      /* Aucune source FC/puissance/cadence/calories dans le schéma actuel. */
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      caloriesKcal: null,
    },
    metricVisibility
  );

  const dateLabel = session.started_at ? session.started_at.slice(0, 10) : null;
  const title =
    (typeof overlayRecord?.title === 'string' ? overlayRecord.title.trim() : '') ||
    session.title?.trim() ||
    route?.name?.trim() ||
    (dateLabel ? `Sortie du ${dateLabel}` : 'Sortie');

  return {
    id: session.id,
    title,
    date: dateLabel,
    startedAt: metricVisibility.duration ? session.started_at : null,
    endedAt: metricVisibility.duration ? session.ended_at : null,
    massif: route?.region?.trim() || route?.name?.trim() || null,
    routeName: route?.name?.trim() || null,
    sport,
    km: projectedMetrics.distanceKm,
    dplus: projectedMetrics.elevationGainM,
    maxAlt: projectedMetrics.maxAltitudeM,
    durationS: projectedMetrics.durationS,
    paceMinPerKm: projectedMetrics.paceMinPerKm,
    movingTimeS: projectedMetrics.movingTimeS,
    heartRateBpm: projectedMetrics.heartRateBpm,
    powerW: projectedMetrics.powerW,
    cadenceRpm: projectedMetrics.cadenceRpm,
    caloriesKcal: projectedMetrics.caloriesKcal,
    metricVisibility,
    shareMetricVisibility,
    shareMetricsConfigured: metricPolicyRead.configured,
    metricsMasked: projectedMetrics.masked,
    status: computeStatus(session),
    visibility,
    verified: traceSegments.some((segment) => segment.length >= 2),
    coverUrl: photos[0]?.url ?? null,
    notes,
    rpe: isOwner ? readStoredOutingRpe(session) : null,
    weather,
    photos,
    photosUnavailable,
    participants,
    gear,
    kit,
    missingGear,
    kudos: {
      count: kudosRows.length,
      mine: kudosRows.some((row) => row.user_id === userId),
      users: kudosUsers,
    },
    comments,
    points,
    traceSegments,
    traceMasked: projection.masked,
    traceFullyMasked: projection.fullyMasked,
    traceError: projection.error,
    canEdit,
    provenance,
    // Les tours n'ont de sens que pour un import dont la provenance est lue.
    // Une sortie GPS expose `null`, jamais un tableau vide ambigu.
    laps: provenance ? laps : null,
    // Le résumé et les séries sont privés au propriétaire, comme la provenance
    // et les tours. Un participant reçoit `null`, jamais les mesures cardio.
    summary: provenance ? summary : null,
    samples: provenance ? samples : null,
    elapsedS: metricVisibility.duration ? rawElapsedS : null,
    tags: Array.isArray(overlayRecord?.tags)
      ? overlayRecord.tags.filter((t) => typeof t === 'string')
      : [],
    revision:
      typeof lifecycleOverlay?.revision === 'number'
        ? lifecycleOverlay.revision
        : typeof overlayRecord?.revision === 'number'
          ? overlayRecord.revision
          : null,
    quickEditPending:
      isOwner &&
      Boolean(overlayRecord?.quickEditState?.visible) &&
      overlayRecord?.quickEditState?.status === 'pending',
    correctedMetrics: Boolean(
      overlayRecord?.correction &&
        (overlayRecord.correction.distanceMethod !== 'gps_measured' ||
          overlayRecord.correction.elevationMethod !== 'gps_measured'),
    ),
    gpsSpikesRemoved: Array.isArray(overlayRecord?.gpsSpikes)
      ? overlayRecord.gpsSpikes.length
      : 0,
  };
}

async function assertOwner(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<SessionRow | null> {
  const { data } = await supabase
    .from('hike_sessions')
    .select('id,user_id,kit_id,title,notes,visibility,weather')
    .eq('id', outingId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

export async function updateOuting(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  patch: { title?: string; notes?: string; visibility?: OutingVisibility; rpe?: number | null }
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.slice(0, 120);
  if (patch.notes !== undefined) update.notes = patch.notes.slice(0, 2000);
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.rpe !== undefined) {
    update.rpe = patch.rpe === null ? null : parseValidRpe(patch.rpe);
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase
    .from('hike_sessions')
    .update(update)
    .eq('id', outingId)
    .eq('user_id', userId);
  if (error?.code === '42703' && patch.rpe !== undefined) {
    // Schéma sans colonne `rpe` dédiée : on persiste dans `weather._rpe` sans écraser la météo existante.
    const fallbackUpdate = { ...update };
    delete fallbackUpdate.rpe;
    const baseWeather =
      owner.weather && typeof owner.weather === 'object' && !Array.isArray(owner.weather)
        ? { ...(owner.weather as Record<string, unknown>) }
        : {};
    if (patch.rpe === null) {
      delete baseWeather._rpe;
    } else {
      const validRpe = parseValidRpe(patch.rpe);
      if (validRpe !== null) baseWeather._rpe = validRpe;
    }
    fallbackUpdate.weather = Object.keys(baseWeather).length > 0 ? baseWeather : null;
    const retry = await supabase
      .from('hike_sessions')
      .update(fallbackUpdate)
      .eq('id', outingId)
      .eq('user_id', userId);
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;

  // C-PRIV : repasser une sortie en privé révoque immédiatement les partages actifs du fil.
  if (patch.visibility === 'private') {
    const { data: shareRows } = await supabase
      .from('community_posts')
      .select('id,creation_meta')
      .eq('author_id', userId)
      .contains('creation_meta', { schema: 'lkdv.activity.share.v1', session_id: outingId })
      .limit(10);
    for (const row of (shareRows ?? []) as Array<{ id: string; creation_meta?: unknown }>) {
      const meta = parseActivityShareMeta(row.creation_meta);
      if (meta && isActivityShareActive(meta)) {
        await revokeActivityShare(supabase, row.id, meta);
      }
    }
    await revokeAllOutingShareLinks(supabase, userId, outingId).catch(() => undefined);
    const { compensateActivityProgression } = await import('@/features/progression/server/awardProducer');
    await compensateActivityProgression(userId, 'hike_session', outingId, 'visibility_private');
  }
}

export async function deleteOuting(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { error } = await supabase
    .from('hike_sessions')
    .delete()
    .eq('id', outingId)
    .eq('user_id', userId);
  if (error) throw error;

  // C-REWARD : une sortie supprimée émet une écriture compensatoire unique dans le ledger.
  const { compensateActivityProgression } = await import('@/features/progression/server/awardProducer');
  await compensateActivityProgression(userId, 'hike_session', outingId, 'deleted');
}

export async function toggleKudos(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<{ mine: boolean; count: number }> {
  const { data: existing } = await supabase
    .from('hike_session_kudos')
    .select('user_id')
    .eq('session_id', outingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('hike_session_kudos')
      .delete()
      .eq('session_id', outingId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('hike_session_kudos')
      .insert({ session_id: outingId, user_id: userId });
    if (error) throw error;
  }

  const { count } = await supabase
    .from('hike_session_kudos')
    .select('user_id', { count: 'exact', head: true })
    .eq('session_id', outingId);
  return { mine: !existing, count: count ?? 0 };
}

export async function addComment(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  body: string
): Promise<void> {
  const { error } = await supabase.from('hike_session_comments').insert({
    session_id: outingId,
    user_id: userId,
    body: body.slice(0, 1000),
  });
  if (error) throw error;
}

export async function deleteComment(
  supabase: SupabaseClient,
  userId: string,
  commentId: string
): Promise<void> {
  const { error } = await supabase
    .from('hike_session_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function addParticipant(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  handle: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const cleaned = handle.trim().replace(/^@/, '');
  if (!cleaned) throw new Error('invalid_handle');

  const { data } = await supabase
    .from('public_profiles')
    .select('id')
    .ilike('handle', cleaned)
    .limit(1)
    .maybeSingle();
  const target = data as { id: string } | null;
  if (!target?.id) throw new Error('not_found');
  if (target.id === userId) throw new Error('self');

  const { error } = await supabase
    .from('hike_session_participants')
    .insert({ session_id: outingId, user_id: target.id, role: 'guest' });
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
}

export async function removeParticipant(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  participantId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { error } = await supabase
    .from('hike_session_participants')
    .delete()
    .eq('user_id', participantId)
    .eq('session_id', outingId);
  if (error) throw error;
}

export async function attachKitGear(
  supabase: SupabaseClient,
  userId: string,
  outingId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  if (!owner.kit_id) throw new Error('no_kit');

  const { data: items } = await supabase
    .from('materiel_kit_items')
    .select('name,weight_g')
    .eq('kit_id', owner.kit_id);

  // Lien stable vers l'inventaire quand le nom est unique chez ce propriétaire.
  // Un doublon de nom reste non lié plutôt que d'être associé au hasard.
  const { data: ownedGear } = await supabase
    .from('gear_items')
    .select('id,name')
    .eq('user_id', userId);
  const idsByName = new Map<string, string | null>();
  for (const row of (ownedGear ?? []) as Array<{ id: string; name: string | null }>) {
    const key = row.name?.trim().toLowerCase() || '';
    if (!key) continue;
    idsByName.set(key, idsByName.has(key) ? null : row.id);
  }

  const rows = (items ?? [])
    .map((row: { name: string | null; weight_g: number | null }) => {
      const itemName = row.name?.trim() || 'Objet';
      return {
        session_id: outingId,
        kit_id: owner.kit_id,
        gear_item_id: idsByName.get(itemName.toLowerCase()) ?? null,
        item_name: itemName,
        weight_g: row.weight_g,
      };
    })
    .filter((row) => row.item_name.length > 0);
  if (rows.length === 0) throw new Error('empty_kit');

  await supabase.from('hike_session_gear').delete().eq('session_id', outingId);
  let { error } = await supabase.from('hike_session_gear').insert(rows);
  // Compatibilité avant migration : on ne casse pas le rattachement de kit
  // dans un environnement où la colonne `gear_item_id` n'existe pas encore.
  if (error && (error.code === '42703' || /gear_item_id/i.test(error.message ?? ''))) {
    const legacyRows = rows.map((row) => ({
      session_id: row.session_id,
      kit_id: row.kit_id,
      item_name: row.item_name,
      weight_g: row.weight_g,
    }));
    const retry = await supabase.from('hike_session_gear').insert(legacyRows);
    error = retry.error;
  }
  if (error) throw error;
}

export async function removeGear(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  gearId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { error } = await supabase
    .from('hike_session_gear')
    .delete()
    .eq('id', gearId)
    .eq('session_id', outingId);
  if (error) throw error;
}

export async function addPhoto(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  storagePath: string,
  caption?: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  if (!storagePath.trim()) throw new Error('invalid_path');
  const path = storagePath.trim();
  if (!path.startsWith(`${userId}/`) && !/^https?:\/\//i.test(path)) {
    throw new Error('invalid_path');
  }

  const { data: last } = await supabase
    .from('hike_session_photos')
    .select('position')
    .eq('session_id', outingId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = Number((last as { position?: number } | null)?.position ?? -1) + 1;

  const { error } = await supabase.from('hike_session_photos').insert({
    session_id: outingId,
    user_id: userId,
    storage_path: path,
    caption: caption?.slice(0, 200) || null,
    position,
  });
  if (error) throw error;
}

export async function deletePhoto(
  supabase: SupabaseClient,
  userId: string,
  outingId: string,
  photoId: string
): Promise<void> {
  const owner = await assertOwner(supabase, userId, outingId);
  if (!owner) throw new Error('not_found');
  const { data } = await supabase
    .from('hike_session_photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('session_id', outingId)
    .eq('user_id', userId)
    .maybeSingle();
  const path = (data as { storage_path?: string } | null)?.storage_path;
  const { error } = await supabase
    .from('hike_session_photos')
    .delete()
    .eq('id', photoId)
    .eq('session_id', outingId)
    .eq('user_id', userId);
  if (error) throw error;
  if (path && !/^https?:\/\//i.test(path)) {
    await supabase.storage.from('outing-media').remove([path]).catch(() => undefined);
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Morceaux réellement exportables. `traceSegments` est la source prioritaire :
 * `points` n'est qu'un repli pour les anciens appels de test. Un morceau d'un
 * seul point n'est pas une trace.
 */
export function outingTraceSegments(
  detail: Pick<OutingDetail, 'traceSegments' | 'points'>
): OutingPoint[][] {
  const segments = Array.isArray(detail.traceSegments)
    ? detail.traceSegments
    : detail.traceSegments === undefined
      ? [detail.points]
      : [];
  return segments.filter((segment) => segment.length >= 2);
}

/** GPX 1.1 généré depuis la trace réelle (aucun fichier stocké). */
export function buildGpx(detail: OutingDetail): string {
  const rawSegments = outingTraceSegments(detail);
  /*
   * Défense en profondeur : le DTO est déjà projeté par `loadOutingDetail`,
   * mais un appel direct ne doit pas réintroduire une altitude ou une heure
   * masquée. Sans politique (anciens appels de test), le sérialiseur reste
   * compatible et ne projette rien.
   */
  const segments = detail.metricVisibility
    ? projectTraceMetrics(rawSegments, detail.metricVisibility).segments
    : rawSegments;
  const track = segments
    .map((segment) => {
      const points = segment
        .map((point) => {
          const ele = point.elevationM !== null ? `<ele>${point.elevationM}</ele>` : '';
          const time = point.timestamp ? `<time>${escapeXml(point.timestamp)}</time>` : '';
          return `<trkpt lat="${point.lat}" lon="${point.lng}">${ele}${time}</trkpt>`;
        })
        .join('');
      return `<trkseg>${points}</trkseg>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(detail.title)}</name></metadata>
  <trk><name>${escapeXml(detail.title)}</name>${track}</trk>
</gpx>`;
}

const EARTH_RADIUS_TCX_M = 6_371_000;

function tcxStepMeters(a: OutingPoint, b: OutingPoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_TCX_M * Math.asin(Math.min(1, Math.sqrt(Math.min(1, h))));
}

function tcxSportAttr(sport: string): 'Running' | 'Biking' | 'Other' {
  if (sport === 'course' || sport === 'trail') return 'Running';
  if (sport === 'velo') return 'Biking';
  return 'Other';
}

/**
 * S1.25 / S1.26 — Génère un TCX (TrainingCenterDatabase v2) à partir de la trace
 * visible projetée (`tracePrivacy` + `metricVisibility`), sans fuite pour les tiers.
 *
 * Les mesures capteurs réellement conservées (`samples`, origine `device`) sont
 * émises quand la politique les autorise — `<HeartRateBpm>`, `<Cadence>`,
 * `<Watts>` — et omises quand elles sont masquées. Aucune valeur n'est inventée :
 * sans mesure conservée, aucun élément capteur n'est écrit.
 */
export function buildTcx(detail: OutingDetail): string {
  const rawSegments = outingTraceSegments(detail);
  const segments = detail.metricVisibility
    ? projectTraceMetrics(rawSegments, detail.metricVisibility).segments
    : rawSegments;

  const visibility = detail.metricVisibility;
  const heartRateAllowed = !visibility || visibility.heartRate === true;
  const cadenceAllowed = !visibility || visibility.cadence === true;
  const powerAllowed = !visibility || visibility.power === true;

  // Jointure points ↔ mesures conservées : par horodatage quand il existe,
  // sinon par index quand les deux tableaux s'alignent.
  const samples = Array.isArray(detail.samples) ? detail.samples : [];
  const sampleByTime = new Map<string, (typeof samples)[number]>();
  for (const sample of samples) {
    if (typeof sample.recordedAt === 'string' && sample.recordedAt.length > 0) {
      if (!sampleByTime.has(sample.recordedAt)) sampleByTime.set(sample.recordedAt, sample);
    }
  }
  const flatPoints = segments.flat();
  const indexAligned =
    samples.length > 0 && samples.length === flatPoints.length
    && flatPoints.every((point, i) => {
      const recordedAt = samples[i]?.recordedAt;
      return recordedAt == null || recordedAt === point.timestamp;
    });
  let flatIndex = -1;
  const sampleForPoint = (point: OutingPoint): (typeof samples)[number] | null => {
    flatIndex += 1;
    if (point.timestamp && sampleByTime.has(point.timestamp)) {
      return sampleByTime.get(point.timestamp) ?? null;
    }
    if (indexAligned) return samples[flatIndex] ?? null;
    return null;
  };

  const firstTimestamp =
    segments.flat().find((p) => typeof p.timestamp === 'string' && p.timestamp.length > 0)?.timestamp ??
    detail.startedAt ??
    '1970-01-01T00:00:00.000Z';

  let cumulativeDistanceM = 0;
  let prevPoint: OutingPoint | null = null;
  const tracksXml = segments
    .map((segment) => {
      const tps = segment
        .map((point) => {
          if (prevPoint) cumulativeDistanceM += tcxStepMeters(prevPoint, point);
          prevPoint = point;
          const sample = sampleForPoint(point);
          const heartRate =
            heartRateAllowed && typeof sample?.heartRateBpm === 'number' && Number.isFinite(sample.heartRateBpm)
              ? Math.round(sample.heartRateBpm)
              : null;
          const cadenceRaw =
            cadenceAllowed
              ? (typeof sample?.cadenceRpm === 'number' && Number.isFinite(sample.cadenceRpm)
                ? Math.round(sample.cadenceRpm)
                : typeof sample?.cadenceSpm === 'number' && Number.isFinite(sample.cadenceSpm)
                  ? Math.round(sample.cadenceSpm / 2)
                  : null)
              : null;
          const power =
            powerAllowed && typeof sample?.powerW === 'number' && Number.isFinite(sample.powerW)
              ? Math.round(sample.powerW)
              : null;
          const timeTag = point.timestamp
            ? `<Time>${escapeXml(point.timestamp)}</Time>`
            : '';
          const altTag =
            point.elevationM !== null ? `<AltitudeMeters>${point.elevationM}</AltitudeMeters>` : '';
          const hrTag = heartRate !== null ? `<HeartRateBpm>${heartRate}</HeartRateBpm>` : '';
          const cadTag = cadenceRaw !== null ? `<Cadence>${cadenceRaw}</Cadence>` : '';
          const wattsTag =
            power !== null
              ? `<Extensions><LX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>${power}</Watts></LX></Extensions>`
              : '';
          return `<Trackpoint>${timeTag}<Position><LatitudeDegrees>${point.lat}</LatitudeDegrees><LongitudeDegrees>${point.lng}</LongitudeDegrees></Position>${altTag}<DistanceMeters>${Math.round(cumulativeDistanceM * 10) / 10}</DistanceMeters>${hrTag}${cadTag}${wattsTag}</Trackpoint>`;
        })
        .join('');
      return `<Track>${tps}</Track>`;
    })
    .join('');

  const totalTime =
    typeof detail.durationS === 'number' && Number.isFinite(detail.durationS)
      ? Math.max(0, Math.round(detail.durationS))
      : 0;
  const totalDistanceM =
    typeof detail.km === 'number' && Number.isFinite(detail.km)
      ? Math.round(detail.km * 1000)
      : Math.round(cumulativeDistanceM);

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="${tcxSportAttr(detail.sport ?? 'rando')}">
      <Id>${escapeXml(firstTimestamp)}</Id>
      <Lap StartTime="${escapeXml(firstTimestamp)}">
        <TotalTimeSeconds>${totalTime}</TotalTimeSeconds>
        <DistanceMeters>${totalDistanceM}</DistanceMeters>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        ${tracksXml}
      </Lap>
      <Notes>${escapeXml(detail.title)}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}
