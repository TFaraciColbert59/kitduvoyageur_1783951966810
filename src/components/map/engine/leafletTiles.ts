import { atlasTiles, type AtlasTileMode } from './createMapStyle';

/**
 * Fonds des cartes Leaflet (plan 1.6) : les mêmes sources que la carte
 * MapLibre (`createMapStyle`), c'est-à-dire ArcGIS Location Platform avec la
 * clé du site, au lieu d'URL publiques en dur (OSM France, ArcGIS sans clé),
 * qui ne couvrent pas un usage commercial.
 *
 * Esri exige « Powered by Esri » et la mention de TOUS les fournisseurs de
 * données ; OpenStreetMap la sienne. Leaflet n'a pas de crédit repliable (le
 * « i » de MapLibre) : chaque carte, petite ou grande, affiche donc le crédit
 * complet (revue Codex sur #83 : le crédit court oubliait TomTom, Garmin…).
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

export function leafletTiles(mode: AtlasTileMode, opts: { key?: string } = {}): LeafletTileSpec {
  const src = atlasTiles(opts.key)[mode];
  // Sans clé (développement), plusieurs sous-domaines « a. b. c. » : un seul modèle {s}.
  const multi = src.tiles.length > 1;
  const url = multi ? src.tiles[0].replace(/^https:\/\/a\./, 'https://{s}.') : src.tiles[0];
  return {
    url,
    options: {
      attribution: src.attribution,
      maxZoom: src.maxzoom,
      tileSize: src.tileSize,
      zoomOffset: src.tileSize === 512 ? -1 : 0,
      ...(multi ? { subdomains: ['a', 'b', 'c'] } : {}),
    },
  };
}
