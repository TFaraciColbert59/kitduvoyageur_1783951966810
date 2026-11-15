/**
 * S1.12 · Rééducation comme type d'activité.
 *
 * Prend en charge :
 *   - Le type d'activité Rééducation et ses 4 variantes (`rehab-mobilite`,
 *     `rehab-marche`, `rehab-velo-doux`, `rehab-aquatique`).
 *   - La règle de visibilité conditionnelle : affichée dans « Explorer → choix
 *     du sport » uniquement lorsque le mode rééducation est activé.
 *   - Le mapping bidirectionnel avec les activités compatibles du catalogue
 *     LKDV (`explorer_sport_map` et `activity_catalog`).
 *   - La saisie manuelle rétrospective (connectée à S1.08) et l'enregistrement
 *     en direct (avec ou sans GPS, profil d'auto-pause tolérant aux marches
 *     très lentes).
 */

import {
  LOCAL_SESSION_VERSION,
  newClientSessionId,
  type LocalSessionRecord,
} from '../localSession';
import { ActivityTracker, type AutoPauseConfig, type GpsFix } from '../tracker';
import type { Sport } from '../../state/types';
import { getActivityModeDefinition, toServerPersistenceMapping } from './catalog';
import {
  buildManualActivitySummary,
  validateManualActivityInput,
  type ManualActivityErrorCode,
  type ManualActivityInput,
} from './manualActivity';
import type {
  ActivityModeDefinition,
  ActivityModeSummary,
  ServerPersistenceMapping,
  UnitSystem,
} from './types';
import { buildStandardSummaryMetrics } from './units';

export type RehabVariantId =
  | 'rehab-mobilite'
  | 'rehab-marche'
  | 'rehab-velo-doux'
  | 'rehab-aquatique';

export type RehabBodyZone =
  | 'genou'
  | 'cheville'
  | 'hanche'
  | 'epaule'
  | 'dos'
  | 'cardio'
  | 'autre';

export const REHAB_STORAGE_KEY = 'lkdv:explorer-v2:rehab-mode-enabled';

/**
 * Profil d'auto-pause adapté à la marche thérapeutique / rééducation :
 *   - reprise dès 0,15 m/s (0,54 km/h) pour ne jamais geler un marcheur en
 *     rééducation ou béquilles ;
 *   - délai de 240 s (4 min) avant mise en pause automatique.
 */
export const REHAB_WALK_AUTO_PAUSE_CONFIG: AutoPauseConfig = {
  enabled: true,
  speedThresholdMs: 0.1,
  durationS: 240,
  resumeSpeedThresholdMs: 0.15,
  resumeDurationS: 4,
  maxFixGapS: 180,
  maxPlausibleSpeedMs: 4.5,
};

export interface RehabCompatibleMapping {
  rehabVariantId: RehabVariantId;
  label: string;
  baseSport: Sport;
  catalogSlug: string;
  serverVariantId: string | null;
  compatibleSourceVariants: readonly string[];
  allowsOutdoorGps: boolean;
}

