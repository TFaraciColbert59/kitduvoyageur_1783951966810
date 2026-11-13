/**
 * Splits kilométriques, splits impériaux et tours d'une activité
 * (K5.09 / S2.05).
 *
 * Le moteur ne reçoit que des intervalles **réellement acceptés** par
 * `ActivityTracker` : une distance et le temps en mouvement associé. Les
 * pauses manuelles, les pauses automatiques et les trous GPS n'arrivent donc
 * jamais ici ; ils ne peuvent ni avancer un kilomètre ni gonfler un tour.
 *
 * Trois découpes indépendantes sont tenues :
 *   - `km` : un split par kilomètre entamé, fermé au franchissement exact du
 *     seuil. Quand un intervalle traverse le seuil, son temps est réparti au
 *     prorata de la distance réellement mesurée. Aucune distance n'est
 *     inventée : un trou GPS laisse simplement le split en attente.
 *   - `mi` : la même découpe par mile (1 609,344 m), tenue en parallèle pour
 *     que le passage aux unités impériales ne réinvente ni ne recalculé les
 *     valeurs rétroactivement.
 *   - `laps` : tours manuels, fermés uniquement sur demande. Un tour sans
 *     distance mesurée n'est pas créé (double appui, départ, bruit GPS).
 *
 * Les valeurs sont propres à chaque segment : durée en mouvement, distance et
 * allure/vitesse dérivées. Aucune allure globale n'est recopiée.
 */

import type { ActivitySplit } from '../state/types';

/** Longueur d'un split kilométrique, en mètres. */
export const SPLIT_DISTANCE_M = 1000;

/** Longueur d'un split impérial (mile international), en mètres. */
export const MILE_DISTANCE_M = 1609.344;

/** Distance minimale pour qu'un tour manuel soit considéré comme réel. */
export const MIN_LAP_DISTANCE_M = 1;

const EPSILON_M = 1e-6;

export interface SplitsState {
  km: ActivitySplit[];
  mi: ActivitySplit[];
  laps: ActivitySplit[];
}

export function createSplit(kind: ActivitySplit['kind'], index: number): ActivitySplit {
  return {
    kind,
    index,
    distanceM: 0,
    movingS: 0,
    completed: false,
  };
}

/** État initial d'une séance : km 1, mile 1 et tour 1 ouverts, à zéro. */
export function createSplitsState(): SplitsState {
  return {
    km: [createSplit('km', 1)],
    mi: [createSplit('mi', 1)],
    laps: [createSplit('lap', 1)],
  };
}

/** Copie défensive : le consommateur ne peut pas muter l'état interne. */
export function cloneSplits(splits: readonly ActivitySplit[] | undefined): ActivitySplit[] {
  return (splits ?? []).map((split) => ({ ...split }));
}

/**
 * Ajoute un intervalle à une découpe de longueur fixe. Le temps est réparti au
 * prorata de la distance mesurée quand le seuil tombe dans l'intervalle.
 */
function addToScale(
  splits: readonly ActivitySplit[],
  kind: ActivitySplit['kind'],
  unitM: number,
  distanceM: number,
  time: number,
): ActivitySplit[] {
  const next = splits.length > 0 ? splits.slice() : [createSplit(kind, 1)];
  let current = next[next.length - 1];
  let remainingDistance = distanceM;
  let remainingTime = time;

  while (remainingDistance > EPSILON_M) {
    const missing = unitM - current.distanceM;

    // État déjà complet (ne devrait pas arriver) : on ouvre le suivant sans
    // lui attribuer un temps qui ne lui appartient pas.
    if (missing <= EPSILON_M) {
      current = createSplit(kind, current.index + 1);
      next.push(current);
      continue;
    }

    if (remainingDistance < missing - EPSILON_M) {
      current = {
        ...current,
        distanceM: current.distanceM + remainingDistance,
        movingS: current.movingS + remainingTime,
      };
      next[next.length - 1] = current;
      remainingDistance = 0;
      remainingTime = 0;
      break;
    }

    // Le seuil tombe dans cet intervalle : la part de temps affectée au split
    // est la part de distance réellement mesurée avant le seuil.
    const fraction = Math.min(1, missing / remainingDistance);
    const timePart = remainingTime * fraction;
    current = {
      ...current,
      distanceM: unitM,
      movingS: current.movingS + timePart,
      completed: true,
    };
    next[next.length - 1] = current;

    remainingDistance = Math.max(0, remainingDistance - missing);
    remainingTime = Math.max(0, remainingTime - timePart);

    current = createSplit(kind, current.index + 1);
    next.push(current);
  }

  return next;
}

/**
 * Ajoute un intervalle mesuré aux découpes.
 *
 * `distanceM` et `movingS` doivent être les incréments du tracker pour ce
 * fix : jamais des cumuls. Un intervalle nul ou non fini est ignoré.
 */
export function addSplitInterval(
  state: SplitsState,
  distanceM: number,
  movingS: number,
): SplitsState {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return state;
  const time = Number.isFinite(movingS) ? Math.max(0, movingS) : 0;

  const laps = state.laps.length > 0 ? state.laps.slice() : [createSplit('lap', 1)];
  const currentLap = laps[laps.length - 1];
  laps[laps.length - 1] = {
    ...currentLap,
    distanceM: currentLap.distanceM + distanceM,
    movingS: currentLap.movingS + time,
  };

  const km = addToScale(state.km, 'km', SPLIT_DISTANCE_M, distanceM, time);
  const mi = addToScale(state.mi, 'mi', MILE_DISTANCE_M, distanceM, time);

  return { km, mi, laps };
}

/**
 * Ferme le tour courant et en ouvre un nouveau. Sans distance mesurée, aucun
 * tour vide n'est créé : l'état est rendu inchangé.
 */
export function closeLap(state: SplitsState): SplitsState {
  const laps = state.laps.length > 0 ? state.laps.slice() : [createSplit('lap', 1)];
  const current = laps[laps.length - 1];
  if (current.distanceM + EPSILON_M < MIN_LAP_DISTANCE_M) return state;

  laps[laps.length - 1] = { ...current, completed: true };
  laps.push(createSplit('lap', current.index + 1));
  return { ...state, laps };
}

/** Dernier split non fermé d'une liste, ou `null`. */
export function activeSplit(
  splits: readonly ActivitySplit[] | undefined,
): ActivitySplit | null {
  if (!splits || splits.length === 0) return null;
  const last = splits[splits.length - 1];
  return last.completed ? null : last;
}

/** Allure du segment (s/km), ou `null` sans distance ou sans temps mesuré. */
export function splitPaceSecondsPerKm(split: ActivitySplit): number | null {
  if (!(split.distanceM > 0) || !(split.movingS > 0)) return null;
  return split.movingS / (split.distanceM / 1000);
}

/** Allure du segment (s/mile), ou `null` sans distance ou sans temps mesuré. */
export function splitPaceSecondsPerMile(split: ActivitySplit): number | null {
  const perKm = splitPaceSecondsPerKm(split);
  return perKm === null ? null : perKm * (MILE_DISTANCE_M / 1000);
}

/** Vitesse du segment (km/h), ou `null` sans distance ou sans temps mesuré. */
export function splitSpeedKmh(split: ActivitySplit): number | null {
  if (!(split.distanceM > 0) || !(split.movingS > 0)) return null;
  return (split.distanceM / split.movingS) * 3.6;
}
