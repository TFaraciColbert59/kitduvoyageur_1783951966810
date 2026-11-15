import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { formatZodIssues } from '@/components/media-sharing/server/contract';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function badRequest(error: z.ZodError): NextResponse {
  return json(
    {
      error: 'Requête invalide',
      code: 'invalid_body',
      issues: formatZodIssues(error),
    },
    400,
  );
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

export function invalidJson(): NextResponse {
  return json({ error: 'Corps JSON invalide', code: 'invalid_json' }, 400);
}

export function serverError(scope: string, error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Erreur inconnue';
  console.error(`[media-sharing] ${scope}`, message);
  return json({ error: 'Service indisponible', code: 'internal_error' }, 500);
}
