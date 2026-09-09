import type { ActivityType } from './activityTypes';
import type { AdventureProfile, HubSectionId, HubWidgetId } from './hubProfileEngine';

/**
 * H-ACT §3 — Couche de profils d'activité du hub universel.
 *
 * La nature `sortie` COMPOSE déjà `deriveTripProfile` (R2). Cette couche
 * ajoute les deltas propres au type d'activité SANS dupliquer la matrice :
 *   - onglet Équipage (`team`) TOUJOURS visible — ajout et gestion des
 *     participants même en solo (couche groupe universelle) ;
 *   - widgets de sidebar masqués quand ils ne concernent pas l'activité ;
 *   - libellés de sections spécialisés par activité (ex. Itinéraire → Parcours) ;
 *   - `activityType` exposé sur le profil pour la composition de l'aperçu.
 *
 * Fonction PURE — testable sans base de données.
 */

/** Widgets de sidebar sans pertinence pour une randonnée. */
const HIKING_MASKED_WIDGETS: ReadonlySet<HubWidgetId> = new Set([
  'budget-burn',
  'country-card',
  'docs-expiry',
  'trip-context',
]);

/** Libellés de sections spécialisés par type d'activité. */
export const ACTIVITY_SECTION_LABELS: Partial<
  Record<ActivityType, Partial<Record<HubSectionId, string>>>
> = {
  hiking: {
    itinerary: 'Parcours',
    gear: 'Matériel',
  },
  travel: {
    gear: 'Matériel & bagages',
  },
};

/** Libellé d'une section pour une activité donnée (retombe sur le registre). */
export function activitySectionLabel(
  activityType: ActivityType | null | undefined,
  sectionId: HubSectionId,
  fallback: string,
): string {
  if (!activityType) return fallback;
  return ACTIVITY_SECTION_LABELS[activityType]?.[sectionId] ?? fallback;
}

/**
 * Applique les deltas du profil d'activité sur le profil de base (trip).
 * @param cancelled  voyage annulé → aperçu seul, aucun delta.
 */
export function applyActivityProfile(
  base: AdventureProfile,
  activityType: ActivityType,
  cancelled: boolean,
): AdventureProfile {
  if (cancelled) return { ...base, activityType };

  // Widgets masqués pour l'activité (budget/pays/documents pertinents en voyage).
  const widgets: HubWidgetId[] =
    activityType === 'hiking'
      ? base.widgets.filter((w) => !HIKING_MASKED_WIDGETS.has(w))
      : base.widgets;

  // Onglet Équipage toujours visible (qu'il soit vide ou non).
  const sections: HubSectionId[] = base.sections.includes('team')
    ? base.sections
    : [...base.sections, 'team'];

  const reason = { ...base.reason };
  if (!base.sections.includes('team')) {
    reason.team = 'affiché : onglet Équipage toujours visible (ajout et gestion des participants)';
  }

  return {
    ...base,
    activityType,
    widgets,
    sections,
    reason,
  };
}