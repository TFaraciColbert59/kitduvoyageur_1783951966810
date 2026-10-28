import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ sessionId: z.string().uuid() });

/**
 * Fin de sortie : appelle `finish_activity_session` (SECURITY DEFINER), qui
 * clôt la session et écrit le résumé compatible dans `hike_sessions`.
 * Le jeton de l'utilisateur est relayé tel quel : la RPC vérifie le propriétaire.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'sessionId invalide' }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/finish_activity_session`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_session: parsed.data.sessionId }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'refusé', detail: (await res.text()).slice(0, 200) }, { status: res.status });
    }
    const summaryId = await res.json();
    return NextResponse.json({ status: 'saved', summaryId });
  } catch (error) {
    console.error('[explorer-v2] finish', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
