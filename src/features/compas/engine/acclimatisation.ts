/**
 * Compas — acclimatation en altitude (plan 4.5, fonction pure, aucune I/O).
 *
 * Règle publique, la même pour le planificateur d'itinéraire et pour le
 * contrôle d'un itinéraire déjà posé : au-dessus de 2 500 m, l'altitude de
 * COUCHAGE ne monte pas de plus de 300 à 500 m d'une nuit à l'autre, et une
 * nuit de plus à la même altitude revient après 2 à 4 jours de montée.
 *
 * Deux limites dites, jamais cachées :
 * - l'altitude d'une étape est un REPÈRE lu sur le relief ou sur la carte (un
 *   plancher, pas une mesure) : la nuit peut être plus haute, le texte le dit ;
 * - ce module ne pose aucun diagnostic et ne remplace pas un médecin.
 */

import { distanceKm } from './places';

/** La source LUE (pas citée de mémoire) : texte lu le 11 octobre 2026. */
export const ACCLIMATISATION_SOURCE = {
  organisation: 'UIAA (Union internationale des associations d’alpinisme), commission médicale',
  title:
    'Consensus Statement No. 2, « Emergency Field Management of Acute Mountain Sickness, High Altitude Pulmonary Edema, and High Altitude Cerebral Edema », § 3 Prevention of altitude diseases',
  year: 2012,
  version: 'V 3.2',
  url: 'https://www.theuiaa.org/documents/mountainmedicine/English_UIAA_MedCom_Rec_No_2_AMS_HAPE_HACE_2012_V3-2.pdf',
  readOn: '2026-10-11',
  /** Les deux phrases lues, telles quelles (faute d'origine comprise : « he same »). */
  quote:
    'Above 2500-3000m the next night should not be planned more than 300-500m higher than the previous one. Have two nights at he same altitude after every 2-4 days of ascent.',
  /**
   * Fiche de la même commission, lue le même jour : « Usually after 2700m, not to
   * climb more than 400m from the previous night's sleeping altitude would be a
   * reasonable recommendation » et « A rest day after every two days of gain in altitude may also help ».
   */
  factsheetUrl: 'https://www.theuiaa.org/documents/safety/UIAA_Medical_AltitudeSickness.pdf',
} as const;

/** Au-dessus de cette altitude de couchage (m), la règle s'applique. */
export const ACCLIMATISATION_FROM_M = 2500;
/** Montée de couchage d'une nuit à l'autre au plus (m) : le haut de la fourchette de 300 à 500 m. */
export const MAX_SLEEP_GAIN_M = 500;
/** Nuits de montée d'affilée au-dessus de 2 500 m après lesquelles le planificateur pose une nuit de plus au même lieu (fourchette lue : 2 à 4 jours). */
export const REST_AFTER_NIGHTS = 3;
/** Au-delà de ce nombre de nuits d'affilée, le contrôle signale l'absence de nuit au même niveau. */
export const REST_MAX_NIGHTS = 4;

/**
 * De combien (m) la nuit suivante dépasse les 500 m de montée, quand elle est
 * à 2 500 m ou plus. 0 si l'une des altitudes est inconnue (rien n'est déduit).
 */
export function sleepOvershootM(
  prevM: number | null | undefined,
  nextM: number | null | undefined
): number {
  if (prevM == null || nextM == null || !Number.isFinite(prevM) || !Number.isFinite(nextM))
    return 0;
  if (nextM < ACCLIMATISATION_FROM_M) return 0;
  return Math.max(0, nextM - prevM - MAX_SLEEP_GAIN_M);
}

export interface SleepNight {
  /** Numéro du jour (le soir de ce jour-là). */
  day: number;
  /** Altitude repère du lieu où l'on dort (m), null si inconnue. */
  eleM: number | null;
  /** Même lieu que la nuit d'avant : une nuit au même niveau. */
  stay?: boolean;
}

export type AcclimFinding =
  | { kind: 'gain'; day: number; fromM: number; toM: number; gainM: number }
  | { kind: 'rest'; day: number; nights: number };

