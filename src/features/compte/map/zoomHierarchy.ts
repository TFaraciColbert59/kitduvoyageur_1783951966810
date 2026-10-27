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
