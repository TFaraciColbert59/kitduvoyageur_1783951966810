import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { isTravelMode, MAX_ROUTE_POINTS } from '@/features/adventure-prep/routingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * I4 — le cache de traces de routage, cote SERVEUR.
 *
 * POURQUOI UNE ROUTE, ET PAS UN IMPORT.
 *
 * `routingService.ts` est un module PARTAGE : `/api/route` (serveur) et
 * `browserMeasurements` ('use client') l importent tous les deux. Il doit donc
 * rester 100 % client-safe. Or la base se touche par `lib/ai/serviceClient.ts`,
 * qui commence par `import 'server-only'` : l inclure dans ce graphe fait
 * tomber TOUTES les routes en 500. MESURE le 29/09/2026 sur `/prepare`, `/`
 * et `/hub` — `ModuleBuildError`.
 *
 * Un `import()` PARSEUX ne sauve rien : webpack resout un littéral de chaine
 * dans le graphe statique, le module y entre quand meme. Cette Route Handler
 * est donc le seul point de contact, et la seule Maniere honnete de sortir
 * `server-only` du bundle client.
 *
 * Elle ne fait QUE relayer deux appels : `get_route_cache` et `set_route_cache`,
 * definis par la migration du meme nom. Aucune decision ici : la cle, le TTL,
 * l expiration et le refus de servir une entree en erreur restent dans
 * `routingService`, ou dans le SQL.
 *
 * DEGRADE : toute panne de base se traduit par un 503 ou une erreur loguee,
 * jamais par une trace inventee. L appelant retombe alors sur son cache
 * memoire, qui est le comportement d avant I4.
 *
 * LECTURE — lecture seule, providers gratuits : failMode ouvert, le cache
 * absorbe. 300/min laisse largement la place : une reponse deja connue ne
 * consomme meme pas de credit, seules les VRAIES mesures l'atteignent, et
 * `/api/route` en limite deja 60/min.
 */
const RATE_LIMIT = {
  scope: 'prep-route-cache',
  limit: 300,
  windowMs: 60_000,
  failMode: 'open' as const,
};

/** Un point : `lon,lat`, bornes reelles, arrondies comme le service les ecrit. */
const POINT = String.raw`-?\d{1,3}(?:\.\d{1,6})?,-?\d{1,2}(?:\.\d{1,6})?`;

/**
 * La cle du service : `route:<mode>:<lon,lat>;<lon,lat>…`. Rien d'autre.
 *
 * Le PREMIER point est CAPTURE (`(…)`) : c est lui que `readKey` recompte
 * pour borner le nombre de points. Sans ce groupe, la destruction
 * `[, mode, points]` recevrait `undefined` — mesure le 29/09/2026, un 500
 * sur TOUTE cle bien formee, parce que `points.split` levait.
 */
const CACHE_KEY = new RegExp(String.raw`^route:([a-z_]+):(${POINT})(?:;${POINT})*$`);

/** Un `lon,lat` de plus, ou `null`. La liste blanche remplace toute derivation. */
function readKey(raw: string | null): { key: string; mode: string } | null {
  if (!raw || raw.length > 512) return null;
  const match = CACHE_KEY.exec(raw);
  if (!match) return null;
  const [, mode, points] = match;
  // Le nombre de points est borne comme la mesure elle-meme, sinon une cle
  // geodesicement absurde s'ecrirait en base pour rien.
  if (points.split(';').length > MAX_ROUTE_POINTS) return null;
  if (!isTravelMode(mode)) return null;
  return { key: raw, mode };
}

const PROVIDERS = new Set(['osrm', 'valhalla', 'brouter']);

/**
 * Une panne de base ne doit JAMAIS se voir comme un 500.
 *
 * Un 500 annonce « le service est casse » a l appelant comme au navigateur,
 * alors que ce cache est un ACCELERATEUR : son absence doit se lire comme
 * « pas de reponse en base », donc un repli silencieux sur le cache memoire.
 * `getServiceSupabase` renvoie deja `null` sans les variables d'environnement,
 * mais un client construit puis une connexion reelle peuvent LANCER (DNS
 * coupe, schema absent, PostgREST injoignable) : d ou cette enveloppe, qui
 * transforme tout jet en 503.
 */
async function avecBase<T>(stage: string, run: () => T | PromiseLike<T>): Promise<
  { ok: true; value: T } | { ok: false }
> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    console.error(`[route/cache] ${stage} a leve :`, err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/**
 * Un troncon est-il une MESURE recevable, ou une valeur inventee ?
 *
 * C'est le seul garde-fou qui compte ici. Sans lui, l'ecriture serait
 * ouverte : n'importe quel appelant pourrait deposer sous une cle legitime
 * une distance fausse, et elle serait ensuite servie comme une MESURE pendant
 * toute la duree du TTL. Un cache de mesures doit etre ecrit par des mesures.
 */
function isMeasuredLeg(leg: unknown): boolean {
  if (!leg || typeof leg !== 'object') return false;
  const { distanceKm, durationMin, geometry } = leg as {
    distanceKm?: unknown;
    durationMin?: unknown;
    geometry?: unknown;
  };
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) return false;
  if (typeof durationMin !== 'number' || !Number.isFinite(durationMin) || durationMin < 0) {
    return false;
  }
  if (!Array.isArray(geometry) || geometry.length < 2) return false;
  return geometry.every((point) => {
    if (!Array.isArray(point) || point.length !== 2) return false;
    const [lon, lat] = point as [unknown, unknown];
    return (
      typeof lon === 'number' &&
      typeof lat === 'number' &&
      Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  });
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  const parsed = readKey(request.nextUrl.searchParams.get('key'));
  if (!parsed) {
    return NextResponse.json(
      { status: 'invalid', reason: 'key_expected' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const client = await avecBase('client', async () => getServiceSupabase());
  if (!client.ok) {
    return NextResponse.json(
      { status: 'unavailable', reason: 'client_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const clientValue = client.value;
  if (!clientValue) {
    return NextResponse.json(
      { status: 'unavailable', reason: 'service_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const lecture = await avecBase('get_route_cache', () =>
    clientValue.rpc('get_route_cache', { p_cache_key: parsed.key }),
  );
  if (!lecture.ok) {
    return NextResponse.json(
      { status: 'unavailable', reason: 'cache_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { data, error } = lecture.value;
  if (error) {
    // Schema absent (migration pas appliquee) ou panne : l appelant degrade.
    console.error('[route/cache] get_route_cache:', error.message);
    return NextResponse.json(
      { status: 'unavailable', reason: 'cache_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Une entree absente vaut 404, PAS une reponse vide : l appelant doit
  // pouvoir distinguer « je dois mesurer » de « la base a reponde vide ».
  if (data === null || data === undefined) {
    return NextResponse.json(
      { status: 'miss', payload: null },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { status: 'hit', payload: data },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: 'invalid', reason: 'body_expected' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { key: rawKey, mode, provider, legs } = (body ?? {}) as {
    key?: unknown;
    mode?: unknown;
    provider?: unknown;
    legs?: unknown;
  };
  const parsed = typeof rawKey === 'string' ? readKey(rawKey) : null;
  if (!parsed || parsed.mode !== mode) {
    return NextResponse.json(
      { status: 'invalid', reason: 'key_expected' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // Le mode de la cle et celui du corps doivent etre le MEME : sinon on
  // ecrirait un trace pieton sous une cle voiture.
  if (!isTravelMode(mode)) {
    return NextResponse.json(
      { status: 'invalid', reason: 'mode_expected' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (provider !== null && provider !== undefined && !PROVIDERS.has(String(provider))) {
    return NextResponse.json(
      { status: 'invalid', reason: 'provider_expected' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Un point de trop donne un troncon de trop : c est la meme coherence que
  // `normalizeOsrmRouteDetailed` exige d OSRM, on la rejoue a l ecriture.
  const expected = parsed.key.split(':')[2].split(';').length - 1;
  if (!Array.isArray(legs) || legs.length !== expected || !legs.every((l) => isMeasuredLeg(l))) {
    return NextResponse.json(
      { status: 'invalid', reason: 'legs_expected' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const client = getServiceSupabase();
  if (!client) {
    return NextResponse.json(
      { status: 'unavailable', reason: 'service_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const ttlSeconds = Number(request.nextUrl.searchParams.get('ttl') ?? 3600);
  const ecriture = await avecBase('set_route_cache', () =>
    client.rpc('set_route_cache', {
      p_cache_key: parsed.key,
      p_route_mode: parsed.mode,
      p_payload: { legs, reason: null, provider: provider ?? null },
      p_provider: provider ?? null,
      // Borne basse ET haute : un TTL negatif ne rendrait pas l entree
      // immediate, un TTL enorme la garderait bien apres le redeploiement
      // qu elle est censee survivre.
      p_ttl_seconds: Math.min(Math.max(Math.round(ttlSeconds) || 3600, 60), 86_400),
    }),
  );
  if (!ecriture.ok) {
    return NextResponse.json(
      { status: 'unavailable', reason: 'cache_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const { error } = ecriture.value;
  if (error) {
    console.error('[route/cache] set_route_cache:', error.message);
    return NextResponse.json(
      { status: 'unavailable', reason: 'cache_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { status: 'stored' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
