/**
 * S1.08 · Saisie manuelle d'activité (séance rétrospective sans GPS ni import).
 *
 * Permet d'ajouter une sortie passée depuis « Compte → Sorties → ⋯ → Ajouter
 * manuellement » (ou depuis la fiche rééducation S1.12) en réutilisant le
 * contrat de séance (`LocalSessionRecord`, `ActivityState`, `clientSessionId`
 * idempotent) sans inventer aucun point GPS ni aucune métrique capteur.
 *
 * Invariants :
 *   - Séparation entre l'horodatage UTC (`startedAt`, `endedAt`) et la durée
 *     monotone en mouvement (`movingS`).
 *   - Cohérence avec les bornes SQL de `sync_activity_session` (`started_at >=
 *     2000-01-01` et `ended_at <= now()`).
 *   - Rejet des vitesses implicites invraisemblables par sport (même garde-fou
 *     que `ActivityTracker`).
 *   - Même `clientSessionId` conservé en cas de double soumission ou de rejeu
 *     hors ligne : une seule séance est créée côté serveur.
 */

import {
  isUuid,
  LOCAL_SESSION_VERSION,
  newClientSessionId,
  type LocalSessionRecord,
} from '../localSession';
import { AUTO_PAUSE_BY_SPORT, DEFAULT_MAX_PLAUSIBLE_SPEED_MS } from '../tracker';
import { getActivityModeDefinition, toServerPersistenceMapping } from './catalog';
import type {
  ActivityModeSummary,
  DistanceUnit,
  ElevationUnit,
  ServerPersistenceMapping,
  UnitSystem,
} from './types';
import { buildStandardSummaryMetrics, elevationToMeters, toMeters } from './units';

/** Borne inférieure imposée par la RPC `sync_activity_session` (`2000-01-01T00:00:00Z`). */
export const MIN_MANUAL_ACTIVITY_EPOCH_MS = Date.UTC(2000, 0, 1, 0, 0, 0);

/** Durée maximale d'une saisie manuelle (14 jours, couvrant les treks/bivouacs multi-jours). */
export const MAX_MANUAL_DURATION_S = 14 * 24 * 3600;

/** Dénivelé positif maximal plausible sur une séance saisie manuellement (m). */
export const MAX_MANUAL_ELEV_GAIN_M = 20_000;

/** Tolérance d'horloge pour une saisie « à l'instant » (60 s). */
export const MANUAL_CLOCK_TOLERANCE_MS = 60_000;

const FLAT_WATER_VARIANTS = new Set<string>([
  'kayak-riviere',
  'kayak-mer',
  'natation-piscine',
  'natation-eau-libre',
  'rameur-indoor',
  'rehab-aquatique',
]);

export interface ManualActivityInput {
  /** Identifiant de sport (`course`, `rando`, …) ou de variante (`velo-route`, `natation-piscine`, `rehab-marche`, …). */
  sportOrVariant: string;
  /** Début de la séance (ms UTC ou chaîne ISO 8601). */
  startedAt: number | string;
  /** Durée en mouvement (en secondes, strictement positive). */
  durationS: number;
  /** Durée totale écoulée pauses incluses (en secondes, >= `durationS`). Par défaut égale à `durationS`. */
  elapsedS?: number | null;
  /** Distance optionnelle dans l'unité choisie (`distanceUnit`). */
  distance?: number | null;
  distanceUnit?: DistanceUnit;
  /** Dénivelé positif optionnel dans l'unité choisie (`elevationUnit`). */
  elevGain?: number | null;
  elevationUnit?: ElevationUnit;
  /** Titre optionnel de la sortie (1..120 caractères après nettoyage). */
  title?: string | null;
  /** Notes libres optionnelles (0..2000 caractères). */
  notes?: string | null;
  /** Ressenti d'effort (RPE 1 à 10, optionnel). */
  perceivedExertion?: number | null;
  /** Identifiant client stable pour rendre la création idempotente aux rejeux. */
  clientSessionId?: string | null;
}

