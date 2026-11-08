/**
 * Communauté v2 — formatage français et calculs purs.
 *
 * Aucune dépendance React, aucun accès réseau, aucune locale implicite : le fuseau
 * de référence est Europe/Paris (comme le reste du produit). Toutes les fonctions
 * sont déterministes et couvertes par `__tests__/format.test.ts`.
 *
 * Conventions du produit (annexe C § 9) :
 * - nombres `fr-FR`, une décimale maximum, virgule décimale ;
 * - séparateur de méta « · » ;
 * - unités « km », « m », « +{n} m », « g »/« kg », « min », « % » précédé d'une espace ;
 * - pluriels réels : 0 et 1 au singulier, pluriel seulement au-delà de 1 ;
 * - dates : jour de la semaine + jour + mois en toutes lettres pour les dates lues,
 *   mois courts pour les méta, année omise si elle est l'année courante.
 */

export const PARIS_TZ = 'Europe/Paris';

const FR_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const FR_MONTHS_SHORT = [
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
] as const;

const FR_MONTHS_STAMP = [
  'JAN',
  'FÉV',
  'MAR',
  'AVR',
  'MAI',
  'JUN',
  'JUL',
  'AOÛ',
  'SEP',
  'OCT',
  'NOV',
  'DÉC',
] as const;

const FR_WEEKDAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const;

const FR_WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parties calendaires d'une date dans le fuseau Europe/Paris. */
export function parisParts(value: Date | string | null | undefined): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const date = toDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayShort = get('weekday');
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].findIndex((d) =>
    weekdayShort.startsWith(d),
  );
  return {
    year: Number(get('year')),
    month: Number(get('month')) - 1,
    day: Number(get('day')),
    weekday: weekdayIndex < 0 ? 0 : weekdayIndex,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
}

/** Date « calendrier » en ISO `YYYY-MM-DD` (fuseau Paris). */
export function parisIsoDate(value: Date | string | null | undefined): string | null {
  const p = parisParts(value);
  if (!p) return null;
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Aujourd'hui (ISO date) dans le fuseau Paris. */
export function todayIso(now: Date = new Date()): string {
  return parisIsoDate(now) as string;
}

/** Ajoute `days` jours à une ISO date `YYYY-MM-DD` et renvoie une ISO date. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(
    base.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Différence en jours calendaires entre deux ISO dates. */
export function daysBetweenIso(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const a = Date.UTC(y1, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((b - a) / 86400000);
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value);
}

/** « 62,4 km » (sans décimale inutile), « — » si absent. */
export function formatKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const hasDecimal = Math.abs(rounded % 1) > 0.001;
  return `${formatDecimal(rounded, hasDecimal ? 1 : 0)} km`;
}

/** « 12 km » / « à 12 km » / « — ». */
export function formatDistanceKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatKm(value);
}

export function formatElevationM(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `+${formatInt(value)} m`;
}

/** « 4,2 kg » au-delà de 1000 g, « 850 g » en dessous. */
export function formatWeightG(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  if (value < 1000) return `${formatInt(value)} g`;
  return `${formatDecimal(value / 1000, 1)} kg`;
}

export function formatDays(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatInt(value)} j`;
}

export function formatPluralFr(
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string {
  return count > 1 ? plural : singular;
}

/** « 1 membre » / « 3 membres » / « 0 membre ». */
export function formatCountFr(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatInt(count)} ${formatPluralFr(count, singular, plural)}`;
}

/** Date complète : « samedi 14 novembre » (+ année si demandée ou différente de l'année courante). */
export function formatDateFull(
  value: Date | string | null | undefined,
  options: { year?: boolean; now?: Date } = {},
): string {
  const p = parisParts(value);
  if (!p) return 'Date non renseignée';
  const nowYear = parisParts(options.now ?? new Date())?.year;
  const withYear = options.year === true || (nowYear != null && p.year !== nowYear);
  return `${FR_WEEKDAYS[p.weekday]} ${p.day} ${FR_MONTHS[p.month]}${withYear ? ` ${p.year}` : ''}`;
}

/** Date courte pour les méta : « 14 nov. » (+ année si différente). */
export function formatDateShort(
  value: Date | string | null | undefined,
  options: { year?: boolean; now?: Date } = {},
): string {
  const p = parisParts(value);
  if (!p) return '—';
  const nowYear = parisParts(options.now ?? new Date())?.year;
  const withYear = options.year === true || (nowYear != null && p.year !== nowYear);
  return `${p.day} ${FR_MONTHS_SHORT[p.month]}${withYear ? ` ${p.year}` : ''}`;
}

