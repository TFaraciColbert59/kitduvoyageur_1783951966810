import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Base cartographique Maptoolkit Hiking 3D + hybride satellite (chantier CARTO).
 *
 * Licence Maptoolkit (Community) : les styles peuvent être copiés et modifiés,
 * mais **toutes** les références de tuiles, glyphes et sprites doivent rester sur
 * les domaines officiels `tiles|fonts|icons.maptoolkit.org`. On ne réécrit donc
 * jamais `sources`, `glyphs` ni `sprite` : on ne fait qu'ajouter des couches
 * LKDV et, en mode hybride, une couche raster satellite **sous** le style.
 *
 * Contraintes de licence encodées ici :
 *   - attribution obligatoire (logo ≥ 24 px + `© Maptoolkit © Openstreetmap`) ;
 *   - aucun téléchargement en masse / hors ligne (voir `isCacheableTileUrl`).
 */

export const MAPTOOLKIT_STYLE_2D = 'https://styles.maptoolkit.org/hiking.json';
export const MAPTOOLKIT_STYLE_3D = 'https://styles.maptoolkit.org/hiking-3d.json';
export const MAPTOOLKIT_LOGO = 'https://www.maptoolkit.org/assets/maptoolkit-attribution.png';
export const MAPTOOLKIT_COPYRIGHT = 'https://www.maptoolkit.com/copyright/';
export const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

/** Hôtes Maptoolkit : seuls autorisés pour les tuiles du style. */
export const MAPTOOLKIT_HOSTS = ['tiles.maptoolkit.org', 'fonts.maptoolkit.org', 'icons.maptoolkit.org'];

/** Imagerie satellite ArcGIS (déjà licenciée dans le projet, quota 2 M tuiles/mois). */
const ARCGIS_IMAGERY = 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile';

export interface CartoOptions {
  /** Fond : Maptoolkit hiking (défaut) ou hybride satellite + vecteurs. */
  base: 'maptoolkit' | 'hybrid';
  /** Relief 3D (DEM Maptoolkit `rgb-tiles`). */
  terrain3d: boolean;
  /** Clé ArcGIS (satellite). Absente ⇒ hybride indisponible, base Maptoolkit seule. */
  arcgisKey?: string;
  /** Atténue les aplats du style Maptoolkit pour laisser voir l'imagerie. */
  hybridVectorOpacity?: number;
}

export const DEFAULT_CARTO_OPTIONS: CartoOptions = {
  base: 'maptoolkit',
  terrain3d: true,
  hybridVectorOpacity: 0.35,
};

/** Attribution Maptoolkit (texte + liens) — jamais masquable. */
export function maptoolkitAttributionHtml(): string {
  return (
    `<a href="${MAPTOOLKIT_COPYRIGHT}" target="_blank" rel="noopener noreferrer">© Maptoolkit</a> ` +
    `<a href="${OSM_COPYRIGHT}" target="_blank" rel="noopener noreferrer">© Openstreetmap</a>`
  );
}

/**
 * Une URL de tuile peut-elle être mise en cache pour un usage hors ligne ?
 * Licence Maptoolkit §7(b) : jamais pour Maptoolkit. Satellite ArcGIS : le cache
 * navigateur standard suffit, on ne précharge pas (quota).
 */
export function isCacheableTileUrl(url: string): boolean {
  try {
    const host = new URL(url).host;
    if (MAPTOOLKIT_HOSTS.includes(host)) return false;
    if (host.endsWith('arcgis.com')) return false;
    return true;
  } catch {
    return false;
  }
}

/** Couches du style officiel qui reçoivent la teinte LKDV (identité visuelle). */
const IDENTITY_LAYERS: Record<string, string> = {
  background: 'lkdv-background',
  'water_area_ocean': 'lkdv-water',
  'water_area_lagoon': 'lkdv-water',
  'nature_natural_land': 'lkdv-land',
  'nature_landuse': 'lkdv-land',
};

/** Palette LKDV appliquée aux aplats (les tracés/sentiers Maptoolkit sont conservés). */
const LKDV_COLORS: Record<string, string> = {
  'lkdv-background': '#EFF2EA',
  'lkdv-water': '#BFD6D2',
  'lkdv-land': '#E7EDDF',
};

/**
 * Applique l'identité LKDV au style officiel **sans toucher aux sources**.
 * Retourne un nouveau style (le style officiel n'est jamais muté).
 */
export function applyLkdvIdentity(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map((layer) => {
    const token = IDENTITY_LAYERS[layer.id];
    if (!token) return layer;
    const color = LKDV_COLORS[token];
    if (layer.type === 'background') {
      return { ...layer, paint: { ...(layer.paint ?? {}), 'background-color': color } };
    }
    if (layer.type === 'fill') {
      return { ...layer, paint: { ...(layer.paint ?? {}), 'fill-color': color } };
    }
    return layer;
  });
  return { ...style, layers };
}

/**
 * Insère la couche satellite **sous** toutes les couches du style, et atténue
 * les aplats pour laisser voir l'imagerie. Les sentiers, courbes, symboles et
 * POI restent au-dessus.
 */
export function withSatelliteBase(
  style: StyleSpecification,
  arcgisKey: string,
  vectorOpacity = 0.35,
): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    ...style.sources,
    'lkdv-satellite': {
      type: 'raster',
      tiles: [`${ARCGIS_IMAGERY}/{z}/{y}/{x}?token=${arcgisKey}`],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Powered by <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> | ' +
        'Esri, Maxar, Earthstar Geographics, GIS User Community',
    },
  };

  const satelliteLayer = {
    id: 'lkdv-satellite-raster',
    type: 'raster' as const,
    source: 'lkdv-satellite',
    paint: { 'raster-opacity': 1 },
  };

  // Sous le style : juste après la couche `background` (ou en tête).
  const layers = [...style.layers];
  const index = layers.findIndex((layer) => layer.type === 'background');
  layers.splice(index + 1, 0, satelliteLayer);

  const dimmed = layers.map((layer): LayerSpecification => {
    if (layer.id === 'lkdv-satellite-raster') return layer;
    // Aplats opaques du style : rendus translucides pour voir la photo.
    if (layer.type === 'fill') {
      const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
      if (paint['fill-color']) paint['fill-opacity'] = vectorOpacity;
      return { ...layer, paint } as LayerSpecification;
    }
    if (layer.type === 'background') {
      const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
      if (paint['background-color']) paint['background-opacity'] = 0;
      return { ...layer, paint } as LayerSpecification;
    }
    return layer;
  });

  return { ...style, sources, layers: dimmed };
}

/** Active/désactive le terrain 3D (DEM Maptoolkit `rgb-tiles`). */
export function withTerrain(style: StyleSpecification, enabled: boolean): StyleSpecification {
  if (!enabled) {
    const { terrain: _terrain, ...rest } = style;
    return rest;
  }
  return { ...style, terrain: style.terrain ?? { source: 'rgb-tiles', exaggeration: 1 } };
}

/** Construit le style final à partir du JSON officiel téléchargé. */
export function buildCartoStyle(
  official: StyleSpecification,
  options: CartoOptions = DEFAULT_CARTO_OPTIONS,
): StyleSpecification {
  let style = applyLkdvIdentity(official);
  if (options.base === 'hybrid' && options.arcgisKey) {
    style = withSatelliteBase(style, options.arcgisKey, options.hybridVectorOpacity ?? 0.35);
  }
  return withTerrain(style, options.terrain3d);
}
