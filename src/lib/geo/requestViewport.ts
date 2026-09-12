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

export function parseOptionalBbox(searchParams: URLSearchParams): ViewportParseResult {
  const hasAny = BBOX_KEYS.some((key) => searchParams.has(key));
  if (!hasAny) {
    return { ok: true, bbox: null, clamped: false };
  }
  const parsed = parseBboxQuery(searchParams);
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
