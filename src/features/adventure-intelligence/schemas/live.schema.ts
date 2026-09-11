/**
 * Schémas Terrain Live (Phase 5) — signalements, confirmations et événements.
 * Les valeurs proviennent de la migration `20260911134000_a1_terrain_live.sql`
 * (autorité DDL) ; aucune identité de contributeur dans les surfaces publiques.
 */
import { z } from 'zod';
import { isoDateTimeSchema } from './adventurePlan.schema';

export const TERRAIN_REPORT_CATEGORIES = [
  'obstacle',
  'closure',
  'mud',
  'snow_ice',
  'water',
  'danger',
  'bridge',
  'flood',
  'marking',
  'shelter',
  'crowding',
  'animal',
  'rockfall',
] as const;

export const terrainReportCategorySchema = z.enum(TERRAIN_REPORT_CATEGORIES);

export const TERRAIN_REPORT_STATUSES = [
  'pending',
  'confirmed',
  'active',
  'stale',
  'verify',
  'resolved',
  'expired',
  'rejected',
] as const;

export const terrainReportStatusSchema = z.enum(TERRAIN_REPORT_STATUSES);

/** Réponses possibles à « Toujours présent ? » — présent / disparu / inconnu. */
export const TERRAIN_CONFIRMATIONS = ['present', 'gone', 'unknown'] as const;

export const terrainConfirmationSchema = z.enum(TERRAIN_CONFIRMATIONS);

export const CONDITION_BUCKETS = [
  'dry',
  'wet',
  'snow',
  'ice',
  'day',
  'night',
  'ascent',
  'descent',
  'light_pack',
  'heavy_pack',
] as const;

export const conditionBucketSchema = z.enum(CONDITION_BUCKETS);

export const terrainSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const terrainPassabilitySchema = z.enum(['passable', 'difficult', 'impassable', 'unknown']);

export const reportDirectionSchema = z.enum(['forward', 'reverse', 'unknown']);

export const terrainSourceTypeSchema = z.enum(['user', 'official', 'auto']);

export const terrainReportSchema = z.object({
  id: z.string().uuid('id doit être un UUID'),
  segmentId: z.number().int('segmentId doit être un entier').positive().optional(),
  reporterId: z.string().uuid('reporterId doit être un UUID'),
  category: terrainReportCategorySchema,
  severity: terrainSeveritySchema.default('warning'),
  passability: terrainPassabilitySchema.default('unknown'),
  description: z
    .string()
    .max(1000, 'description ne peut pas dépasser 1000 caractères')
    .optional(),
  photoUrl: z.string().url('photoUrl doit être une URL valide').optional(),
  lat: z.number().min(-90, 'lat doit être compris entre -90 et 90').max(90, 'lat doit être compris entre -90 et 90'),
  lng: z
    .number()
    .min(-180, 'lng doit être compris entre -180 et 180')
    .max(180, 'lng doit être compris entre -180 et 180'),
  gpsAccuracyM: z.number().min(0, 'gpsAccuracyM doit être positif ou nul').optional(),
  direction: reportDirectionSchema.optional(),
  sourceType: terrainSourceTypeSchema.default('user'),
  status: terrainReportStatusSchema.default('pending'),
  presentCount: z.number().int('presentCount doit être un entier').min(0).default(0),
  goneCount: z.number().int('goneCount doit être un entier').min(0).default(0),
  unknownCount: z.number().int('unknownCount doit être un entier').min(0).default(0),
  reportCount: z.number().int('reportCount doit être un entier').min(1).default(1),
  createdAt: isoDateTimeSchema.default(() => new Date().toISOString()),
  updatedAt: isoDateTimeSchema.optional(),
  expiresAt: isoDateTimeSchema.optional(),
});

/** Surface publique : jamais `reporter_id` (vue `terrain_reports_public`). */
export const terrainReportPublicSchema = terrainReportSchema.omit({ reporterId: true });

export const terrainReportConfirmationSchema = z.object({
  id: z.string().uuid('id doit être un UUID').optional(),
  reportId: z.string().uuid('reportId doit être un UUID'),
  userId: z.string().uuid('userId doit être un UUID'),
  confirmation: terrainConfirmationSchema,
  locationDistanceM: z.number().min(0, 'locationDistanceM doit être positif ou nul').optional(),
  gpsQuality: z
    .number()
    .min(0, 'gpsQuality doit être compris entre 0 et 1')
    .max(1, 'gpsQuality doit être compris entre 0 et 1')
    .optional(),
  createdAt: isoDateTimeSchema.optional(),
});

export const TERRAIN_EVENT_STATUSES = ['active', 'resolved', 'expired'] as const;

export const terrainEventStatusSchema = z.enum(TERRAIN_EVENT_STATUSES);

export const terrainEventSchema = z.object({
  id: z.string().uuid('id doit être un UUID'),
  segmentId: z.number().int('segmentId doit être un entier').positive().optional(),
  category: terrainReportCategorySchema,
  status: terrainEventStatusSchema.default('active'),
  mergedReportIds: z.array(z.string().uuid('mergedReportIds doit contenir des UUID')).default([]),
  confidenceScore: z
    .number()
    .min(0, 'confidenceScore doit être compris entre 0 et 1')
    .max(1, 'confidenceScore doit être compris entre 0 et 1')
    .optional(),
  firstReportedAt: isoDateTimeSchema,
  lastConfirmedAt: isoDateTimeSchema.optional(),
  expiresAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema.default(() => new Date().toISOString()),
  updatedAt: isoDateTimeSchema.optional(),
});

export type TerrainReportCategory = z.infer<typeof terrainReportCategorySchema>;
export type TerrainReportStatus = z.infer<typeof terrainReportStatusSchema>;
export type TerrainConfirmation = z.infer<typeof terrainConfirmationSchema>;
export type Confirmation = TerrainConfirmation;
export type ConditionBucket = z.infer<typeof conditionBucketSchema>;
export type TerrainSeverity = z.infer<typeof terrainSeveritySchema>;
export type TerrainPassability = z.infer<typeof terrainPassabilitySchema>;
export type ReportDirection = z.infer<typeof reportDirectionSchema>;
export type TerrainSourceType = z.infer<typeof terrainSourceTypeSchema>;
export type TerrainReport = z.infer<typeof terrainReportSchema>;
export type TerrainReportPublic = z.infer<typeof terrainReportPublicSchema>;
export type TerrainReportConfirmation = z.infer<typeof terrainReportConfirmationSchema>;
export type TerrainEvent = z.infer<typeof terrainEventSchema>;
