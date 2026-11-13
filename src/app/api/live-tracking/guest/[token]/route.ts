import { NextResponse } from 'next/server';

import { getLiveTrackingRuntime } from '@/features/compte/live-tracking/server/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_MAX_LENGTH = 512;

/**
 * Lecture invité, publique par conception mais fail-closed.
 *
 * Aucune donnée de séance, aucune coordonnée, aucun historique n'est renvoyé
 * si le jeton est absent, forgé, révoqué, expiré, rattaché à une séance
 * terminée ou refusé par P01. Le statut HTTP reste 200 pour que l'écran invité
 * distingue les causes sans transformer un jeton mort en erreur serveur.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token?.trim() ?? '';
  const headers = {
    'Cache-Control': 'no-store, private',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };

  if (!token || token.length > TOKEN_MAX_LENGTH) {
    return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 200, headers });
  }

  try {
    const result = await getLiveTrackingRuntime().readGuestView(token);
    return NextResponse.json(result, { status: 200, headers });
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 500, headers });
  }
}
