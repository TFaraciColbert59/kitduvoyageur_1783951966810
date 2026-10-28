import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  sessionId: z.string().uuid().nullable().optional(),
  accuracyM: z.number().min(0).max(10000).optional(),
  battery: z.number().int().min(0).max(100).optional(),
  countryIso: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .optional(),
});

/**
 * Alerte SOS (05_DONNEES §5, RLS `sos_alerts_owner_rw`).
 *
 * La ligne n'est écrite que pour l'utilisateur authentifié : le jeton du
 * client est transmis tel quel à PostgREST, la politique RLS fait le reste.
 * Aucun appel téléphonique n'est déclenché par cette route.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'authentification requise' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'position invalide' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'configuration absente' }, { status: 503 });
  }

  const { lat, lng, sessionId, accuracyM, battery, countryIso } = parsed.data;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/sos_alerts`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: authorization,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          latitude: lat,
          longitude: lng,
          status: 'active',
          session_id: sessionId ?? null,
          accuracy_m: accuracyM ?? null,
          battery: battery ?? null,
          country_iso_a2: countryIso ?? null,
        },
      ]),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: 'refusé', detail: detail.slice(0, 200) }, { status: res.status });
    }
    const rows = (await res.json()) as Array<{ id: string; created_at: string }>;
    return NextResponse.json({ status: 'recorded', alert: rows[0] ?? null });
  } catch (error) {
    console.error('[explorer-v2] sos', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
