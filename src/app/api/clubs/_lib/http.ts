import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ClubErrorCode, ClubResult } from '@/features/clubs';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

export function errorJson(error: string, status: number, details?: unknown) {
  return json(details === undefined ? { error } : { error, details }, status);
}

/** Refuse une mutation cross-origin (même garde que les autres routes LKDV). */
export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // requête serveur / same-origin sans en-tête Origin
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    return !requestHost || originHost === requestHost;
  } catch {
    return false;
  }
}

export function csrfFailure(): NextResponse {
  return errorJson('origin_not_allowed', 403);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

/** Session obligatoire ; retourne null quand l’appelant est anonyme. */
export async function optionalUser(supabase: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export function clubErrorStatus(code: ClubErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
    case 'SELF_PROMOTION_FORBIDDEN':
    case 'LAST_ADMIN_PROTECTED':
    case 'BLOCKED_USER':
    case 'PRIVACY_RESTRICTED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'CAPACITY_FULL':
      return 409;
    case 'INVITE_INVALID':
    case 'INVITE_EXPIRED':
    case 'INVITE_REVOKED':
    case 'INVITE_EXHAUSTED':
      return 410;
    case 'INVALID_INPUT':
    default:
      return 400;
  }
}

export function respondClubResult<T>(result: ClubResult<T>, successStatus = 200) {
  if (result.ok) return json({ data: result.data }, successStatus);
  return json({ error: result.error, message: result.message }, clubErrorStatus(result.error));
}

export function dbErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

/** Traduction minimale des erreurs PostgREST en réponses stables. */
export function dbFailure(context: string, error: unknown) {
  const code = dbErrorCode(error);
  if (code === '23505') return errorJson('conflict', 409);
  if (code === '23503' || code === 'PGRST116' || code === 'P0002') return errorJson('not_found', 404);
  if (code === '42501') return errorJson('forbidden', 403);
  if (code === '23514' || code === '55000' || code === '23P01') return errorJson('invalid_state', 409);
  console.error(`[API clubs] ${context}`, error);
  return errorJson('server_error', 500);
}

export function parseIso(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

export function nowIsoOr(value: unknown): string {
  return parseIso(value, new Date().toISOString());
}
