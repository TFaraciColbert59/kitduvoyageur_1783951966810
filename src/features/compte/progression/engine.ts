/**
 * Progression des sorties — calculs purs, sans réseau ni persistance.
 *
 * S2.17 (calendrier et synthèse hebdomadaire) et S2.18 (cumuls par sport et
 * période comparable) partagent ce moteur. Il ne lit que les séances réelles
 * transmises par le bootstrap du Compte et ne fabrique aucune valeur :
 *   - une métrique absente reste `null` (l'UI affiche « indisponible ») ;
 *   - un sport inconnu n'est jamais deviné (groupe « Sport non renseigné ») ;
 *   - seules les séances terminées entrent dans les cumuls ;
 *   - les jours et périodes sont découpés dans le fuseau choisi.
 *
 * Aucune migration : le moteur ne fait que lire les contrats existants
 * (`hike_sessions`, `activity_sessions` via le lien de séance, fuseau du profil
 * voyageur). Voir `docs/compte/A05-S2.17-S2.18-DEPENDANCES.md`.
 */

export type ProgressionSessionStatus = 'done' | 'ongoing' | 'planned' | 'unknown';

export type ProgressionPeriod = '7d' | '30d' | '90d' | '12m' | 'all';

export interface ProgressionSession {
  id: string;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  /** Distance réellement enregistrée, ou `null` si la colonne est absente. */
  km: number | null;
  /** Dénivelé positif réellement enregistré, ou `null`. */
  dplus: number | null;
  /** Durée enregistrée en secondes, ou `null`. */
  durationS: number | null;
  /** Identifiant de sport (`rando`, `course`, …) ou `null` s'il n'est pas connu. */
  sport: string | null;
  /** Massif / région de l'itinéraire, jamais une coordonnée. */
  massif: string | null;
}

export interface ProgressionMetric {
  /** Somme des valeurs présentes, ou `null` si aucune valeur n'est présente. */
  value: number | null;
  /** Nombre de séances portant une valeur exploitable. */
  present: number;
  /** Nombre de séances dont la valeur est absente. */
  missing: number;
}

export interface ProgressionTotals {
  sessions: number;
  km: ProgressionMetric;
  dplusM: ProgressionMetric;
  durationS: ProgressionMetric;
}

export interface ProgressionSportGroup extends ProgressionTotals {
  sport: string | null;
  label: string;
}

export interface ProgressionDateRange {
  startKey: string;
  endKey: string;
  label: string;
  previous: { startKey: string; endKey: string } | null;
}

export interface ProgressionPeriodStats {
  range: ProgressionDateRange;
  totals: ProgressionTotals;
  previousTotals: ProgressionTotals | null;
  sports: ProgressionSportGroup[];
  /** Séances terminées et comprises dans la période. */
  done: number;
  /** Séances terminées dont le sport n'est pas connu. */
  unknownSport: number;
  /** Séances non terminées présentes dans la période (exclues des cumuls). */
  excluded: number;
}

export interface ProgressionCalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
  sessions: ProgressionSession[];
  done: number;
  km: ProgressionMetric;
  dplusM: ProgressionMetric;
}

export interface ProgressionCalendarMonth {
  key: string;
  year: number;
  month: number;
  label: string;
  days: ProgressionCalendarDay[];
}

export interface ProgressionWeekSummary {
  startKey: string;
  endKey: string;
  label: string;
  sessions: ProgressionSession[];
  totals: ProgressionTotals;
  done: number;
}

export interface ProgressionMonthlyPoint {
  key: string;
  label: string;
  sessions: number;
  km: ProgressionMetric;
  dplusM: ProgressionMetric;
}

export interface ResolvedTimeZone {
  timeZone: string;
  source: 'profile' | 'browser' | 'utc';
}

/**
 * Libellés de la taxonomie fermée `explorer_sport_map`. Un identifiant inconnu
 * est affiché tel quel : on ne le renomme jamais en un sport supposé.
 */
export const SPORT_LABELS: Readonly<Record<string, string>> = {
  course: 'Course',
  rando: 'Randonnée',
  velo: 'Vélo',
  kayak: 'Kayak',
  trail: 'Trail',
  ski: 'Ski de rando',
  escalade: 'Escalade',
  famille: 'Balade en famille',
  bivouac: 'Bivouac',
};

export const PROGRESSION_PERIODS: ReadonlyArray<{ id: ProgressionPeriod; label: string }> = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '90d', label: '90 jours' },
  { id: '12m', label: '12 mois' },
  { id: 'all', label: 'Tout' },
];

const MONTHS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

const DAY_MS = 86_400_000;
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateKeyFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  dateKeyFormatters.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fuseau retenu : celui du profil voyageur, sinon celui du navigateur, sinon
 * UTC. La source est conservée pour que l'UI puisse dire d'où vient le découpage.
 */
