import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/vapid
 * Renvoie la clé publique VAPID pour l'inscription Web Push.
 */
export async function GET(req: NextRequest) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: 'Web Push non configuré sur le serveur' }, { status: 404 });
  }
  return NextResponse.json({ publicKey });
}
