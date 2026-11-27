import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { pgrest } from '@/lib/explorer-v2/pgrest';
import { createClient } from '@/lib/supabase/server';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title: z.string().min(3).max(120),
  destination: z.string().max(160).optional(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Sport Explorer (`rando`, `velo`, `ski`…) : converti vers l'enum `trips`. */
  activity: z
    .enum([
      'hiking',
      'trekking',
      'bivouac',
      'roadtrip',
      'cultural',
      'bushcraft',
      'mixed',
      'cycling',
      'ski',
      'mountaineering',
      'climbing',
      'water',
      'citytrip',
      'beach',
      'vanlife',
      'running',
      'trail',
    ])
    .optional(),
  partySize: z.number().int().min(1).max(50).default(4),
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
 * Création d'un départ (P6-07). L'identifiant `user_id` est toujours dérivé
 * côté serveur depuis l'utilisateur vérifié (`auth.getUser`), jamais depuis
 * le corps client.
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
    scope: 'explorer-v2-trips-write',
    limit: 15,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'départ invalide' }, { status: 400 });
  }

  const { title, destination, countryCode, startDate, endDate, activity, partySize } = parsed.data;
  const slug = `${title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)}-${Date.now().toString(36)}`;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/trips`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: postgrestAuthHeader,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          slug,
          user_id: userId,
          title,
          destination_name: destination ?? null,
          destination_country_code: countryCode ?? null,
          start_date: startDate,
          end_date: endDate,
          primary_activity: activity ?? null,
          party_size: partySize,
          status: 'planned',
          visibility: 'public',
        },
      ]),
    });
    if (!res.ok) {
      console.warn('[explorer-v2] trips rejected', res.status);
      return NextResponse.json({ error: 'refusé' }, { status: safeUpstreamStatus(res.status) });
    }
    const rows = (await res.json()) as Array<{ id: string; slug: string }>;
    return NextResponse.json({ status: 'created', trip: rows[0] ?? null });
  } catch (error) {
    console.error('[explorer-v2] trips', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}

/** Départs publics ouverts, filtrables par pays. */
export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-trips-read',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const iso = params.get('iso');
  const filter = iso && /^[A-Z]{2}$/.test(iso) ? `&destination_country_code=eq.${iso}` : '';
  try {
    const rows = await pgrest<
      Array<{
        id: string;
        title: string;
        destination_name: string | null;
        start_date: string | null;
        end_date: string | null;
        primary_activity: string | null;
        party_size: number | null;
      }>
    >(
      `trips?select=id,title,destination_name,start_date,end_date,primary_activity,party_size` +
        `&status=in.(planned,active)&visibility=eq.public${filter}&order=start_date.asc&limit=12`,
      { revalidate: 60 },
    );
    return NextResponse.json({ trips: rows });
  } catch (error) {
    console.error('[explorer-v2] trips list', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
