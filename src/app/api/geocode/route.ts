// Frontiere reseud du geocodage du preparateur.
//
// Le navigateur ne parle JAMAIS directement a un fournisseur : cette route est
// le seul point de controle (allowlist de parametres, rate limit, cache, forme
// de reponse). Aucun secret ici non plus : les deux fournisseurs sont libres et
// sans cle, donc rien a exposer au client.
import { NextRequest, NextResponse } from 'next/server';
import { geocodePlace, reverseGeocodePlace } from '@/features/adventure-prep/geocodeService';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ALLOWED_KEYS = ['q', 'limit', 'lat', 'lon'] as const;
const CACHE = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } as const;

/**
 * Geocodage : lecture seule, providers gratuits et cloisonnes.
 * `failMode: open` car aucun cout financier n'est engage ; le cache du service
 * absorbe de toute facon l'essentiel du trafic.
 */
const RATE_LIMIT = {
  scope: 'prep-geocode',
  limit: 60,
  windowMs: 60_000,
  failMode: 'open' as const,
};

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const unknownKeys = [...params.keys()].filter(
    (key) => !(ALLOWED_KEYS as readonly string[]).includes(key),
  );
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { status: 'invalid', matches: [], reason: 'unknown_parameter' },
      { status: 400 },
    );
  }

  const q = params.get('q') ?? '';
  const lat = params.get('lat');
  const lon = params.get('lon');

  // Point inverse : `lat`/`lon` designent la position REELLE de la personne,
  // et le service en rend le nom de commune. C'est ce qui permet d ecrire
  // « Chamonix-Mont-Blanc » la ou l on est, au lieu d un « Ma position » vide.
  if (lat !== null || lon !== null) {
    const numeric = (raw: string | null): unknown => (raw === null ? Number.NaN : Number(raw));
    const result = await reverseGeocodePlace(numeric(lat), numeric(lon));

    if (result.status === 'invalid') {
      return NextResponse.json(
        { status: 'invalid', matches: [], reason: lat === null || lon === null ? 'lat_lon_pair_expected' : 'lat_lon_range_expected' },
        { status: 400 },
      );
    }
    if (result.status === 'unavailable') {
      return NextResponse.json(
        { status: 'unavailable', matches: [], reason: 'providers_unreachable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(result, { status: 200, headers: CACHE });
  }

  if (q.length > 200) {
    return NextResponse.json(
      { status: 'invalid', matches: [], reason: 'query_too_long' },
      { status: 400 },
    );
  }

  const result = await geocodePlace(q);

  if (result.status === 'invalid') {
    return NextResponse.json(
      { status: 'invalid', matches: [], reason: 'query_too_short' },
      { status: 400 },
    );
  }
  if (result.status === 'unavailable') {
    return NextResponse.json(
      { status: 'unavailable', matches: [], reason: 'providers_unreachable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(result, { status: 200, headers: CACHE });
}
