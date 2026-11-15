import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isRouteSport,
  isSurfacePreference,
  type RouteRoutingOptions,
  type RouteSport,
} from '@/features/adventure-prep/routeProfiles';
import { generateSportLoop } from '@/features/routes/loop/loopGenerator';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { signRouteCacheKey } from '@/lib/routeCacheSignature';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = {
  scope: 'explorer-loop',
  limit: 20,
  windowMs: 60_000,
  failMode: 'open' as const,
};

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  sport: z.string(),
  targetDistanceKm: z.number().min(2).max(200),
  bearingDeg: z.number().min(-360).max(360).optional().nullable(),
  ebike: z.boolean().optional(),
  surfacePref: z.string().optional(),
  avoidSteps: z.boolean().optional(),
  avoidFerries: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres de boucle invalides' }, { status: 400 });
  }
  const data = parsed.data;
  if (!isRouteSport(data.sport)) {
    return NextResponse.json({ error: 'Sport inconnu', reason: 'sport_expected' }, { status: 400 });
  }
  if (data.surfacePref !== undefined && !isSurfacePreference(data.surfacePref)) {
    return NextResponse.json(
      { error: 'Préférence de surface invalide', reason: 'surface_pref_expected' },
      { status: 400 }
    );
  }

  const options: RouteRoutingOptions = {
    ...(data.ebike ? { ebike: true } : {}),
    ...(data.surfacePref && isSurfacePreference(data.surfacePref)
      ? { surfacePref: data.surfacePref }
      : {}),
    ...(data.avoidSteps ? { avoidSteps: true } : {}),
    ...(data.avoidFerries ? { avoidFerries: true } : {}),
  };

  try {
    const result = await generateSportLoop(
      {
        start: { lat: data.lat, lon: data.lng },
        sport: data.sport as RouteSport,
        targetDistanceKm: data.targetDistanceKm,
        bearingDeg: data.bearingDeg ?? null,
        options,
      },
      {
        signal: request.signal,
        cacheBaseUrl: request.nextUrl.origin,
        signCacheKey: signRouteCacheKey,
      }
    );

    if (result.status !== 'ready') {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[explorer-v2] loop generator', error);
    return NextResponse.json({ error: 'Génération de boucle indisponible' }, { status: 503 });
  }
}
