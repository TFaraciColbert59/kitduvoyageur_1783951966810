/**
 * Compas — formats d'affichage. Une valeur absente s'affiche « — » ou avec un
 * libellé honnête, jamais comme un zéro.
 */

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatKg(grams: number | null | undefined): string {
  if (grams == null || !Number.isFinite(grams)) return '—';
  if (grams < 1000) return `${nf0.format(Math.round(grams))} g`;
  return `${nf1.format(grams / 1000)} kg`;
}

export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km <= 0) return '—';
  return `${nf1.format(km)} km`;
}

export function formatMeters(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m) || m <= 0) return '—';
  return `${nf0.format(Math.round(m))} m`;
}

export function formatDuration(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function formatMoney(amount: number | null | undefined, currency = 'EUR'): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${nf1.format(amount)} ${currency}`;
  }
}

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** « lun. 12 » à partir d'une date ISO (AAAA-MM-JJ). */
export function formatWeekday(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

const MONTHS = [
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

/** « sam. 12 oct. » à partir d'une date ISO. */
export function formatDayMonth(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Ajoute `n` jours à une date ISO (AAAA-MM-JJ), sans fuseau. */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (b − a). */
export function daysBetweenIso(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) /
      86_400_000
  );
}

/** Libellé court d'un code météo WMO (Open-Meteo) et icône du registre LKDV. */
export function weatherLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Dégagé', icon: 'sun' };
  if (code <= 2) return { label: 'Éclaircies', icon: 'cloud-sun' };
  if (code === 3) return { label: 'Couvert', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Brouillard', icon: 'cloud-fog' };
  if (code >= 51 && code <= 57) return { label: 'Bruine', icon: 'cloud-drizzle' };
  if (code >= 61 && code <= 67) return { label: 'Pluie', icon: 'cloud-rain' };
  if (code >= 71 && code <= 77) return { label: 'Neige', icon: 'cloud-snow' };
  if (code >= 80 && code <= 82) return { label: 'Averses', icon: 'cloud-rain-wind' };
  if (code >= 85 && code <= 86) return { label: 'Averses de neige', icon: 'cloud-snow' };
  if (code >= 95) return { label: 'Orage', icon: 'cloud-lightning' };
  return { label: 'Variable', icon: 'cloud' };
}

/** Première lettre en capitale, reste inchangé. */
export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Initiales d'un nom (2 lettres max). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Découpe une liste en pages de taille fixe (au moins 1 élément par page). */
export function paginate<T>(list: readonly T[], perPage: number): T[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: T[][] = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/* ---------- Échelle de durée (maquette v8) : 15 min → 1 mois, logarithmique ---------- */

const LN0 = Math.log(0.25);
const LN = Math.log(720) - LN0;

/** Position 0..1 d'une durée (heures) sur la règle logarithmique. */
export function rulerPosition(hours: number): number {
  const t = (Math.log(Math.max(0.25, Math.min(720, hours))) - LN0) / LN;
  return Math.round(t * 1000) / 1000;
}

/** Inverse de `rulerPosition` : position 0..1 → durée (heures), bornée. */
export function hoursFromPosition(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return Math.exp(LN0 + c * LN);
}

/**
 * Pas de la règle : 15 min sous un jour, un jour au-delà (un voyage se
 * réserve en dates : « 1 j 5 h » n'existe pas dans un calendrier).
 */
export function snapHours(hours: number): number {
  const h = Math.max(0.25, Math.min(720, hours));
  if (h < 23.875) return Math.max(0.25, Math.round(h * 4) / 4);
  return Math.max(1, Math.min(30, Math.round(h / 24))) * 24;
}

/** Pas suivant ou précédent de la règle (clavier). `big` = 1 h ou 1 semaine. */
export function stepHours(hours: number, dir: 1 | -1, big = false): number {
  const h = snapHours(hours);
  if (h < 24) {
    const next = h + dir * (big ? 1 : 0.25);
    return next >= 24 ? 24 : snapHours(Math.max(0.25, next));
  }
  const days = h / 24 + dir * (big ? 7 : 1);
  return days < 1 ? 23.75 : snapHours(Math.min(30, days) * 24);
}

export const RULER_TICKS: ReadonlyArray<[number, string]> = [
  [0.25, '15 min'],
  [1, '1 h'],
  [24, '1 j'],
  [168, '1 sem.'],
  [720, '1 mois'],
];

const ZONES: ReadonlyArray<{ upTo: number; label: string }> = [
  { upTo: 3, label: 'Sortie' },
  { upTo: 12, label: 'Journée' },
  { upTo: 48, label: 'Raid' },
  { upTo: 240, label: 'Expédition' },
  { upTo: Infinity, label: 'Monde' },
];

export function durationZone(hours: number): string {
  return (ZONES.find((z) => hours < z.upTo) ?? ZONES[ZONES.length - 1]).label;
}

/** Durée en heures, « 4 j », « 5 h 30 », « 45 min ». */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return formatDuration(hours * 60);
  const d = Math.floor(hours / 24);
  const r = Math.round(hours - d * 24);
  return r ? `${d} j ${r} h` : `${d} j`;
}

const ACTIVITIES: Record<string, string> = {
  hiking: 'Randonnée',
  randonnee: 'Randonnée',
  trek: 'Trek',
  trekking: 'Trek',
  bivouac: 'Bivouac',
  trail: 'Trail',
  running: 'Course',
  cycling: 'Vélo',
  velo: 'Vélo',
  bikepacking: 'Bikepacking',
  climbing: 'Escalade',
  alpinisme: 'Alpinisme',
  mountaineering: 'Alpinisme',
  ski: 'Ski de randonnée',
  kayak: 'Kayak',
  travel: 'Voyage',
  voyage: 'Voyage',
  roadtrip: 'Road trip',
};

export function activityLabel(activity: string | null): string | null {
  if (!activity) return null;
  const key = activity.toLowerCase().replace(/[\s_-]+/g, '');
  return ACTIVITIES[key] ?? capitalize(activity.replace(/[_-]+/g, ' '));
}
