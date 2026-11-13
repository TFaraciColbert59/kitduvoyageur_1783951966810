/**
 * Lot A02 — utilitaires communs aux routes `/api/activities/lifecycle`.
 *
 * Aucune donnée n'est lue dans le corps pour l'identité : `requireUser()`
 * fournit seul `userId`. Les erreurs de persistance ne sont jamais maquillées
 * en succès.
 */

import { NextResponse } from 'next/server';
import { fail } from '@/lib/api/respond';
import {
  LifecycleNotFoundError,
  LifecyclePersistenceUnavailableError,
  LifecycleRevisionConflictError,
} from '@/features/compte/server/lifecycle';

export function rejected(code: string, error: string): NextResponse {
  return NextResponse.json(
    { error, code },
    { status: 422, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function unavailable(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'persistence_unavailable' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function handleLifecycleError(error: unknown): NextResponse {
  if (error instanceof LifecycleNotFoundError) {
    return fail('not_found', error.message);
  }
  if (error instanceof LifecycleRevisionConflictError) {
    return NextResponse.json(
      { error: error.message, code: 'revision_conflict', currentRevision: error.currentRevision },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (error instanceof LifecyclePersistenceUnavailableError) {
    return unavailable('La persistance du cycle de vie n’est pas disponible. Réessaie plus tard.');
  }
  return fail('server', 'Impossible de traiter cette activité.');
}