/**
 * Contrôle d'un itinéraire : les nuits qui montent de plus de 500 m (arrivée
 * à 2 500 m ou plus) et les séries de plus de 4 nuits de MONTÉE au-dessus de
 * 2 500 m sans nuit au même niveau. Seule une nuit plus haute que la précédente
 * prolonge la série ; une nuit au même niveau ou plus basse (palier) la remet à
 * zéro, comme la règle de l'UIAA, qui parle de jours de montée. `startM` :
 * altitude de la nuit d'avant la première, si on la connaît (sinon la première
 * nuit n'est pas jugée, et compte dans la série : on ne déduit pas qu'elle
 * redescend). `nights` : les nuits seulement, pas l'étape d'arrivée du dernier
 * jour (voir `sleepNightsOf`).
 */
export function checkSleepingProfile(
  nights: ReadonlyArray<SleepNight>,
  startM: number | null = null
): AcclimFinding[] {
  const out: AcclimFinding[] = [];
  let prev = startM;
  let streak = 0;
  for (const n of nights) {
    const over = sleepOvershootM(prev, n.eleM);
    if (over > 0 && prev != null && n.eleM != null)
      out.push({
        kind: 'gain',
        day: n.day,
        fromM: Math.round(prev),
        toM: Math.round(n.eleM),
        gainM: Math.round(n.eleM - prev),
      });
    const climbs = n.eleM != null && (prev == null || n.eleM > prev);
    if (n.stay || !climbs || n.eleM == null || n.eleM < ACCLIMATISATION_FROM_M) streak = 0;
    else {
      streak += 1;
      if (streak === REST_MAX_NIGHTS + 1) out.push({ kind: 'rest', day: n.day, nights: streak });
    }
    if (n.eleM != null) prev = n.eleM;
  }
  return out;
}

/**
 * Les nuits d'un itinéraire, à passer à `checkSleepingProfile` : les étapes des
 * jours 1 à `nightsCount` seulement (le dernier jour est l'arrivée, on n'y dort
 * pas : `nightsCount` = jours - 1). `steps` : les étapes localisées, dans
 * l'ordre ; `altitudes` : leur altitude repère, dans le même ordre (null :
 * inconnue). Une étape à moins de 300 m de la précédente est la même nuit au
 * même niveau.
 */
export function sleepNightsOf(
  steps: ReadonlyArray<{ day: number; lat: number; lon: number }>,
  altitudes: ReadonlyArray<number | null> | null,
  nightsCount: number
): SleepNight[] {
  return steps
    .map((st, i) => ({
      day: st.day,
      eleM: altitudes?.[i] ?? null,
      stay: i > 0 && distanceKm(st, steps[i - 1]) < 0.3,
    }))
    .filter((n) => n.day >= 1 && n.day <= nightsCount);
}

const rounded = (m: number) => `${Math.round(m / 10) * 10}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * La note de l'écran : la règle, la limite des repères, puis les étapes à
 * revoir. Prudente : « conseille », « repères », jamais un diagnostic.
 * Rien si l'itinéraire ne dépasse jamais 2 500 m.
 */
export function acclimatisationNote(input: {
  maxAltitudeM: number | null;
  findings: ReadonlyArray<AcclimFinding>;
}): string | null {
  const max = input.maxAltitudeM;
  if (max == null || !Number.isFinite(max) || max < ACCLIMATISATION_FROM_M) return null;
  const parts = [
    `Altitude jusqu’à ${rounded(max)} m environ (repère lu sur le relief : la nuit peut être plus haute). La commission médicale de l’UIAA conseille, au-dessus de 2 500 m, de ne pas dormir plus de 300 à 500 m plus haut que la nuit d’avant et de passer deux nuits à la même altitude après 2 à 4 jours de montée (UIAA, 2012, lue le 11 octobre 2026).`,
  ];
  const gains = input.findings.filter(
    (f): f is Extract<AcclimFinding, { kind: 'gain' }> => f.kind === 'gain'
  );
  if (gains.length)
    parts.push(
      `À revoir : ${gains
        .slice(0, 3)
        .map((g) => `jour ${g.day} (environ +${rounded(g.gainM)} m de couchage)`)
        .join(
          ', '
        )}${gains.length > 3 ? ' et d’autres' : ''}. Ajoute une nuit intermédiaire si tu le peux.`
    );
  const rest = input.findings.find((f) => f.kind === 'rest');
  if (rest)
    parts.push(
      `Pas de nuit au même niveau depuis ${rest.nights} jours de montée (jour ${rest.day}) : prévois-en une.`
    );
  parts.push(
    'Au moindre mal de tête, nausée ou essoufflement au repos, ne monte plus et redescends ; en cas de doute, demande conseil à un médecin avant de partir.'
  );
  return parts.join(' ');
}
