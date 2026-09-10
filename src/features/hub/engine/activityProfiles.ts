import type { ActivityType } from './activityTypes';
import type { AdventureProfile, HubSectionId } from './hubProfileEngine';

/**
 * H-ACT §3 — Couche de profils d'activité du hub universel.
 *
 * La nature `sortie` COMPOSE déjà `deriveTripProfile` (R2). Cette couche
 * ajoute les deltas propres au type d'activité SANS dupliquer la matrice :
 *   - onglet Groupe (`groupe`, ex-Équipage) TOUJOURS visible — ajout et
 *     gestion des participants même en solo (couche groupe universelle) ;
 *   - libellés de sections spécialisés par activité (ex. Itinéraire → Parcours) ;
 *   - `activityType` exposé sur le profil pour la composition de l'aperçu.
 *
 * Fonction PURE — testable sans base de données.
 */

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

  // Rail sortie réduit au déroulé du jour — aucun masque d'activité restant.

  // Onglet Groupe toujours visible (qu'il soit vide ou non).
  const sections: HubSectionId[] = base.sections.includes('groupe')
    ? base.sections
    : [...base.sections, 'groupe'];

  const reason = { ...base.reason };
  if (!base.sections.includes('groupe')) {
    reason.groupe = 'affiché : onglet Groupe toujours visible (ajout et gestion des participants)';
  }

  return {
    ...base,
    activityType,
    widgets: [...base.widgets],
    sections,
    reason,
  };
}