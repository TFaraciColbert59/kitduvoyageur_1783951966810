import { NextResponse } from 'next/server';
import { ApiError, apiError, errorBody, isApiError, logUnknownError, translateDbError } from '../lib/errors';

/** Identifiant de requête corrélé aux journaux (`request_ref`). */
export function requestRef(): string {
  return crypto.randomUUID();
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function jsonError(error: unknown, ref: string): NextResponse {
  const apiErr: ApiError = isApiError(error) ? error : translateDbError(error);
  if (!isApiError(error)) logUnknownError('route_unhandled', error, ref);
  return NextResponse.json(errorBody(apiErr, ref), { status: apiErr.status, headers: { 'Cache-Control': 'no-store' } });
}

/** Exécute une route en traduisant toute erreur, sans jamais laisser fuiter de détail. */
export async function guard(fn: () => Promise<Response>, ref: string): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return jsonError(error, ref);
  }
}

export function methodNotAllowed(allow: string): Response {
  return NextResponse.json(errorBody(apiError('method_not_allowed'), requestRef()), {
    status: 405,
    headers: { Allow: allow, 'Cache-Control': 'no-store' }
  });
}

/** Corps JSON borné, validé ensuite par zod. */
export async function readJsonBody(request: Request, maxBytes = 64_000): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw apiError('payload_too_large');
  const text = await request.text();
  if (text.length > maxBytes) throw apiError('payload_too_large');
  if (!text.trim()) throw apiError('invalid_body');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw apiError('invalid_json');
  }
}

/** `Authorization: Bearer <jeton>` ; null si absent. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/** IP approximative pour la limitation de débit (pas de journalisation). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'inconnu';
  return request.headers.get('x-real-ip') ?? 'inconnu';
}

/** Horodatage ISO pour les réponses de santé. */
export function nowIso(): string {
  return new Date().toISOString();
}
