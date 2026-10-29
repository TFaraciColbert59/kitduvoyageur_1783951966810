import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reporterId: z.string().uuid(),
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

/**
 * Signalement terrain (05_DONNEES §5). Le jeton utilisateur est relayé à
 * PostgREST : la politique `terrain_reports` décide, la route n'invente rien.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'signalement invalide' }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'configuration absente' }, { status: 503 });

  const { reporterId, lat, lng, category, severity, passability, description } = parsed.data;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/terrain_reports`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: authorization,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          reporter_id: reporterId,
          category,
          severity,
          passability,
          description: description ?? null,
          lat,
          lng,
          source_type: 'user',
          // Contrat de la politique `terrain_reports_insert_own` : un
          // signalement naît « pending », la fusion communautaire le confirme.
          status: 'pending',
          present_count: 0,
          gone_count: 0,
          unknown_count: 0,
          report_count: 1,
        },
      ]),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'refusé', detail: (await res.text()).slice(0, 200) }, { status: res.status });
    }
    const rows = (await res.json()) as Array<{ id: string }>;
    return NextResponse.json({ status: 'recorded', report: rows[0] ?? null });
  } catch (error) {
    console.error('[explorer-v2] reports', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
