import { addCivilDays, getCivilDurationDays, parseCivilDate, toCivilIsoString } from '@/lib/dates/tripDates';
import { dayTraceFromSteps } from '@/features/trips/domain/dayTraces';
import { haversineKm } from '@/components/map/engine/camera';
import { normalizeCivilDateString } from '@/features/trips/engine/temporalPhaseEngine';
import type { CockpitData, CockpitExpense, CockpitStep, Coordinate } from './model';

export function currentCockpitDay(
  start: string | null | undefined,
  totalDays: number | null,
  date = normalizeCivilDateString(),
): number {
  const origin = start ? parseCivilDate(start) : null;
  if (!origin) return 1;
  const startDate = toCivilIsoString(origin.year, origin.month, origin.day);
  if (date < startDate) return 1;
  const elapsed = getCivilDurationDays(startDate, date);
  return totalDays ? Math.min(elapsed, totalDays) : elapsed;
}

export function momentHour(time: string | null | undefined): number | null {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d/.test(time)) return null;
  return Number(time.slice(0, 2));
}

export function momentClock(time: string | null, timestamp: string | null): string | null {
  if (momentHour(time) !== null) return time!.slice(0, 5);
  const date = timestamp && new Date(timestamp);
  return date && Number.isFinite(date.valueOf())
    ? `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
    : null;
}

type Money = { currency: string; amount: number };
function sumCurrencies(rows: CockpitExpense[]): Money[] {
  const amounts = new Map<string, number>();
  for (const { amount, currency } of rows) amounts.set(currency, (amounts.get(currency) ?? 0) + amount);
  return [...amounts.entries()].map(([currency, amount]) => ({ currency, amount }));
}

export function cockpitDayBudget(
  budget: NonNullable<CockpitData['budget']>,
  start: string | null | undefined,
  day: number,
  totalDays: number | null,
  fallbackDate: string,
) {
  const origin = start ? parseCivilDate(start) : null;
  const date = origin
    ? addCivilDays(toCivilIsoString(origin.year, origin.month, origin.day), day - 1)
    : day === 1 ? fallbackDate : null;
  const rows = date ? budget.expenses.filter((row) => row.date === date) : [];
  const expenses = rows.filter((row) => !row.planned);
  const spent = sumCurrencies(expenses);
  const planned = sumCurrencies(rows.filter((row) => row.planned));
  let estimate = false;
  if (planned.length === 0 && budget.planned && totalDays && date && !budget.expenses.some((row) => row.planned)) {
    const { amount, currency } = budget.planned;
    const digits = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const unit = 10 ** digits;
    const minor = Math.round(amount * unit);
    planned.push({ currency, amount: (Math.floor(minor / totalDays) + Number(day <= minor % totalDays)) / unit });
    estimate = totalDays > 1;
  }
  return { expenses, spent, planned, estimate };
}

export function cockpitDayRoute(route: Coordinate[][], steps: CockpitStep[], day: number, total: number | null) {
  if (total === 1) return route;
  const anchors = steps.flatMap((step) => step.coordinate ? [step.coordinate] : []);
  if (anchors.length < 2) return [];
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (haversineKm(first, last) < 0.05) return [];
  const segment = route.find((line) =>
    [first, last].every((point) => line.some((vertex) => haversineKm(point, vertex) <= 0.5)));
  if (!segment) return [];
  const points = anchors.map(([lng, lat]) => ({ lng, lat }));
  const line = segment.map(([lng, lat]) => ({ lng, lat }));
  const clipped = dayTraceFromSteps(points, line, day, total ?? 1).map(({ lng, lat }): Coordinate => [lng, lat]);
  return clipped.length > 1 ? [clipped] : [];
}
