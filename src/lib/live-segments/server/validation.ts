/**
 * Lot S03-UI — validation serveur des efforts et des capacités appareil.
 *
 * Le client ne fait jamais autorité : un effort reçu est rejoué contre le
 * segment réel (version, sport, sens, couverture, vitesse plausible) avant
 * de recevoir un verdict. Les drapeaux `isValidForLeaderboard`, `beatPr` et
 * `beatKom` sont recalculés ici, jamais recopiés du corps de requête.
 */

import { z } from 'zod';
import {
  DEFAULT_LIVE_SEGMENT_THRESHOLDS,
  type EffortInvalidationReason,
  type FinalSegmentEffort,
  type GhostProfile,
  type LiveSegmentDefinition,
  type LiveSegmentThresholds,
  type SportType,
} from '@/features/live-segments';

export const SPORT_TYPES = [
  'cycling',
  'running',
  'hiking',
  'trail',
  'gravel',
] as const satisfies readonly SportType[];

export const INVALIDATION_REASONS = [
  'gps_lost_during_effort',
  'gps_teleport_detected',
  'insufficient_coverage',
  'off_route_aborted',
  'paused_during_effort',
] as const satisfies readonly EffortInvalidationReason[];

export const EffortSubmissionSchema = z
  .object({
    effortId: z.string().min(1).max(240),
    segmentId: z.string().min(1).max(160),
    segmentVersion: z.number().int().nonnegative(),
    sport: z.enum(SPORT_TYPES),
    direction: z.enum(['forward', 'reverse']),
    startedAtMs: z.number().int().positive(),
    finishedAtMs: z.number().int().positive(),
    elapsedMs: z.number().int().positive(),
    distanceCoveredM: z.number().finite().nonnegative(),
    coverageRatio: z.number().finite().min(0).max(1),
    isValidForLeaderboard: z.boolean(),
    invalidationReason: z.enum(INVALIDATION_REASONS).optional(),
    beatPr: z.boolean(),
    beatKom: z.boolean(),
    queuedForSync: z.boolean(),
  })
  .strict();

export type EffortSubmission = z.infer<typeof EffortSubmissionSchema>;

export const DeviceCapabilitySchema = z
  .object({
    deviceId: z.string().min(1).max(160),
    deviceName: z.string().min(1).max(160),
    platform: z.enum([
      'garmin_connect',
      'wahoo_elemnt',
      'hammerhead_karoo',
      'apple_watch',
      'wear_os',
      'web_unsupported',
    ]),
    supportsLiveSegments: z.boolean(),
    maxSyncedSegments: z.number().int().min(0).max(500),
    supportedSports: z.array(z.enum(SPORT_TYPES)).max(5),
    hasPermission: z.boolean(),
    isOnline: z.boolean(),
  })
  .strict();

export type DeviceCapabilityInput = z.infer<typeof DeviceCapabilitySchema>;

export const DeviceSyncRequestSchema = z
  .object({
    device: DeviceCapabilitySchema,
    segmentIds: z.array(z.string().min(1).max(160)).min(1).max(100),
    preferredGhostKind: z.enum(['pr', 'kom', 'qom', 'target', 'friend']).optional(),
    optedIn: z.boolean().default(true),
  })
  .strict();

export type DeviceSyncRequest = z.infer<typeof DeviceSyncRequestSchema>;

