import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';

export const revalidate = 120;

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(50000).default(3000),
});

/** Signalements terrain publics autour d'un point (RPC `a5_terrain_reports_near`). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: params.get('lat'),
    lng: params.get('lng'),
    radius: params.get('radius') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
  }
  const { lat, lng, radius } = parsed.data;
  try {
    const rows = await rpc<
      Array<{
        id: string;
        category: string;
        severity: string;
        passability: string;
        description: string | null;
        lat: number;
        lng: number;
        status: string;
        present_count: number;
        gone_count: number;
        report_count: number;
        distance_m: number;
        created_at: string;
      }>
    >('a5_terrain_reports_near', { p_lat: lat, p_lng: lng, p_radius_m: radius }, 120);
    return NextResponse.json(
      { reports: rows },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('[explorer-v2] reports near', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
