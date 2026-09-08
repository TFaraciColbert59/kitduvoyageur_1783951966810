import { z } from 'zod';

export const ACTIVE_ADVENTURE_COOKIE = 'lkv_active_adventure';

/**
 * H2.1 — Schéma strict de l'aventure active conservée en cookie httpOnly.
 * Miroir de activeTripSchema (voyages) étendu aux 3 natures du hub.
 * Seuls les identifiants essentiels non sensibles sont stockés.
 */
export const adventureSchema = z.discriminatedUnion('nature', [
  z.object({ nature: z.literal('possession') }),
  z.object({
    nature: z.literal('sortie'),
    id: z.string().min(1),
    slug: z.string().min(1),
    title: z.string().min(1),
  }),
  z.object({
    nature: z.literal('collectif'),
    kind: z.enum(['groupe', 'equipage']),
    id: z.string().min(1),
    title: z.string().min(1),
  }),
]);

export type ActiveAdventureData = z.infer<typeof adventureSchema>;

/** Sérialise l'état en chaîne base64url compacte et URL-safe. */
export function serializeActiveAdventure(data: ActiveAdventureData): string {
  const parsed = adventureSchema.parse(data);
  const json = JSON.stringify(parsed);
  return Buffer.from(json, 'utf-8').toString('base64url');
}

/** Désérialise et valide rigoureusement le cookie actif (null si invalide). */
export function deserializeActiveAdventure(raw: unknown): ActiveAdventureData | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json);
    const result = adventureSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Lit le JSON persisté en localStorage (null si absent ou corrompu). */
export function parseStoredAdventure(raw: string | null): ActiveAdventureData | null {
  if (!raw) return null;
  try {
    const result = adventureSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
