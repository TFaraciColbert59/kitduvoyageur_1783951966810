import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    sessionId: z.string().uuid().nullable().optional(),
    tokenKind: z.enum(['push_to_start', 'activity_update']),
    apnsToken: z.string().regex(/^[0-9a-fA-F]{32,256}$/),
    environment: z.enum(['development', 'production']).default('production'),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'push-live-activity-token',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'token APNs invalide' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/apns_live_activity_tokens`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: auth,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        session_id: parsed.data.sessionId ?? null,
        token_kind: parsed.data.tokenKind,
        apns_token: parsed.data.apnsToken,
        environment: parsed.data.environment,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'enregistrement refusé' }, { status: res.status === 401 ? 401 : 503 });
    }
    return NextResponse.json({ saved: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
