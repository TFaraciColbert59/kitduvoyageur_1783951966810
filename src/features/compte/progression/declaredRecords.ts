/**
 * Records personnels all-time déclarés (S2.24) & Exploits / temps forts de séance (S2.25).
 */

import { isDone, sportLabel, type ProgressionSession } from './engine';
import type { OutingDetail } from '@/features/compte/server/sorties';
import { formatChronoS } from './runningRecords';

export type DeclaredRecordCategory =
  | 'distance_km'
  | 'elevation_m'
  | 'duration_s'
  | 'chrono_5k_s'
  | 'chrono_10k_s'
  | 'chrono_half_s'
  | 'chrono_marathon_s'
  | 'ftp_w';

export interface DeclaredPersonalRecord {
  id: string;
  sport: string;
  category: DeclaredRecordCategory;
  label: string;
  value: number;
  unit: string;
  achievedDate: string | null;
  note: string;
  provenance: 'declared';
  updatedAt: string;
}

export const DECLARED_RECORD_OPTIONS: ReadonlyArray<{
  category: DeclaredRecordCategory;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
}> = [
  { category: 'chrono_5k_s', label: 'Record 5 km', unit: 's', lowerIsBetter: true },
  { category: 'chrono_10k_s', label: 'Record 10 km', unit: 's', lowerIsBetter: true },
  { category: 'chrono_half_s', label: 'Record Semi-marathon', unit: 's', lowerIsBetter: true },
  { category: 'chrono_marathon_s', label: 'Record Marathon', unit: 's', lowerIsBetter: true },
  { category: 'distance_km', label: 'Plus longue distance', unit: 'km', lowerIsBetter: false },
  { category: 'elevation_m', label: 'Plus gros D+ en une sortie', unit: 'm', lowerIsBetter: false },
  { category: 'ftp_w', label: 'Meilleure FTP vélo', unit: 'W', lowerIsBetter: false },
  { category: 'duration_s', label: 'Plus longue sortie (durée)', unit: 's', lowerIsBetter: false },
];

const STORAGE_PREFIX = 'lkdv.progression.declaredRecords.v1:';

export function readDeclaredRecords(accountKey = 'anonymous'): DeclaredPersonalRecord[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${accountKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeclaredPersonalRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveDeclaredRecord(
  accountKey: string,
  record: Omit<DeclaredPersonalRecord, 'id' | 'provenance' | 'updatedAt'> & { id?: string }
): DeclaredPersonalRecord[] {
  const existing = readDeclaredRecords(accountKey);
  const nextItem: DeclaredPersonalRecord = {
    ...record,
    id: record.id ?? `pr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    provenance: 'declared',
    updatedAt: new Date().toISOString(),
  };
  const next = [nextItem, ...existing.filter((item) => item.id !== nextItem.id)];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${accountKey}`, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function deleteDeclaredRecord(accountKey: string, recordId: string): DeclaredPersonalRecord[] {
  const next = readDeclaredRecords(accountKey).filter((item) => item.id !== recordId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${accountKey}`, JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
  return next;
}

export function formatDeclaredRecordValue(record: Pick<DeclaredPersonalRecord, 'category' | 'value' | 'unit'>): string {
  if (record.unit === 's') return formatChronoS(record.value);
  return `${record.value} ${record.unit}`;
}

export interface SessionHighlight {
  id: string;
  kind: 'record' | 'achievement' | 'milestone';
  title: string;
  detail: string;
  metricValue: string;
}

/**
 * S2.25 : Exploits & temps forts d'une sortie comparée à l'historique du compte
 * (ou ses propres chiffres si aucun historique comparatif n'est fourni).
 */
export function detectOutingHighlights(
  outing: Pick<
    OutingDetail,
    'id' | 'sport' | 'km' | 'dplus' | 'durationS' | 'paceMinPerKm' | 'powerW' | 'heartRateBpm' | 'maxAlt'
  >,
  history: readonly ProgressionSession[] = []
): SessionHighlight[] {
  const highlights: SessionHighlight[] = [];
  const otherDone = history.filter((s) => s.id !== outing.id && isDone(s));
  const sameSport = outing.sport
    ? otherDone.filter((s) => s.sport === outing.sport)
    : otherDone;

  if (typeof outing.km === 'number' && Number.isFinite(outing.km) && outing.km > 0) {
    const prevMaxKm = sameSport.reduce((max, s) => Math.max(max, s.km ?? 0), 0);
    if (sameSport.length >= 2 && outing.km > prevMaxKm) {
      highlights.push({
        id: 'best-distance',
        kind: 'record',
        title: `Record de distance (${sportLabel(outing.sport)})`,
        detail: `Dépasse ton précédent maximum de ${prevMaxKm.toFixed(1)} km.`,
        metricValue: `${outing.km.toFixed(1)} km`,
      });
    } else if (outing.km >= 20) {
      highlights.push({
        id: 'long-outing',
        kind: 'milestone',
        title: 'Sortie longue validée',
        detail: 'Distance soutenue supérieure à 20 km.',
        metricValue: `${outing.km.toFixed(1)} km`,
      });
    }
  }

  if (typeof outing.dplus === 'number' && Number.isFinite(outing.dplus) && outing.dplus > 0) {
    const prevMaxDplus = sameSport.reduce((max, s) => Math.max(max, s.dplus ?? 0), 0);
    if (sameSport.length >= 2 && outing.dplus > prevMaxDplus) {
      highlights.push({
        id: 'best-dplus',
        kind: 'record',
        title: `Record de dénivelé (${sportLabel(outing.sport)})`,
        detail: `Devant ton précédent sommet à +${Math.round(prevMaxDplus)} m.`,
        metricValue: `+${Math.round(outing.dplus)} m`,
      });
    } else if (outing.dplus >= 1000) {
      highlights.push({
        id: 'big-climb',
        kind: 'achievement',
        title: 'Grosse journée en dénivelé',
        detail: 'Plus de 1 000 m de dénivelé positif cumulés.',
        metricValue: `+${Math.round(outing.dplus)} m`,
      });
    }
  }

  if (
    typeof outing.paceMinPerKm === 'number' &&
    Number.isFinite(outing.paceMinPerKm) &&
    outing.paceMinPerKm > 1 &&
    outing.km &&
    outing.km >= 3
  ) {
    const paces = sameSport
      .filter((s) => s.km && s.km >= 3 && s.durationS && s.durationS > 60)
      .map((s) => s.durationS! / 60 / s.km!);
    const bestPrevPace = paces.length > 0 ? Math.min(...paces) : null;
    if (bestPrevPace !== null && outing.paceMinPerKm < bestPrevPace - 0.03) {
      highlights.push({
        id: 'fastest-pace',
        kind: 'record',
        title: 'Allure la plus rapide sur 3+ km',
        detail: `Meilleure allure moyenne que tes ${paces.length} sorties précédentes.`,
        metricValue: `${outing.paceMinPerKm.toFixed(2)} min/km`,
      });
    }
  }

  if (typeof outing.maxAlt === 'number' && Number.isFinite(outing.maxAlt) && outing.maxAlt >= 2000) {
    highlights.push({
      id: 'high-alt',
      kind: 'milestone',
      title: 'Passage en haute altitude',
      detail: 'Altitude maximale enregistrée au-dessus de 2 000 m.',
      metricValue: `${Math.round(outing.maxAlt)} m`,
    });
  }

  return highlights;
}