export type ManualActivityErrorCode =
  | 'unknown_sport_or_variant'
  | 'invalid_started_at'
  | 'started_before_min_epoch'
  | 'ended_in_future'
  | 'invalid_duration'
  | 'elapsed_less_than_moving'
  | 'invalid_distance'
  | 'implausible_speed'
  | 'invalid_elevation'
  | 'elevation_not_applicable'
  | 'invalid_perceived_exertion'
  | 'invalid_title'
  | 'invalid_notes'
  | 'invalid_client_session_id';

export interface NormalizedManualActivity {
  clientSessionId: string;
  mapping: ServerPersistenceMapping;
  startedAtMs: number;
  endedAtMs: number;
  movingS: number;
  elapsedS: number;
  /** `null` lorsque l'utilisateur n'a saisi aucune distance (séance durée seule). */
  distanceM: number | null;
  /** `null` lorsque l'utilisateur n'a saisi aucun D+. */
  elevGainM: number | null;
  title: string | null;
  notes: string | null;
  perceivedExertion: number | null;
}

export type ManualActivityValidationResult =
  | { ok: true; value: NormalizedManualActivity }
  | {
      ok: false;
      code: ManualActivityErrorCode;
      field: keyof ManualActivityInput;
      message: string;
    };

export interface ManualActivityDetails {
  entrySource: 'manual';
  gpsUsed: false;
  importedFile: false;
  title: string | null;
  notes: string | null;
  perceivedExertion: number | null;
  hasExplicitDistance: boolean;
  hasExplicitElevation: boolean;
}

function parseTimestampMs(raw: number | string): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.trunc(raw) : null;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Valide et normalise une saisie manuelle d'activité (S1.08).
 */
