import { NextRequest, NextResponse } from 'next/server';
import { getTrails } from '@/lib/queries/trails';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trails (legacy)
 *
 * ATLAS Phase 6 — même garde de rate limiting que /api/hikes : toute voie
 * d'accès à `trails_in_viewport` doit être bornée (invariant sécurité).
 * Réponse compatible avec les anciens consommateurs ({ trails: [...] }).
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'trails-legacy',
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const difficulty = searchParams.get('difficulty');
    const minDist = searchParams.get('minDist') ? parseFloat(searchParams.get('minDist')!) : 0;
    const maxDist = searchParams.get('maxDist') ? parseFloat(searchParams.get('maxDist')!) : null;

    const trails = await getTrails({
      search,
      difficulty,
      minDist,
      maxDist,
      includeShort: true,
    });

    return NextResponse.json(
      { trails },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: unknown) {
    console.error('API /api/trails error', err);
    return NextResponse.json({ error: 'Internal Server Error', trails: [] }, { status: 500 });
  }
}
