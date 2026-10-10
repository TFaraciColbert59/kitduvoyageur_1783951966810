import 'server-only';

import { NextResponse } from 'next/server';

import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from '@/lib/observability/correlation';

/**
 * Enveloppe d'erreur/réponse canonique des API Admin — SERVEUR UNIQUEMENT.
 * `{ok:true,data,correlationId} | {ok:false,error:{code,message},correlationId}`
 * + en-tête `x-correlation-id` systématique pour traçabilité.
 */

export function ok<T>(data: T, init?: { correlationId?: string; status?: number }) {
  const { correlationId } = resolveCorrelationId({ body: init?.correlationId });
  return NextResponse.json(
    { ok: true, data, correlationId },
    { status: init?.status ?? 200, headers: { [CORRELATION_ID_HEADER]: correlationId } }
  );
}

export function fail(
  code: string,
  message: string,
  status = 400,
  correlationId?: string
) {
  const resolved = resolveCorrelationId({ body: correlationId });
  return NextResponse.json(
    { ok: false, error: { code, message }, correlationId: resolved.correlationId },
    { status, headers: { [CORRELATION_ID_HEADER]: resolved.correlationId } }
  );
}

/**
 * Mappe un message d'erreur RPC (potentiellement préfixé par Postgres,
 * ex. `ERROR: sod_violation`) vers un code connu via inclusion.
 * Retourne null si aucun code connu — l'appelant répond 500 générique.
 */
export function rpcErrorCode(
  message: string,
  known: Record<string, number>
): { code: string; status: number } | null {
  for (const [code, status] of Object.entries(known)) {
    if (message.includes(code)) return { code, status };
  }
  return null;
}
