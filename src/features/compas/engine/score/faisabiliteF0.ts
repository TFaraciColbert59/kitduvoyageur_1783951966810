import { tripLengthDays, anchorOf } from '../tripContext';
import {
  axis,
  compasOf,
  obj,
  critere,
  finite,
  haversineKm,
  validCoords,
  type AxisScore,
  type Critere,
  type TripSnapshot,
} from './types';

/** Grille F0 : les contrôles vérifiables sur les données d'aujourd'hui (remplacée par `engine/checks/`). */
export const F0_CHECKS: ReadonlyArray<{ id: string; libelle: string }> = [
  { id: 'F0-01', libelle: 'Toutes les étapes ont des coordonnées valides' },
  { id: 'F0-02', libelle: 'Les numéros de jour couvrent 1..jours sans trou ni doublon' },
  { id: 'F0-03', libelle: 'Le saut à vol d’oiseau entre deux jours consécutifs est plausible pour le mode de transport' },
  { id: 'F0-04', libelle: 'Aucune journée de marche au-delà de 35 km ou de 2 000 m de dénivelé positif' },
  { id: 'F0-05', libelle: 'Chaque étape est à 1 500 km au plus de l’ancre' },
  { id: 'F0-06', libelle: 'Toute dépense prévue a un montant fini > 0 et une devise' },
  { id: 'F0-07', libelle: 'La somme des dépenses prévues ne dépasse pas le budget estimé' },
  { id: 'F0-08', libelle: 'La fin n’est pas avant le début et la durée datée égale la durée retenue' },
];

const MAX_WALK_KM = 35;
const MAX_WALK_GAIN_M = 2000;
const MAX_FROM_ANCHOR_KM = 1500;

function jumpLimitKm(mode: string | null): number {
  if (mode === 'foot') return 40;
  if (mode === 'bike') return 150;
  return 800;
}

