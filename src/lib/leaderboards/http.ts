import { NextResponse } from 'next/server';
import type { LeaderboardSegmentView } from './types';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
} as const;

const PUBLIC_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function leaderboardJson<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: PRIVATE_HEADERS });
}

export function leaderboardPublicJson<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: PUBLIC_HEADERS });
}

export interface ApiErrorBody {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export function leaderboardError(
  status: number,
  code: string,
  error: string,
  details?: unknown
): NextResponse {
  const body: ApiErrorBody = { success: false, error, code };
  if (details !== undefined) body.details = details;
  return leaderboardJson(body, status);
}

export function invalidQuery(issues: Array<{ path: string; message: string }>): NextResponse {
  return leaderboardError(400, 'invalid_query', 'Paramètres de classement invalides.', issues);
}

export function segmentNotFound(): NextResponse {
  return leaderboardError(404, 'segment_not_found', 'Segment introuvable.');
}

export function authRequired(): NextResponse {
  return leaderboardError(
    401,
    'authentication_required',
    'Connectez-vous pour consulter un classement entre amis ou de club.'
  );
}

export function clubRequired(): NextResponse {
  return leaderboardError(400, 'club_id_required', 'Sélectionnez un club.');
}

export function clubAccessDenied(): NextResponse {
  return leaderboardError(403, 'club_access_denied', 'Vous n’êtes pas membre de ce club.');
}

export function segmentForbidden(segment: LeaderboardSegmentView): NextResponse {
  return leaderboardError(404, 'segment_not_found', `Segment introuvable : ${segment.name}.`);
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`[API leaderboards] ${context}`, error);
  return leaderboardError(500, 'server_error', 'Erreur interne de classement.');
}
