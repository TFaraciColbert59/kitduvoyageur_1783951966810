import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/loyalty/redeem — REMPLACÉE par `POST /api/rewards/redeem`.
 *
 * L'ancien échange (`legacy_loyalty_redeem`) débitait sans contrôle de
 * financement, de coût ni de stock et marquait l'échange « completed » sur le
 * champ. Le nouvel échange réserve stock et débit ensemble, avec clé
 * d'idempotence. Refus explicite, aucun débit : les points restent acquis.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'moved', replacement: '/api/rewards/redeem' },
    { status: 410 }
  );
}
