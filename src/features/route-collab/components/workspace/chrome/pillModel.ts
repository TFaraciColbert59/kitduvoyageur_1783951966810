import {
  formatPillSummary,
  readinessFacts,
  routeQualityLight,
  type Readiness,
  type RouteQualityLight,
} from '../../../insights';
import { legsStats, stageLegs } from '../../../insights/shared';
import type { RouteWorkspaceState } from '../../../types';
import { saveStatusOf, type SaveInputs, type SaveStatus } from './saveStatus';

/**
 * Modèle de la pilule (3.1, 3.2, 3.7, 3.8) : tout ce qu'elle dit, calculé sans rendu, donc testable.
 * Règle : un chiffre inconnu s'écrit « ? », jamais 0 ; un état de préparation est un compte de faits, jamais
 * une note.
 */
export interface PillDay {
  readonly id: string;
  readonly dayNumber: number;
  readonly label: string;
  /** « Jour 2 · 14 km · D+ inconnu » : lu par les lecteurs d'écran et au survol. */
  readonly title: string;
}

export interface PillModel {
  readonly summary: string;
  readonly light: RouteQualityLight & { readonly text: string };
  readonly readiness: Readiness & { readonly text: string; readonly facts: string };
  readonly days: readonly PillDay[];
  readonly save: SaveStatus;
}

const LIGHT_TEXT: Record<RouteQualityLight['level'], string> = {
  green: 'Tracé continu, altitude et surface connues',
  orange: 'Tracé continu, à vérifier',
  red: 'Tracé à corriger',
};

export function readinessText(r: Readiness): string {
  if (r.remaining.length === 0) return r.label;
  const n = r.remaining.length;
  return `${r.label} · ${n} ${n > 1 ? 'points' : 'point'}`;
}

export function dayChips(ws: RouteWorkspaceState): PillDay[] {
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  return ws.stages
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((st) => {
      const stats = legsStats(stageLegs(ws, st));
      const km = stats.legCount > 0 ? `${fmt.format(stats.distanceKm)} km` : 'distance inconnue';
      const d = stats.ascentM != null ? `D+ ${stats.ascentM} m` : 'D+ inconnu';
      return { id: st.id, dayNumber: st.dayNumber, label: `J${st.dayNumber}`, title: `Jour ${st.dayNumber} · ${km} · ${d}` };
    });
}

export function buildPillModel(ws: RouteWorkspaceState, save: SaveInputs): PillModel {
  const light = routeQualityLight(ws);
  const readiness = readinessFacts(ws);
  return {
    summary: formatPillSummary(ws),
    light: { ...light, text: light.reasons[0] ?? LIGHT_TEXT[light.level] },
    readiness: {
      ...readiness,
      text: readinessText(readiness),
      facts: readiness.remaining.map((f) => f.text).join(' · '),
    },
    days: dayChips(ws),
    save: saveStatusOf(save),
  };
}
