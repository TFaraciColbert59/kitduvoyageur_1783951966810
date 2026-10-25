/**
 * « Partir librement » — reconnaissance d'activite (ecrans 61 / 62).
 *
 * Regle non negociable : rien n'est invente. On ne propose une activite que si
 * les mesures la distinguent reellement d'une autre. En cas de doute ou
 * d'absence de mesure, on renvoie `null` et l'ecran affiche « Activite a
 * identifier » — jamais un defaut plausible presente comme une certitude.
 */

import { activityById } from '@/features/adventure-prep/catalog';

/** Mesures observees pendant la session, toutes optionnelles. */
export interface FreeSessionSignals {
  /** Distance mesuree par le traceur, en km. `null` = non mesure. */
  distanceKm: number | null;
  /** Duree ecoulee en secondes : c'est une horloge, donc toujours connue. */
  durationSeconds: number;
  /** Vitesse moyenne en km/h. `null` = non calculable (trop peu de points). */
  averageSpeedKmH: number | null;
  /** Denivele positif en metres. `null` = capteurs absents. */
  elevationGainM: number | null;
}

export type ActivityGuessConfidence = 'proposee' | 'incertaine';

export interface ActivityGuess {
  activityId: string;
  label: string;
  icon: string;
  /** Ce qui a conduit a cette proposition, en mots. */
  because: string;
  confidence: ActivityGuessConfidence;
}

/** En dessous de ces seuils, aucune distinction n'est defendable. */
const MIN_DURATION_S = 15 * 60;
const MIN_DISTANCE_KM = 0.3;

function fmtDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

function fmtKm(km: number): string {
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

/**
 * Qualificatifs de catalogue, pas d'activite.
 *
 * Le catalogue nomme une ENTREE, pas une sortie : « Randonnee a la journee »
 * se distingue de « Randonnee avec nuit de refuge » parce que les deux lignes
 * sont voisines dans une liste. Un en-tete d'ecran n'a pas ce probleme — une
 * seule activite est a l'ecran, et rien ne peut lui etre confondu — mais
 * « Randonnee a la journee » y prend deux fois plus de place que necessaire.
 *
 * D'ou la regle : on retire le qualificatif, jamais le nom.
 *
 * La liste est fermee et explicite, et c'est volontaire. Un raccourcissement
 * plus general finirait par transformer « Ski de randonnee » en « Ski » ou
 * « Nuit en bivouac » en « Nuit » : deux erreurs qui disent autre chose que
 * l'activite reellement faite.
 */
const QUALIFIERS: readonly string[] = [
  ' à la journée',
  ' à la semaine',
  ' à la nuit',
  ' avec nuit',
  ' en mer',
  ' en ville',
  ' en avion',
  ' en montagne',
  ' autonome',
  ' de voyage',
];

/** En dessous de cette longueur, on ne coupe pas : « En » seul n'est pas un nom. */
const MIN_HEAD_LENGTH = 3;

/**
 * Nom d'activite affiche pendant et apres la sortie.
 *
 * Les noms sans qualificatif ne bougent pas : « Trail », « Course », « Kayak »,
 * « Alpinisme » et « Bikepacking » sont deja courts et exacts.
 */
export function shortActivityLabel(label: string): string {
  for (const qualifier of QUALIFIERS) {
    const at = label.indexOf(qualifier);
    if (at >= MIN_HEAD_LENGTH) return label.slice(0, at);
  }
  return label;
}

/**
 * Proposition d'activite a partir des seules mesures disponibles.
 *
 * On raisonne par bandes de vitesse moyenne : c'est le seul critere qui
 * distingue vraiment « course » de « randonnee » ou « velo ». Le denivele
 * n'est qu'un indice, jamais une preuve.
 *
 * Renvoie `null` — donc « Activite a identifier » — des que la session est
 * trop courte, trop courte en distance, ou sans vitesse exploitable.
 */
export function guessActivity(signals: FreeSessionSignals): ActivityGuess | null {
  const { distanceKm, durationSeconds, averageSpeedKmH, elevationGainM } = signals;

  if (durationSeconds < MIN_DURATION_S) return null;
  if (distanceKm === null || distanceKm < MIN_DISTANCE_KM) return null;
  if (averageSpeedKmH === null || averageSpeedKmH <= 0) return null;

  const band = resolveBand(averageSpeedKmH);
  if (band === null) return null;

  const def = activityById(band.activityId);
  if (def === null) return null;

  const reasons: string[] = [
    `vitesse moyenne ${averageSpeedKmH.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km/h`,
    `sur ${fmtDuration(durationSeconds)}`,
    fmtKm(distanceKm),
  ];
  if (elevationGainM !== null) reasons.push(`+${Math.round(elevationGainM)} m`);

  return {
    activityId: def.id,
    // Nom court : l'ecran 61 et 62 n'affichent qu'une seule activite, et le
    // qualificatif de catalogue n'y apporte rien.
    label: shortActivityLabel(def.label),
    icon: def.icon,
    because: reasons.join(', '),
    confidence: band.confidence,
  };
}

interface Band {
  activityId: string;
  confidence: ActivityGuessConfidence;
}

/**
 * Bandes de vitesse moyenne, en km/h.
 *
 * Les bornes se chevauchent volontairement : entre deux bandes franches, on
 * renvoie la lecture prudente (« incertaine »). Une mesure a 10,5 km/h est
 * aussi bien une course lente qu'un trail rapide : on le dit plutot que de
 * trancher au hasard.
 */
function resolveBand(speed: number): Band | null {
  // Sous 3 km/h : arret, ou traceur a la derive. Rien de defendable.
  if (speed < 3) return null;
  if (speed < 4.2) return { activityId: 'rando-journee', confidence: 'incertaine' };
  if (speed < 6) return { activityId: 'rando-journee', confidence: 'proposee' };
  if (speed < 8) return { activityId: 'trail', confidence: 'incertaine' };
  if (speed < 11.5) return { activityId: 'course', confidence: 'proposee' };
  if (speed < 14) return { activityId: 'course', confidence: 'incertaine' };
  if (speed <= 45) return { activityId: 'velo-route', confidence: 'proposee' };
  // Au-dela, la mesure est suspecte (bug de traceur, saut d'axe) :
  // on ne propose rien plutot qu'une idee fausse.
  return null;
}