export function resolveTimeZone(value?: string | null): ResolvedTimeZone {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (candidate && isValidTimeZone(candidate)) {
    return { timeZone: candidate, source: 'profile' };
  }
  try {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browser && isValidTimeZone(browser)) {
      return { timeZone: browser, source: 'browser' };
    }
  } catch {
    // Aucun fuseau navigateur : UTC reste explicite, jamais supposé.
  }
  return { timeZone: 'UTC', source: 'utc' };
}

/** Date civile (`YYYY-MM-DD`) d'un instant, dans le fuseau demandé. */
export function localDateKey(value: string | null | undefined, timeZone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = dateFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export function todayKey(timeZone: string, now = new Date()): string {
  return localDateKey(now.toISOString(), timeZone) ?? now.toISOString().slice(0, 10);
}

export function addDaysToKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonthsToKey(key: string, months: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function startOfWeekKey(key: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDaysToKey(key, -offset);
}

export function daysBetweenKeys(startKey: string, endKey: string): number {
  const start = new Date(`${startKey}T00:00:00Z`).getTime();
  const end = new Date(`${endKey}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const label = MONTHS_LONG[month - 1] ?? monthKey;
  return `${label} ${year}`;
}

export function shortDateLabel(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function longDateLabel(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function sportLabel(sport: string | null): string {
  if (!sport) return 'Sport non renseigné';
  return SPORT_LABELS[sport] ?? sport;
}

export function sessionStatus(session: ProgressionSession, now = Date.now()): ProgressionSessionStatus {
  const start = session.startedAt ? Date.parse(session.startedAt) : NaN;
  if (!Number.isFinite(start)) return 'unknown';
  const end = session.endedAt ? Date.parse(session.endedAt) : NaN;
  if (Number.isFinite(end) && end < start) return 'unknown';
  if (start > now) return 'planned';
  if (Number.isFinite(end) && end <= now) return 'done';
  if (Number.isFinite(end) && end > now) return 'ongoing';
  return 'unknown';
}

export function isDone(session: ProgressionSession, now = Date.now()): boolean {
  return sessionStatus(session, now) === 'done';
}

function metric(sessions: ProgressionSession[], pick: (session: ProgressionSession) => number | null): ProgressionMetric {
  let value = 0;
  let present = 0;
  let missing = 0;
  for (const session of sessions) {
    const candidate = pick(session);
    if (candidate === null || !Number.isFinite(candidate)) {
      missing += 1;
      continue;
    }
    value += candidate;
    present += 1;
  }
  return { value: present > 0 ? value : null, present, missing };
}

export function totalsFor(sessions: ProgressionSession[]): ProgressionTotals {
  return {
    sessions: sessions.length,
    km: metric(sessions, (session) => session.km),
    dplusM: metric(sessions, (session) => session.dplus),
    durationS: metric(sessions, (session) => session.durationS),
  };
}

export function periodRange(period: ProgressionPeriod, timeZone: string, now = new Date()): ProgressionDateRange {
  const endKey = todayKey(timeZone, now);
  if (period === 'all') {
    return {
      startKey: '0000-01-01',
      endKey,
      label: 'Tout l’historique',
      previous: null,
    };
  }

  let startKey: string;
  let label: string;
  if (period === '12m') {
    startKey = addDaysToKey(addMonthsToKey(endKey, -12), 1);
    label = '12 derniers mois';
  } else {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    startKey = addDaysToKey(endKey, -(days - 1));
    label = `${days} derniers jours`;
  }

  const length = daysBetweenKeys(startKey, endKey) + 1;
  const previousEnd = addDaysToKey(startKey, -1);
  const previousStart = addDaysToKey(previousEnd, -(length - 1));
  return {
    startKey,
    endKey,
    label,
    previous: { startKey: previousStart, endKey: previousEnd },
  };
}

function inRange(session: ProgressionSession, startKey: string, endKey: string, timeZone: string): boolean {
  const key = localDateKey(session.startedAt, timeZone);
  if (!key) return false;
  return key >= startKey && key <= endKey;
}

export function buildPeriodStats(
  sessions: ProgressionSession[],
  period: ProgressionPeriod,
  timeZone: string,
  now = new Date()
): ProgressionPeriodStats {
  const range = periodRange(period, timeZone, now);
  const nowMs = now.getTime();
  const doneSessions = sessions.filter((session) => isDone(session, nowMs));
  const current = doneSessions.filter((session) => inRange(session, range.startKey, range.endKey, timeZone));
  const previous = range.previous
    ? doneSessions.filter((session) =>
        inRange(session, range.previous!.startKey, range.previous!.endKey, timeZone)
      )
    : null;

  const groups = new Map<string, ProgressionSession[]>();
  for (const session of current) {
    const key = session.sport ?? '';
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }

  const sports: ProgressionSportGroup[] = [...groups.entries()]
    .map(([sport, group]) => ({
      sport: sport || null,
      label: sportLabel(sport || null),
      ...totalsFor(group),
    }))
    .sort((left, right) => {
      if (left.sport === null) return 1;
      if (right.sport === null) return -1;
      return left.label.localeCompare(right.label, 'fr');
    });

  const excluded = sessions.filter(
    (session) =>
      !isDone(session, nowMs) && inRange(session, range.startKey, range.endKey, timeZone)
  ).length;

  return {
    range,
    totals: totalsFor(current),
    previousTotals: previous ? totalsFor(previous) : null,
    sports,
    done: current.length,
    unknownSport: current.filter((session) => !session.sport).length,
    excluded,
  };
}

export function buildMonthCalendar(
  sessions: ProgressionSession[],
  monthKey: string,
  timeZone: string,
  now = new Date()
): ProgressionCalendarMonth {
  const [year, month] = monthKey.split('-').map(Number);
  const safeYear = Number.isFinite(year) ? year : now.getUTCFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1;
  const normalizedKey = `${safeYear}-${String(safeMonth).padStart(2, '0')}`;
  const firstKey = `${normalizedKey}-01`;
  const firstWeekday = new Date(`${firstKey}T00:00:00Z`).getUTCDay();
  const leading = (firstWeekday + 6) % 7;
  const gridStart = addDaysToKey(firstKey, -leading);
  const nowMs = now.getTime();

  const byDay = new Map<string, ProgressionSession[]>();
  for (const session of sessions) {
    const key = localDateKey(session.startedAt, timeZone);
    if (!key) continue;
    const list = byDay.get(key) ?? [];
    list.push(session);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) {
    list.sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''));
  }

  const days: ProgressionCalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const key = addDaysToKey(gridStart, index);
    const daySessions = byDay.get(key) ?? [];
    const doneSessions = daySessions.filter((session) => isDone(session, nowMs));
    const day = Number(key.slice(8, 10));
    days.push({
      key,
      day,
      inMonth: key.slice(0, 7) === normalizedKey,
      sessions: daySessions,
      done: doneSessions.length,
      km: metric(doneSessions, (session) => session.km),
      dplusM: metric(doneSessions, (session) => session.dplus),
    });
  }

  return {
    key: normalizedKey,
    year: safeYear,
    month: safeMonth,
    label: monthLabel(normalizedKey),
    days,
  };
}

export function buildWeekSummary(
  sessions: ProgressionSession[],
  anchorKey: string,
  timeZone: string,
  now = new Date()
): ProgressionWeekSummary {
  const startKey = startOfWeekKey(anchorKey);
  const endKey = addDaysToKey(startKey, 6);
  const nowMs = now.getTime();
  const weekSessions = sessions.filter((session) => {
    const key = localDateKey(session.startedAt, timeZone);
    return Boolean(key && key >= startKey && key <= endKey);
  });
  const doneSessions = weekSessions.filter((session) => isDone(session, nowMs));
  return {
    startKey,
    endKey,
    label: `${shortDateLabel(startKey)} – ${shortDateLabel(endKey)}`,
    sessions: weekSessions,
    totals: totalsFor(doneSessions),
    done: doneSessions.length,
  };
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchSessions(
  sessions: ProgressionSession[],
  query: string,
  timeZone: string
): ProgressionSession[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  return sessions
    .filter((session) => {
      const key = localDateKey(session.startedAt, timeZone);
      const haystack = normalizeSearch(
        [
          session.title,
          session.massif ?? '',
          session.sport ?? '',
          sportLabel(session.sport),
          key ?? '',
          key ? longDateLabel(key) : '',
        ].join(' ')
      );
      return haystack.includes(needle);
    })
    .sort((left, right) => (right.startedAt ?? '').localeCompare(left.startedAt ?? ''))
    .slice(0, 24);
}

export function buildMonthlyProgression(
  sessions: ProgressionSession[],
  timeZone: string,
  now = new Date(),
  monthCount = 12
): ProgressionMonthlyPoint[] {
  const endKey = todayKey(timeZone, now);
  const endMonth = monthKeyOf(endKey);
  const nowMs = now.getTime();
  const doneSessions = sessions.filter((session) => isDone(session, nowMs));
  const points: ProgressionMonthlyPoint[] = [];

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const key = shiftMonthKey(endMonth, -offset);
    const monthSessions = doneSessions.filter((session) => {
      const sessionKey = localDateKey(session.startedAt, timeZone);
      return Boolean(sessionKey && sessionKey.slice(0, 7) === key);
    });
    const [year, month] = key.split('-').map(Number);
    points.push({
      key,
      label: `${MONTHS_SHORT[month - 1] ?? key} ${String(year).slice(2)}`,
      sessions: monthSessions.length,
      km: metric(monthSessions, (session) => session.km),
      dplusM: metric(monthSessions, (session) => session.dplus),
    });
  }

  return points;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}
