/**
 * Provenance des mesures : qui a produit le chiffre que l'ecran affiche.
 *
 * Constat qui a motive ce module : `resolveSourceLine` — la seule ligne de
 * source du preparateur — nommait une RESERVATION (« Confirmé par toi »), pas
 * une DONNEE. Un utilisateur lisait « 14,5 km » sans pouvoir dire d'ou ce
 * kilometre sortait. Or chaque mesure du preparateur a un fournisseur REEL,
 * choisi au moment de la mesure et pas avant :
 *
 *   - la distance et la duree viennent du routeur qui a repondu. Ce n'est
 *     pas toujours le meme : OSRM d'abord, Valhalla ensuite, BRouter en
 *     dernier recours sur un lieu hors reseau (voir `routingService.ts`) ;
 *   - le denivele vient de la grille d'altitude d'Open-Meteo ;
 *   - la meteo vient des previsions d'Open-Meteo.
 *
 * Nommer un fournisseur qui n'a pas repondu serait le meme mensonge qu'un
 * `?? 18` : une origine inventee pour une mesure reelle. D'ou la regle : une
 * source absente se dit « source inconnue », jamais « probablement ».
 *
 * Le vocabulaire de l'absence — « À vérifier », « source inconnue » — est
 * celui de `trust.ts`. On ne le reecrit pas, on s'y branche.
 */

import { withUnit } from './trust';

/** Les mesures dont l'ecran doit nommer la source. */
export type PrepDataSourceId = 'distance' | 'denivele' | 'meteo';

/**
 * Un fournisseur, tel qu'il est NOMME par la reponse qu'il a renvoyee.
 *
 * Ces identifiants ne sont pas une liste de fournisseurs possibles : chacun
 * est produit par le code qui a reellement interroge le reseau. Une valeur
 * absente signifie donc « personne n'a repondu », pas « on ne sait pas
 * encore ».
 */
export type DataSourceId =
  | 'osrm'
  | 'valhalla'
  | 'brouter'
  | 'open-meteo-elevation'
  | 'open-meteo';

/**
 * Le fournisseur du routage, tel que `routingService.ts` le nomme.
 *
 * Il ne fait PAS partie de `DataSourceId` : ces trois-la produisent une
 * distance ET une duree. L'elargissement a `DataSourceId` se fait au moment
 * de l'affichage, ou l'on sait de quelle mesure l'on parle.
 */
export type RouteProvider = 'osrm' | 'valhalla' | 'brouter';

/** L'identifiant d'affichage d'un routeur : meme cle, meme moteur. */
export function routeDataSource(provider: RouteProvider): DataSourceId {
  return provider;
}

/** Formulation unique pour une provenance absente. */
export const SOURCE_INCONNUE = 'source inconnue';

/**
 * Le nom lisible de chaque fournisseur.
 *
 * OSRM et Valhalla sont deux serveurs differents d'OpenStreetMap : les nommer
 * « OpenStreetMap » seul serait deja un mensonge de precision, et les nommer
 * sans leur socle cacherait que leurs graphes viennent de la meme source.
 */
export const DATA_SOURCE_LABELS: Readonly<Record<DataSourceId, string>> = {
  osrm: 'OpenStreetMap (OSRM)',
  valhalla: 'OpenStreetMap (Valhalla)',
  brouter: 'BRouter (profil randonnée)',
  'open-meteo-elevation': 'Open-Meteo (altitudes)',
  'open-meteo': 'Open-Meteo (prévisions)',
};

const METRIC_LABELS: Readonly<Record<PrepDataSourceId, string>> = {
  distance: 'Distance',
  denivele: 'Dénivelé',
  meteo: 'Météo',
};

/** Le nombre de decimales de chaque mesure, comme dans `metrics.ts`. */
const METRIC_DIGITS: Readonly<Record<PrepDataSourceId, number>> = {
  distance: 1,
  denivele: 0,
  meteo: 0,
};

/**
 * Le nom du fournisseur, ou « source inconnue ».
 *
 * Une cle inconnue — venue d'une version future du serveur, ou d'une reponse
 * bricolee — ne retombe sur aucun fournisseur connu : elle aussi se dit
 * « source inconnue ».
 */
export function dataSourceLabel(source: DataSourceId | null | undefined): string {
  if (!source) return SOURCE_INCONNUE;
  return DATA_SOURCE_LABELS[source] ?? SOURCE_INCONNUE;
}

/**
 * Une mesure affichee, avec la seule information qui compte pour elle :
 * d'ou elle vient.
 */
export interface DataSourceEntry {
  readonly metric: PrepDataSourceId;
  /** La mesure, ou `null` quand personne ne l'a relevee. */
  readonly value: number | null;
  readonly unit: string;
  /** Le fournisseur reellement interroge, ou `null` si personne ne l'a ete. */
  readonly source: DataSourceId | null;
}

/**
 * La ligne complete : la mesure, puis son origine.
 *
 * `withUnit` porte deja l'absence — « À vérifier » — donc une mesure non
 * relevee n'affiche jamais un nombre plausible. La provenance est ajoutee
 * apres, et jamais a sa place.
 */
export function describeDataSource(entry: DataSourceEntry): string {
  const value = withUnit(entry.value, entry.unit, METRIC_DIGITS[entry.metric]);
  return `${METRIC_LABELS[entry.metric]} : ${value} · ${dataSourceLabel(entry.source)}`;
}
