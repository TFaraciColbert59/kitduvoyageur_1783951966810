/**
 * Lot D03-UI — utilitaires HTTP communs aux routes `/api/watches`.
 *
 * L'identité vient uniquement de `requireUser()` : aucun `userId` n'est lu
 * dans le corps de la requête. Les erreurs de contrat sont traduites en
 * statuts explicites, jamais en faux succès.
 */

import { NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import {
  WatchNotFoundError,
  WatchPersistenceError,
  WatchRevisionConflictError,
} from '@/features/compte/server/watches';

export function rejected(code: string, message: string, status = 422): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function handleWatchError(error: unknown): NextResponse {
  if (error instanceof WatchNotFoundError) {
    return fail('not_found', error.message);
  }
  if (error instanceof WatchRevisionConflictError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'revision_conflict',
        expectedRevision: error.expectedRevision,
        receivedRevision: error.receivedRevision,
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof WatchPersistenceError) {
    return NextResponse.json(
      { error: error.message, code: 'persistence_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof Error && /incohérent|appartient|sort de la plage/i.test(error.message)) {
    return rejected('invalid_batch', error.message);
  }
  return fail('server', 'Impossible de traiter cette synchronisation montre.');
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export function truthyFlag(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === '1' || value.toLowerCase() === 'true';
}