export const REHAB_COMPATIBLE_MAPPINGS: Readonly<Record<RehabVariantId, RehabCompatibleMapping>> = {
  'rehab-mobilite': {
    rehabVariantId: 'rehab-mobilite',
    label: 'Rééducation · Mobilité & kiné',
    baseSport: 'famille',
    catalogSlug: 'rando-famille',
    serverVariantId: null,
    compatibleSourceVariants: [
      'rehab-mobilite',
      'escalade-salle',
      'escalade-bloc',
      'escalade-voie',
      'bivouac-1n',
    ],
    allowsOutdoorGps: false,
  },
  'rehab-marche': {
    rehabVariantId: 'rehab-marche',
    label: 'Rééducation · Marche thérapeutique',
    baseSport: 'famille',
    catalogSlug: 'rando-famille',
    serverVariantId: 'famille-balade',
    compatibleSourceVariants: [
      'rehab-marche',
      'famille-balade',
      'famille-poussette',
      'rando-matin',
      'rando-journee',
      'course-route',
      'course-tapis',
      'trail-10k',
    ],
    allowsOutdoorGps: true,
  },
  'rehab-velo-doux': {
    rehabVariantId: 'rehab-velo-doux',
    label: 'Rééducation · Vélo ergonomique',
    baseSport: 'velo',
    catalogSlug: 'velo-route',
    serverVariantId: null,
    compatibleSourceVariants: [
      'rehab-velo-doux',
      'velo-home-trainer',
      'velo-virtuel',
      'velo-route',
      'velo-gravel',
    ],
    allowsOutdoorGps: false,
  },
  'rehab-aquatique': {
    rehabVariantId: 'rehab-aquatique',
    label: 'Rééducation · Balnéothérapie',
    baseSport: 'kayak',
    catalogSlug: 'canoe-journee',
    serverVariantId: null,
    compatibleSourceVariants: [
      'rehab-aquatique',
      'natation-piscine',
      'natation-eau-libre',
      'kayak-riviere',
      'kayak-mer',
      'rameur-indoor',
    ],
    allowsOutdoorGps: false,
  },
};

const VALID_BODY_ZONES: ReadonlySet<string> = new Set<RehabBodyZone>([
  'genou',
  'cheville',
  'hanche',
  'epaule',
  'dos',
  'cardio',
  'autre',
]);

/**
 * Retourne les définitions de rééducation visibles selon l'état d'activation
 * du mode rééducation (S1.12).
 */
export function getVisibleRehabDefinitions(rehabEnabled: boolean): ActivityModeDefinition[] {
  if (!rehabEnabled) return [];
  const ids: RehabVariantId[] = [
    'rehab-mobilite',
    'rehab-marche',
    'rehab-velo-doux',
    'rehab-aquatique',
  ];
  return ids
    .map((id) => getActivityModeDefinition(id))
    .filter((def): def is ActivityModeDefinition => def !== null);
}

/**
 * Associe un sport ou une variante quelconque du catalogue LKDV au profil de
 * rééducation compatible (S1.12).
 */
export function mapActivityToRehabVariant(sportOrVariant: string): RehabCompatibleMapping | null {
  if (!sportOrVariant || typeof sportOrVariant !== 'string') return null;

  if (sportOrVariant in REHAB_COMPATIBLE_MAPPINGS) {
    return REHAB_COMPATIBLE_MAPPINGS[sportOrVariant as RehabVariantId];
  }

  for (const mapping of Object.values(REHAB_COMPATIBLE_MAPPINGS)) {
    if (mapping.compatibleSourceVariants.includes(sportOrVariant)) {
      return mapping;
    }
  }

  // Correspondance directe par identifiant `Sport`
  switch (sportOrVariant as Sport) {
    case 'famille':
    case 'rando':
    case 'course':
    case 'trail':
      return REHAB_COMPATIBLE_MAPPINGS['rehab-marche'];
    case 'velo':
      return REHAB_COMPATIBLE_MAPPINGS['rehab-velo-doux'];
    case 'kayak':
      return REHAB_COMPATIBLE_MAPPINGS['rehab-aquatique'];
    case 'escalade':
    case 'ski':
    case 'bivouac':
      return REHAB_COMPATIBLE_MAPPINGS['rehab-mobilite'];
    default:
      return null;
  }
}

export interface RehabActivityInput extends Omit<ManualActivityInput, 'sportOrVariant'> {
  rehabVariant?: RehabVariantId | string;
  /** Niveau de douleur ou d'inconfort ressenti déclaré par l'utilisateur (0 à 10, optionnel). */
  painLevel?: number | null;
  /** Score de mobilité/aisance déclaré par l'utilisateur (1 à 5, optionnel). */
  mobilityScore?: number | null;
  /** Zone corporelle ciblée par la séance (optionnelle). */
  bodyZone?: RehabBodyZone | null;
  /** Vrai si la séance est encadrée par un kinésithérapeute / soignant. */
  supervisedByPractitioner?: boolean;
}

