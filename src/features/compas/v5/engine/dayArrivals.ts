/**
 * Compas v5 : où finit chaque jour (fonction pure).
 *
 * Le point d'arrivée d'un jour est la position de sa dernière étape placée sur la carte, comme le fait la
 * recherche des points autour des étapes. Un jour sans étape placée n'a pas d'arrivée : rien n'est cherché
 * pour lui (jamais une position devinée).
 */

import { notedStay } from '../../engine/stayProposal';
import type { TransportChoice } from './transportOptions';
import type { V5Extras } from '../types';

export interface ArrivalSource {
  itinerary: ReadonlyArray<{ id: string; day: number; accommodation: string | null }>;
  points: ReadonlyArray<{ id: string; lat: number; lon: number; kind: 'step' | 'poi' }>;
}

export interface DayArrival {
  day: number;
  /** Dernière étape placée du jour. */
  stepId: string;
  lat: number;
  lon: number;
  /** Nuit déjà notée pour ce soir (« Hébergement à réserver » n'en est pas une). */
  noted: string | null;
  /** Dernier jour du voyage : pas de nuit à chercher. */
  isLast: boolean;
}

/** Arrivées des jours, dans l'ordre des jours. Le dernier jour du voyage est celui de la dernière étape. */
export function dayArrivals(src: ArrivalSource): DayArrival[] {
  const placed = new Map(
    src.points
      .filter((p) => p.kind === 'step' && Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => [p.id, p] as const)
  );
  const days = [...new Set(src.itinerary.map((s) => s.day))].sort((a, b) => a - b);
  const lastDay = days.length ? days[days.length - 1] : 0;
  const out: DayArrival[] = [];
  for (const day of days) {
    const steps = src.itinerary.filter((s) => s.day === day);
    const last = [...steps].reverse().find((s) => placed.has(`s-${s.id}`));
    if (!last) continue;
    const point = placed.get(`s-${last.id}`)!;
    const noted = [...steps].reverse().map((s) => notedStay(s.accommodation)).find((n) => n != null) ?? null;
    out.push({ day, stepId: last.id, lat: point.lat, lon: point.lon, noted, isLast: day === lastDay });
  }
  return out;
}

/**
 * Nuit retenue de chaque jour, lue sur les lignes de `trip_steps` (`metadata.compas.stay.id`, écrit par
 * le choix d'une nuit). Le jour compte la dernière étape (celle qui porte l'hébergement).
 */
export function stayChoicesFromRows(
  rows: ReadonlyArray<{ day_number: unknown; order_index: unknown; metadata: unknown }>
): Record<number, string> {
  const lastOfDay = new Map<number, { order: number; id: string | null }>();
  for (const row of rows) {
    const day = Number(row.day_number);
    if (!Number.isInteger(day)) continue;
    const order = Number.isFinite(Number(row.order_index)) ? Number(row.order_index) : 0;
    const prev = lastOfDay.get(day);
    if (prev && order < prev.order) continue;
    const compas = (row.metadata as { compas?: { stay?: { id?: unknown } } } | null)?.compas;
    const id = typeof compas?.stay?.id === 'string' && compas.stay.id ? compas.stay.id.slice(0, 200) : null;
    lastOfDay.set(day, { order, id });
  }
  const out: Record<number, string> = {};
  for (const [day, { id }] of lastOfDay) if (id) out[day] = id;
  return out;
}

/** Choix déjà faits, rendus avec les extras pour que les tiroirs sachent quelle option est retenue. */
export interface V5ExtrasPayload extends V5Extras {
  choices: {
    transport: TransportChoice | null;
    /** Par numéro de jour : identifiant de la nuit retenue (`osm:…` ou `noted:…`). */
    stays: Record<number, string>;
  };
  /**
   * Vrai quand le temps ou le nombre de requêtes autorisées a arrêté la lecture avant la fin : la
   * relancer la complète, à partir de ce que le cache partagé a déjà gardé. Ce n'est pas une panne.
   */
  partial: boolean;
}
