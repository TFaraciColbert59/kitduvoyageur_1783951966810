import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.enum([
    'obstacle',
    'closure',
    'mud',
    'snow_ice',
    'water',
    'danger',
    'bridge',
    'flood',
    'marking',
    'shelter',
    'crowding',
    'animal',
    'rockfall',
  ]),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  passability: z.enum(['passable', 'difficult', 'impassable', 'unknown']).default('unknown'),
  description: z.string().max(1000).optional(),
});

function bearerToken(header: string | null): string {
  const match = header ? /^Bearer\s+(\S+)\s*$/i.exec(header) : null;
  return match?.[1] ?? '';
}

function safeUpstreamStatus(status: number): number {
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 409) return 409;
  if (status === 400 || status === 422) return 400;
  return 503;
}

/**
 * Signalement terrain (05_DONNEES §5).
 * L'identifiant `reporter_id` est systématiquement dérivé côté serveur depuis
 * l'utilisateur vérifié (`auth.getUser`) — jamais lu depuis le corps client.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const token = bearerToken(request.headers.get('authorization'));
  let userId: string | null = null;
  let postgrestAuthHeader: string | null = null;

  if (token) {
    try {
      const authClient = createSupabaseClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error,
      } = await authClient.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
        postgrestAuthHeader = `Bearer ${token}`;
      }
    } catch {
      return NextResponse.json({ error: 'indisponible' }, { status: 503 });
    }
  } else {
    try {
      const serverClient = await createClient();
      const {
        data: { user },
        error,
      } = await serverClient.auth.getUser();
      if (!error && user) {
        userId = user.id;
        const { data: sessionData } = await serverClient.auth.getSession();
        if (sessionData.session?.access_token) {
          postgrestAuthHeader = `Bearer ${sessionData.session.access_token}`;
        }
      }
    } catch {
      // Session absente
    }
  }

  if (!userId || !postgrestAuthHeader) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }

  const limited = await enforceRateLimit(userId, {
    scope: 'explorer-v2-reports',
    limit: 20,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'signalement invalide' }, { status: 400 });
  }

  const { lat, lng, category, severity, passability, description } = parsed.data;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/terrain_reports`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: postgrestAuthHeader,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          reporter_id: userId,
          category,
          severity,
          passability,
          description: description ?? null,
          lat,
          lng,
          source_type: 'user',
          // Statut `active` aligné sur `a5_terrain_reports_near` et `explorer_place`
          // afin que les signalements vérifiés soient visibles immédiatement sur la carte.
          status: 'active',
          present_count: 0,
          gone_count: 0,
          unknown_count: 0,
          report_count: 1,
        },
      ]),
    });
    if (!res.ok) {
      console.warn('[explorer-v2] reports rejected', res.status);
      return NextResponse.json({ error: 'refusé' }, { status: safeUpstreamStatus(res.status) });
    }
    const rows = (await res.json()) as Array<{ id: string }>;
    return NextResponse.json({ status: 'recorded', report: rows[0] ?? null });
  } catch (error) {
    console.error('[explorer-v2] reports', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
