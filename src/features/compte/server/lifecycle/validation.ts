/**
 * Lot A02 — validation zod des entrées HTTP du cycle de vie.
 *
 * Toute entrée utilisateur est validée à la réception (règle sécurité LKDV).
 * Les schémas sont volontairement stricts : un champ inconnu est refusé, les
 * tableaux sont bornés et les horodatages doivent être des ISO valides.
 */

import { z } from 'zod';
import { ACTIVITY_TAGS } from '@/features/activity/lifecycle';
import { SPORT_FAMILIES } from '@/features/explorer-v2/sheet/sportSelection';

const SPORTS = SPORT_FAMILIES.map((family) => family.sport) as [string, ...string[]];
const TAGS = [...ACTIVITY_TAGS] as [string, ...string[]];

const isoDateTime = z
  .string()
  .trim()
  .refine((value) => Number.isFinite(Date.parse(value)), 'Horodatage ISO invalide.');

const operationId = z.string().trim().min(1).max(120);

export const ActivityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/, 'Identifiant d’activité invalide.');

export const MetadataPatchSchema = z
  .object({
    operationId: operationId.optional(),
    title: z.string().trim().max(120).optional(),
    notes: z.string().max(2000).optional(),
    sport: z.enum(SPORTS).optional(),
    variantId: z.string().trim().max(64).nullable().optional(),
    tags: z.array(z.enum(TAGS)).max(8).optional(),
    visibility: z.enum(['private', 'collective_anonymized']).optional(),
    kitId: z.string().trim().max(64).nullable().optional(),
    gearIds: z.array(z.string().trim().max(64)).max(200).optional(),
    expectedRevision: z.number().int().min(1).optional(),
  })
  .strict();

export const CropSchema = z
  .object({
    operationId: operationId.optional(),
    startIndex: z.number().int().min(0).optional(),
    endIndex: z.number().int().min(0).optional(),
    startTimeIso: isoDateTime.optional(),
    endTimeIso: isoDateTime.optional(),
    startOffsetS: z.number().min(0).optional(),
    endOffsetS: z.number().min(0).optional(),
    startDistanceM: z.number().min(0).optional(),
    endDistanceM: z.number().min(0).optional(),
    previewOnly: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.startIndex !== undefined ||
      value.endIndex !== undefined ||
      value.startTimeIso !== undefined ||
      value.endTimeIso !== undefined ||
      value.startOffsetS !== undefined ||
      value.endOffsetS !== undefined ||
      value.startDistanceM !== undefined ||
      value.endDistanceM !== undefined,
    'Au moins une borne de recadrage est requise.'
  );

export const SplitSchema = z
  .object({
    operationId: operationId.optional(),
    splitIndices: z.array(z.number().int().min(0)).min(1).max(10).optional(),
    splitTimestampsIso: z.array(isoDateTime).min(1).max(10).optional(),
    splitDistancesM: z.array(z.number().min(0)).min(1).max(10).optional(),
    partTitles: z.array(z.string().trim().max(120)).max(11).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(value.splitIndices?.length) ||
      Boolean(value.splitTimestampsIso?.length) ||
      Boolean(value.splitDistancesM?.length),
    'Au moins un point de fractionnement est requis.'
  );

export const CorrectionSchema = z
  .object({
    operationId: operationId.optional(),
    distanceMethod: z.enum(['raw', 'recompute_from_trace', 'manual_override']).optional(),
    manualDistanceM: z.number().min(0).max(2_000_000).optional(),
    elevationMethod: z
      .enum(['raw', 'dem_projection', 'threshold_smoothing', 'manual_override'])
      .optional(),
    demElevationsM: z.array(z.number().min(-500).max(9_000).nullable()).max(50_000).optional(),
    manualElevationGainM: z.number().min(0).max(100_000).optional(),
    manualElevationLossM: z.number().min(0).max(100_000).optional(),
    smoothingThresholdM: z.number().min(0).max(50).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.distanceMethod) || Boolean(value.elevationMethod),
    'Aucune méthode de correction fournie.'
  );

export const GpsSmoothingSchema = z
  .object({
    maxPlausibleSpeedMs: z.number().min(1).max(60).optional(),
  })
  .strict();

const MediaActionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('add'),
      id: z.string().trim().min(1).max(120),
      kind: z.enum(['photo', 'video']).optional(),
      storagePath: z.string().trim().min(1).max(512),
      url: z.string().url().max(2048).nullable().optional(),
      caption: z.string().max(500).nullable().optional(),
    })
    .strict(),
  z.object({ type: z.literal('remove'), id: z.string().trim().min(1).max(120) }).strict(),
  z
    .object({
      type: z.literal('reorder'),
      orderedIds: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
    })
    .strict(),
  z
    .object({
      type: z.literal('update_caption'),
      id: z.string().trim().min(1).max(120),
      caption: z.string().max(500).nullable(),
    })
    .strict(),
  z.object({ type: z.literal('set_cover'), id: z.string().trim().min(1).max(120) }).strict(),
]);

export const MediaSchema = z.object({ action: MediaActionSchema }).strict();

export const QuickEditSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('apply'), patch: MetadataPatchSchema }).strict(),
  z.object({ action: z.literal('dismiss') }).strict(),
]);

const ListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    trash: z.enum(['0', '1']).optional(),
    includeDeleted: z.enum(['0', '1']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    requestSeq: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export type ListQuery = z.infer<typeof ListQuerySchema>;

export function parseListQuery(
  searchParams: URLSearchParams
): { ok: true; value: ListQuery } | { ok: false; error: string } {
  const raw: Record<string, string> = {};
  for (const key of ['q', 'trash', 'includeDeleted', 'limit', 'requestSeq']) {
    const value = searchParams.get(key);
    if (value !== null) raw[key] = value;
  }
  const parsed = ListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Paramètres de recherche invalides.' };
  }
  return { ok: true, value: parsed.data };
}

export type MetadataPatchBody = z.infer<typeof MetadataPatchSchema>;
