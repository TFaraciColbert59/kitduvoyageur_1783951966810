import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  createSupabaseTerrainReportsClient,
  listNearbyTerrainReports,
} from '@/features/adventure-intelligence/server/terrainReports';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import {
  consumeToken,
  createTokenBucket,
  PUBLIC_READ_BUCKET_CAPACITY,
  PUBLIC_READ_REFILL_PER_SECOND,
  type TokenBucket,
} from '@/features/adventure-intelligence/domain/requestLimiter';

export const dynamic = 'force-dynamic';

/** Rayon par défaut de la lecture conditions (mètres) — prudent et borné. */
const CONDITIONS_DEFAULT_RADIUS_M = 5000;
/** Cache court des lectures publiques : 60 s + stale-while-revalidate 5 min. */
const CONDITIONS_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
/** Nombre maximal de seaux conservés en mémoire (best-effort anti-fuite). */
const CONDITIONS_BUCKET_MAX_KEYS = 10000;

/**
 * Seaux par IP en mémoire — best-effort, sans dépendance externe. Le processus
 * peut être recyclé à tout moment : la limite protège la rafale, pas un quota.
 */
const conditionsBuckets = new Map<string, TokenBucket>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp && realIp.length > 0 ? realIp : 'inconnue';
}

/** Consomme un jeton pour cette IP à `nowMs` (mutation best-effort du seau). */
function consumeConditionsToken(
  ip: string,
  nowMs: number
): ReturnType<typeof consumeToken> {
  const bucket =
    conditionsBuckets.get(ip) ??
    createTokenBucket(nowMs, PUBLIC_READ_BUCKET_CAPACITY);
  const result = consumeToken(bucket, nowMs, {
    capacity: PUBLIC_READ_BUCKET_CAPACITY,
    refillPerSecond: PUBLIC_READ_REFILL_PER_SECOND,
  });
  conditionsBuckets.set(ip, result.bucket);
  if (conditionsBuckets.size > CONDITIONS_BUCKET_MAX_KEYS) {
    // Nettoyage simple : le plus ancien inséré (Map ordonnée).
    const oldest = conditionsBuckets.keys().next().value;
    if (oldest !== undefined) conditionsBuckets.delete(oldest);
  }
  return result;
}

const nearbyQuerySchema = z.object({
  lat: z
    .number()
    .min(-90, 'lat doit être compris entre -90 et 90')
    .max(90, 'lat doit être compris entre -90 et 90'),
  lng: z
    .number()
    .min(-180, 'lng doit être compris entre -180 et 180')
    .max(180, 'lng doit être compris entre -180 et 180'),
  radius: z
    .number()
    .min(1, 'radius doit être au moins 1 mètre')
    .max(50000, 'radius ne peut pas dépasser 50 000 mètres')
    .optional(),
});

function zodDetails(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

/**
 * GET /api/terrain/conditions?lat&lng&radius — signalements confirmés/actifs
 * non expirés autour d'un point. Lecture de la vue publique (aucune identité,
 * jamais `reporter_id`) via la RPC A5, triée par distance.
 *
 * Protection A11 (#22) : rayon par défaut 5 km, cache court public et limite
 * de débit par IP (seau à jetons en mémoire, best-effort) avec `Retry-After`.
 */
export async function GET(request: NextRequest) {
  try {
    const latRaw = request.nextUrl.searchParams.get('lat');
    const lngRaw = request.nextUrl.searchParams.get('lng');
    if (latRaw === null || lngRaw === null || latRaw === '' || lngRaw === '') {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: 'lat et lng sont requis' },
        { status: 400 }
      );
    }

    const parsed = nearbyQuerySchema.safeParse({
      lat: Number(latRaw),
      lng: Number(lngRaw),
      radius:
        request.nextUrl.searchParams.get('radius') === null
          ? undefined
          : Number(request.nextUrl.searchParams.get('radius')),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: zodDetails(parsed.error) },
        { status: 400 }
      );
    }

    const ip = clientIp(request);
    const limit = consumeConditionsToken(ip, Date.now());
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Trop de requêtes', details: 'conditions_rate_limited' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const flags = await currentAdventureFeatureFlags();
    if (flags.terrain_live !== true) {
      return NextResponse.json({ error: 'Fonctionnalité non activée' }, { status: 503 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    const reports = await listNearbyTerrainReports(
      {
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        radiusM: parsed.data.radius ?? CONDITIONS_DEFAULT_RADIUS_M,
      },
      createSupabaseTerrainReportsClient(supabase)
    );

    return NextResponse.json(
      { reports },
      { headers: { 'Cache-Control': CONDITIONS_CACHE_CONTROL } }
    );
  } catch (err) {
    console.error(
      '[terrain/conditions] erreur inattendue:',
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

