import { atlasTiles, type AtlasTileMode } from './createMapStyle';

/**
 * Fonds des cartes Leaflet (plan 1.6) : les mêmes sources que la carte
 * MapLibre (`createMapStyle`), c'est-à-dire ArcGIS Location Platform avec la
 * clé du site, au lieu d'URL publiques en dur (OSM France, ArcGIS sans clé),
 * qui ne couvrent pas un usage commercial.
 *
 * Esri exige « Powered by Esri » et la mention des données ; OpenStreetMap la
 * sienne : chaque carte affiche donc un crédit, court sur les petites cartes.
 */
export interface LeafletTileSpec {
  url: string;
  options: {
    attribution: string;
    maxZoom: number;
    tileSize: number;
    /** Tuiles de 512 px : Leaflet les place un niveau de zoom plus bas. */
    zoomOffset: number;
    subdomains?: string[];
  };
}

/** `compact` : crédit court (« Powered by Esri · © OpenStreetMap »), pour les vignettes. */
export function leafletTiles(mode: AtlasTileMode, opts: { compact?: boolean; key?: string } = {}): LeafletTileSpec {
  const src = atlasTiles(opts.key)[mode];
  // Sans clé (développement), plusieurs sous-domaines « a. b. c. » : un seul modèle {s}.
  const multi = src.tiles.length > 1;
  const url = multi ? src.tiles[0].replace(/^https:\/\/a\./, 'https://{s}.') : src.tiles[0];
  return {
    url,
    options: {
      attribution: opts.compact ? src.short : src.attribution,
      maxZoom: src.maxzoom,
      tileSize: src.tileSize,
      zoomOffset: src.tileSize === 512 ? -1 : 0,
      ...(multi ? { subdomains: ['a', 'b', 'c'] } : {}),
    },
  };
}
