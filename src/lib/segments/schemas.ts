import { z } from 'zod';

/** Schémas d'entrée des routes `/api/segments` (validation systématique). */

export const SEGMENT_SPORTS = [
  'running',
  'trail',
  'cycling',
  'gravel',
  'mtb',
  'hiking',
  'walking',
  'ski',
] as const;

export const SEGMENT_VISIBILITIES = ['public', 'private'] as const;

export const HAZARD_CATEGORIES = [
  'dangerous_road_or_traffic',
  'blind_intersection',
  'steep_technical_descent',
  'trail_closed_or_collapsed',
  'private_property',
  'other_safety_hazard',
] as const;

export const EFFORT_FLAG_CATEGORIES = [
  'motorized_vehicle',
  'gps_glitch_or_shortcut',
  'wrong_activity_type',
  'ebike_in_regular_leaderboard',
] as const;

export const LEADERBOARD_SCOPES = ['community', 'me'] as const;
export const LEADERBOARD_WINDOWS = ['all_time', 'this_year', 'this_month', 'recent_7d'] as const;

const isoDateSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: 'Date ISO invalide',
});

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  ele: z.number().nullable().optional(),
});

const trackPointSchema = geoPointSchema.extend({
  timestamp: isoDateSchema,
  accuracyM: z.number().min(0).nullable().optional(),
  speedMps: z.number().nullable().optional(),
  heartRateBpm: z.number().nullable().optional(),
  powerW: z.number().nullable().optional(),
  cadenceRpm: z.number().nullable().optional(),
  maskedByPrivacyZone: z.boolean().optional(),
});

const pauseSchema = z.object({
  startAt: isoDateSchema,
  endAt: isoDateSchema,
  durationS: z.number().min(0),
});

const privacyZoneSchema = z.object({
  id: z.string().max(120).optional(),
  center: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  radiusM: z.number().min(0).max(50_000),
});

export const activityTraceSchema = z.object({
  activityId: z.string().min(1).max(200),
  activityVersion: z.number().int().min(1),
  userId: z.string().min(1).max(200),
  sport: z.enum(SEGMENT_SPORTS),
  points: z.array(trackPointSchema).min(2).max(100_000),
  pauses: z.array(pauseSchema).max(10_000).optional(),
  visibility: z.enum(['public', 'communaute', 'followers', 'private', 'collective_anonymized']),
  hiddenZones: z.array(privacyZoneSchema).max(500).optional(),
  maskedPointIndices: z.array(z.number().int().min(0)).max(100_000).optional(),
  isManualOrIndoor: z.boolean().optional(),
  ebikeOrAssisted: z.boolean().optional(),
  optOutPublicLeaderboards: z.boolean().optional(),
});

export const createSegmentBodySchema = z.object({
  segmentId: z.string().min(1).max(200).optional(),
  name: z.string().trim().min(3).max(120),
  activity: activityTraceSchema,
  startPointIndex: z.number().int().min(0),
  endPointIndex: z.number().int().min(0),
  visibility: z.enum(SEGMENT_VISIBILITIES),
  sport: z.enum(SEGMENT_SPORTS).optional(),
  surface: z.string().max(80).nullable().optional(),
});

export const updateSegmentBodySchema = z
  .object({
    name: z.string().trim().min(3).max(120).optional(),
    sport: z.enum(SEGMENT_SPORTS).optional(),
    surface: z.string().max(80).nullable().optional(),
    visibility: z.enum(SEGMENT_VISIBILITIES).optional(),
    newBounds: z
      .object({
        activity: activityTraceSchema,
        startPointIndex: z.number().int().min(0),
        endPointIndex: z.number().int().min(0),
      })
      .optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.sport !== undefined ||
      body.surface !== undefined ||
      body.visibility !== undefined ||
      body.newBounds !== undefined,
    { message: 'Aucune modification fournie' }
  );

export const detectEffortsBodySchema = z.object({
  activity: activityTraceSchema,
  segmentIds: z.array(z.string().min(1).max(200)).max(500).optional(),
});

export const hazardReportBodySchema = z.object({
  category: z.enum(HAZARD_CATEGORIES),
  description: z.string().trim().min(5).max(1000),
  officialSource: z.boolean().optional(),
});

export const effortFlagBodySchema = z.object({
  effortId: z.string().min(1).max(200),
  category: z.enum(EFFORT_FLAG_CATEGORIES),
  comment: z.string().trim().min(1).max(500),
});

export const effortContestBodySchema = z.object({
  effortId: z.string().min(1).max(200),
  justification: z.string().trim().min(5).max(1000),
});

export const compareEffortsBodySchema = z.object({
  segmentId: z.string().min(1).max(200),
  candidateEffortId: z.string().min(1).max(200),
  referenceEffortId: z.string().min(1).max(200),
  candidateTrackPoints: z.array(trackPointSchema).max(50_000).optional(),
  referenceTrackPoints: z.array(trackPointSchema).max(50_000).optional(),
  stepsCount: z.number().int().min(2).max(100).optional(),
});

export const preferencesBodySchema = z.object({
  segmentId: z.string().min(1).max(200),
  action: z.enum(['star', 'unstar', 'hide', 'unhide']),
});

const optionalBooleanParam = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => value === 'true' || value === '1');

export const listSegmentsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  sport: z.enum(SEGMENT_SPORTS).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(100_000).optional(),
  includeHidden: optionalBooleanParam,
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const effortsQuerySchema = z.object({
  scope: z.enum(LEADERBOARD_SCOPES).optional(),
  window: z.enum(LEADERBOARD_WINDOWS).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type CreateSegmentBody = z.infer<typeof createSegmentBodySchema>;
export type UpdateSegmentBody = z.infer<typeof updateSegmentBodySchema>;
export type PreferencesBody = z.infer<typeof preferencesBodySchema>;
