/**
 * Réduit une trace à `maxPoints` sommets, par échantillonnage régulier.
 *
 * Utilisé sur les bandes Monde/Pays (`trackSimplified`) : à cette échelle une
 * trace de 120 points ne montre aucun détail. L'échantillonnage garde toujours
 * le premier et le dernier point (départ/arrivée réels) et reste déterministe :
 * même entrée, même sortie. Une trace déjà courte est renvoyée telle quelle, par
 * identité, pour ne pas allouer inutilement.
 */
export function simplifyCoordinates<T extends { lng: number; lat: number }>(
  coordinates: T[],
  maxPoints = 20
): T[] {
  const limit = Math.max(2, Math.floor(maxPoints));
  if (coordinates.length <= limit) return coordinates;

  const last = coordinates.length - 1;
  const step = last / (limit - 1);
  const simplified: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    simplified.push(coordinates[Math.round(index * step)]!);
  }
  return simplified;
}

export type MapZoomBand = 'world' | 'country' | 'region' | 'place';

export interface MapZoomConfig {
  band: MapZoomBand;
  massifs: 'clustered' | 'individual';
  carnets: 'hidden' | 'dots' | 'pills';
  pois: 'hidden' | 'pills';
  endpoints: 'hidden' | 'dots';
  trackWidth: number;
  trackSimplified: boolean;
  casing: boolean;
  glow: boolean;
  clusterRadiusPx: number;
  viewportMarginPx: number;
}

export const MAP_ZOOM_PRIORITY = [
  'selected',
  'poi',
  'carnet',
  'massif',
  'endpoint',
  'track',
] as const;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Indique si un point projeté tombe dans le viewport, marge comprise : la marge
 * **élargit** le cadre de `marginPx` sur les quatre côtés, bornes incluses.
 *
 * Un point à `x = 23` dans un viewport de 400 px de large est donc conservé, même
 * avec 24 px de marge : il est visible à l'écran. La marge ne sert qu'à tolérer un
 * débordement (pill, épingle) au bord du cadre, jamais à masquer un point visible.
 */
export function isInsideViewport(
  point: ScreenPoint,
  viewport: ViewportSize,
  marginPx: number
): boolean {
  return (
    point.x >= -marginPx &&
    point.y >= -marginPx &&
    point.x <= viewport.width + marginPx &&
    point.y <= viewport.height + marginPx
  );
}

/**
 * Types d'entrée de l'overlay DOM de la carte. L'ordre de cette union n'est
 * **pas** un ordre de priorité : il suit l'ordre d'apparition historique
 * (massifs de la tâche 6, puis POI, puis carnets). La priorité de superposition,
 * elle, est `MAP_ZOOM_PRIORITY` : `poi` > `carnet` > `massif`.
 */
export type MapOverlayKind = 'massif' | 'poi' | 'carnet';

/**
 * Visibilité effective d'une entrée d'overlay : d'abord l'appartenance au
 * viewport (marge extérieure comprise, voir `isInsideViewport`), ensuite la
 * règle de bande du type.
 *
 * Un massif ou un agrégat n'est **jamais** filtré par la bande : la carte le
 * garde à toutes les échelles, seule la projection décide de sa présence.
 * POI et carnets, eux, suivent leur champ de bande : les POI n'existent que
 * sous forme de pastilles (`pills`), les carnets dès que la bande ne les cache
 * plus (`dots` comme `pills`).
 */
export function isOverlayEntryVisible(
  kind: MapOverlayKind,
  config: MapZoomConfig,
  insideViewport: boolean
): boolean {
  if (!insideViewport) return false;
  if (kind === 'poi') return config.pois === 'pills';
  if (kind === 'carnet') return config.carnets !== 'hidden';
  return true;
}

/**
 * Drapeaux de couches d'un mode de carte (`mapModeConfig(mode).layers`), réduits
 * aux booléens utiles : `tracks` y est un mode ('all' | 'filtered' | 'none').
 */
export interface MapModeLayerFlags {
  pois: boolean;
  outingPins: boolean;
  tracks: boolean;
}

/** Visibilité effective des couches natives (rendues par MapLibre). */
export interface NativeLayerVisibility {
  pois: boolean;
  trackStarts: boolean;
  trackEnds: boolean;
  casing: boolean;
  glow: boolean;
}

