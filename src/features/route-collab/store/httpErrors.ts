import { NextResponse } from 'next/server';
import { RouteCollabStoreError } from './types';

/**
 * Traduit une erreur du store en réponse HTTP. Les erreurs inattendues sont journalisées côté
 * serveur et renvoyées en 500 sans détail (jamais de message SQL au client).
 */
export function storeErrorResponse(error: unknown): NextResponse {
  if (error instanceof RouteCollabStoreError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[route-collab] erreur inattendue', error);
  return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
}