export type RehabValidationErrorCode =
  | ManualActivityErrorCode
  | 'invalid_rehab_variant'
  | 'invalid_pain_level'
  | 'invalid_mobility_score'
  | 'invalid_body_zone';

export interface RehabActivityDetails {
  rehabVariantId: RehabVariantId;
  mappedBaseSport: Sport;
  mappedCatalogSlug: string;
  entrySource: 'manual' | 'live';
  gpsUsed: boolean;
  painLevel: number | null;
  mobilityScore: number | null;
  bodyZone: RehabBodyZone | null;
  supervisedByPractitioner: boolean;
  perceivedExertion: number | null;
  notes: string | null;
}

export type RehabManualValidationResult =
  | {
      ok: true;
      summary: ActivityModeSummary<RehabActivityDetails>;
    }
  | {
      ok: false;
      code: RehabValidationErrorCode;
      message: string;
    };

function validateRehabFeedback(input: {
  painLevel?: number | null;
  mobilityScore?: number | null;
  bodyZone?: RehabBodyZone | null;
}):
  | {
      ok: true;
      painLevel: number | null;
      mobilityScore: number | null;
      bodyZone: RehabBodyZone | null;
    }
  | { ok: false; code: RehabValidationErrorCode; message: string } {
  let painLevel: number | null = null;
  if (input.painLevel !== undefined && input.painLevel !== null) {
    if (
      typeof input.painLevel !== 'number' ||
      !Number.isInteger(input.painLevel) ||
      input.painLevel < 0 ||
      input.painLevel > 10
    ) {
      return {
        ok: false,
        code: 'invalid_pain_level',
        message: 'Le niveau de douleur déclaré doit être un entier compris entre 0 et 10.',
      };
    }
    painLevel = input.painLevel;
  }

  let mobilityScore: number | null = null;
  if (input.mobilityScore !== undefined && input.mobilityScore !== null) {
    if (
      typeof input.mobilityScore !== 'number' ||
      !Number.isInteger(input.mobilityScore) ||
      input.mobilityScore < 1 ||
      input.mobilityScore > 5
    ) {
      return {
        ok: false,
        code: 'invalid_mobility_score',
        message: 'Le score de mobilité doit être un entier compris entre 1 et 5.',
      };
    }
    mobilityScore = input.mobilityScore;
  }

  let bodyZone: RehabBodyZone | null = null;
  if (input.bodyZone !== undefined && input.bodyZone !== null) {
    if (typeof input.bodyZone !== 'string' || !VALID_BODY_ZONES.has(input.bodyZone)) {
      return {
        ok: false,
        code: 'invalid_body_zone',
        message: 'La zone corporelle de rééducation est invalide.',
      };
    }
    bodyZone = input.bodyZone as RehabBodyZone;
  }

  return { ok: true, painLevel, mobilityScore, bodyZone };
}

/**
 * Valide et construit une séance de rééducation saisie manuellement (S1.12 + S1.08).
 */
