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
