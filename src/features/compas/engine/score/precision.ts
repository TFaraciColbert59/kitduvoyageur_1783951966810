import { tripLengthDays } from '../tripContext';
import { axisByFamily, compasOf, critere, finite, nonEmpty, obj, type AxisScore, type Critere, type TripSnapshot } from './types';

/**
 * Valeurs de `metadata.source` d'une dépense, telles que `autofillActions.ts` les écrit
 * (type `AmountSource`, `engine/autofill.ts`) :
 * - `mesure` : bulletin des prix du carburant, péages mesurés → réel ;
 * - `base` : prix des refuges en base, prix de la boutique → réel ;
 * - `estimation` : barème Compas, défaut du niveau → pas une donnée réelle.
 */
export const EXPENSE_SOURCE_REAL: Readonly<Record<string, boolean>> = { mesure: true, base: true, estimation: false };

/**
 * Précision : quatre familles de poids égal (la note est la moyenne des taux des familles non vides) ;
 * le dénominateur est l'ensemble des éléments ATTENDUS, pas seulement ceux qui sont présents.
 * - `etapes` : une distance attendue par jour ; absente = non réelle ; réelle seulement si
 *   `metadata.distance.source` est une chaîne autre que « estimation » ;
 * - `depenses` : chaque ligne prévue écrite par la préparation (`metadata.autofill`) ; réelle si source
 *   « mesure » ou « base », absente = non réelle ; les lignes saisies à la main restent hors mesure ;
 * - `reglages` : dates réelles plutôt que durée retenue ; groupe dit ;
 * - `sac` : objet relié à l'INVENTAIRE de la personne. Un lien boutique seul n'est pas « réel ».
 */
export function scorePrecision(snapshot: TripSnapshot): AxisScore {
  const { trip, steps, items, expenses } = snapshot;
  const etapes: Critere[] = [];
  const depenses: Critere[] = [];
  const reglages: Critere[] = [];
  const sac: Critere[] = [];

  const days = tripLengthDays(trip.start_date, trip.end_date, compasOf(trip.metadata).planned_days);
  const distanceCritere = (key: string | number, s: TripSnapshot['steps'][number] | undefined) => {
    const src = obj(obj(s?.metadata).distance).source;
    const hasDist = finite(s?.distance_km) != null;
    const real = hasDist && typeof src === 'string' && src !== 'estimation';
    etapes.push(
      critere(
        `distance-etape-${key}`,
        real,
        !s ? 'étape absente' : !hasDist ? 'distance absente' : src === 'estimation' ? 'distance estimée' : typeof src === 'string' ? `distance mesurée (${src})` : 'distance sans source dite'
      )
    );
  };
  if (days != null) {
    const byDay = new Map<number, TripSnapshot['steps'][number]>();
    for (const s of steps) {
      const d = finite(s.day_number);
      if (d != null && !byDay.has(d)) byDay.set(d, s);
    }
    for (let d = 1; d <= days; d++) distanceCritere(d, byDay.get(d));
  } else {
    // Durée inconnue : on ne peut attendre que les étapes rangées.
    steps.forEach((s, i) => distanceCritere(s.day_number ?? `#${i + 1}`, s));
  }

  expenses.forEach((e, i) => {
    if (e.is_planned !== true) return;
    const meta = obj(e.metadata);
    if (!nonEmpty(meta.autofill)) return; // saisie à la main : hors mesure
    const src = meta.source;
    depenses.push(
      critere(
        `depense-${i + 1}`,
        typeof src === 'string' && EXPENSE_SOURCE_REAL[src] === true,
        `${e.title ?? 'ligne'} : ${typeof src === 'string' ? `source « ${src} »` : 'source absente'}`
      )
    );
  });

  const hasDate = typeof trip.start_date === 'string' && trip.start_date !== '';
  const planned = tripLengthDays(null, null, compasOf(trip.metadata).planned_days);
  if (hasDate || planned != null)
    reglages.push(critere('dates', hasDate, hasDate ? 'date de départ réelle' : 'durée retenue sans date'));
  reglages.push(critere('groupe', trip.party_size != null, trip.party_size != null ? `${trip.party_size} personne(s) dite(s)` : 'groupe par défaut'));

  for (const it of items) {
    const real = it.inventory_item_id != null;
    sac.push(
      critere(
        `objet-${it.item_name}`,
        real,
        real ? 'relié à l’inventaire' : it.shop_product_id != null ? 'lien boutique seul (non réel)' : 'objet générique'
      )
    );
  }

  return axisByFamily({ etapes, depenses, reglages, sac });
}
