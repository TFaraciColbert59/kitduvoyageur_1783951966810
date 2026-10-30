import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pgrest } from '@/lib/explorer-v2/pgrest';

export const revalidate = 300;

const querySchema = z.object({
  kind: z.enum(['carnets', 'trips']),
  iso: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  limit: z.coerce.number().min(1).max(20).default(6),
});

/**
 * Contenus communautaires réels : carnets publics et départs ouverts.
 * Aucune donnée de démonstration, aucun repli silencieux : une liste vide
 * laisse le client afficher son état vide.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    kind: params.get('kind'),
    iso: params.get('iso') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'paramètres invalides' }, { status: 400 });
  }
  const { kind, iso, limit } = parsed.data;

  try {
    if (kind === 'carnets') {
      const filter = iso ? `&country_iso=in.(${iso.toLowerCase()},${iso.toUpperCase()})` : '';
      const rows = await pgrest<
        Array<{
          id: string;
          title: string;
          destination: string | null;
          cover_image: string | null;
          start_date: string | null;
          distance_km: number | null;
          denivele_m: number | null;
          nb_nuits: number | null;
          likes_count: number | null;
        }>
      >(
        `carnets?select=id,title,destination,cover_image,start_date,distance_km,denivele_m,nb_nuits,likes_count` +
          `&visibility=eq.public${filter}&order=created_at.desc&limit=${limit}`,
        { revalidate: 300 },
      );
      return NextResponse.json(
        { kind, items: rows },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
      );
    }

    const filter = iso ? `&destination_country_code=in.(${iso.toLowerCase()},${iso.toUpperCase()})` : '';
    const rows = await pgrest<
      Array<{
        id: string;
        title: string;
        destination_name: string | null;
        start_date: string | null;
        end_date: string | null;
        difficulty: string | null;
        primary_activity: string | null;
        party_size: number | null;
      }>
    >(
      `trips?select=id,title,destination_name,start_date,end_date,difficulty,primary_activity,party_size` +
        `&visibility=eq.public${filter}&order=start_date.asc.nullslast&limit=${limit}`,
      { revalidate: 300 },
    );
    return NextResponse.json(
      { kind, items: rows },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('[explorer-v2] content', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
