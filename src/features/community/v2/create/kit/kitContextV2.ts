'use client';

import { createClient } from '@/lib/supabase/client';
import type { KitItemV2 } from '../engine/createSchemasV2';
import type { KitSuggestionV2 } from './kitTemplatesV2';

/**
 * Contexte du Kit (Kit#9, #12, #15) — logique pure et lectures seules.
 *
 * - Kit#15 : unités. La préférence du compte est celle de `/compte` →
 *   Réglages (`localStorage.lkdv_units`, `metric` par défaut) ; le commutateur
 *   du formulaire la surcharge **sans la modifier**.
 * - Kit#9 : suggestions adaptées à la météo du lieu où la personne se trouve
 *   (route existante `/api/weather`, position demandée sur geste uniquement).
 * - Kit#12 : prêts. Les objets empruntés (`materiel_loans`, emprunteur =
 *   soi) sont reconnus par leur `product_ownership_id`.
 */

export type KitUnitsV2 = 'metric' | 'imperial';

export const UNITS_STORAGE_KEY = 'lkdv_units';

const GRAMS_PER_POUND = 453.592;

/** Préférence du compte (réglages `/compte`) ; `metric` si absente ou illisible. */
export function readStoredUnitsV2(storage?: Pick<Storage, 'getItem'> | null): KitUnitsV2 {
  try {
    const source = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    return source?.getItem(UNITS_STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

/** « 1,2 kg » ou « 2,6 lb » (une décimale, virgule française). */
export function formatKitWeightV2(weightG: number, units: KitUnitsV2): string {
  const safe = Number.isFinite(weightG) ? weightG : 0;
  const value = units === 'imperial' ? safe / GRAMS_PER_POUND : safe / 1000;
  return `${value.toFixed(1).replace('.', ',')} ${units === 'imperial' ? 'lb' : 'kg'}`;
}

/** Poids d'un objet, en grammes (« 85 g ») ou en livres au-delà de 100 g. */
export function formatKitItemWeightV2(weightG: number, units: KitUnitsV2): string {
  if (units === 'imperial') return formatKitWeightV2(weightG, units);
  return weightG >= 1000 ? formatKitWeightV2(weightG, units) : `${Math.round(weightG)} g`;
}

// ── Kit#9 — météo ────────────────────────────────────────────────────────────

export interface KitWeatherV2 {
  /** Libellé de la route météo (« Éclaircies », « Pluie »…). */
  label: string;
  tempMin: number;
  tempMax: number;
}

const WET = /pluie|averse|orage|bruine|neige|giboul/i;

/**
 * Objets que la météo du jour justifie. Jamais un lieu, un prix ou une date :
 * uniquement des objets de l'équipement courant, proposés (jamais ajoutés).
 */
export function kitWeatherSuggestionsV2(
  weather: KitWeatherV2 | null,
  items: readonly KitItemV2[],
): KitSuggestionV2[] {
  if (!weather) return [];
  const wanted: Array<[string, string, number, string]> = [];
  if (weather.tempMin <= 5) {
    wanted.push(['Doudoune', 'Vêtements', 380, `Min ${weather.tempMin}°`]);
    wanted.push(['Gants', 'Vêtements', 80, `Min ${weather.tempMin}°`]);
  }
  if (weather.tempMin <= 0) wanted.push(['Bonnet', 'Vêtements', 60, `Gel (${weather.tempMin}°)`]);
  if (WET.test(weather.label)) {
    wanted.push(['Veste imperméable', 'Vêtements', 320, weather.label]);
    wanted.push(['Housse de pluie', 'Portage', 90, weather.label]);
  }
  if (weather.tempMax >= 25) {
    wanted.push(['Eau 2 L', 'Sécurité', 2000, `Max ${weather.tempMax}°`]);
    wanted.push(['Crème solaire', 'Sécurité', 90, `Max ${weather.tempMax}°`]);
  }
  const names = new Set(items.map((item) => item.name.trim()));
  const seen = new Set<string>();
  const out: KitSuggestionV2[] = [];
  for (const [name, category, weightG, reason] of wanted) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, category, weightG, added: names.has(name), reason });
  }
  return out;
}

