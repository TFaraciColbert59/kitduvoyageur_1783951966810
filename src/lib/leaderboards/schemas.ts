import { z } from 'zod';
import type { LeaderboardSport } from '@/features/leaderboards';

export const LEADERBOARD_PERIODS = [
  'all_time',
  'this_year',
  'this_month',
  'this_week',
  'today',
  'rolling_90d',
] as const;

export const LEADERBOARD_SCOPES = ['global', 'friends', 'club'] as const;

export const LEADERBOARD_GENDERS = ['men', 'women', 'non_binary', 'unspecified', 'all'] as const;

export const LEADERBOARD_SPORTS = [
  'cycling',
  'mtb',
  'gravel',
  'running',
  'trail',
  'hiking',
  'ski',
  'swimming',
] as const satisfies ReadonlyArray<LeaderboardSport>;

const segmentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Identifiant de segment invalide');

/**
 * Filtres S4.06. `ageGroup` et `weightClass` sont acceptés uniquement pour
 * être retirés et signalés au client (le plan LKDV ne les expose pas).
 */
export const leaderboardQuerySchema = z.object({
  period: z.enum(LEADERBOARD_PERIODS).optional(),
  scope: z.enum(LEADERBOARD_SCOPES).optional(),
  clubId: z.string().trim().min(1).max(200).optional(),
  gender: z.enum(LEADERBOARD_GENDERS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
  cursor: z
    .string()
    .trim()
    .max(40)
    .regex(/^offset:\d+$/, 'Curseur invalide')
    .optional(),
  ageGroup: z.string().max(40).optional(),
  weightClass: z.string().max(40).optional(),
});

export const localLegendQuerySchema = z.object({
  scope: z.enum(LEADERBOARD_SCOPES).optional(),
  clubId: z.string().trim().min(1).max(200).optional(),
  windowDays: z.coerce.number().int().min(1).max(365).optional(),
  minEfforts: z.coerce.number().int().min(1).max(100).optional(),
  minEffortsForTitle: z.coerce.number().int().min(1).max(100).optional(),
});

export const segmentListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  sport: z.enum(LEADERBOARD_SPORTS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type LocalLegendQuery = z.infer<typeof localLegendQuerySchema>;
export type SegmentListQuery = z.infer<typeof segmentListQuerySchema>;

export function parseSegmentId(raw: string): string | null {
  const parsed = segmentIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const object: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value !== '') object[key] = value;
  }
  return object;
}

export interface ParseQueryResult<T> {
  data?: T;
  issues?: Array<{ path: string; message: string }>;
}

export function parseQuery<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams
): ParseQueryResult<z.infer<T>> {
  const parsed = schema.safeParse(searchParamsToObject(searchParams));
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return { data: parsed.data as z.infer<T> };
}
