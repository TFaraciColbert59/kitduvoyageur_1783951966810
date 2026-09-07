import { z } from 'zod';

export const ACTIVE_TRIP_COOKIE = 'lkv_active_trip';

/**
 * Schéma strict du voyage actif conservé en cookie httpOnly (Phase 6.1).
 * Seuls les identifiants essentiels non sensibles sont stockés.
 */
export const activeTripSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  crewSlug: z.string().optional(),
});

export type ActiveTripData = z.infer<typeof activeTripSchema>;

/**
 * Sérialise l'état en chaîne base64url compacte et URL-safe.
 */
export function serializeActiveTrip(data: ActiveTripData): string {
  const parsed = activeTripSchema.parse(data);
  const json = JSON.stringify(parsed);
  return Buffer.from(json, 'utf-8').toString('base64url');
}

/**
 * Désérialise et valide rigoureusement le cookie actif.
 */
export function deserializeActiveTrip(raw: string | null | undefined): ActiveTripData | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);
    const result = activeTripSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
