import { tripLengthDays } from '../tripContext';
import { readCompasMeta } from '../meta';
import {
  autofillOf,
  axis,
  compasOf,
  critere,
  finite,
  nonEmpty,
  obj,
  type AxisScore,
  type Critere,
  type TripSnapshot,
} from './types';

/**
 * Trajet d'approche : lignes de dépense de catégorie `transport` dont le titre dit « aller-retour »
 * (vol, train, carburant aller-retour, `autofillActions.ts` 2888-2915). La préparation ne range AUCUN
 * marqueur stable dans `metadata` (seulement `autofill`, `source`, `basis`) : le titre, écrit en
 * français sans passer par `t()`, est le seul repère. À remplacer le jour où une clé existe.
 */
export function isApproachTrip(e: TripSnapshot['expenses'][number]): boolean {
  return e.category === 'transport' && typeof e.title === 'string' && /aller[\s-]+retour/i.test(e.title);
}

/**
 * L'heure n'est tenue que si elle n'est pas un défaut : `start_time` posé ET `metadata.startTime.source`
 * est une chaîne autre que « defaut » (clé qui n'existe pas encore : 0 % aujourd'hui, voulu).
 */
function hourIsReal(s: TripSnapshot['steps'][number]): boolean {
  const src = obj(obj(s.metadata).startTime).source;
  return nonEmpty(s.start_time) && typeof src === 'string' && src !== 'defaut';
}

/** Complétude : les éléments attendus de la grille (SPEC-V6 §5) sont-ils rangés ? */
export function scoreCompletude(snapshot: TripSnapshot): AxisScore {
  const { trip, steps, items, expenses } = snapshot;
  const compas = compasOf(trip.metadata);
  const af = autofillOf(trip.metadata);
  const out: Critere[] = [];

  const prepared = typeof af.runId === 'string' && af.runId !== '';
  out.push(critere('pret', prepared, prepared ? 'préparation enregistrée' : 'aucune préparation (autofill.runId absent)'));

  const days = tripLengthDays(trip.start_date, trip.end_date, compas.planned_days);
  if (days != null)
    out.push(critere('etapes', steps.length === days, `${steps.length} étape(s) pour ${days} jour(s)`));

  if (days != null) {
    const byDay = new Map<number, TripSnapshot['steps'][number]>();
    for (const s of steps) {
      const d = finite(s.day_number);
      if (d != null && !byDay.has(d)) byDay.set(d, s);
    }
    for (let d = 1; d <= days; d++) {
      const s = byDay.get(d);
      const dist = finite(s?.distance_km);
      const gain = finite(s?.elevation_gain_m);
      out.push(
        critere(`jour-${d}-contenu`, !!s && nonEmpty(s.title) && nonEmpty(s.description), s ? 'titre et description' : 'étape absente'),
        critere(`jour-${d}-distance`, dist != null && dist > 0, `distance ${dist ?? 'absente'}`),
        critere(`jour-${d}-denivele`, gain != null, `dénivelé ${gain ?? 'absent'}`),
        critere(`jour-${d}-heure`, !!s && hourIsReal(s), !s || !nonEmpty(s.start_time) ? 'heure de départ absente' : hourIsReal(s) ? 'heure de départ dite' : 'heure de départ sans source (défaut)')
      );
    }
    // Les nuits : jours − 1 (aucune pour une sortie à la journée), rangées sur l'étape du soir.
    const bivouac = readCompasMeta(trip.metadata).preferences?.nights === 'bivouac';
    for (let n = 1; n <= days - 1; n++) {
      const s = byDay.get(n);
      const ok = bivouac || (!!s && nonEmpty(s.accommodation_name));
      out.push(critere(`nuit-${n}`, ok, bivouac ? 'bivouac choisi' : ok ? 'hébergement rangé' : 'hébergement absent'));
    }
  }

  const planned = expenses.filter((e) => e.is_planned === true);
  const approach = planned.filter(isApproachTrip);
  out.push(critere('trajet-aller-retour', approach.length >= 1, `${approach.length} ligne(s) de trajet d'approche`));

  const cats = new Set(
    planned.filter((e) => (finite(e.amount) ?? 0) > 0 && nonEmpty(e.category)).map((e) => e.category as string)
  );
  out.push(critere('budget-postes', cats.size >= 3, `${cats.size} poste(s) distinct(s)`));

  const total = finite(trip.estimated_budget);
  out.push(critere('budget-total', total != null && total !== 0, `budget ${total ?? 'absent'}`));

  const auto = items.filter((i) => i.source === 'compas-auto');
  const vital = auto.some((i) => i.is_vital === true);
  out.push(critere('sac', auto.length >= 5 && vital, `${auto.length} objet(s) compas-auto, ${vital ? 'dont' : 'sans'} indispensable`));

  const papers = af.papers != null && typeof af.papers === 'object';
  out.push(critere('papiers', papers, papers ? 'papiers rangés' : 'papiers absents'));

  return axis(out, ['météo (calculée à la lecture)', 'risques (calculés à la lecture)']);
}
