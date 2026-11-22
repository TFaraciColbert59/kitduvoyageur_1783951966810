import { DEFAULT_NAISMITH, naismithDuration, naismithMethod } from '../../../insights/pace';
import type { RouteWorkspaceState } from '../../../types';

/**
 * Chiffres de tête du tiroir (4.4) et règle « l'inconnu n'est jamais zéro » (4.5).
 * Un chiffre est soit connu (somme de tronçons qui le disent tous), soit inconnu, et l'inconnu dit sur combien de
 * kilomètres il l'est (« D+ inconnu sur 3 km »). Une durée estimée est écrite « ≈ » et nommée comme telle.
 */
export interface Figure {
  readonly id: 'distance' | 'ascent' | 'descent' | 'duration';
  readonly label: string;
  /** Valeur affichée : « 42 km », « 2 180 m », « Inconnu », « ≈ 2 h 10 ». Jamais « 0 » pour un inconnu. */
  readonly value: string;
  readonly known: boolean;
  /** Précision visible dans tous les modes (« D+ inconnu sur 3 km », « estimée »). */
  readonly note: string | null;
  /** Méthode du chiffre, visible en vue experte seulement. */
  readonly method: string;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const ni = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const formatKm = (km: number) => `${nf.format(km)} km`;
export const formatMeters = (m: number) => `${ni.format(m)} m`;

export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Kilomètres des tronçons dont la mesure demandée manque. */
export function unknownKm(
  sections: RouteWorkspaceState['sections'],
  field: 'ascentM' | 'descentM' | 'durationMin'
): number {
  return Number(
    sections
      .filter((s) => s[field] == null)
      .reduce((acc, s) => acc + s.distanceKm, 0)
      .toFixed(1)
  );
}

/** « D+ inconnu sur 3 km » (ou « D− », « Durée »). */
export function unknownNote(label: string, km: number): string {
  return `${label} inconnu${label === 'Durée' ? 'e' : ''} sur ${formatKm(km)}`;
}

function providers(sections: RouteWorkspaceState['sections']): string {
  const names = Array.from(new Set(sections.map((s) => s.provenance.provider).filter((p): p is string => !!p)));
  return names.length > 0 ? names.join(', ') : 'fournisseur non renseigné';
}

export function routeFigures(
  ws: Pick<RouteWorkspaceState, 'sections' | 'points'>,
  options: { naismith?: typeof DEFAULT_NAISMITH } = {}
): Figure[] {
  const secs = ws.sections;
  const n = secs.length;
  const km = Number(secs.reduce((a, s) => a + s.distanceKm, 0).toFixed(2));
  const sum = (field: 'ascentM' | 'descentM' | 'durationMin') =>
    secs.some((s) => s[field] == null) ? null : secs.reduce((a, s) => a + (s[field] as number), 0);
  const asc = n > 0 ? sum('ascentM') : null;
  const desc = n > 0 ? sum('descentM') : null;
  const dur = n > 0 ? sum('durationMin') : null;
  const sections = `${n} ${n > 1 ? 'tronçons' : 'tronçon'}`;

  const dist: Figure =
    n === 0
      ? { id: 'distance', label: 'Distance', value: 'Inconnue', known: false, note: 'Aucun tronçon tracé', method: 'Somme des tronçons : aucun pour l’instant' }
      : { id: 'distance', label: 'Distance', value: formatKm(km), known: true, note: null, method: `Somme de ${sections} · ${providers(secs)}` };

  const elev = (id: 'ascent' | 'descent', label: string, value: number | null, field: 'ascentM' | 'descentM'): Figure => {
    if (n === 0) return { id, label, value: 'Inconnu', known: false, note: 'Aucun tronçon tracé', method: 'Somme des dénivelés des tronçons' };
    if (value !== null) return { id, label, value: formatMeters(value), known: true, note: null, method: `Somme des dénivelés de ${sections}` };
    const gap = unknownKm(secs, field);
    const known = secs.filter((s) => s[field] != null).reduce((a, s) => a + (s[field] as number), 0);
    return {
      id,
      label,
      value: 'Inconnu',
      known: false,
      note: `${unknownNote(label, gap)}${known > 0 ? ` · ${formatMeters(known)} connus ailleurs` : ''}`,
      method: `Somme des dénivelés de ${sections} : l’altitude manque sur ${formatKm(gap)}, aucun dénivelé n’est supposé`,
    };
  };

  const pace = options.naismith ?? DEFAULT_NAISMITH;
  let duration: Figure;
  if (n === 0) {
    duration = { id: 'duration', label: 'Durée', value: 'Inconnue', known: false, note: 'Aucun tronçon tracé', method: naismithMethod(pace) };
  } else if (dur !== null) {
    duration = { id: 'duration', label: 'Durée', value: formatDuration(dur), known: true, note: null, method: `Somme des durées de ${sections} · ${providers(secs)}` };
  } else {
    const est = naismithDuration(km, asc, pace);
    duration =
      est.minutes === null
        ? { id: 'duration', label: 'Durée', value: 'Inconnue', known: false, note: unknownNote('Durée', unknownKm(secs, 'durationMin')), method: est.method }
        : {
            id: 'duration',
            label: 'Durée',
            value: `≈ ${formatDuration(est.minutes)}`,
            known: false,
            note: est.isLowerBound ? 'estimée, minimum (D+ inconnu)' : 'estimée',
            method: est.method,
          };
  }

  return [dist, elev('ascent', 'D+', asc, 'ascentM'), elev('descent', 'D−', desc, 'descentM'), duration];
}
