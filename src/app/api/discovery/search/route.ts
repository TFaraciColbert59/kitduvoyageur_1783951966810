// src/app/api/discovery/search/route.ts
// Frontière réseau unique de la couche découverte. Le fournisseur (viator,
// klook, editorial, terra, legacy) est choisi CÔTÉ SERVEUR via DISCOVERY_PROVIDER.
// Aucun proxy ouvert : paramètres en allowlist stricte, clé jamais côté client.
import { NextRequest, NextResponse } from 'next/server';
import {
  DISCOVERY_QUERY_KEYS,
  discoveryItemsSchema,
  discoveryQuerySchema,
} from '@/features/discovery/schemas/discovery.schema';
import { getDiscovery } from '@/features/discovery/services/discoveryService';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function httpStatusFor(result: Awaited<ReturnType<typeof getDiscovery>>): number {
  if (result.status === 'quota') return 429;
  if (result.status === 'ok' || result.status === 'empty' || result.status === 'unconfigured') {
    return 200;
  }
  if (result.reason === 'unknown_country') return 404;
  return 502;
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { status: 'quota', message: 'Trop de requêtes. Réessayez dans une minute.' },
      { status: 429, headers: NO_STORE }
    );
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const unknownKeys = Object.keys(raw).filter(
    (key) => !(DISCOVERY_QUERY_KEYS as readonly string[]).includes(key)
  );

  const parsed = discoveryQuerySchema.safeParse(raw);
  if (unknownKeys.length > 0 || !parsed.success) {
    return NextResponse.json(
      { status: 'error', reason: 'invalid_request', message: 'Requête invalide.' },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await getDiscovery(parsed.data);

  if (result.items.length > 0 && !discoveryItemsSchema.safeParse(result.items).success) {
    return NextResponse.json(
      { status: 'error', reason: 'invalid_response', message: 'Données indisponibles.' },
      { status: 502, headers: NO_STORE }
    );
  }

  return NextResponse.json(result, { status: httpStatusFor(result), headers: NO_STORE });
}
