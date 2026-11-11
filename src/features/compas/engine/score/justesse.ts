import { shortHoursOf, tripLengthDays, anchorOf } from '../tripContext';
import {
  autofillOf,
  axis,
  compasOf,
  critere,
  finite,
  haversineKm,
  obj,
  type AxisScore,
  type Critere,
  type Expected,
  type TripSnapshot,
} from './types';

/** Territoires français d'outre-mer et FR : équivalents pour le pays attendu, dans les deux sens. */
const FR_FAMILY = new Set(['FR', 'RE', 'GP', 'MQ', 'GF', 'YT', 'PF', 'NC']);

/**
 * Justesse : le voyage rangé correspond-il à ce que la demande disait ?
 * Un critère par champ attendu non null ; sans demande attendue, axe « non mesuré ».
 *
 * « enfants » : le Compas ne range les enfants nulle part en base (ni colonne de `trips`,
 * ni clé de `metadata.compas`, ni ligne de `trip_items`) : jamais mesurable aujourd'hui.
 */
export function scoreJustesse(snapshot: TripSnapshot, expected: Expected | null): AxisScore {
  if (!expected) return axis([], ['demande attendue absente']);
  const { trip } = snapshot;
  const compas = compasOf(trip.metadata);
  const anchor = anchorOf(compas.anchor);
  const out: Critere[] = [];
  const nonMesurables: string[] = [];

  if (expected.pays != null) {
    const fromAnchor = obj(compas.anchor).countryCode;
    const got = (trip.destination_country_code || (typeof fromAnchor === 'string' ? fromAnchor : '') || '').trim().toUpperCase();
    const equiv = got !== expected.pays && FR_FAMILY.has(got) && FR_FAMILY.has(expected.pays);
    out.push(
      critere(
        'pays',
        got === expected.pays || equiv,
        `attendu ${expected.pays}, rangé ${got || 'absent'}${equiv ? ' (territoire français d’outre-mer et FR tenus pour équivalents)' : ''}`
      )
    );
  }

  if (expected.lieu != null) {
    if (!anchor) out.push(critere('lieu', false, 'aucune ancre rangée'));
    else {
      const d = haversineKm({ lat: anchor.lat, lon: anchor.lon }, expected.lieu);
      out.push(
        critere('lieu', d <= expected.lieu.rayonKm, `${Math.round(d)} km de ${expected.lieu.nom} (rayon ${expected.lieu.rayonKm} km)`)
      );
    }
  }

  const days = tripLengthDays(trip.start_date, trip.end_date, compas.planned_days);
  const tolRaw = finite(expected.joursTolerance);
  const tol = tolRaw != null && tolRaw > 0 ? Math.min(3, Math.floor(tolRaw)) : 0;
  if (expected.jours != null)
    out.push(
      critere(
        'jours',
        days != null && Math.abs(days - expected.jours) <= tol,
        `attendu ${expected.jours}${tol ? ` (±${tol})` : ''}, rangé ${days ?? 'inconnu'}`
      )
    );

  if (expected.heures != null) {
    const dh = finite(compas.duration_h);
    const hours = shortHoursOf(days, dh);
    out.push(
      critere(
        'heures',
        hours != null && Math.abs(hours - expected.heures) <= 0.5,
        `attendu ${expected.heures} h (±0,5), rangé ${hours ?? 'absent'}`
      )
    );
  }

  if (expected.personnes != null)
    out.push(
      critere(
        'personnes',
        trip.party_size === expected.personnes || (expected.personnes === 1 && trip.party_size == null),
        `attendu ${expected.personnes}, rangé ${trip.party_size ?? 'absent'}${expected.personnes === 1 ? ' (seul par défaut accepté)' : ''}`
      )
    );

  // enfants = 0 n'est pas un critère ; seul ≥ 1 est noté (et reste non mesurable).
  if (expected.enfants != null && expected.enfants >= 1) nonMesurables.push('enfants');

  if (expected.activite != null)
    out.push(
      critere('activite', trip.primary_activity === expected.activite, `attendu ${expected.activite}, rangé ${trip.primary_activity ?? 'absent'}`)
    );

  if (expected.mois != null) {
    const m = /^\d{4}-(\d{2})/.exec(trip.start_date ?? '');
    const month = m ? Number(m[1]) : null;
    out.push(critere('mois', month === expected.mois, `attendu ${expected.mois}, rangé ${month ?? 'absent'}`));
  }

  if (expected.issue === 'precision') {
    const af = autofillOf(trip.metadata);
    const prepared = typeof af.runId === 'string' && af.runId !== '';
    const notes = Array.isArray(af.notes) && af.notes.some((n) => typeof n === 'string' && n.trim() !== '');
    out.push(
      critere(
        'signale-le-manque',
        !prepared || notes,
        prepared ? (notes ? 'voyage prêt avec des notes' : 'voyage prêt sans rien signaler') : 'aucun voyage rendu'
      )
    );
  }

  return axis(out, nonMesurables);
}
