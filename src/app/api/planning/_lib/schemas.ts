/**
 * Schémas d'entrée des routes /api/planning.
 *
 * Les routes sont des calculateurs sans persistance : elles appliquent
 * strictement le contrat public `@/features/planning` à un payload fourni par
 * l'appelant. Toute écriture (plan, partage, abonnement) reste de la
 * responsabilité de la couche de stockage appelante.
 */

import { z } from 'zod';
import { isValidTimeZone } from '@/features/planning';

export const sportSchema = z.enum([
  'hiking',
  'trekking',
  'trail',
  'cycling',
  'gravel',
  'bikepacking',
  'mountaineering',
]);

export const routeThemeSchema = z.enum([
  'alpine',
  'coastal',
  'forest',
  'ridge',
  'heritage',
  'lake',
  'desert',
  'glacier',
  'general',
]);

export const shareAudienceSchema = z.enum(['private', 'friends', 'tribu', 'public']);

export const lodgingTypeSchema = z.enum(['refuge', 'hut', 'camp', 'gite', 'hotel', 'bivouac']);

export const officialAlertSeveritySchema = z.enum(['none', 'moderate', 'severe', 'extreme']);

export const weatherDataKindSchema = z.enum(['observation', 'forecast', 'official_alert']);

export const weatherProviderStatusSchema = z.enum([
  'available',
  'unavailable',
  'unconfigured',
  'rate_limited',
]);

export const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Horodatage ISO invalide.',
  });

export const ianaTimeZoneSchema = z
  .string()
  .min(1)
  .refine((value) => isValidTimeZone(value), {
    message: 'Fuseau horaire IANA explicite requis.',
  });

export const gpxTrackPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  eleM: z.number().nullable(),
});

export const lodgingAnchorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: lodgingTypeSchema,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  eleM: z.number().nullable(),
  openMonths: z.array(z.number().int().min(1).max(12)).nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
});

export const stageOfflineCapabilitiesSchema = z.object({
  mapReady: z.boolean(),
  traceReady: z.boolean(),
  guidanceReady: z.boolean(),
  searchReady: z.boolean(),
  rerouteReady: z.boolean(),
});

export const stageRevisionSchema = z.object({
  stageId: z.string().min(1),
  dayNumber: z.number().int().min(1),
  revision: z.number().int().min(1),
  startPointIndex: z.number().int().min(0),
  endPointIndex: z.number().int().min(0),
  startCoord: gpxTrackPointSchema,
  endCoord: gpxTrackPointSchema,
  distanceKm: z.number().min(0),
  elevationGainM: z.number().min(0),
  elevationLossM: z.number().min(0),
  estimatedHours: z.number().min(0),
  endLodging: lodgingAnchorSchema.nullable(),
  points: z.array(gpxTrackPointSchema).min(2),
  offline: stageOfflineCapabilitiesSchema,
  standaloneLaunchable: z.boolean(),
});

export const continuousRouteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  sport: sportSchema,
  theme: routeThemeSchema,
  timezone: ianaTimeZoneSchema,
  points: z.array(gpxTrackPointSchema).min(2),
  ownerId: z.string().min(1),
  audience: shareAudienceSchema,
  revision: z.number().int().min(1),
});

export const multiDayPlanSchema = z.object({
  id: z.string().min(1),
  sourceRouteId: z.string().min(1),
  title: z.string().min(1),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  sport: sportSchema,
  theme: routeThemeSchema,
  timezone: ianaTimeZoneSchema,
  daysCount: z.number().int().min(1),
  revision: z.number().int().min(1),
  ownerId: z.string().min(1),
  audience: shareAudienceSchema,
  publicShareConsented: z.boolean(),
  stages: z.array(stageRevisionSchema).min(1),
  createdAtIso: isoDateTimeSchema,
  updatedAtIso: isoDateTimeSchema,
});

export const viewerContextSchema = z.object({
  viewerId: z.string().min(1).nullable(),
  friendIds: z.array(z.string().min(1)),
  tribuIds: z.array(z.string().min(1)),
  blockedUserIds: z.array(z.string().min(1)),
});

export const parsedPlanCriteriaSchema = z.object({
  countryCode: z.string().regex(/^[A-Za-z]{2}$/).nullable(),
  minDays: z.number().int().min(0).nullable(),
  maxDays: z.number().int().min(0).nullable(),
  theme: routeThemeSchema.nullable(),
  textTerms: z.array(z.string()),
});

export const planSearchQuerySchema = z.object({
  rawQuery: z.string().max(500),
  correctedCriteria: parsedPlanCriteriaSchema.partial().optional(),
  sportFilter: sportSchema.nullable().optional(),
  scrollOffset: z.number().int().min(0).optional(),
});

export const splitRouteOptionsSchema = z
  .object({
    planId: z.string().min(1),
    targetDays: z.number().int().min(1).optional(),
    targetHoursPerDay: z.number().positive().optional(),
    nowIso: isoDateTimeSchema,
    publicShareConsented: z.boolean().optional(),
  })
  .refine(
    (value) => value.targetDays !== undefined || value.targetHoursPerDay !== undefined,
    'targetDays ou targetHoursPerDay est requis.',
  );

