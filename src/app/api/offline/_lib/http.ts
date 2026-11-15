import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/** Réponse 400 homogène pour toutes les routes hors ligne. */
export function invalidBody(error: ZodError) {
  return NextResponse.json(
    {
      error: 'Corps invalide',
      details: error.issues.map((issue) => issue.path.join('.') || 'racine').join(', '),
    },
    { status: 400 }
  );
}

/** Réponse 404 homogène. */
export function notFound(details: string) {
  return NextResponse.json({ error: 'Introuvable', details }, { status: 404 });
}

/** Réponse 500 homogène, sans exposer le détail au client. */
export function serverError(scope: string, error: unknown) {
  console.error(`[${scope}] erreur inattendue:`, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
}
