/**
 * Politique de simulation GPS de l'Explorer v2.
 *
 * Incident P0 : `useGpsTracker` injectait automatiquement une pseudo-position
 * toutes les secondes dès qu'aucun fix GPS n'arrivait pendant 2,5 s. En
 * production, une sortie de trace réelle pouvait donc enregistrer un
 * déplacement **inventé** (et fausser distance, dénivelé, hors-trace).
 *
 * La simulation est désormais :
 *  - impossible dans un build `production` (`NODE_ENV === 'production'`), quoi
 *    qu'il arrive ;
 *  - désarmée par défaut : il faut un opt-in de build explicite
 *    (`NEXT_PUBLIC_EXPLORER_GPS_SIMULATION=1`) **et** un armement explicite par
 *    la fixture de recette/test (`armGpsSimulation`) ;
 *  - jamais alimentée par une absence de fix : seule la fixture peut la lancer.
 */

export interface GpsSimulationPolicy {
  nodeEnv: string | undefined;
  /** Opt-in de build (`NEXT_PUBLIC_EXPLORER_GPS_SIMULATION=1`). */
  optIn: boolean;
  /** Armement explicite par une fixture de test/recette. */
  armed: boolean;
}

/** Décision pure, testable : la production est toujours refusée. */
export function gpsSimulationAllowed(policy: GpsSimulationPolicy): boolean {
  return policy.nodeEnv !== 'production' && policy.optIn === true && policy.armed === true;
}

let armed = false;

/**
 * Arme la simulation pour une fixture de test/recette.
 * Sans effet (et `false`) dans un build de production.
 */
export function armGpsSimulation(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  armed = true;
  return true;
}

/** Désarme la simulation. */
export function disarmGpsSimulation(): void {
  armed = false;
}

/** État courant : `false` en production, dans tous les cas. */
export function gpsSimulationEnabled(): boolean {
  return gpsSimulationAllowed({
    nodeEnv: process.env.NODE_ENV,
    optIn: process.env.NEXT_PUBLIC_EXPLORER_GPS_SIMULATION === '1',
    armed,
  });
}