/** Cartouche de billet : jour « 14 » + mois « NOV ». */
export function formatDateStamp(value: Date | string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  const p = parisParts(value);
  if (!p) return { day: '—', month: '—', year: '—' };
  return { day: String(p.day), month: FR_MONTHS_STAMP[p.month], year: String(p.year) };
}

/** Heure de Paris « 08:00 ». */
export function formatTime(value: Date | string | null | undefined): string {
  const p = parisParts(value);
  if (!p) return '';
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** « samedi 14 novembre · 08:00 ». */
export function formatDateTimeFull(value: Date | string | null | undefined): string {
  const p = parisParts(value);
  if (!p) return 'Date non renseignée';
  return `${formatDateFull(value)} · ${formatTime(value)}`;
}

/** Temps relatif : « à l'instant », « il y a 5 min », « il y a 2 h », « hier », « il y a 3 j ». */
export function formatRelativeTime(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return '';
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return formatDateShort(date, { now });
}

/** Nombre de jours d'un carnet à partir de ses dates (incluses), null si absentes. */
export function tripDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const from = start.slice(0, 10);
  const to = end.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const diff = daysBetweenIso(from, to);
  return diff >= 0 ? diff + 1 : null;
}

export interface AgendaDay {
  iso: string;
  weekdayShort: string;
  dayLabel: string;
  count: number;
  isToday: boolean;
  isWeekend: boolean;
}

/** Bande agenda : les `count` prochains jours à partir de `fromIso`. */
export function buildAgendaDays(
  counts: Record<string, number> | null | undefined,
  fromIso: string = todayIso(),
  count = 14,
): AgendaDay[] {
  const days: AgendaDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const iso = addDaysIso(fromIso, i);
    const p = parisParts(`${iso}T12:00:00+01:00`);
    days.push({
      iso,
      weekdayShort: p ? FR_WEEKDAYS_SHORT[p.weekday] : '',
      dayLabel: String(p?.day ?? ''),
      count: counts?.[iso] ?? 0,
      isToday: i === 0,
      isWeekend: p ? p.weekday === 0 || p.weekday === 6 : false,
    });
  }
  return days;
}

export interface AgendaGroup<T> {
  key: 'weekend' | 'next-week' | 'later';
  label: string;
  items: T[];
}

/**
 * Groupes chronologiques de l'Explorer Sorties : « Ce week-end », « La semaine
 * prochaine », « Plus tard ». Un élément sans date parsable tombe dans « Plus tard ».
 */
export function groupEventsByAgenda<T extends { eventDate: string | null }>(
  items: T[],
  now: Date = new Date(),
): AgendaGroup<T>[] {
  const today = todayIso(now);
  const p = parisParts(now);
  // Prochain samedi (ou aujourd'hui si on est samedi/dimanche).
  const daysToSaturday = p ? (6 - p.weekday + 7) % 7 : 0;
  const weekendStart = addDaysIso(today, daysToSaturday);
  const weekendEnd = addDaysIso(weekendStart, 1);
  const nextWeekEnd = addDaysIso(weekendEnd, 7);

  const buckets: Record<AgendaGroup<T>['key'], T[]> = {
    weekend: [],
    'next-week': [],
    later: [],
  };
  for (const item of items) {
    const iso = item.eventDate ? item.eventDate.slice(0, 10) : '';
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      buckets.later.push(item);
      continue;
    }
    if (iso >= weekendStart && iso <= weekendEnd) buckets.weekend.push(item);
    else if (iso > weekendEnd && iso <= nextWeekEnd) buckets['next-week'].push(item);
    else buckets.later.push(item);
  }
  const out: AgendaGroup<T>[] = [];
  if (buckets.weekend.length) out.push({ key: 'weekend', label: 'Ce week-end', items: buckets.weekend });
  if (buckets['next-week'].length)
    out.push({ key: 'next-week', label: 'La semaine prochaine', items: buckets['next-week'] });
  if (buckets.later.length) out.push({ key: 'later', label: 'Plus tard', items: buckets.later });
  return out;
}

