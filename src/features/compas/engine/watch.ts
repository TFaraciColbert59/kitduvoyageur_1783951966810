/**
 * Veille du verdict (maquette finale : onglet « Veille »).
 *
 * Deux choses, toutes deux calculées sur les données réelles déjà chargées :
 * - les RÈGLES : les seuils que le moteur de danger applique réellement
 *   (`DANGER_THRESHOLDS`), chacune avec ce qu'elle a déclenché sur ce voyage ;
 * - une PROPOSITION de décalage : seulement si le calendrier des conditions
 *   (prévision Open-Meteo, jamais la tendance) trouve, à quelques jours près,
 *   une fenêtre sans aucun jour « mauvais » et meilleure que l'actuelle.
 *
 * L'agent propose, la personne décide : rien ici n'écrit quoi que ce soit.
 */

import { DANGER_THRESHOLDS, type DangerAxis, type DangerSignal } from './danger';
import type { CalendarDay, Quality } from './weather';

export interface WatchRule {
  id: string;
  axis: DangerAxis;
  label: string;
  /** Ce que la règle a déclenché sur ce voyage (vide : rien à signaler). */
  hits: Array<{ day: number | null; label: string; source: string }>;
}

const T = DANGER_THRESHOLDS;
const h = (min: number) => `${Math.round(min / 60)} h`;

/** Les règles, dans l'ordre où une personne les lit, avec leur seuil réel. */
const RULES: ReadonlyArray<{ id: string; axis: DangerAxis; label: string }> = [
  { id: 'thunder', axis: 'conjoncturel', label: 'Orages annoncés' },
  {
    id: 'gust',
    axis: 'conjoncturel',
    label: `Rafales ≥ ${T.gustWarnKmh} km/h (bloquant à ${T.gustBlockKmh})`,
  },
  { id: 'rain', axis: 'conjoncturel', label: `Forte pluie ≥ ${T.rainWarnMm} mm` },
  { id: 'heat', axis: 'physique', label: `Chaleur ≥ ${T.heatC} °C` },
  { id: 'cold', axis: 'physique', label: `Froid ≤ ${T.coldC} °C` },
  {
    id: 'light',
    axis: 'physique',
    label: `Marche plus longue que la lumière du jour, ou plus de ${h(T.longDayMin)}`,
  },
  { id: 'gain', axis: 'physique', label: `Montée ≥ ${T.highGainM} m par jour` },
  {
    id: 'slope',
    axis: 'technique',
    label: `Pente moyenne ≥ ${Math.round(T.steepAvgSlope * 100)} %`,
  },
  { id: 'loss', axis: 'technique', label: `Descente ≥ ${T.highLossM} m par jour` },
  { id: 'alert', axis: 'conjoncturel', label: 'Vigilance officielle (Météo-France)' },
];

/** Le suffixe de règle porté par l'identifiant d'un signal du moteur. */
function ruleOf(signal: DangerSignal): string | null {
  if (signal.id.startsWith('alert-')) return 'alert';
  const m = /^(?:physique|technique|conjoncturel)-([a-z]+)-\d+$/.exec(signal.id);
  if (!m) return null;
  return m[1] === 'long' ? 'light' : m[1];
}

export function watchRules(signals: readonly DangerSignal[]): WatchRule[] {
  const byRule = new Map<string, WatchRule['hits']>();
  for (const s of signals) {
    const r = ruleOf(s);
    if (!r) continue;
    const list = byRule.get(r) ?? [];
    list.push({ day: s.day ?? null, label: s.label, source: s.source });
    byRule.set(r, list);
  }
  return RULES.map((r) => ({ ...r, hits: byRule.get(r.id) ?? [] }));
}

/* ---------- Proposition de décalage ---------- */

export interface ShiftProposal {
  offsetDays: number;
  startDate: string;
  endDate: string;
  /** Raisons des jours « mauvais » de la fenêtre actuelle. */
  now: string[];
  /** Pire qualité de la fenêtre proposée. */
  then: Quality;
}

const RANK: Record<Quality, number> = { bon: 0, moyen: 1, mauvais: 2 };

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function span(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Une fenêtre décalée de quelques jours, sans jour « mauvais » et strictement
 * meilleure que l'actuelle. Ne juge que des jours de PRÉVISION : une tendance
 * des années passées ne suffit pas à conseiller de bouger un voyage.
 */
export function proposeShift(input: {
  start: string | null;
  end: string | null;
  calendar: readonly CalendarDay[];
  maxOffset?: number;
}): ShiftProposal | null {
  const { start, end, calendar } = input;
  if (!start || !end || end < start || calendar.length === 0) return null;
  const byDate = new Map(calendar.map((c) => [c.date, c]));
  const today = calendar[0].date;
  const judge = (dates: string[]) => {
    let worst: Quality = 'bon';
    for (const d of dates) {
      const c = byDate.get(d);
      if (!c || c.kind !== 'prevision' || c.quality == null) return null;
      if (RANK[c.quality] > RANK[worst]) worst = c.quality;
    }
    return worst;
  };
  const current = span(start, end);
  const nowQ = judge(current);
  if (nowQ !== 'mauvais') return null;
  const reasons = current.flatMap((d) => {
    const c = byDate.get(d);
    return c?.quality === 'mauvais' ? c.reasons : [];
  });
  const max = input.maxOffset ?? 3;
  for (let k = 1; k <= max; k += 1) {
    for (const offset of [k, -k]) {
      const s = addDays(start, offset);
      if (s < today) continue;
      const q = judge(current.map((d) => addDays(d, offset)));
      if (q && q !== 'mauvais' && RANK[q] < RANK[nowQ]) {
        return {
          offsetDays: offset,
          startDate: s,
          endDate: addDays(end, offset),
          now: [...new Set(reasons)],
          then: q,
        };
      }
    }
  }
  return null;
}
