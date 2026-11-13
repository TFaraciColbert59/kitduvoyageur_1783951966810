import { NextResponse } from 'next/server';
import type { SegmentDefinition } from '@/features/segments';

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function badRequest(message: string): NextResponse {
  return json({ error: message, code: 'invalid_request' }, 400);
}

export function unauthorized(): NextResponse {
  return json({ error: 'Session requise.', code: 'unauthorized' }, 401);
}

export function forbidden(message = 'Accès refusé.'): NextResponse {
  return json({ error: message, code: 'forbidden' }, 403);
}

export function notFound(message = 'Segment introuvable.'): NextResponse {
  return json({ error: message, code: 'not_found' }, 404);
}

export function conflict(message: string): NextResponse {
  return json({ error: message, code: 'conflict' }, 409);
}

export function unprocessable(message: string, code = 'validation_failed'): NextResponse {
  return json({ error: message, code }, 422);
}

export function tooManyRequests(message: string): NextResponse {
  return json({ error: message, code: 'rate_limit_exceeded' }, 429);
}

export function serverError(error: unknown, context: string): NextResponse {
  console.error(`${context}:`, error);
  return json({ error: 'Erreur serveur.', code: 'server' }, 500);
}

/** P01 — un segment privé n'existe pas pour un autre lecteur que son créateur. */
export function canViewSegment(segment: SegmentDefinition, viewerUserId: string | null): boolean {
  if (segment.deletedAt) return false;
  if (segment.visibility === 'private' && segment.createdByUserId !== viewerUserId) return false;
  return true;
}

export function canEditSegment(segment: SegmentDefinition, viewerUserId: string | null): boolean {
  return viewerUserId !== null && segment.createdByUserId === viewerUserId && !segment.deletedAt;
}