/**
 * Croise les couches autorisées par le mode avec la bande de zoom.
 *
 * Les couches natives sont le rendu de fond des mêmes objets que l'overlay DOM :
 * sans ce croisement, masquer les boutons POI laisserait leurs cercles dessinés
 * (et cliquables) à toutes les échelles, et les départs/arrivées resteraient
 * visibles en Monde/Pays alors que la bande les cache. Le mode reste
 * souverain : une couche qu'il refuse ne revient jamais par la bande.
 */
export function resolveNativeLayerVisibility(
  flags: MapModeLayerFlags,
  config: MapZoomConfig
): NativeLayerVisibility {
  const endpoints = config.endpoints !== 'hidden';
  return {
    pois: flags.pois && config.pois === 'pills',
    trackStarts: flags.outingPins && endpoints,
    trackEnds: flags.tracks && endpoints,
    casing: flags.tracks && config.casing,
    glow: flags.tracks && config.glow,
  };
}

export interface MassifCluster<T> {
  id: string;
  items: T[];
  x: number;
  y: number;
}

/**
 * Agrège des massifs par distance écran, en un seul passage.
 *
 * Le rayon est mesuré **au moment de l'insertion**, entre le point courant et le
 * centre courant du massif candidat (moyenne de ses membres à cet instant). Ce n'est
 * ni une distance entre membres voisins, ni une borne d'emprise : le centre dérive à
 * chaque ajout, donc un massif peut couvrir plus de `radiusPx` de large (par exemple
 * 0, 40, 60, 73.33, 83.33 px finissent dans un seul massif d'emprise 83.33 px).
 *
 * Le premier massif compatible dans l'ordre d'entrée absorbe le point, ce qui rend la
 * sortie stable et déterministe pour une entrée donnée : l'ordre des massifs suit leur
 * première apparition et l'ordre des membres suit l'ordre d'entrée.
 */
export function clusterByScreenDistance<T>(
  items: T[],
  pointOf: (item: T) => ScreenPoint,
  radiusPx: number
): MassifCluster<T>[] {
  const clusters: MassifCluster<T>[] = [];
  const sums: ScreenPoint[] = [];

  for (const item of items) {
    const point = pointOf(item);
    const index = clusters.findIndex(
      (candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radiusPx
    );

    if (index === -1) {
      clusters.push({ id: `cluster-${clusters.length}`, items: [item], x: point.x, y: point.y });
      sums.push({ x: point.x, y: point.y });
      continue;
    }

    const cluster = clusters[index]!;
    const sum = sums[index]!;
    cluster.items.push(item);
    sum.x += point.x;
    sum.y += point.y;
    cluster.x = sum.x / cluster.items.length;
    cluster.y = sum.y / cluster.items.length;
  }

  return clusters;
}

export function resolveMapZoomConfig(zoom: number): MapZoomConfig {
  if (zoom < 4.5) {
    return {
      band: 'world',
      massifs: 'clustered',
      carnets: 'hidden',
      pois: 'hidden',
      endpoints: 'hidden',
      trackWidth: 1.5,
      trackSimplified: true,
      casing: false,
      glow: false,
      clusterRadiusPx: 40,
      viewportMarginPx: 24,
    };
  }
  if (zoom < 6.5) {
    return {
      band: 'country',
      massifs: 'clustered',
      carnets: 'hidden',
      pois: 'hidden',
      endpoints: 'hidden',
      trackWidth: 2,
      trackSimplified: true,
      casing: false,
      glow: false,
      clusterRadiusPx: 40,
      viewportMarginPx: 24,
    };
  }
  if (zoom < 10) {
    return {
      band: 'region',
      massifs: 'individual',
      carnets: 'dots',
      pois: 'hidden',
      endpoints: 'dots',
      trackWidth: 3.5,
      trackSimplified: false,
      casing: true,
      glow: true,
      clusterRadiusPx: 40,
      viewportMarginPx: 24,
    };
  }
  return {
    band: 'place',
    massifs: 'individual',
    carnets: 'pills',
    pois: 'pills',
    endpoints: 'dots',
    trackWidth: 4,
    trackSimplified: false,
    casing: true,
    glow: true,
    clusterRadiusPx: 40,
    viewportMarginPx: 24,
  };
}