export const hourlyWeatherPointSchema = z.object({
  timestampIso: isoDateTimeSchema,
  kind: weatherDataKindSchema,
  tempC: z.number().nullable(),
  precipMm: z.number().min(0).nullable(),
  precipProbabilityPct: z.number().min(0).max(100).nullable(),
  windKmh: z.number().min(0).nullable(),
  gustKmh: z.number().min(0).nullable(),
  freezingLevelM: z.number().nullable(),
  alertSeverity: officialAlertSeveritySchema.optional(),
  alertTitle: z.string().nullable().optional(),
});

export const weatherFeedSnapshotSchema = z.object({
  status: weatherProviderStatusSchema,
  providerName: z.string().min(1).nullable(),
  timezone: ianaTimeZoneSchema,
  fetchedAtIso: isoDateTimeSchema.nullable(),
  maxAgeMinutes: z.number().int().min(0),
  points: z.array(hourlyWeatherPointSchema),
  unavailableReason: z.string().nullable().optional(),
});

export const optimalWindowOptionsSchema = z.object({
  minDurationHours: z.number().positive(),
  maxGustKmh: z.number().positive().optional(),
  maxPrecipMmPerHour: z.number().positive().optional(),
  minTempC: z.number().optional(),
  maxTempC: z.number().optional(),
  maxStageElevationM: z.number().positive().nullable().optional(),
});

export const createShareRequestSchema = z.object({
  shareId: z.string().min(1),
  audience: shareAudienceSchema,
  timezone: ianaTimeZoneSchema,
  createdAtIso: isoDateTimeSchema,
  expiresAtIso: isoDateTimeSchema.nullable().optional(),
  allowedTribeIds: z.array(z.string().min(1)).optional(),
  includeExactStartEndCoords: z.boolean().optional(),
});

export const planShareRecordSchema = z.object({
  shareId: z.string().min(1),
  planId: z.string().min(1),
  ownerId: z.string().min(1),
  audience: shareAudienceSchema,
  timezone: ianaTimeZoneSchema,
  createdAtIso: isoDateTimeSchema,
  expiresAtIso: isoDateTimeSchema.nullable(),
  revokedAtIso: isoDateTimeSchema.nullable(),
  allowedTribeIds: z.array(z.string().min(1)),
  includeExactStartEndCoords: z.boolean(),
});

export const anchorLodgingOptionsSchema = z.object({
  expectedPlanRevision: z.number().int().min(0),
  nowIso: isoDateTimeSchema,
  maxSnapDistanceKm: z.number().positive().optional(),
  stayDateIso: isoDateTimeSchema.nullable().optional(),
});

export const searchPayloadSchema = z.object({
  plans: z.array(multiDayPlanSchema),
  query: planSearchQuerySchema,
  viewer: viewerContextSchema,
});

export const splitPayloadSchema = z.object({
  route: continuousRouteSchema,
  options: splitRouteOptionsSchema,
});

export const boundaryPreviewPayloadSchema = z.object({
  plan: multiDayPlanSchema,
  dayNumber: z.number().int().min(1),
  newEndPointIndex: z.number().int().min(1),
  expectedPlanRevision: z.number().int().min(0),
  lodging: lodgingAnchorSchema.nullable().optional(),
});

export const boundaryCommitPayloadSchema = boundaryPreviewPayloadSchema.extend({
  nowIso: isoDateTimeSchema,
});

export const anchorLodgingPayloadSchema = z.object({
  plan: multiDayPlanSchema,
  dayNumber: z.number().int().min(1),
  lodging: lodgingAnchorSchema,
  options: anchorLodgingOptionsSchema,
});

export const weatherEvaluatePayloadSchema = z.object({
  plan: multiDayPlanSchema,
  feed: weatherFeedSnapshotSchema,
  nowIso: isoDateTimeSchema,
});

export const weatherWindowsPayloadSchema = weatherEvaluatePayloadSchema.extend({
  options: optimalWindowOptionsSchema,
});

export const shareCreatePayloadSchema = z.object({
  plan: multiDayPlanSchema,
  actorId: z.string().min(1),
  request: createShareRequestSchema,
});

export const shareRevokePayloadSchema = z.object({
  record: planShareRecordSchema,
  actorId: z.string().min(1),
  revokedAtIso: isoDateTimeSchema,
});

export const shareAccessPayloadSchema = z.object({
  plan: multiDayPlanSchema,
  share: planShareRecordSchema.nullable(),
  viewer: viewerContextSchema,
  nowIso: isoDateTimeSchema,
});

export const stageLaunchPayloadSchema = z.object({
  plan: multiDayPlanSchema,
  dayNumber: z.number().int().min(1),
  viewer: viewerContextSchema,
  activeSport: sportSchema.nullable().optional(),
});
