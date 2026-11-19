import { parseTraceSegments } from '@/features/compte/map/geometry';
import type { HikeSessionRow } from './types';

interface CarnetWindow {
  startDate: string | null;
  endDate: string | null;
}

export function isSessionInCarnetWindow(
  session: HikeSessionRow,
  window: CarnetWindow | null = null
): boolean {
  const start = window?.startDate?.trim();
  const end = window?.endDate?.trim();
  if (!start || !end) return true;
  const at = session.started_at?.slice(0, 10) ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(at) && at >= start && at <= end;
}

/**
 * Choisit une trace parmi les sorties déjà autorisées par l'appelant, dans
 * l'ordre fourni. Les sorties du séjour ont priorité sur les autres sorties
 * liées. La sélection conserve les segments séparés des tracés masqués.
 */
export function pickCarnetTraceSession(
  sessions: HikeSessionRow[],
  window: CarnetWindow | null = null
): HikeSessionRow | null {
  let fallback: HikeSessionRow | null = null;
  for (const session of sessions) {
    if (!parseTraceSegments(session.positions_geojson).some((segment) => segment.length >= 2)) continue;
    if (isSessionInCarnetWindow(session, window)) return session;
    fallback ??= session;
  }
  return fallback;
}

export function pickCarnetTrace(
  sessions: HikeSessionRow[],
  window: CarnetWindow | null = null
): unknown | null {
  return pickCarnetTraceSession(sessions, window)?.positions_geojson ?? null;
}