export function validateManualActivityInput(
  input: ManualActivityInput,
  nowMs: number = Date.now(),
): ManualActivityValidationResult {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      code: 'unknown_sport_or_variant',
      field: 'sportOrVariant',
      message: 'Sélectionne un sport ou une variante valide.',
    };
  }

  const def = getActivityModeDefinition(input.sportOrVariant);
  const mapping = def ? toServerPersistenceMapping(def) : null;
  if (!def || !mapping || !def.supportsManualEntry) {
    return {
      ok: false,
      code: 'unknown_sport_or_variant',
      field: 'sportOrVariant',
      message: 'Sport ou variante d’activité inconnu.',
    };
  }

  if (
    input.clientSessionId !== undefined &&
    input.clientSessionId !== null &&
    !isUuid(input.clientSessionId)
  ) {
    return {
      ok: false,
      code: 'invalid_client_session_id',
      field: 'clientSessionId',
      message: 'L’identifiant de séance client doit être un UUID valide.',
    };
  }

  const startedAtMs = parseTimestampMs(input.startedAt);
  if (startedAtMs === null) {
    return {
      ok: false,
      code: 'invalid_started_at',
      field: 'startedAt',
      message: 'La date et l’heure de départ sont invalides.',
    };
  }

  if (startedAtMs < MIN_MANUAL_ACTIVITY_EPOCH_MS) {
    return {
      ok: false,
      code: 'started_before_min_epoch',
      field: 'startedAt',
      message: 'La date de la sortie ne peut pas être antérieure au 1er janvier 2000.',
    };
  }

  if (
    typeof input.durationS !== 'number' ||
    !Number.isFinite(input.durationS) ||
    input.durationS <= 0 ||
    input.durationS > MAX_MANUAL_DURATION_S
  ) {
    return {
      ok: false,
      code: 'invalid_duration',
      field: 'durationS',
      message: 'La durée en mouvement doit être comprise entre 1 seconde et 14 jours.',
    };
  }

  const movingS = Math.round(input.durationS);
  const rawElapsedS =
    input.elapsedS === undefined || input.elapsedS === null
      ? movingS
      : Math.round(input.elapsedS);

  if (
    !Number.isFinite(rawElapsedS) ||
    rawElapsedS < movingS ||
    rawElapsedS > MAX_MANUAL_DURATION_S
  ) {
    return {
      ok: false,
      code: 'elapsed_less_than_moving',
      field: 'elapsedS',
      message: 'La durée totale écoulée ne peut pas être inférieure au temps en mouvement.',
    };
  }

  const endedAtMs = startedAtMs + rawElapsedS * 1000;
  if (endedAtMs > nowMs + MANUAL_CLOCK_TOLERANCE_MS) {
    return {
      ok: false,
      code: 'ended_in_future',
      field: 'startedAt',
      message: 'Une sortie saisie manuellement ne peut pas se terminer dans le futur.',
    };
  }

  let distanceM: number | null = null;
  if (input.distance !== undefined && input.distance !== null) {
    if (typeof input.distance !== 'number' || !Number.isFinite(input.distance) || input.distance < 0) {
      return {
        ok: false,
        code: 'invalid_distance',
        field: 'distance',
        message: 'La distance saisie doit être un nombre positif ou nul.',
      };
    }
    const unit: DistanceUnit = input.distanceUnit ?? 'km';
    distanceM = toMeters(input.distance, unit);

    const maxSpeedMs =
      AUTO_PAUSE_BY_SPORT[def.baseSport]?.maxPlausibleSpeedMs ?? DEFAULT_MAX_PLAUSIBLE_SPEED_MS;
    const impliedSpeedMs = distanceM / movingS;
    if (distanceM > 0 && impliedSpeedMs > maxSpeedMs) {
      return {
        ok: false,
        code: 'implausible_speed',
        field: 'distance',
        message: 'La distance saisie dépasse la vitesse maximale plausible pour ce sport.',
      };
    }
  }

  let elevGainM: number | null = null;
  if (input.elevGain !== undefined && input.elevGain !== null) {
    if (typeof input.elevGain !== 'number' || !Number.isFinite(input.elevGain) || input.elevGain < 0) {
      return {
        ok: false,
        code: 'invalid_elevation',
        field: 'elevGain',
        message: 'Le dénivelé positif doit être un nombre positif ou nul.',
      };
    }
    const elevUnit: ElevationUnit = input.elevationUnit ?? 'm';
    elevGainM = elevationToMeters(input.elevGain, elevUnit);

    if (elevGainM > MAX_MANUAL_ELEV_GAIN_M) {
      return {
        ok: false,
        code: 'invalid_elevation',
        field: 'elevGain',
        message: 'Le dénivelé positif saisi dépasse la limite plausible (20 000 m).',
      };
    }

    if (elevGainM > 0 && FLAT_WATER_VARIANTS.has(def.id)) {
      return {
        ok: false,
        code: 'elevation_not_applicable',
        field: 'elevGain',
        message: 'Ce sport aquatique ne comporte pas de dénivelé positif.',
      };
    }
  }

  let perceivedExertion: number | null = null;
  if (input.perceivedExertion !== undefined && input.perceivedExertion !== null) {
    if (
      typeof input.perceivedExertion !== 'number' ||
      !Number.isInteger(input.perceivedExertion) ||
      input.perceivedExertion < 1 ||
      input.perceivedExertion > 10
    ) {
      return {
        ok: false,
        code: 'invalid_perceived_exertion',
        field: 'perceivedExertion',
        message: 'L’effort perçu (RPE) doit être un entier entre 1 et 10.',
      };
    }
    perceivedExertion = input.perceivedExertion;
  }

  let title: string | null = null;
  if (input.title !== undefined && input.title !== null) {
    const trimmed = String(input.title).trim();
    if (trimmed.length > 120) {
      return {
        ok: false,
        code: 'invalid_title',
        field: 'title',
        message: 'Le titre ne peut pas dépasser 120 caractères.',
      };
    }
    title = trimmed.length > 0 ? trimmed : null;
  }

  let notes: string | null = null;
  if (input.notes !== undefined && input.notes !== null) {
    const trimmed = String(input.notes).trim();
    if (trimmed.length > 2000) {
      return {
        ok: false,
        code: 'invalid_notes',
        field: 'notes',
        message: 'Les notes ne peuvent pas dépasser 2 000 caractères.',
      };
    }
    notes = trimmed.length > 0 ? trimmed : null;
  }

  return {
    ok: true,
    value: {
      clientSessionId: input.clientSessionId ?? newClientSessionId(),
      mapping,
      startedAtMs,
      endedAtMs,
      movingS,
      elapsedS: rawElapsedS,
      distanceM,
      elevGainM,
      title,
      notes,
      perceivedExertion,
    },
  };
}

