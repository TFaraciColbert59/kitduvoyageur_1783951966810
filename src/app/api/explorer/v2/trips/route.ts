import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pgrest } from '@/lib/explorer-v2/pgrest';

export const revalidate = 60;

const bodySchema = z.object({
  // La politique `trips_insert_policy` exige `user_id = auth.uid()` : le client
  // transmet son propre identifiant, RLS rejette toute usurpation.
  userId: z.string().uuid(),
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

/**
 * Création d'un départ (P6-07). Le jeton utilisateur est requis : la ligne est
 * écrite avec `user_id = auth.uid()` par la politique `trips`.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'départ invalide', details: parsed.error.issues }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const { userId, title, destination, countryCode, startDate, endDate, activity, partySize } = parsed.data;
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
        Authorization: authorization,
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
      return NextResponse.json({ error: 'refusé', detail: (await res.text()).slice(0, 200) }, { status: res.status });
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
