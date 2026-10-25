/**
 * T3 - Le carburant : le constructeur de graines du marche des traces.
 *
 * Risque de cold start repris tel quel du dossier : "les randonnees perso de
 * l'utilisateur sont la graine primordiale ; la tribu enrichit ensuite".
 * Cet ordre n'est pas une convention d'affichage, il est encode dans le
 * code : le perso passe en premier, et le dedoublonnage conserve la premiere
 * graine rencontree - donc la graine perso - des lors qu'une trace de la
 * tribu parle de la meme echelle ET de la meme destination.
 *
 * Regles de purete du module, identiques a `scaleAxis` et `traces` :
 * - aucun import hors domaine, aucun reseau, aucun `Date.now()`, aucun `new
 *   Date()` : deux appels sur la meme entree rendent le meme tableau, au bit
 *   pres ;
 * - la `zone` d'une graine n'est JAMAIS une valeur saisie : elle est derivee
 *   de `hours` par `zoneForHours`. C'est ce qui garde "a ton echelle"
 *   coherent quand une definition de zone bouge ;
 * - le matching n'est pas reecrit : on branche sur `matchTraces` et
 *   `scaleMatchScore`, on n'en fait pas une deuxieme version.
 */

import {
  H_MAX,
  H_MIN,
  clamp,
  hoursFromT,
  tAtZoneMiddle,
  zoneForHours,
  type TrajectoireZone,
} from './scaleAxis';
import { AT_SCALE_THRESHOLD, scaleMatchScore, type TraceSeed } from './traces';

/** Curseur perso : une sortie reellement vecue, randonnee ou carnet ecrit. */
export interface PersonalHike {
  id: string;
  label: string;
  /** Duree de la sortie, en heures. */
  hours: number;
  distanceM?: number | null;
  /** Destination. C'est aussi la clef de dedoublonnage. */
  region?: string | null;
  /** Date de la sortie (ISO). Seule l'annee est lue, sans `new Date()`. */
  happenedAt?: string | null;
}

/** Carnet de la tribu : le meme format qu'une randonnee perso, plus un auteur. */
export interface TribeCarnet {
  id: string;
  author: string;
  label: string;
  hours: number;
  distanceM?: number | null;
  region?: string | null;
}

/** Auteur affiche pour une graine perso : elle appartient a l'utilisateur. */
export const PERSONAL_TRACE_AUTHOR = 'Moi';

/** Repli quand un carnet de la tribu arrive sans auteur. */
export const TRIBE_FALLBACK_AUTHOR = 'La tribu';

const LABEL_FALLBACK_PERSO = 'Sortie personnelle';
const LABEL_FALLBACK_TRIBU = 'Carnet de tribu';

/** Detail d'une graine, avant le calcul de sa zone et de son contexte. */
interface SeedDraft {
  id: string;
  author: string;
  label: string;
  hours: number;
  distanceM: number | null;
  region: string | null;
  year: string | null;
}

interface SeedDraftEntry {
  draft: SeedDraft;
  source: TraceSeed['source'];
}

/** Compte de graines "a ton echelle" pour une zone donnee. */
export interface ZoneSeedCount {
  zone: TrajectoireZone;
  /** Duree representative de la zone, en heures (point median de l'axe). */
  hours: number;
  /** Graines dont le score d'echelle franchit le seuil de l'app. */
  count: number;
}

/**
 * Construit les graines du marche des traces, graine primordiale d'abord.
 *
 * Priorite explicite, dans cet ordre et jamais l'inverse :
 * 1. les curseurs perso - ce sont des sorties vecues, donc la seule base
 *    honnete sur laquelle un plan peut demarrer ;
 * 2. les carnets de la tribu - ils enrichissent ensuite, et seulement
 *    la ou ils n'ecrasent pas une graine perso.
 *
 * Une entree est ignoree plutot que fatale quand elle n'a pas d'identifiant
 * (une graine non traçable ne peut pas etre auditee), quand ses heures sont
 * nulles, negatives ou non finies. Les heures trop grandes sont ramenees a
 * `H_MAX` : une trace qui depasse l'axe reste une trace, elle est bornee.
 */
export function buildTraceSeeds(
  personal: readonly PersonalHike[] = [],
  tribe: readonly TribeCarnet[] = []
): TraceSeed[] {
  // L'ordre du tableau est la priorite ; le dedoublonnage garde le premier
  // occupant d'une destination, donc le perso qui est passe avant la tribu.
  const entries: readonly SeedDraftEntry[] = [
    ...draftsFromPersonal(personal),
    ...draftsFromTribe(tribe),
  ];
  return toSeeds(entries);
}

/**
 * Le gate de sortie T3, zone par zone : combien de graines franchissent le
 * seuil "a ton echelle" pour la duree representative de chaque zone.
 *
 * On reutilise `scaleMatchScore` et `AT_SCALE_THRESHOLD` du moteur de
 * matching, avec le meme operateur `>=` que le badge `atYourScale` de
 * `matchTraces` : sinon le gate compterait des graines que l'ecran
 * n'affiche pas, et la sortie serait decalee du produit.
 */