/**
 * Construit le bilan complet et l'enregistrement local `LocalSessionRecord`
 * d'une activité saisie manuellement (S1.08), prêt pour `ExplorerState.summary`
 * et la synchronisation idempotente (`finishSession`).
 */
export function buildManualActivitySummary(
  normalized: NormalizedManualActivity,
  units: UnitSystem = 'metric',
): ActivityModeSummary<ManualActivityDetails> {
  const {
    clientSessionId,
    mapping,
    startedAtMs,
    endedAtMs,
    movingS,
    elapsedS,
    distanceM,
    elevGainM,
    title,
    notes,
    perceivedExertion,
  } = normalized;

  const numericDistanceM = distanceM !== null ? Math.round(distanceM) : 0;
  const numericElevGainM = elevGainM !== null ? Math.round(elevGainM) : 0;

  const activity = {
    sport: mapping.serverSport,
    selection: mapping.selection,
    sessionId: null,
    clientSessionId,
    startedAt: startedAtMs,
    endedAt: endedAtMs,
    paused: false,
    offRoute: false,
    distanceM: numericDistanceM,
    elevGainM: numericElevGainM,
    movingS,
  };

  const localRecord: LocalSessionRecord = {
    version: LOCAL_SESSION_VERSION,
    clientSessionId,
    serverSessionId: null,
    sport: mapping.serverSport,
    selection: mapping.selection,
    startedAt: startedAtMs,
    endedAt: endedAtMs,
    paused: false,
    distanceM: numericDistanceM,
    elevGainM: numericElevGainM,
    movingS,
    lastPointSeq: 0,
    syncedThroughSeq: 0,
    status: 'finished' as const,
    updatedAt: endedAtMs,
  };

  const metrics = buildStandardSummaryMetrics({
    distanceM,
    movingS,
    elevGainM,
    verticalDropM: null,
    heartRateBpm: null,
    powerW: null,
    cadenceRpm: null,
    units,
    sourceStatus: 'manual',
    distanceUnavailableReason: 'no_gps_in_mode',
    elevationUnavailableReason: FLAT_WATER_VARIANTS.has(mapping.selection.variantId)
      ? 'not_applicable_for_sport'
      : 'elevation_missing',
  });

  return {
    modeKind: 'manual',
    variantId: mapping.selection.variantId,
    variantLabel: mapping.selection.variantLabel,
    units,
    activity,
    localRecord,
    elapsedS,
    movingS,
    metrics,
    splits: [],
    mileSplits: [],
    laps: [],
    details: {
      entrySource: 'manual',
      gpsUsed: false,
      importedFile: false,
      title,
      notes,
      perceivedExertion,
      hasExplicitDistance: distanceM !== null,
      hasExplicitElevation: elevGainM !== null,
    },
  };
}

/**
 * Construit les charges utiles exactes pour synchroniser une séance manuelle
 * avec les routes `/api/explorer/v2/activity/start`, `/points` et `/finish`
 * sans aucune modification du backend existant.
 */
export function buildManualSyncPayloads(normalized: NormalizedManualActivity) {
  return {
    startBody: {
      clientSessionId: normalized.clientSessionId,
      sport: normalized.mapping.serverSport,
      variantId: normalized.mapping.serverVariantId,
      routeId: null,
    },
    pointsBody: (serverSessionId: string) => ({
      sessionId: serverSessionId,
      startedAt: normalized.startedAtMs,
      endedAt: normalized.endedAtMs,
      points: [] as never[],
      metrics: {
        distanceM: normalized.distanceM !== null ? Math.round(normalized.distanceM) : 0,
        elevGainM: normalized.elevGainM !== null ? Math.round(normalized.elevGainM) : 0,
        movingS: normalized.movingS,
        paused: false,
      },
    }),
    finishBody: (serverSessionId: string) => ({
      sessionId: serverSessionId,
      idempotencyKey: `activity.finish:${normalized.clientSessionId}`,
    }),
  };
}
