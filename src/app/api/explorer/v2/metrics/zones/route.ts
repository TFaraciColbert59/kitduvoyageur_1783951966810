import { NextRequest, NextResponse } from 'next/server';

import type { ZoneMetric } from '@/features/explorer-v2/metrics/activityMetrics';
import {
  listZoneConfigs,
  saveZoneConfiguration,
} from '@/features/explorer-v2/server/zoneConfigs';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } as const;
const METRICS: readonly ZoneMetric[] = ['heartRate', 'power', 'pace'];

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function isMetric(value: string): value is ZoneMetric {
  return (METRICS as readonly string[]).includes(value);
}

/**
 * Lecture des configurations privées de zones et de seuils.
 *
 * Paramètres obligatoires : `limit` (1–100). Filtres facultatifs : `metric`,
 * `discipline`, `at` (millisecondes UTC). Sans `at`, les configurations les
 * plus récentes sont retournées ; avec `at`, seules celles déjà effectives à
 * cet instant. Aucune configuration n'est inventée quand la liste est vide.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  const rawLimit = params.get('limit');
  if (rawLimit === null) return json({ error: 'limit requis' }, 400);
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return json({ error: 'limit invalide' }, 400);
  }

  const rawMetric = params.get('metric');
  let metric: ZoneMetric | null = null;
  if (rawMetric !== null) {
    if (!isMetric(rawMetric)) return json({ error: 'metric invalide' }, 400);
    metric = rawMetric;
  }

  const discipline = params.get('discipline');
  if (discipline !== null && !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(discipline)) {
    return json({ error: 'discipline invalide' }, 400);
  }

  const rawAt = params.get('at');
  let atMs: number | null = null;
  if (rawAt !== null) {
    atMs = Number(rawAt);
    if (rawAt.trim().length === 0 || !Number.isSafeInteger(atMs)) {
      return json({ error: 'at invalide' }, 400);
    }
  }

  const result = await listZoneConfigs({
    metric,
    discipline,
    atMs,
    limit,
  });

  if (!result.ok) {
    const status =
      result.reason === 'unauthorized'
        ? 401
        : result.reason === 'invalid_query'
          ? 400
          : 503;
    return json({ error: result.reason }, status);
  }

  return json({ configs: result.configs }, 200);
}

/**
 * Enregistrement d'une configuration explicitement fournie.
 *
 * Le corps est le `ZoneSet` complet (dates en millisecondes UTC, seuil `null`
 * ou complet, zones ordonnées). Aucune valeur n'est complétée : une
 * configuration incomplète est refusée avec ses erreurs de validation.
 * Un rejeu identique est idempotent ; un rejeu avec un autre contenu est un
 * conflit `409`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.json().catch(() => null);
  const result = await saveZoneConfiguration(payload);

  if (!result.ok) {
    const status =
      result.reason === 'unauthorized'
        ? 401
        : result.reason === 'invalid_configuration'
          ? 400
          : result.reason === 'payload_mismatch'
            ? 409
            : 503;
    return json(
      {
        error: result.reason,
        ...(result.reason === 'invalid_configuration' && result.errors
          ? { errors: result.errors }
          : {}),
      },
      status
    );
  }

  return json({ created: result.created, config: result.zoneSet }, result.created ? 201 : 200);
}
