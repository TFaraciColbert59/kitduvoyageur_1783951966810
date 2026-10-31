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
/** Logo officiel auto-heberge (inchange) : evite d'ouvrir img-src a un hote de plus. */
export const MAPTOOLKIT_LOGO = '/carto/maptoolkit-attribution.png';
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
 * Insère la couche satellite **sous** toutes les couches du style.
 * Si `visible` est true (mode hybride), les aplats sont atténués pour laisser voir l'imagerie.
 * Si `visible` est false (mode standard), la couche satellite est masquée (`layout.visibility: 'none'`).
 * La bascule se fait ensuite à l'exécution via `setLayoutProperty` et `setPaintProperty`
 * pour **ne jamais reconstruire le style** (ce qui perdrait le worker et les tuiles vectorielles).
 */
export function withSatelliteLayer(
  style: StyleSpecification,
  arcgisKey: string,
  visible = false,
  vectorOpacity = 0.35,
): StyleSpecification {
  if (style.sources['lkdv-satellite']) return style;
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

  const layers = [...style.layers];
  const index = layers.findIndex((layer) => layer.type === 'background');
  const satelliteLayer = {
    id: 'lkdv-satellite-raster',
    type: 'raster' as const,
    source: 'lkdv-satellite',
    layout: { visibility: (visible ? 'visible' : 'none') as 'visible' | 'none' },
    paint: { 'raster-opacity': 1 },
  };
  layers.splice(index + 1, 0, satelliteLayer as LayerSpecification);

  if (!visible) {
    return { ...style, sources, layers };
  }

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
  return withSatelliteLayer(style, arcgisKey, true, vectorOpacity);
}

/**
 * Résout les sources distantes (`url: TileJSON`) en `tiles` explicites.
 *
 * MapLibre 6 n'émet aucune requête de tuile pour une source vectorielle
 * déclarée par `url` dans certains contextes (constaté : 0 requête `.mvt`,
 * `querySourceFeatures` vide, alors que le TileJSON répond 200). Inliner les
 * tuiles règle le problème — et reste conforme au TOS Maptoolkit §11 : les URLs
 * de tuiles restent celles des domaines officiels.
 */
export async function inlineRemoteSources(style: StyleSpecification): Promise<StyleSpecification> {
  const sources: Record<string, unknown> = {};
  for (const [name, source] of Object.entries(style.sources)) {
    const candidate = source as { url?: string; type?: string };
    if (!candidate.url) {
      sources[name] = source;
      continue;
    }
    try {
      const response = await fetch(candidate.url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(String(response.status));
      const tilejson = (await response.json()) as {
        tiles?: string[];
        minzoom?: number;
        maxzoom?: number;
        attribution?: string;
        bounds?: [number, number, number, number];
      };
      if (!tilejson.tiles?.length) throw new Error('tiles absentes');
      // `url: undefined` est refusé par la validation de style (« url: string
      // expected »), ce qui vidait la source : on retire la clé.
      const { url: _ignored, ...rest } = candidate;
      sources[name] = {
        ...rest,
        tiles: tilejson.tiles,
        minzoom: tilejson.minzoom ?? 0,
        maxzoom: tilejson.maxzoom ?? 22,
        ...(tilejson.attribution ? { attribution: tilejson.attribution } : {}),
        ...(tilejson.bounds ? { bounds: tilejson.bounds } : {}),
      };
    } catch (error) {
      console.warn('[carto] TileJSON non résolu', name, error);
      sources[name] = source;
    }
  }
  return { ...style, sources: sources as StyleSpecification['sources'] };
}

/** Active/désactive le terrain 3D (DEM Maptoolkit `rgb-tiles`). */
export function withTerrain(style: StyleSpecification, enabled: boolean): StyleSpecification {
  if (!enabled) {
    const { terrain: _terrain, ...rest } = style;
    return rest;
  }
  return { ...style, terrain: style.terrain ?? { source: 'rgb-tiles', exaggeration: 1 } };
}

/** Construit le style final **avec sources inlinées** (recommandé). */
export async function buildCartoStyleResolved(
  official: StyleSpecification,
  options: CartoOptions = DEFAULT_CARTO_OPTIONS,
): Promise<StyleSpecification> {
  const inlined = await inlineRemoteSources(official);
  return buildCartoStyle(inlined, options);
}

/** Construit le style final à partir du JSON officiel téléchargé. */
export function buildCartoStyle(
  official: StyleSpecification,
  options: CartoOptions = DEFAULT_CARTO_OPTIONS,
): StyleSpecification {
  let style = applyLkdvIdentity(official);
  if (options.arcgisKey) {
    style = withSatelliteLayer(
      style,
      options.arcgisKey,
      options.base === 'hybrid',
      options.hybridVectorOpacity ?? 0.35,
    );
  }
  return withTerrain(style, options.terrain3d);
}

/** Opacités d'origine des aplats, pour restaurer en sortie d'hybride. */
export function fillOpacityOf(layer: LayerSpecification): number | undefined {
  if (layer.type !== 'fill') return undefined;
  const paint = layer.paint as Record<string, unknown> | undefined;
  const value = paint?.['fill-opacity'];
  return typeof value === 'number' ? value : undefined;
}

let officialStylePromise: Promise<StyleSpecification> | null = null;

/** Charge le style officiel Maptoolkit Hiking 3D une seule fois (mis en cache mémoire). */
export function loadOfficialStyle(): Promise<StyleSpecification> {
  if (!officialStylePromise) {
    officialStylePromise = fetch(MAPTOOLKIT_STYLE_3D, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`style Maptoolkit ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .catch((error) => {
        officialStylePromise = null;
        throw error;
      });
  }
  return officialStylePromise;
}

/** Charge le style Maptoolkit résolu avec options LKDV (terrain, satellite ArcGIS, aplats). */
export async function loadCartoStyle(
  options: Partial<CartoOptions> = {},
): Promise<StyleSpecification> {
  const official = await loadOfficialStyle();
  return buildCartoStyleResolved(official, {
    ...DEFAULT_CARTO_OPTIONS,
    arcgisKey: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
    ...options,
  });
}
