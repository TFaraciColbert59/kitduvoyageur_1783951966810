import registryJson from './routeRegistry.json';

/**
 * P6 — Registre de routage : SOURCE UNIQUE des redirections de configuration.
 *
 * Les donnees vivent dans `routeRegistry.json`, lit a la fois par ce module
 * (typage, invariants, tests) et par `route-redirects.config.mjs`, consomme par
 * `next.config.mjs`. `next.config.mjs` ne peut pas importer de TypeScript :
 * le JSON est donc le point de partage, et il n'y a qu'une seule copie des
 * decisions.
 *
 * Trois statuts, et pas deux :
 * - `active`  : redirection appliquee, destination verifiee sur disque ;
 * - `kept`    : route canonique qu'aucune redirection ne doit masquer ;
 * - `blocked` : redirection proposee par le plan et REFUSEE, avec la raison
 *   materielle. Une entree `blocked` pointe toujours vers une page vivante :
 *   c'est la preuve qu'appliquer la proposition aurait supprime une feature.
 *
 * Module PUR : aucune I/O, aucun import Next.
 */

/** Statut d'une entree de routage. */
export type RouteDecision = 'active' | 'kept' | 'blocked';

export interface ActiveRoute {
  readonly source: string;
  readonly destination: string;
  readonly permanent: boolean;
  readonly note: string;
}

export interface KeptRoute {
  readonly route: string;
  readonly note: string;
}

export interface BlockedRoute {
  readonly source: string;
  /** Cible proposee par le plan §8.1, volontairement NON appliquee. */
  readonly proposed: string;
  /** Motif materiel du refus (page vivante, stub parametrique, feature flag...). */
  readonly reason: string;
}

/** Redirections reellement appliquees. */
export const ACTIVE_ROUTES: readonly ActiveRoute[] = registryJson.active;

/** Routes canoniques preservees. */
export const KEPT_ROUTES: readonly KeptRoute[] = registryJson.kept;

/** Propositions refusees, avec leur motif. */
export const BLOCKED_ROUTES: readonly BlockedRoute[] = registryJson.blocked;

/**
 * Routes listees comme canoniques mais dont aucun `page.tsx` n'existe encore.
 * Le repertoire est reserve : aucune redirection ne doit les squatter, mais
 * l'absence de page n'est pas non plus une page cassee a corriger ici.
 */
export const RESERVED_WITHOUT_PAGE: readonly string[] = registryJson.reservedWithoutPage;

export { buildRedirects, ROUTE_REDIRECTS } from '../../route-redirects.config.mjs';
