/** Période Mission Control — pur, testé. */
export type PeriodKey = "Aujourd'hui" | '7 jours' | '30 jours' | 'custom';

export interface PeriodRange {
  current: PeriodKey | string;
  from?: string;
  to?: string;
}

const DAY = 24 * 60 * 60 * 1000;

export function parsePeriod(sp: { period?: string; from?: string; to?: string }): PeriodRange {
  const raw = (sp.period ?? '').slice(0, 20);
  const now = new Date();
  if (raw === 'custom' && sp.from) {
    return { current: 'custom', from: sp.from.slice(0, 10), to: (sp.to ?? '').slice(0, 10) || undefined };
  }
  if (raw === '7 jours') {
    return { current: raw, from: new Date(now.getTime() - 7 * DAY).toISOString() };
  }
  if (raw === '30 jours') {
    return { current: raw, from: new Date(now.getTime() - 30 * DAY).toISOString() };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { current: "Aujourd'hui", from: start.toISOString() };
}

export function greeting(hour: number, name: string): string {
  const hello = hour < 18 ? 'Bonjour' : 'Bonsoir';
  return `${hello} ${name}`;
}