export function atScaleCountForZones(
  seeds: readonly TraceSeed[],
  zones: readonly TrajectoireZone[]
): readonly ZoneSeedCount[] {
  return zones.map((zone) => {
    const hours = hoursFromT(tAtZoneMiddle(zone));
    const count = seeds.filter(
      (seed) => scaleMatchScore(seed.hours, hours) >= AT_SCALE_THRESHOLD
    ).length;
    return { zone, hours, count };
  });
}

function draftsFromPersonal(hikes: readonly PersonalHike[]): readonly SeedDraftEntry[] {
  return hikes
    .map((hike): SeedDraftEntry | null => {
      const id = usableText(hike.id);
      const hours = usableHours(hike.hours);
      if (id === null || hours === null) return null;
      return {
        draft: {
          id,
          author: PERSONAL_TRACE_AUTHOR,
          label: usableText(hike.label) ?? LABEL_FALLBACK_PERSO,
          hours,
          distanceM: usableDistance(hike.distanceM),
          region: usableText(hike.region),
          year: usableYear(hike.happenedAt),
        },
        source: 'randonnee_perso',
      };
    })
    .filter((entry): entry is SeedDraftEntry => entry !== null);
}

function draftsFromTribe(carnets: readonly TribeCarnet[]): readonly SeedDraftEntry[] {
  return carnets
    .map((carnet): SeedDraftEntry | null => {
      const id = usableText(carnet.id);
      const hours = usableHours(carnet.hours);
      if (id === null || hours === null) return null;
      return {
        draft: {
          id,
          author: usableText(carnet.author) ?? TRIBE_FALLBACK_AUTHOR,
          label: usableText(carnet.label) ?? LABEL_FALLBACK_TRIBU,
          hours,
          distanceM: usableDistance(carnet.distanceM),
          region: usableText(carnet.region),
          year: null,
        },
        source: 'trace_tribu',
      };
    })
    .filter((entry): entry is SeedDraftEntry => entry !== null);
}

function toSeeds(entries: readonly SeedDraftEntry[]): TraceSeed[] {
  const seeds: TraceSeed[] = [];
  let claimed: readonly string[] = [];
  for (const entry of entries) {
    // La zone vient du moteur, jamais de la saisie : une graine ne peut pas
    // se retrouver dans une zone que ses heures ne justifient pas.
    const zone = zoneForHours(entry.draft.hours);
    const seed: TraceSeed = {
      id: entry.draft.id,
      author: entry.draft.author,
      context: buildContext(entry.draft),
      hours: entry.draft.hours,
      distanceM: entry.draft.distanceM,
      source: entry.source,
      zone: zone.id,
    };
    const key = destinationKey(zone.id, entry.draft.region);
    if (key === null) {
      seeds.push(seed);
      continue;
    }
    if (claimed.includes(key)) continue;
    claimed = [...claimed, key];
    seeds.push(seed);
  }
  return seeds;
}

/**
 * Clef de dedoublonnage : meme echelle ET meme destination. Sans region, on
 * ne peut pas prouver que deux traces parlent du meme endroit, donc aucune
 * deduplication n'est appliquee - on ne jette jamais une graine sur un
 * doute.
 */
function destinationKey(zone: TrajectoireZone, region: string | null): string | null {
  if (region === null) return null;
  return `${zone}|${normalizeDestination(region)}`;
}

/**
 * Normalise une destination pour comparer "Pyrenees", "pyrÉNées" et
 * "Pyrénées" : minuscules, sans diacritiques, sans ponctuation.
 */
function normalizeDestination(region: string): string {
  return region
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ligne de contexte, dans l'ordre du dossier : lieu, intitule, année, distance. */
function buildContext(draft: SeedDraft): string {
  const distanceKm = draft.distanceM === null ? null : formatKm(draft.distanceM);
  return [draft.region, draft.label, draft.year, distanceKm]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' - ');
}

/** Distance en kilometres, virgule decimale francaise, une seule decimale. */
function formatKm(distanceM: number): string {
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Heures utilisables, bornees sur l'axe. `null` = entree ignoree. */
function usableHours(hours: number): number | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return clamp(hours, H_MIN, H_MAX);
}

/** Distance exploitable : absente si l'entree est vide, negative ou infinie. */
function usableDistance(distanceM?: number | null): number | null {
  if (distanceM === undefined || distanceM === null) return null;
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
  return Math.round(distanceM);
}

function usableText(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Année de sortie, lue sur les quatre premiers caractères de la date ISO.
 * Aucun `new Date()` : le fuseau de la machine n'a pas son mot à dire sur la
 * graine, donc le résultat ne bouge pas d'un poste à l'autre.
 */
function usableYear(happenedAt?: string | null): string | null {
  const text = usableText(happenedAt);
  if (text === null) return null;
  const match = /^(\d{4})/.exec(text);
  return match === null ? null : match[1];
}
