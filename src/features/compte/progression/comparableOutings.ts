/**
 * Sorties comparables sur le même itinéraire ou massif/distance proche (A05 · S2.26).
 */

import { isDone, localDateKey, type ProgressionSession } from './engine';
import type { OutingDetail } from '@/features/compte/server/sorties';
import { formatChronoS } from './runningRecords';

export interface ComparableOutingEntry {
  id: string;
  title: string;
  dateKey: string | null;
  distanceKm: number | null;
  dplusM: number | null;
  durationS: number | null;
  paceMinPerKm: number | null;
  deltaDurationS: number | null;
  matchReason: 'meme-itineraire' | 'meme-massif-distance' | 'titre-similaire';
  isCurrent: boolean;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findComparableOutings(
  current: Pick<OutingDetail, 'id' | 'title' | 'date' | 'sport' | 'massif' | 'routeName' | 'km' | 'dplus' | 'durationS' | 'paceMinPerKm'>,
  allSessions: readonly ProgressionSession[],
  timeZone: string
): ComparableOutingEntry[] {
  const curRoute = normalizeText(current.routeName);
  const curTitle = normalizeText(current.title);
  const curMassif = normalizeText(current.massif);

  const matches: ComparableOutingEntry[] = [];

  for (const s of allSessions) {
    if (s.id === current.id || !isDone(s)) continue;
    if (current.sport && s.sport && current.sport !== s.sport) continue;

    const sTitle = normalizeText(s.title);
    const sMassif = normalizeText(s.massif);
    const kmClose =
      current.km !== null &&
      s.km !== null &&
      current.km > 0 &&
      Math.abs(s.km - current.km) / current.km <= 0.12;
    const dplusClose =
      current.dplus === null ||
      s.dplus === null ||
      Math.abs(s.dplus - current.dplus) <= Math.max(120, current.dplus * 0.2);

    let reason: ComparableOutingEntry['matchReason'] | null = null;
    if (curRoute && sTitle.includes(curRoute)) {
      reason = 'meme-itineraire';
    } else if (curTitle.length >= 5 && sTitle === curTitle) {
      reason = 'titre-similaire';
    } else if (curMassif && sMassif === curMassif && kmClose && dplusClose) {
      reason = 'meme-massif-distance';
    }

    if (!reason) continue;

    const pace =
      s.km && s.km > 0 && s.durationS && s.durationS > 0
        ? Math.round(((s.durationS / 60) / s.km) * 100) / 100
        : null;
    const deltaDurationS =
      current.durationS !== null && s.durationS !== null
        ? Math.round(current.durationS - s.durationS)
        : null;

    matches.push({
      id: s.id,
      title: s.title,
      dateKey: localDateKey(s.startedAt ?? s.endedAt, timeZone),
      distanceKm: s.km,
      dplusM: s.dplus,
      durationS: s.durationS,
      paceMinPerKm: pace,
      deltaDurationS,
      matchReason: reason,
      isCurrent: false,
    });
  }

  return matches
    .sort((a, b) => (b.dateKey ?? '').localeCompare(a.dateKey ?? ''))
    .slice(0, 6);
}

export function formatDurationDelta(deltaS: number | null): string {
  if (deltaS === null || !Number.isFinite(deltaS)) return '—';
  if (Math.abs(deltaS) < 5) return 'Identique';
  const sign = deltaS < 0 ? '-' : '+';
  return `${sign}${formatChronoS(Math.abs(deltaS))} ${deltaS < 0 ? '(plus rapide)' : '(plus lent)'}`;
}