export function createManualRehabActivity(
  input: RehabActivityInput,
  options: { nowMs?: number; units?: UnitSystem } = {},
): RehabManualValidationResult {
  const mapped = mapActivityToRehabVariant(input.rehabVariant ?? 'rehab-mobilite');
  if (!mapped) {
    return {
      ok: false,
      code: 'invalid_rehab_variant',
      message: 'Variante ou sport de rééducation inconnu.',
    };
  }

  const feedback = validateRehabFeedback(input);
  if (!feedback.ok) return feedback;

  const validatedManual = validateManualActivityInput(
    {
      ...input,
      sportOrVariant: mapped.rehabVariantId,
    },
    options.nowMs ?? Date.now(),
  );

  if (!validatedManual.ok) {
    return {
      ok: false,
      code: validatedManual.code,
      message: validatedManual.message,
    };
  }

  const baseSummary = buildManualActivitySummary(
    validatedManual.value,
    options.units ?? 'metric',
  );

  return {
    ok: true,
    summary: {
      ...baseSummary,
      modeKind: 'rehab',
      details: {
        rehabVariantId: mapped.rehabVariantId,
        mappedBaseSport: mapped.baseSport,
        mappedCatalogSlug: mapped.catalogSlug,
        entrySource: 'manual',
        gpsUsed: false,
        painLevel: feedback.painLevel,
        mobilityScore: feedback.mobilityScore,
        bodyZone: feedback.bodyZone,
        supervisedByPractitioner: input.supervisedByPractitioner === true,
        perceivedExertion: validatedManual.value.perceivedExertion,
        notes: validatedManual.value.notes,
      },
    },
  };
}

/**
 * Moteur de séance de rééducation en direct (S1.12), avec ou sans GPS.
 */
export class RehabSessionEngine {
  readonly clientSessionId: string;
  readonly rehabMapping: RehabCompatibleMapping;
  readonly persistenceMapping: ServerPersistenceMapping;
  readonly startedAtMs: number;

  private readonly tracker: ActivityTracker;
  private lastTickMs: number;
  private movingS = 0;
  private pausedS = 0;
  private isPaused = false;
  private acceptedFixCount = 0;

  constructor(options: {
    rehabVariant?: RehabVariantId | string;
    startedAtMs?: number;
    clientSessionId?: string;
  } = {}) {
    const rehabMapping =
      mapActivityToRehabVariant(options.rehabVariant ?? 'rehab-mobilite') ??
      REHAB_COMPATIBLE_MAPPINGS['rehab-mobilite'];
    const def = getActivityModeDefinition(rehabMapping.rehabVariantId)!;
    this.rehabMapping = rehabMapping;
    this.persistenceMapping = toServerPersistenceMapping(def)!;
    this.clientSessionId = options.clientSessionId ?? newClientSessionId();
    this.startedAtMs = options.startedAtMs ?? Date.now();
    this.lastTickMs = this.startedAtMs;
    this.tracker = new ActivityTracker(REHAB_WALK_AUTO_PAUSE_CONFIG);
  }

