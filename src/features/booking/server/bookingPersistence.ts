import { z } from 'zod';
import type { BookingVertical } from './bookingProviderTypes';

/**
 * Persistance serveur des réservations fournisseurs (table `public.bookings`).
 *
 * Invariants de sécurité tenus ici :
 *  - `user_id` et `trip_id` ne viennent JAMAIS du corps de la requête : ils
 *    sont forcés par le serveur (utilisateur authentifié + paramètre d'URL).
 *  - Le statut créé est toujours `pending` (une réservation n'est jamais
 *    confirmée par un simple POST client).
 *  - Les métadonnées sont nettoyées récursivement : aucune clé de type
 *    secret / token / credential n'est stockée ni renvoyée.
 *  - Les lectures ne sélectionnent que des colonnes explicitement listées.
 */

// Colonnes autorisées en lecture/écriture (jamais de `select('*')`).
export const BOOKING_COLUMNS = [
  'id',
  'trip_id',
  'vertical',
  'provider',
  'external_ref',
  'amount_eur',
  'currency',
  'status',
  'checkout_mode',
  'metadata',
  'created_at',
  'updated_at',
] as const;

const BLOCKED_KEY_PARTS = [
  'token',
  'secret',
  'password',
  'passwd',
  'credential',
  'authorization',
  'apikey',
  'accesskey',
  'privatekey',
  'sessionkey',
  'cookie',
  'bearer',
];

const MAX_METADATA_DEPTH = 6;
const MAX_METADATA_KEYS = 100;
const MAX_METADATA_STRING = 2000;

/** Normalise une clé puis détecte un fragment de type secret/credential. */
export function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BLOCKED_KEY_PARTS.some((part) => normalized.includes(part));
}

/**
 * Nettoie un objet de métadonnées : supprime récursivement les clés
 * sensibles, borne la profondeur / le nombre de clés / la taille des chaînes.
 * Un objet non-objet renvoie `{}`.
 */
export function sanitizeBookingMetadata(value: unknown, depth = 0): Record<string, unknown> {
  if (depth > MAX_METADATA_DEPTH) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (isSensitiveMetadataKey(key)) continue;
    count += 1;
    if (Array.isArray(val)) {
      out[key] = val.map((item) => {
        if (item && typeof item === 'object') return sanitizeBookingMetadata(item, depth + 1);
        if (typeof item === 'string') return item.slice(0, MAX_METADATA_STRING);
        return item;
      });
    } else if (val && typeof val === 'object') {
      out[key] = sanitizeBookingMetadata(val, depth + 1);
    } else if (typeof val === 'string') {
      out[key] = val.slice(0, MAX_METADATA_STRING);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Schéma de création. `.strict()` rejette toute clé inconnue (notamment
 * `user_id`, `trip_id`, `id`, `status` hors `pending`) : impossible de faire
 * du mass-assignment depuis le client.
 */
export const bookingCreateSchema = z
  .object({
    vertical: z.enum(['flight', 'hotel', 'car', 'activity']),
    provider: z.enum(['routestack', 'viator', 'affiliate']),
    external_ref: z.string().trim().min(1).max(255).nullish(),
    amount_eur: z.number().min(0).max(10_000_000).default(0),
    currency: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
    status: z.literal('pending').default('pending'),
    checkout_mode: z.enum(['deeplink', 'acp']).default('deeplink'),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export interface PublicBooking {
  id: string;
  trip_id: string;
  vertical: BookingVertical;
  provider: string;
  external_ref: string | null;
  amount_eur: number;
  currency: string;
  status: string;
  checkout_mode: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BookingStoreError {
  message: string;
  code?: string;
  status: number;
}

export interface BookingStoreResult<T> {
  data: T | null;
  error: BookingStoreError | null;
}

/** Client Supabase minimal (typage volontairement lâche : serveur uniquement). */
export interface BookingStore {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(columns: string): { single(): Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
    };
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, opts: { ascending: boolean }): Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
      };
    };
  };
}

/**
 * Vérifie `can_edit_trip`. Fail-closed : toute erreur RPC vaut refus.
 */
export async function canEditTrip(supabase: BookingStore, tripId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_edit_trip', { p_trip_id: tripId });
  if (error) {
    console.error('[booking] can_edit_trip error', { message: error.message });
    return false;
  }
  return data === true;
}

/** Mappe une ligne DB vers un DTO public, nettoyé, sans `user_id`. */
export function toPublicBooking(row: Record<string, unknown>): PublicBooking {
  return {
    id: String(row.id),
    trip_id: String(row.trip_id),
    vertical: row.vertical as BookingVertical,
    provider: String(row.provider),
    external_ref: row.external_ref == null ? null : String(row.external_ref),
    amount_eur: Number(row.amount_eur ?? 0),
    currency: String(row.currency ?? 'EUR'),
    status: String(row.status),
    checkout_mode: String(row.checkout_mode),
    metadata: sanitizeBookingMetadata(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Insère une réservation en `pending`.
 * `user_id` est forcé à l'utilisateur authentifié, `trip_id` au paramètre
 * d'URL, `status` à `pending` : le corps de la requête ne peut pas les fixer.
 */
export async function insertBooking(
  supabase: BookingStore,
  args: { tripId: string; userId: string; payload: BookingCreateInput }
): Promise<BookingStoreResult<PublicBooking>> {
  const row = {
    trip_id: args.tripId,
    user_id: args.userId,
    vertical: args.payload.vertical,
    provider: args.payload.provider,
    external_ref: args.payload.external_ref ?? null,
    amount_eur: args.payload.amount_eur,
    currency: args.payload.currency,
    status: 'pending' as const,
    checkout_mode: args.payload.checkout_mode,
    metadata: sanitizeBookingMetadata(args.payload.metadata),
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert(row)
    .select(BOOKING_COLUMNS.join(','))
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return { data: null, error: { message: error.message, code: error.code, status } };
  }
  return { data: toPublicBooking(data as Record<string, unknown>), error: null };
}

/** Liste les réservations d'un voyage (plus récentes d'abord). */
export async function listBookings(
  supabase: BookingStore,
  tripId: string
): Promise<BookingStoreResult<PublicBooking[]>> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS.join(','))
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: { message: error.message, code: error.code, status: 500 } };
  }
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  return { data: rows.map(toPublicBooking), error: null };
}
