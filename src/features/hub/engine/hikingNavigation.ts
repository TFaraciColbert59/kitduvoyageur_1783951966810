import type { HubHikingContext } from '../server/getHubAdventureData';

/**
 * Phase 3 — Décision UNIQUE d'activation de l'entrée « Démarrer la randonnée ».
 *
 * Règle géographique du chantier LANCEMENT_MONDIAL :
 *   géométrie BDD valide (ou GPX validé / routage autorisé)
 *   SINON aucun bouton « Démarrer la navigation ».
 *
 * Le repli `uniform_from_blueprint` est une estimation : il ne peut jamais
 * activer la navigation. La seule source de vérité est `routeNavigable`,
 * calculé côté serveur par le même prédicat que `select_adventure_plan_route`.
 */

export interface HikingNavigationDecision {
  enabled: boolean;
  label: 'Démarrer la randonnée' | 'Choisir un parcours';
  href: string;
  /** Explication affichée quand la navigation est désactivée (null sinon). */
  reason: string | null;
}

export const CHOOSE_ROUTE_HREF = '/preparer-randonnee';

export function hikingNavigationHref(routeId: string): string {
  return `/randonnee-active?routeId=${encodeURIComponent(routeId)}`;
}

export function decideHikingNavigation(
  hiking: HubHikingContext | null
): HikingNavigationDecision {
  if (!hiking) {
    return {
      enabled: false,
      label: 'Choisir un parcours',
      href: CHOOSE_ROUTE_HREF,
      reason: 'Aucun voyage actif ne porte de parcours.',
    };
  }

  if (hiking.routeId && hiking.routeNavigable) {
    return {
      enabled: true,
      label: 'Démarrer la randonnée',
      href: hikingNavigationHref(hiking.routeId),
      reason: null,
    };
  }

  if (hiking.routeId && !hiking.routeNavigable) {
    return {
      enabled: false,
      label: 'Choisir un parcours',
      href: CHOOSE_ROUTE_HREF,
      reason:
        'Le parcours lié n’a pas de tracé GPS vérifié — choisissez un parcours réel pour activer la navigation.',
    };
  }

  return {
    enabled: false,
    label: 'Choisir un parcours',
    href: CHOOSE_ROUTE_HREF,
    reason:
      'Aucun parcours réel n’est sélectionné — la navigation reste désactivée tant qu’aucun tracé vérifié n’est choisi.',
  };
}