  tick(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs <= this.lastTickMs) return;
    const dtS = (nowMs - this.lastTickMs) / 1000;
    this.lastTickMs = nowMs;
    if (this.isPaused) {
      this.pausedS += dtS;
    } else {
      this.movingS += dtS;
    }
  }

  pause(nowMs?: number): void {
    if (typeof nowMs === 'number') this.tick(nowMs);
    this.isPaused = true;
    this.tracker.breakContinuity();
  }

  resume(nowMs?: number): void {
    if (typeof nowMs === 'number') this.tick(nowMs);
    this.isPaused = false;
  }

  addFix(fix: GpsFix) {
    if (!this.rehabMapping.allowsOutdoorGps || this.isPaused) {
      return this.tracker.state;
    }
    const state = this.tracker.addFix(fix);
    if (state.accepted) {
      this.acceptedFixCount += 1;
      if (fix.t > this.lastTickMs) {
        this.lastTickMs = fix.t;
      }
    }
    return state;
  }

  finish(
    options: {
      endedAtMs?: number;
      units?: UnitSystem;
      painLevel?: number | null;
      mobilityScore?: number | null;
      bodyZone?: RehabBodyZone | null;
      supervisedByPractitioner?: boolean;
      perceivedExertion?: number | null;
      notes?: string | null;
    } = {},
  ): ActivityModeSummary<RehabActivityDetails> {
    if (typeof options.endedAtMs === 'number') {
      this.tick(options.endedAtMs);
    }

    const trackerState = this.tracker.state;
    const gpsUsed = this.acceptedFixCount > 0;
    const effectiveMovingS = Math.max(
      1,
      Math.round(gpsUsed ? Math.max(trackerState.movingS, this.movingS) : this.movingS),
    );
    const effectiveElapsedS = Math.max(
      effectiveMovingS,
      Math.round(this.movingS + this.pausedS),
    );
    const finalEndedAtMs =
      typeof options.endedAtMs === 'number' && options.endedAtMs >= this.startedAtMs
        ? options.endedAtMs
        : this.startedAtMs + effectiveElapsedS * 1000;

    const distanceM = gpsUsed ? trackerState.distanceM : null;
    const elevGainM = gpsUsed ? trackerState.elevGainM : null;
    const units = options.units ?? 'metric';

    const feedback = validateRehabFeedback({
      painLevel: options.painLevel,
      mobilityScore: options.mobilityScore,
      bodyZone: options.bodyZone,
    });

    const metrics = buildStandardSummaryMetrics({
      distanceM,
      movingS: effectiveMovingS,
      elevGainM,
      verticalDropM: null,
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      units,
      sourceStatus: 'measured',
      distanceUnavailableReason: 'no_gps_in_mode',
      elevationUnavailableReason: 'no_gps_in_mode',
    });

    const numericDistanceM = distanceM !== null ? Math.round(distanceM) : 0;
    const numericElevGainM = elevGainM !== null ? Math.round(elevGainM) : 0;

    const activity = {
      sport: this.persistenceMapping.serverSport,
      selection: this.persistenceMapping.selection,
      sessionId: null,
      clientSessionId: this.clientSessionId,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      offRoute: false,
      distanceM: numericDistanceM,
      elevGainM: numericElevGainM,
      movingS: effectiveMovingS,
      ...(gpsUsed
        ? {
            splits: trackerState.splits,
            mileSplits: trackerState.mileSplits,
            laps: trackerState.laps,
          }
        : {}),
    };

    const localRecord: LocalSessionRecord = {
      version: LOCAL_SESSION_VERSION,
      clientSessionId: this.clientSessionId,
      serverSessionId: null,
      sport: this.persistenceMapping.serverSport,
      selection: this.persistenceMapping.selection,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      distanceM: numericDistanceM,
      elevGainM: numericElevGainM,
      movingS: effectiveMovingS,
      lastPointSeq: this.acceptedFixCount,
      syncedThroughSeq: 0,
      status: 'finished' as const,
      updatedAt: finalEndedAtMs,
    };

    return {
      modeKind: 'rehab',
      variantId: this.persistenceMapping.selection.variantId,
      variantLabel: this.persistenceMapping.selection.variantLabel,
      units,
      activity,
      localRecord,
      elapsedS: effectiveElapsedS,
      movingS: effectiveMovingS,
      metrics,
      splits: gpsUsed ? trackerState.splits : [],
      mileSplits: gpsUsed ? trackerState.mileSplits : [],
      laps: gpsUsed ? trackerState.laps : [],
      details: {
        rehabVariantId: this.rehabMapping.rehabVariantId,
        mappedBaseSport: this.rehabMapping.baseSport,
        mappedCatalogSlug: this.rehabMapping.catalogSlug,
        entrySource: 'live',
        gpsUsed,
        painLevel: feedback.ok ? feedback.painLevel : null,
        mobilityScore: feedback.ok ? feedback.mobilityScore : null,
        bodyZone: feedback.ok ? feedback.bodyZone : null,
        supervisedByPractitioner: options.supervisedByPractitioner === true,
        perceivedExertion:
          typeof options.perceivedExertion === 'number' &&
          Number.isInteger(options.perceivedExertion) &&
          options.perceivedExertion >= 1 &&
          options.perceivedExertion <= 10
            ? options.perceivedExertion
            : null,
        notes:
          typeof options.notes === 'string' && options.notes.trim().length > 0
            ? options.notes.trim().slice(0, 2000)
            : null,
      },
    };
  }
}