/** Fusionne les suggestions de modèle/saison et celles de la météo (sans doublon). */
export function mergeKitSuggestionsV2(
  base: readonly KitSuggestionV2[],
  extra: readonly KitSuggestionV2[],
): KitSuggestionV2[] {
  const known = new Set(base.map((entry) => entry.name));
  return [...base, ...extra.filter((entry) => !known.has(entry.name))];
}

interface WeatherDayPayload {
  date?: string;
  label?: string;
  tMaxC?: number;
  tMinC?: number;
}

/** Météo du jour à une position, via la route existante `/api/weather`. */
export async function fetchKitWeatherV2(
  point: { lat: number; lng: number },
  today: string,
  fetchImpl: typeof fetch | null = typeof fetch === 'function' ? fetch : null,
): Promise<KitWeatherV2 | null> {
  if (!fetchImpl || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  try {
    const query = `?lat=${point.lat.toFixed(4)}&lon=${point.lng.toFixed(4)}&from=${today}&to=${today}`;
    const response = await fetchImpl(`/api/weather${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { status?: string; days?: WeatherDayPayload[] };
    if (payload.status !== 'ok' || !Array.isArray(payload.days)) return null;
    const day = payload.days.find((entry) => entry.date === today) ?? payload.days[0];
    if (!day || typeof day.tMaxC !== 'number' || typeof day.tMinC !== 'number') return null;
    if (!Number.isFinite(day.tMaxC) || !Number.isFinite(day.tMinC)) return null;
    return { label: day.label || 'Météo', tempMax: Math.round(day.tMaxC), tempMin: Math.round(day.tMinC) };
  } catch {
    return null;
  }
}

// ── Kit#12 — prêts ───────────────────────────────────────────────────────────

export interface BorrowedLoansV2 {
  /** `product_ownership_id` des prêts actifs dont la personne est emprunteuse. */
  ownershipIds: string[];
  /** Nombre de prêts actifs (y compris ceux sans objet identifié). */
  count: number;
  error: string | null;
}

interface LoanRowLike {
  product_ownership_id?: string | null;
  status?: string | null;
}

export function summarizeBorrowedLoansV2(rows: readonly LoanRowLike[]): BorrowedLoansV2 {
  const active = rows.filter((row) => row.status === 'en_cours' || row.status === 'en_retard');
  return {
    ownershipIds: active.map((row) => row.product_ownership_id).filter((id): id is string => Boolean(id)),
    count: active.length,
    error: null,
  };
}

/** Prêts actifs où la personne emprunte (RLS `materiel_loans`, lecture seule). */
export async function loadBorrowedLoansV2(userId: string): Promise<BorrowedLoansV2> {
  if (!userId) return { ownershipIds: [], count: 0, error: null };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('materiel_loans')
      .select('product_ownership_id, status')
      .eq('borrower_id', userId)
      .in('status', ['en_cours', 'en_retard'])
      .limit(50);
    if (error) return { ownershipIds: [], count: 0, error: 'Tes prêts sont indisponibles pour le moment.' };
    return summarizeBorrowedLoansV2(Array.isArray(data) ? (data as LoanRowLike[]) : []);
  } catch {
    return { ownershipIds: [], count: 0, error: 'Tes prêts sont indisponibles pour le moment.' };
  }
}

/** Un objet est « emprunté » s'il est marqué ainsi ou lié à un prêt actif. */
export function isItemBorrowedV2(item: Pick<KitItemV2, 'ownershipId'> & { borrowed?: boolean }, loans: readonly string[]): boolean {
  return Boolean(item.borrowed) || (item.ownershipId != null && loans.includes(item.ownershipId));
}
