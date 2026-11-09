/**
 * Un seul état de jour pour toute la fiche : la carte du haut, le tiroir et la
 * carte du bas lisent le MÊME `activeDay` (0 = Résumé, 1..n = jour n) et ce
 * module est l'unique endroit où ce jour filtre les données. Aucune valeur
 * n'est inventée : un champ absent reste `null`.
 */
import type {
  CarnetBudgetItem,
  CarnetDay,
  CarnetDetail,
  CarnetEtapeDay,
  CarnetKitItemRow,
  CarnetMomentItem,
  CarnetNightItem,
} from './types';

export interface DayData {
  /** 0 = Résumé (tout le carnet). */
  day: number;
  moments: CarnetMomentItem[];
  photoMoments: CarnetMomentItem[];
  etapes: CarnetEtapeDay[];
  nights: CarnetNightItem[];
  /** Objets cités ce jour-là ; au Résumé, tout le kit. */
  kitItems: CarnetKitItemRow[];
  budgetItems: CarnetBudgetItem[];
}

const dayOf = (day: CarnetDay): number => day.dayNumber ?? day.index;

/** Date `YYYY-MM-DD` d'un jour du carnet (pour rattacher une dépense). */
function dateOfDay(detail: CarnetDetail, dayNumber: number): string | null {
  const found = detail.days.find((d) => dayOf(d) === dayNumber);
  return found?.date ?? null;
}

export function selectDayData(detail: CarnetDetail, day: number): DayData {
  if (day <= 0) {
    return {
      day: 0,
      moments: detail.moments,
      photoMoments: detail.photoMoments,
      etapes: detail.etapes,
      nights: detail.nights ?? [],
      kitItems: detail.kit.items,
      budgetItems: detail.budget?.items ?? [],
    };
  }
  const date = dateOfDay(detail, day);
  return {
    day,
    moments: detail.moments.filter((m) => m.dayNumber === day),
    photoMoments: detail.photoMoments.filter((m) => m.dayNumber === day),
    etapes: detail.etapes.filter((e) => e.dayNumber === day),
    nights: (detail.nights ?? []).filter((n) => n.dayNumber === day),
    kitItems: detail.kit.items.filter((item) => item.joursUtilises?.includes(day)),
    budgetItems: (detail.budget?.items ?? []).filter((item) => (date ? item.date === date : false)),
  };
}

/** « 6 h 40 », « 6h », « 7 h 10 min » → minutes ; `null` si illisible. */
export function parseDurationMinutes(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /(\d+)\s*h(?:\s*(\d+))?/i.exec(text);
  if (!match) return null;
  return Number(match[1]) * 60 + (match[2] ? Number(match[2]) : 0);
}

export interface DayStat {
  dayNumber: number;
  distanceKm: number | null;
  elevationM: number | null;
  durationMin: number | null;
}

/** Chiffres de chaque jour : l'étape déclarée commande, le jour mesuré complète. */
export function resolveDayStats(detail: Pick<CarnetDetail, 'days' | 'etapes'>): DayStat[] {
  const numbers = new Set<number>();
  detail.days.forEach((d) => numbers.add(dayOf(d)));
  detail.etapes.forEach((e) => numbers.add(e.dayNumber));
  return [...numbers]
    .sort((a, b) => a - b)
    .map((dayNumber) => {
      const day = detail.days.find((d) => dayOf(d) === dayNumber) ?? null;
      const etape = detail.etapes.find((e) => e.dayNumber === dayNumber) ?? null;
      return {
        dayNumber,
        distanceKm: etape?.distanceKm ?? day?.distanceKm ?? null,
        elevationM: etape?.elevationM ?? day?.elevationM ?? null,
        durationMin:
          parseDurationMinutes(etape?.durationText) ??
          (day?.durationS != null ? Math.round(day.durationS / 60) : null),
      };
    });
}

export type DayMetricKey = 'distance' | 'elevation' | 'duration';

export interface DayMetric {
  rows: Array<{ dayNumber: number; value: number | null }>;
  total: number | null;
  /** Moyenne des jours renseignés. */
  average: number | null;
  /** Valeur du jour affiché (`null` au Résumé ou si non renseignée). */
  current: number | null;
  /** Écart en % du jour à la moyenne (`null` si l'un des deux manque). */
  deltaPct: number | null;
}

export function dayMetric(
  detail: Pick<CarnetDetail, 'days' | 'etapes'>,
  day: number,
  key: DayMetricKey
): DayMetric {
  const pick = (s: DayStat): number | null =>
    key === 'distance' ? s.distanceKm : key === 'elevation' ? s.elevationM : s.durationMin;
  const rows = resolveDayStats(detail).map((s) => ({ dayNumber: s.dayNumber, value: pick(s) }));
  const known = rows.map((r) => r.value).filter((v): v is number => v !== null);
  const total = known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
  const average = known.length > 0 ? (total as number) / known.length : null;
  const current = day > 0 ? (rows.find((r) => r.dayNumber === day)?.value ?? null) : null;
  const deltaPct =
    current !== null && average !== null && average > 0
      ? Math.round((current / average - 1) * 100)
      : null;
  return { rows, total, average, current, deltaPct };
}
