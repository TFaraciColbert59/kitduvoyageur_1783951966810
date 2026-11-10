/**
 * Mesure du Compas v6 (ADR-V6-001 §6) : types et petits lecteurs défensifs partagés.
 * Module pur : aucune I/O, aucune horloge. Importé par chemins relatifs seulement
 * (le script `scripts/compas/score-trip.mjs` le charge par tsx, sans alias `@/`).
 */

export interface TripSnapshot {
  trip: {
    id: string;
    title: string | null;
    destination_name: string | null;
    destination_country_code: string | null;
    start_date: string | null;
    end_date: string | null;
    party_size: number | null;
    primary_activity: string | null;
    estimated_budget: number | null;
    budget_currency: string | null;
    metadata: Record<string, unknown> | null;
  };
  steps: Array<{
    day_number: number | null;
    title: string | null;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    distance_km: number | null;
    elevation_gain_m: number | null;
    start_time: string | null;
    accommodation_name: string | null;
    transport_mode: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  items: Array<{
    item_name: string;
    category: string | null;
    is_vital: boolean | null;
    source: string | null;
    inventory_item_id: string | null;
    shop_product_id: string | null;
  }>;
  expenses: Array<{
    title: string | null;
    amount: number | null;
    currency: string | null;
    category: string | null;
    is_planned: boolean | null;
    metadata: Record<string, unknown> | null;
  }>;
}

/** Le champ `attendu` d'une demande du jeu « demandes-or ». */
export interface Expected {
  pays: string | null;
  lieu: { nom: string; lat: number; lon: number; rayonKm: number } | null;
  jours: number | null;
  /** Écart de jours toléré (entier 0 à 3, défaut 0). */
  joursTolerance?: number | null;
  heures: number | null;
  personnes: number | null;
  enfants: number | null;
  activite: string | null;
  mois: number | null;
  segments?: string[] | null;
  issue: 'pret' | 'precision';
}

export interface Critere {
  id: string;
  ok: boolean;
  detail: string;
}

export interface AxisScore {
  note: number | null;
  tenus: number;
  total: number;
  criteres: Critere[];
  nonMesurables: string[];
  /** Détail par famille quand la note est la moyenne des taux des familles (précision). */
  familles?: Record<string, { tenus: number; total: number }>;
}

/** Version de chaque grille ; une note ne se compare qu'à une note de même version. */
export const GRILLE = { justesse: 'J0', completude: 'C0', faisabilite: 'F0', precision: 'P0' } as const;
export type Grille = { justesse: string; completude: string; faisabilite: string; precision: string };

export interface TripScore {
  grille: Grille;
  justesse: AxisScore;
  completude: AxisScore;
  faisabilite: AxisScore;
  precision: AxisScore;
}

/* ---------- lecteurs défensifs (jsonb non fiable) ---------- */

export function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Bloc `metadata.compas` d'un voyage. */
export function compasOf(metadata: unknown): Record<string, unknown> {
  return obj(obj(metadata).compas);
}

/** Bloc `metadata.compas.autofill` (la trace de la préparation). */
export function autofillOf(metadata: unknown): Record<string, unknown> {
  return obj(compasOf(metadata).autofill);
}

/** Nombre fini, sinon null (null, chaîne vide et booléens ne deviennent jamais 0). */
export function finite(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/** Coordonnées valides (lat/lon présents, finis, dans les bornes). */
export function validCoords(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const a = finite(lat);
  const b = finite(lon);
  if (a == null || b == null || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lon: b };
}

/** Distance à vol d'oiseau en km (haversine). */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rend un axe : note = round(100 × tenus / total), null si total = 0. */
export function axis(criteres: Critere[], nonMesurables: string[] = []): AxisScore {
  const total = criteres.length;
  const tenus = criteres.filter((c) => c.ok).length;
  return { note: total === 0 ? null : Math.round((100 * tenus) / total), tenus, total, criteres, nonMesurables };
}

export function critere(id: string, ok: boolean, detail: string): Critere {
  return { id, ok, detail };
}

/**
 * Axe à familles : chaque famille non vide pèse autant, quel que soit son nombre de lignes
 * (note = moyenne arrondie des taux). `tenus` et `total` restent les sommes brutes.
 */
export function axisByFamily(familles: Record<string, Critere[]>, nonMesurables: string[] = []): AxisScore {
  const entries = Object.entries(familles).filter(([, l]) => l.length > 0);
  const criteres = entries.flatMap(([, l]) => l);
  const detail: Record<string, { tenus: number; total: number }> = {};
  for (const [k, l] of entries) detail[k] = { tenus: l.filter((c) => c.ok).length, total: l.length };
  const rates = Object.values(detail).map((d) => d.tenus / d.total);
  return {
    note: rates.length === 0 ? null : Math.round((100 * rates.reduce((t, r) => t + r, 0)) / rates.length),
    tenus: criteres.filter((c) => c.ok).length,
    total: criteres.length,
    criteres,
    nonMesurables,
    familles: detail,
  };
}