/** Faisabilité F0 : un critère par contrôle applicable. */
export function scoreFaisabiliteF0(snapshot: TripSnapshot): AxisScore {
  const { trip, steps, expenses } = snapshot;
  const compas = compasOf(trip.metadata);
  const out: Critere[] = [];
  const label = (id: string) => F0_CHECKS.find((c) => c.id === id)?.libelle ?? id;
  const push = (id: string, ok: boolean, detail: string) => out.push(critere(id, ok, `${label(id)} : ${detail}`));

  const prepared = typeof obj(compas.autofill).runId === 'string' && obj(compas.autofill).runId !== '';
  const MISSING = 'donnée manquante';

  // F0-01 : sans étape sur un voyage prêt, la donnée manque (échec) ; sur un voyage non préparé, sans objet.
  if (steps.length > 0) {
    const bad = steps.filter((s) => !validCoords(s.latitude, s.longitude)).length;
    push('F0-01', bad === 0, bad === 0 ? 'oui' : `${MISSING} : ${bad} étape(s) sans coordonnées valides`);
  } else if (prepared) push('F0-01', false, `${MISSING} : aucune étape alors que le voyage est prêt`);

  // F0-02
  const days = tripLengthDays(trip.start_date, trip.end_date, compas.planned_days);
  if (days != null && steps.length > 0) {
    const nums = steps.map((s) => finite(s.day_number));
    const seen = new Set<number>();
    let dup = 0;
    let outside = 0;
    for (const n of nums) {
      if (n == null || !Number.isInteger(n) || n < 1 || n > days) outside++;
      else if (seen.has(n)) dup++;
      else seen.add(n);
    }
    const missing = days - seen.size;
    push('F0-02', dup === 0 && outside === 0 && missing === 0, `${missing} jour(s) manquant(s), ${dup} doublon(s), ${outside} hors 1..${days}`);
  } else if (days != null && prepared) push('F0-02', false, `${MISSING} : aucune étape alors que le voyage est prêt`);

  // F0-03 : un saut par paire de jours consécutifs dont les deux étapes existent ; coordonnées absentes = échec.
  const byDay = new Map<number, TripSnapshot['steps'][number]>();
  for (const s of steps) {
    const d = finite(s.day_number);
    if (d != null && !byDay.has(d)) byDay.set(d, s);
  }
  const jumps: string[] = [];
  let jumpsChecked = 0;
  let jumpsMissing = 0;
  for (const [d, s] of byDay) {
    const prev = byDay.get(d - 1);
    if (!prev) continue;
    jumpsChecked++;
    const a = validCoords(prev.latitude, prev.longitude);
    const b = validCoords(s.latitude, s.longitude);
    if (!a || !b) {
      jumpsMissing++;
      continue;
    }
    const km = haversineKm(a, b);
    const limit = jumpLimitKm(s.transport_mode);
    if (km > limit) jumps.push(`jour ${d - 1}→${d} : ${Math.round(km)} km > ${limit}`);
  }
  if (jumpsChecked > 0) {
    const notes = [...(jumpsMissing ? [`${MISSING} : ${jumpsMissing} saut(s) sans coordonnées`] : []), ...jumps];
    push('F0-03', notes.length === 0, notes.length === 0 ? `${jumpsChecked} saut(s) plausible(s)` : notes.join(' ; '));
  }

  // F0-04 : journées de marche ; distance absente = échec.
  const walks = steps.filter((s) => s.transport_mode === 'foot');
  if (walks.length > 0) {
    const noDist = walks.filter((s) => finite(s.distance_km) == null).length;
    const tooLong = walks.filter((s) => (finite(s.distance_km) ?? 0) > MAX_WALK_KM || (finite(s.elevation_gain_m) ?? 0) > MAX_WALK_GAIN_M).length;
    const notes = [...(noDist ? [`${MISSING} : ${noDist} journée(s) de marche sans distance`] : []), ...(tooLong ? [`${tooLong} journée(s) trop longue(s) ou trop raide(s)`] : [])];
    push('F0-04', notes.length === 0, notes.length === 0 ? 'oui' : notes.join(' ; '));
  }

  // F0-05 : étape sans coordonnées = échec (la distance à l'ancre ne peut pas être vérifiée).
  const anchor = anchorOf(compas.anchor);
  if (anchor && steps.length > 0) {
    const placed = steps.map((s) => validCoords(s.latitude, s.longitude)).filter((c): c is { lat: number; lon: number } => c != null);
    const unplaced = steps.length - placed.length;
    const far = placed.filter((c) => haversineKm({ lat: anchor.lat, lon: anchor.lon }, c) > MAX_FROM_ANCHOR_KM).length;
    const notes = [...(unplaced ? [`${MISSING} : ${unplaced} étape(s) sans coordonnées`] : []), ...(far ? [`${far} étape(s) à plus de ${MAX_FROM_ANCHOR_KM} km de l’ancre`] : [])];
    push('F0-05', notes.length === 0, notes.length === 0 ? 'oui' : notes.join(' ; '));
  }

  // F0-06
  const planned = expenses.filter((e) => e.is_planned === true);
  if (planned.length > 0) {
    const bad = planned.filter((e) => {
      const a = finite(e.amount);
      return a == null || a <= 0 || typeof e.currency !== 'string' || e.currency.trim() === '';
    }).length;
    push('F0-06', bad === 0, bad === 0 ? 'oui' : `${bad} dépense(s) sans montant > 0 ou sans devise`);
  }

  // F0-07
  const budget = finite(trip.estimated_budget);
  if (budget != null && planned.length > 0) {
    const sum = planned.reduce((t, e) => t + (finite(e.amount) ?? 0), 0);
    push('F0-07', sum <= budget * 1.001, `dépenses ${Math.round(sum)} pour un budget de ${Math.round(budget)}`);
  }

  // F0-08
  const hasStart = typeof trip.start_date === 'string' && trip.start_date !== '';
  const hasEnd = typeof trip.end_date === 'string' && trip.end_date !== '';
  if (hasStart && hasEnd) {
    const dated = tripLengthDays(trip.start_date, trip.end_date, null);
    const planDays = tripLengthDays(null, null, compas.planned_days);
    const ordered = dated != null; // null : fin avant début ou date illisible
    const same = planDays == null || dated == null || dated === planDays;
    push('F0-08', ordered && same, !ordered ? 'fin avant début ou date illisible' : same ? 'oui' : `${dated} jour(s) datés pour ${planDays} retenus`);
  }

  return axis(out);
}
