/**
 * CHANTIER ATLAS — Phase 5
 * Garde serveur commune des endpoints viewport (`/api/hikes`, `/api/pois`) :
 *   - bbox optionnelle, validée et plafonnée à MAX_BBOX_SPAN_DEG (parseBboxQuery) ;
 *   - refus explicite 400 si partielle/invalide (jamais de bbox devinée).
 * Le rate limiting est appliqué par les routes via `enforceRateLimit`
 * (failMode `open` : lectures publiques, repli mémoire dégradé journalisé).
 */
import { NextResponse } from 'next/server';
import { parseBboxQuery, type BboxQuery } from './bbox';

export type ViewportParseResult =
  | { ok: true; bbox: BboxQuery | null; clamped: boolean }
  | { ok: false; response: NextResponse };

const BBOX_KEYS = ['min_lng', 'min_lat', 'max_lng', 'max_lat'] as const;
const CAMEL_TO_SNAKE_BBOX: ReadonlyArray<readonly [string, string]> = [
  ['minLng', 'min_lng'],
  ['minLat', 'min_lat'],
  ['maxLng', 'max_lng'],
  ['maxLat', 'max_lat'],
];

export function parseOptionalBbox(searchParams: URLSearchParams): ViewportParseResult {
  const hasCamel = CAMEL_TO_SNAKE_BBOX.some(([camel]) => searchParams.has(camel));
  let normalized = searchParams;
  if (hasCamel) {
    normalized = new URLSearchParams(searchParams.toString());
    for (const [camel, snake] of CAMEL_TO_SNAKE_BBOX) {
      if (!normalized.has(snake) && normalized.has(camel)) {
        const val = normalized.get(camel);
        if (val !== null) normalized.set(snake, val);
      }
    }
  }
  const hasAny = BBOX_KEYS.some((key) => normalized.has(key));
  if (!hasAny) {
    return { ok: true, bbox: null, clamped: false };
  }
  const parsed = parseBboxQuery(normalized);
  if (!parsed.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: parsed.error }, { status: 400 }),
    };
  }
  return { ok: true, bbox: parsed.bbox, clamped: parsed.clamped };
}

/** Politique de rate limiting des lectures viewport publiques. */
export const VIEWPORT_RATE_LIMIT = {
  limit: 120,
  windowMs: 60_000,
  failMode: 'open' as const,
};

export type NumericParseResult =
  | { ok: true; value: number | null }
  | { ok: false; response: NextResponse };

/**
 * Valide un paramètre numérique optionnel : absent ⇒ null ; présent mais
 * non fini/vide ⇒ 400 explicite (jamais de NaN transmis à la RPC/au query builder).
 */
export function parseOptionalNumber(
  searchParams: URLSearchParams,
  key: string
): NumericParseResult {
  if (!searchParams.has(key)) return { ok: true, value: null };
  const raw = searchParams.get(key);
  if (raw === null || raw.trim() === '') {
    return {
      ok: false,
      response: NextResponse.json({ error: `${key} invalide (nombre fini requis)` }, { status: 400 }),
    };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      response: NextResponse.json({ error: `${key} invalide (nombre fini requis)` }, { status: 400 }),
    };
  }
  return { ok: true, value };
}

/**
 * Variante bornée : rejette explicitement (400) toute valeur hors `[min, max]`.
 * Empêche les `limit` géants (dumps massifs) et les zooms absurdes côté public.
 */
export function parseOptionalNumberInRange(
  searchParams: URLSearchParams,
  key: string,
  min: number,
  max: number
): NumericParseResult {
  const parsed = parseOptionalNumber(searchParams, key);
  if (!parsed.ok) return parsed;
  if (parsed.value === null) return parsed;
  if (parsed.value < min || parsed.value > max) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${key} hors bornes (${min}..${max})` },
        { status: 400 }
      ),
    };
  }
  return parsed;
}

/** Bornes publiques des paramètres viewport. */
export const VIEWPORT_PARAM_RANGES = {
  limit: { min: 1, max: 300 },
  zoom: { min: 0, max: 22 },
  minDist: { min: 0, max: 1000 },
  maxDist: { min: 0, max: 1000 },
} as const;