/** Replie un texte : minuscules + diacritiques retirés, en conservant la table d'index. */
export function foldWithIndexMap(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    const decomposed = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const piece of decomposed) {
      folded += piece;
      map.push(i);
    }
  }
  return { folded, map };
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Découpe un texte selon les termes recherchés (insensible aux accents et à la casse). */
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const clean = terms.map((t) => t.trim()).filter((t) => t.length > 1);
  if (!clean.length || !text) return [{ text, match: false }];
  const { folded, map } = foldWithIndexMap(text);
  const ranges: Array<[number, number]> = [];
  for (const term of clean) {
    const needle = foldWithIndexMap(term).folded;
    if (!needle) continue;
    let index = folded.indexOf(needle);
    while (index >= 0) {
      const start = map[index];
      const end = map[index + needle.length - 1];
      if (start != null && end != null) ranges.push([start, end + 1]);
      index = folded.indexOf(needle, index + needle.length);
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

const SEARCH_STOPWORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'de',
  'et',
  'a',
  'au',
  'aux',
  'en',
  'dans',
  'sur',
  'pour',
  'avec',
  'par',
  'mon',
  'ma',
  'mes',
]);

/** Termes de recherche utiles (≥ 2 caractères, ponctuation retirée, stopwords ignorés). */
export function searchTerms(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of query.trim().split(/[\s,;:!?()[\]{}«»"']+/)) {
    const term = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (term.length < 2) continue;
    const key = foldWithIndexMap(term).folded;
    if (!key || seen.has(key) || SEARCH_STOPWORDS.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

/** Initiales d'un nom (1 à 2 lettres majuscules), « ? » si vide. */
export function initialsFromName(name: string | null | undefined): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const word = words[0] as string;
    // Un handle « @tony » ou un pseudo d'un seul mot : deux premières lettres utiles.
    const letters = word.replace(/^@/, '').replace(/[^\p{L}\p{N}]/gu, '');
    return (letters.slice(0, 2) || '?').toUpperCase();
  }
  return `${(words[0] as string)[0] ?? ''}${(words[words.length - 1] as string)[0] ?? ''}`.toUpperCase();
}

/** Graine déterministe (blason) : stable pour un même id/nom. */
export function crestSeed(...parts: Array<string | null | undefined>): string {
  const source = parts.filter(Boolean).join('|') || 'club';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 1000003;
  }
  return String(hash);
}

/** Échappement texte iCalendar (RFC 5545). */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsUtcStamp(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(
    value.getUTCHours(),
  )}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`;
}

export interface IcsEventInput {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt?: string | null;
  eventDate: string;
  location: string;
  description?: string | null;
  url?: string | null;
  meetingPoint?: string | null;
}

/**
 * Fichier .ics d'une sortie (Sorties#14 : « Ajouter au calendrier »).
 * DTSTART : `starts_at` si présent, sinon la date à 09:00 Paris ; DTEND : `ends_at`,
 * sinon +2 h. UID stable par sortie, PRODID LKDV.
 */
export function buildEventIcs(event: IcsEventInput): string {
  const start = toDate(event.startsAt) ?? toDate(`${event.eventDate}T09:00:00+01:00`) ?? new Date();
  const end = toDate(event.endsAt) ?? new Date(start.getTime() + 2 * 3600 * 1000);
  const location = [event.location, event.meetingPoint].filter(Boolean).join(' — ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//LKDV//Communaute//FR',
    'BEGIN:VEVENT',
    `UID:${event.id}@lekitduvoyageur`,
    `DTSTAMP:${icsUtcStamp(new Date())}`,
    `DTSTART:${icsUtcStamp(start)}`,
    `DTEND:${icsUtcStamp(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(event.description ?? '')}`,
    ...(event.url ? [`URL:${icsEscape(event.url)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  return lines.join('\r\n');
}

/** Nom de fichier .ics sûr et lisible. */
export function eventIcsFilename(title: string): string {
  const slug = foldWithIndexMap(title)
    .folded.replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `lkdv-sortie-${slug || 'evenement'}.ics`;
}

/** Clé de tri de repli côté client (les RPC trient déjà côté serveur). */
export function fallbackSortValue(sort: string): string {
  return `${sort}|`;
}

/** Compteur « 3/10 » de caractères, jamais négatif. */
export function characterCount(text: string, max: number): { count: number; max: number; near: boolean } {
  const count = [...text].length;
  return { count, max, near: count >= max * 0.9 };
}

/** Champs manquants à corriger : un compteur « 2 champs à corriger » en tête. */
export function errorSummaryLabel(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return '1 champ à corriger';
  return `${count} champs à corriger`;
}
