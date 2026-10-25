import type { OutingCardData } from '../cards/OutingCard';
import type { StampTileData } from '../cards/StampTile';
import type { HighlightCardData } from '../cards/HighlightCard';

/** Fuseau de référence du groupement Timeline (et non UTC). */
export const PARIS_TIME_ZONE = 'Europe/Paris';

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});
const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});
const YEAR_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
});
const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Une métrique absente reste absente : elle ne devient jamais 0. */
export function asOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Le mapper du bootstrap rend 0 pour une valeur absente : 0 n'est pas une métrique honnête. */
export function asPositiveNumber(value: unknown): number | null {
  const number = asOptionalNumber(value);
  return number !== null && number > 0 ? number : null;
}

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function asPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((photo): photo is string => typeof photo === 'string' && photo.length > 0);
}

export function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Groupement calendaire à l'heure de Paris. Une sortie du 31/12 à 23:30Z
 * bascule au 1er janvier à Paris : le mois affiché doit être janvier 2027,
 * pas décembre 2026 (UTC).
 */
export function parisDateParts(startedAt: string): {
  year: number | null;
  monthLabel: string;
  dateLabel: string;
} {
  if (!startedAt) return { year: null, monthLabel: 'Sans date', dateLabel: '' };
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) {
    return { year: null, monthLabel: 'Sans date', dateLabel: '' };
  }
  const year = Number(YEAR_FORMAT.format(date));
  return {
    year: Number.isFinite(year) ? year : null,
    monthLabel: capitalize(MONTH_YEAR_FORMAT.format(date)),
    dateLabel: DAY_MONTH_FORMAT.format(date),
  };
}

export function normalizeOuting(value: unknown, index: number): OutingCardData | null {
  const row = asRecord(value);
  const title = asText(row.title);
  // Aucun titre inventé : une ligne sans titre réel n'est pas affichée.
  if (!title) return null;

  const startedAt = asText(row.startedAt) || asText(row.started_at);
  const parts = parisDateParts(startedAt);

  return {
    id: asText(row.id) || `outing_${index}`,
    title,
    mass: asText(row.mass) || asText(row.region),
    date: asText(row.date) || parts.dateLabel,
    startedAt,
    km: asPositiveNumber(row.km ?? row.distance_km),
    dplus: asPositiveNumber(row.dplus ?? row.elevation_gain_m),
    proven: row.proven === true,
    photos: asPhotos(row.photos),
    status: asText(row.status),
    year: parts.year,
    monthLabel: parts.monthLabel,
  };
}

export function normalizeStamp(value: unknown, index: number): StampTileData | null {
  const row = asRecord(value);
  const name = asText(row.name);
  // Aucun lieu inventé : seul un massif réellement nommé devient un tampon.
  if (!name) return null;

  return {
    id: asText(row.id) || `stamp_${index}`,
    name,
    kind: asText(row.kind) || 'massif',
    outings: Math.max(0, Math.round(asOptionalNumber(row.outings) ?? 0)),
    verified: row.verified === true,
  };
}

export function normalizeHighlight(value: unknown, index: number): HighlightCardData | null {
  const row = asRecord(value);
  const title = asText(row.title);
  // Aucun album inventé : un titre réel est requis.
  if (!title) return null;

  return {
    id: asText(row.id) || `highlight_${index}`,
    title,
    items: Math.max(0, Math.round(asOptionalNumber(row.items) ?? 0)),
    coverStoryId: asText(row.coverStoryId) || asText(row.cover_story_id) || null,
    cover: asText(row.cover),
    position: asOptionalNumber(row.position) ?? 0,
  };
}

export function timeValue(outing: OutingCardData): number {
  const value = Date.parse(outing.startedAt);
  return Number.isNaN(value) ? 0 : value;
}

export function placeLabel(count: number): string {
  return `${count} lieu${count > 1 ? 'x' : ''} visité${count > 1 ? 's' : ''}`;
}

export function outingsCountLabel(count: number): string {
  return `${count} sortie${count > 1 ? 's' : ''} affichée${count > 1 ? 's' : ''}`;
}
