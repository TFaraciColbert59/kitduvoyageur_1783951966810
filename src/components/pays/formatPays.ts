// src/components/pays/formatPays.ts
//
// Une seule fabrique de chaînes pour la fiche pays : nombres, surfaces,
// distances, dénivelés, dates, pluriels. Aucune valeur inventée : une donnée
// absente rend `null` et la ligne n'est pas affichée.

const NBSP = '\u202F';

export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR').replace(/\u00A0|\u202F/g, NBSP);
}

/** « 643 801 km² » — accepte « 643801 » comme « 643 801 ». */
export function formatArea(km2: number | string | null | undefined): string | null {
  if (km2 === null || km2 === undefined || km2 === '') return null;
  const raw = typeof km2 === 'string' ? km2.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}\b)/g, '') : km2;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${formatNumber(Math.round(n))} km²`;
}

function parseAreaKm2(km2: number | string | null | undefined): number | null {
  if (km2 === null || km2 === undefined || km2 === '') return null;
  const raw = typeof km2 === 'string' ? km2.replace(/[^\d.,]/g, '').replace(/[.,](?=\d{3}\b)/g, '') : km2;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** « 644 000 km » — arrondi au millier pour la stat principale. */
export function formatAreaShort(km2: number | string | null | undefined): string | null {
  const n = parseAreaKm2(km2);
  if (n === null) return null;
  return `${formatNumber(Math.round(n / 1_000) * 1_000)} km`;
}

export function formatDistance(km: number | null | undefined, digits = 1): string | null {
  if (typeof km !== 'number' || !Number.isFinite(km)) return null;
  const fixed = Number.isInteger(km) ? String(km) : km.toFixed(digits).replace('.', ',');
  return `${fixed} km`;
}

export function formatElevation(m: number | null | undefined): string | null {
  if (typeof m !== 'number' || !Number.isFinite(m)) return null;
  return `${formatNumber(Math.round(m))} m`;
}

export function formatPopulation(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M hab.`;
  if (n >= 1_000) return `${formatNumber(Math.round(n / 1_000))} k hab.`;
  return `${formatNumber(n)} hab.`;
}

export function plural(n: number, sing: string, plur: string): string {
  return `${n} ${n > 1 ? plur : sing}`;
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « 1 → 22 oct. 2025 », « 28 déc. 2025 → 4 janv. 2026 ». */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s) return null;
  const d = (x: Date) => `${x.getDate()} ${MOIS[x.getMonth()]}`;
  if (!e) return `${d(s)} ${s.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()} → ${e.getDate()} ${MOIS[e.getMonth()]} ${e.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${d(s)} → ${d(e)} ${e.getFullYear()}`;
  }
  return `${d(s)} ${s.getFullYear()} → ${d(e)} ${e.getFullYear()}`;
}

/** « à l’instant », « il y a 3 h », « il y a 2 j ». */
export function relativeDate(iso: string | null | undefined): string | null {
  const d = parseDate(iso);
  if (!d) return null;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'à l’instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 31) return `il y a ${j} j`;
  const m = Math.floor(j / 30);
  return `il y a ${m} mois`;
}

/** Concatène les segments non vides avec « · », sans séparateur orphelin. */
export function joinMeta(parts: (string | null | undefined)[]): string | null {
  const clean = parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  return clean.length ? clean.join(' · ') : null;
}
