/**
 * Allure ajustée à la pente (A04 · S2.09).
 *
 * Décision de cette tranche : **aucune valeur n'est calculée**. Le dépôt ne
 * contient aucune méthode de conversion d'une allure de course vers une allure
 * équivalente sur plat dont la méthode et les paramètres seraient validés.
 *
 * Les modèles présents dans le dépôt ne répondent pas à cette question :
 *   - Tobler et Naismith sont des modèles de **marche/randonnée** (vitesse ou
 *     durée), pas une conversion d'allure de course ;
 *   - le résolveur A3 (`resolvePace`) est un modèle de **randonnée** avec des
 *     paramètres heuristiques (`+1` ou `+0,8` min/km par 100 m D+/km, `+0,4`
 *     en descente technique), non validé pour la course et sans pente par
 *     segment ;
 *   - le plan d'architecture parle d'un `coefficient_pente` sans formule ni
 *     paramètres ;
 *   - le GAP de Strava est propriétaire : aucune formule ni aucun paramètre
 *     publiable n'est présent dans le dépôt.
 *
 * Aucune valeur n'est donc produite. Une future estimation devra être
 * étiquetée `estimated`, jamais `measured`, et ne pourra pas revendiquer une
 * équivalence avec un algorithme propriétaire sans preuve.
 *
 * Ce module est volontairement sans dépendance et sans calcul : il expose un
 * contrat d'indisponibilité que l'interface ne peut pas contourner par un
 * nombre par défaut.
 */

import type { MetricQuality, Sport } from '../state/types';

/** Sports de course pour lesquels la fiche S2.09 demande cette analyse. */
export const SLOPE_ADJUSTED_PACE_SPORTS: ReadonlySet<Sport> = new Set<Sport>([
  'course',
  'trail',
]);

/**
 * Une valeur ajustée à la pente serait une **estimation** issue d'un modèle,
 * jamais une mesure : le GPS ne mesure pas une « allure sur plat ».
 */
export const SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY: Extract<MetricQuality, 'estimated'> =
  'estimated';

/**
 * Motif court, affichable. Le détail des méthodes examinées vit dans
 * `docs/explorer-v2/S2.09-ALLURE-PENTE.md`.
 */
export const SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON =
  'Aucune méthode de conversion validée pour la course ; la pente par segment n’est pas mesurée.';

/**
 * Contrat d'indisponibilité. `method` et `parameters` restent `null` : aucun
 * algorithme ne peut être invoqué implicitement par l'interface.
 */
export interface SlopeAdjustedPaceAvailability {
  status: 'unavailable';
  method: null;
  parameters: null;
  wouldBeQuality: typeof SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY;
  /** Aucune équivalence avec le GAP d'un service tiers n'est revendiquée. */
  proprietaryEquivalent: false;
  reason: string;
}

const UNAVAILABLE: SlopeAdjustedPaceAvailability = {
  status: 'unavailable',
  method: null,
  parameters: null,
  wouldBeQuality: SLOPE_ADJUSTED_PACE_WOULD_BE_QUALITY,
  proprietaryEquivalent: false,
  reason: SLOPE_ADJUSTED_PACE_UNAVAILABLE_REASON,
};

/** Vrai pour les sports de course concernés par la fiche. */
export function supportsSlopeAdjustedPace(sport: Sport): boolean {
  return SLOPE_ADJUSTED_PACE_SPORTS.has(sport);
}

/**
 * Point d'entrée unique de l'allure ajustée. Retourne `null` pour les sports
 * non concernés et un contrat d'indisponibilité motivé pour la course.
 *
 * Aucun nombre n'est retourné : un consommateur ne peut donc pas afficher une
 * allure ajustée par accident, ni la confondre avec une mesure.
 */
export function readSlopeAdjustedPace(sport: Sport): SlopeAdjustedPaceAvailability | null {
  if (!supportsSlopeAdjustedPace(sport)) return null;
  // Copie défensive : un consommateur ne peut pas muter le contrat partagé.
  return { ...UNAVAILABLE };
}
