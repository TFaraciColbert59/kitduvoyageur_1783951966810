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
  | 'terrain-tiles'
  | 'met-norway';

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
  'terrain-tiles': 'Terrain Tiles (altitudes)',
  'met-norway': 'MET Norway (prévisions)',
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

/* ------------------------------------------------------------------ */
/* Les deux series de mesure : meteo et altitude (H5)                  */
/* ------------------------------------------------------------------ */

/**
 * L'identifiant que portent les reponses de `/api/weather` et
 * `/api/elevation`.
 *
 * Volontairement etroit : une cle venue d'une version future du serveur ne
 * rejoint aucun fournisseur connu, donc elle ne nomme personne. C'est la
 * meme regle que `readRouteProvider` cote routage, et elle sert la meme
 * raison : le credit vient du CORPS de la reponse, jamais d'une intention.
 */
export type MeasureProviderId = 'met-norway' | 'terrain-tiles';

/**
 * Le fournisseur nomme par une reponse de mesure, ou `null`.
 *
 * Les deux routes rendent l'objet `{ id, name, url }` de
 * `dataProviders.ts` : c'est donc `provider.id` qui fait foi, et pas un
 * `provider` nu comme le routage. Lire un objet donne un nom, une URL et un
 * identifiant — on ne garderait que le dernier des trois, parce que le
 * vocabulaire d'affichage (`DATA_SOURCE_LABELS`) est lui aussi une decision
 * d'ecran, pas une donnee du serveur.
 *
 * Un 503 ne porte aucun `provider` : la fonction rend alors `null`, et la
 * ligne affiche « source inconnue ». C'est voulu, et c'est la meme regle que
 * pour le routage : personne n'a repondu, donc personne n'est cite.
 */
export function readMeasureProvider(payload: unknown): MeasureProviderId | null {
  const body = payload as { provider?: { id?: unknown } | null } | null;
  const id = body?.provider?.id;
  return id === 'met-norway' || id === 'terrain-tiles' ? id : null;
}

/**
 * La source affichee de l'ALTITUDE, ou `null`.
 *
 * Depuis le 2026-10-05, les deux series ont chacune leur source :
 * MET Norway pour la prevision, Terrain Tiles (AWS Open Data) pour
 * l'altitude — Open-Meteo n'etant gratuit qu'en usage non commercial.
 * La source affichee reste celle que nomme la reponse, jamais une intention.
 */
export function elevationDataSource(
  provider: MeasureProviderId | null | undefined,
): DataSourceId | null {
  return provider === 'terrain-tiles' ? 'terrain-tiles' : null;
}

/** La source affichee de la METEO, ou `null`. */
export function weatherDataSource(
  provider: MeasureProviderId | null | undefined,
): DataSourceId | null {
  return provider === 'met-norway' ? 'met-norway' : null;
}

/**
 * La source d'UNE mesure, choisie par la mesure elle-meme.
 *
 * Regroupe les deux conversions precedente pour qu'un appelant n'ait pas a
 * se rappeler laquelle des deux correspond a `denivele` : le risque n'est
 * pas une erreur de syntaxe, c'est un credit de prevision pose sur un
 * denivele, et il ne se voit pas a la compilation.
 *
 * Une cle de mesure inconnue ne nomme personne : la liste des mesures est
 * fermee, donc une cle sortante de ce module est une version future du
 * serveur, pas une source de plus.
 */
export function metricDataSource(
  metric: PrepDataSourceId,
  provider: MeasureProviderId | null | undefined,
): DataSourceId | null {
  if (metric === 'meteo') return weatherDataSource(provider);
  if (metric === 'denivele') return elevationDataSource(provider);
  // La distance n vient pas de ces deux routes : elle sort du routeur qui a
  // repondu, et porte son propre identifiant (`routeDataSource`). Lui
  // attribuer `open-meteo` serait faux, meme si le service s appelait
  // pareil.
  return null;
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
  // Une mesure absente ne recoit AUCUNE source, meme si un run voisin en a
  // produit une : « Dénivelé : À vérifier · Open-Meteo (altitudes) » credite
  // un fournisseur pour un chiffre qui n'existe pas. C'est le meme mensonge
  // qu'un `?? 18`, a l'envers : le nombre disparait, le credit reste.
  const source = entry.value === null ? null : entry.source;
  return `${METRIC_LABELS[entry.metric]} : ${value} · ${dataSourceLabel(source)}`;
}