export const ListQuerySchema = z
  .object({
    lat: z.coerce.number().finite().min(-90).max(90).optional(),
    lon: z.coerce.number().finite().min(-180).max(180).optional(),
    radius: z.coerce.number().finite().min(100).max(200_000).optional(),
    sport: z.enum(SPORT_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    optIn: z.enum(['0', '1']).optional(),
  })
  .strict();

export type ListQuery = z.infer<typeof ListQuerySchema>;

export type EffortValidationResult =
  | { ok: true; effort: FinalSegmentEffort }
  | { ok: false; code: string; message: string };

const INVALIDATION_PRIORITY: readonly EffortInvalidationReason[] = [
  'gps_teleport_detected',
  'gps_lost_during_effort',
  'off_route_aborted',
  'paused_during_effort',
  'insufficient_coverage',
];

function pickInvalidation(
  reasons: readonly EffortInvalidationReason[],
): EffortInvalidationReason | undefined {
  for (const reason of INVALIDATION_PRIORITY) {
    if (reasons.includes(reason)) return reason;
  }
  return reasons[0];
}

function ghostFor(
  ghosts: readonly GhostProfile[],
  kinds: readonly GhostProfile['kind'][],
): GhostProfile | null {
  for (const kind of kinds) {
    const match = ghosts.find((ghost) => ghost.kind === kind);
    if (match) return match;
  }
  return null;
}

/**
 * Rejoue l'effort contre la définition du segment et scelle un verdict serveur.
 *
 * Un effort déclaré valide mais qui ne l'est pas (couverture insuffisante,
 * vitesse invraisemblable) n'est pas rejeté : il est renvoyé invalidé, ce qui
 * évite de perdre la sortie de l'utilisateur tout en empêchant un faux KOM.
 */
export function validateEffortSubmission(
  submission: EffortSubmission,
  segment: LiveSegmentDefinition,
  thresholds: LiveSegmentThresholds = DEFAULT_LIVE_SEGMENT_THRESHOLDS,
): EffortValidationResult {
  if (submission.segmentId !== segment.id) {
    return { ok: false, code: 'segment_mismatch', message: 'Segment inconnu pour cet effort.' };
  }
  if (submission.segmentVersion !== segment.version) {
    return {
      ok: false,
      code: 'segment_version_mismatch',
      message: 'La version du segment a changé ; l’effort ne peut pas être rattaché.',
    };
  }
  if (submission.sport !== segment.sport) {
    return { ok: false, code: 'sport_mismatch', message: 'Sport incompatible avec le segment.' };
  }
  if (segment.direction !== 'bidirectional' && submission.direction !== segment.direction) {
    return {
      ok: false,
      code: 'direction_mismatch',
      message: 'Sens de parcours incompatible avec le segment.',
    };
  }
  if (submission.finishedAtMs < submission.startedAtMs) {
    return { ok: false, code: 'invalid_timestamps', message: 'Horodatage de fin antérieur au départ.' };
  }

  const wallClockMs = submission.finishedAtMs - submission.startedAtMs;
  // Une pause rend `elapsedMs` inférieur au temps mural ; l'inverse est impossible.
  if (submission.elapsedMs > wallClockMs + 2_000) {
    return {
      ok: false,
      code: 'invalid_timestamps',
      message: 'Durée d’effort supérieure au temps écoulé entre départ et arrivée.',
    };
  }

  const totalDistanceM = Math.max(1, segment.totalDistanceM);
  if (submission.distanceCoveredM > totalDistanceM * 1.05) {
    return {
      ok: false,
      code: 'invalid_distance',
      message: 'Distance parcourue supérieure à la longueur du segment.',
    };
  }

  const computedCoverage = Math.min(1, submission.distanceCoveredM / totalDistanceM);
  const reasons: EffortInvalidationReason[] = [];
  if (submission.invalidationReason) reasons.push(submission.invalidationReason);
  if (computedCoverage < thresholds.minCoverageRatio) reasons.push('insufficient_coverage');

  const impliedSpeedMps = submission.distanceCoveredM / (submission.elapsedMs / 1000);
  if (impliedSpeedMps > thresholds.maxPlausibleSpeedMps) {
    reasons.push('gps_teleport_detected');
  }

  const invalidationReason = pickInvalidation(reasons);
  const isValidForLeaderboard = invalidationReason === undefined;

  const prGhost = ghostFor(segment.ghostProfiles, ['pr']);
  const komGhost = ghostFor(segment.ghostProfiles, ['kom', 'qom']);
  const beatPr =
    isValidForLeaderboard && prGhost ? submission.elapsedMs < prGhost.totalTimeMs : false;
  const beatKom =
    isValidForLeaderboard && komGhost ? submission.elapsedMs < komGhost.totalTimeMs : false;

  const effort: FinalSegmentEffort = {
    effortId: submission.effortId,
    segmentId: segment.id,
    segmentVersion: segment.version,
    sport: segment.sport,
    direction: submission.direction,
    startedAtMs: submission.startedAtMs,
    finishedAtMs: submission.finishedAtMs,
    elapsedMs: submission.elapsedMs,
    distanceCoveredM: Number(submission.distanceCoveredM.toFixed(2)),
    coverageRatio: Number(computedCoverage.toFixed(4)),
    isValidForLeaderboard,
    ...(invalidationReason ? { invalidationReason } : {}),
    beatPr,
    beatKom,
    queuedForSync: submission.queuedForSync,
  };

  return { ok: true, effort };
}
