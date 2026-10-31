'use client';

import * as React from 'react';
import type { Map as MapLibreMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl';
import {
  DEFAULT_CARTO_OPTIONS,
  MAPTOOLKIT_COPYRIGHT,
  MAPTOOLKIT_LOGO,
  OSM_COPYRIGHT,
  buildCartoStyleResolved,
  loadOfficialStyle,
  type CartoOptions,
} from './maptoolkit';

/**
 * `LKDVMap` — composant cartographique unifié (chantier CARTO).
 *
 * Un seul moteur (MapLibre GL JS 6), une seule base de référence officielle (Maptoolkit Hiking 3D),
 * un hybride satellite HD ArcGIS immersif, et une attribution légale TOS obligatoire.
 *
 * Ce composant ne touche pas à `src/components/map/engine/*` : HUB et Compas
 * gardent leur moteur actuel intact sans régression (voir docs/carto/PLAN.md).
 */

export type LKDVMapBaseMode = 'maptoolkit' | 'hybrid' | 'relief' | 'satellite' | 'plan';

export interface LKDVMapProps {
  /** Centre initial [lng, lat]. */
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  minZoom?: number;
  maxZoom?: number;
  maxPitch?: number;
  /** Projection : globe pour les vues mondiales, mercator par défaut. */
  projection?: 'globe' | 'mercator';
  /** Base : Maptoolkit hiking ('maptoolkit' / 'relief'), hybride satellite ('hybrid' / 'satellite'), ou plan vectoriel 2D ('plan'). */
  base?: LKDVMapBaseMode;
  /** Relief 3D (DEM Maptoolkit rgb-tiles). Par défaut true sauf pour 'plan'. */
  terrain3d?: boolean;
  /** Interaction (désactivable pour les mini-cartes). */
  interactive?: boolean;
  dragRotate?: boolean;
  pitchWithRotate?: boolean;
  fadeDuration?: number;
  /** Applique un `padding` pour ne pas cacher le contenu sous un tiroir. */
  padding?: { top: number; bottom: number; left?: number; right?: number };
  className?: string;
  style?: React.CSSProperties;
  /** Décalage vertical de l'attribution (ex: au-dessus d'un tiroir de 176px). */
  attributionOffsetBottom?: number;
  /** Masquer l'attribution intégrée si le parent l'affiche dans un HUD dédié. */
  hideAttribution?: boolean;
  /** Ambiance de ciel / atmosphère. */
  sky?: boolean;
  /** Appelé quand la carte est prête (poser des couches LKDV). */
  onReady?: (map: MapLibreMap) => void;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  onClick?: (event: MapLayerMouseEvent) => void;
  /** Contenu superposé (marqueurs DOM, contrôles). */
  children?: React.ReactNode;
}

/** Style de secours si Maptoolkit est injoignable : jamais d'écran blanc muet. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'lkdv-fallback', type: 'background', paint: { 'background-color': '#EFF2EA' } }],
};

const LKDVMap = React.forwardRef<MapLibreMap | null, LKDVMapProps>(function LKDVMap(
  {
    center = [2.5, 46.5],
    zoom = 5,
    pitch = 0,
    bearing = 0,
    minZoom,
    maxZoom,
    maxPitch = 70,
    projection = 'mercator',
    base = DEFAULT_CARTO_OPTIONS.base,
    terrain3d,
    interactive = true,
    dragRotate = true,
    pitchWithRotate = true,
    fadeDuration = 120,
    padding,
    className,
    style,
    attributionOffsetBottom = 8,
    hideAttribution = false,
    sky = false,
    onReady,
    onMoveEnd,
    onClick,
    children,
  },
  forwardedRef,
) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  // Normalisation du mode de base
  const isHybrid = base === 'hybrid' || base === 'satellite';
  const effectiveBase: CartoOptions['base'] = isHybrid ? 'hybrid' : 'maptoolkit';
  const effectiveTerrain3d =
    terrain3d !== undefined
      ? terrain3d
      : base === 'plan'
        ? false
        : DEFAULT_CARTO_OPTIONS.terrain3d;

  // Hybride effectif : dépend de la présence de la clé ArcGIS
  const hybridActive = effectiveBase === 'hybrid' && Boolean(process.env.NEXT_PUBLIC_ARCGIS_API_KEY);

  // Synchronisation forwardedRef
  const setMapInstance = React.useCallback(
    (instance: MapLibreMap | null) => {
      mapRef.current = instance;
      if (typeof forwardedRef === 'function') {
        forwardedRef(instance);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<MapLibreMap | null>).current = instance;
      }
    },
    [forwardedRef],
  );

  // Création de l'instance : une seule fois par montage.
  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    (async () => {
      const maplibre = await import('maplibre-gl');
      // Sans worker servi par l'application, MapLibre ne demande AUCUNE tuile
      // vectorielle (ni glyphe) : raster seul, sentiers absents. Les fichiers
      // sont dans `public/maplibre/` (même configuration que Compas v5).
      maplibre.setWorkerUrl?.('/maplibre/maplibre-gl-worker.mjs');
      // TOS Maptoolkit §9 : 10 requêtes non cachées/s en non enregistré.
      maplibre.setMaxParallelImageRequests(6);

      let initialStyle: StyleSpecification;
      try {
        const official = await loadOfficialStyle();
        initialStyle = await buildCartoStyleResolved(official, {
          base: effectiveBase,
          terrain3d: effectiveTerrain3d,
          arcgisKey: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
        });
      } catch (loadError) {
        if (!cancelled) setError('Fond cartographique indisponible');
        console.error('[carto] style Maptoolkit', loadError);
        initialStyle = FALLBACK_STYLE;
      }
      if (cancelled) return;

      const map = new maplibre.Map({
        container,
        style: initialStyle,
        center,
        zoom,
        pitch,
        bearing,
        minZoom,
        maxZoom,
        maxPitch,
        interactive,
        dragRotate,
        pitchWithRotate,
        fadeDuration,
        attributionControl: false,
      });

      setMapInstance(map);
      (window as unknown as { __lkdvMap?: MapLibreMap }).__lkdvMap = map;

      const markReady = () => {
        if (cancelled) return;
        setReady(true);
        onReady?.(map);
      };

      map.on('style.load', () => {
        if (padding) map.setPadding(padding);
        if (projection) {
          try {
            map.setProjection({ type: projection });
          } catch {}
        }
        if (sky) {
          try {
            map.setSky({
              'sky-color': 'rgba(233,238,231,0.0)',
              'sky-horizon-blend': 0.5,
              'horizon-color': '#e9eee7',
              'horizon-fog-blend': 0.6,
              'fog-color': '#eef2ed',
              'fog-ground-blend': 0.7,
            } as never);
          } catch {}
        }
        if (effectiveTerrain3d && map.getSource('rgb-tiles')) {
          map.setTerrain({ source: 'rgb-tiles', exaggeration: 1.1 });
        }
        markReady();
      });

      map.on('load', markReady);
      map.on('error', (event) => {
        console.warn('[carto]', event.error?.message ?? event);
      });
      map.on('moveend', () => {
        const current = map.getCenter();
        onMoveEnd?.([current.lng, current.lat], map.getZoom());
      });
      if (onClick) {
        map.on('click', onClick);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      setMapInstance(null);
    };
    // Les props initiales ne doivent pas recréer la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bascule Maptoolkit ⇄ hybride satellite sans reconstruire le style :
  // on bascule la visibilité de la couche satellite et l'opacité des aplats.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer('lkdv-satellite-raster')) {
      map.setLayoutProperty('lkdv-satellite-raster', 'visibility', hybridActive ? 'visible' : 'none');
      const mapStyle = map.getStyle();
      if (mapStyle?.layers) {
        for (const layer of mapStyle.layers) {
          if (layer.id === 'lkdv-satellite-raster') continue;
          if (layer.type === 'fill') {
            map.setPaintProperty(layer.id, 'fill-opacity', hybridActive ? 0.35 : 1);
          } else if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-opacity', hybridActive ? 0 : 1);
          }
        }
      }
    }
  }, [hybridActive, ready]);

  // Terrain 3D dynamique
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (effectiveTerrain3d && map.getSource('rgb-tiles')) {
      map.setTerrain({ source: 'rgb-tiles', exaggeration: 1.1 });
    } else if (!effectiveTerrain3d) {
      map.setTerrain(null);
    }
  }, [effectiveTerrain3d, ready]);

  // Projection dynamique (ex: globe vs mercator dans Explorer)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !projection) return;
    try {
      map.setProjection({ type: projection });
    } catch {}
  }, [projection, ready]);

  // Recentrage contrôlé si nécessaire
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const current = map.getCenter();
    if (
      Math.abs(current.lng - center[0]) > 0.0001 ||
      Math.abs(current.lat - center[1]) > 0.0001
    ) {
      map.easeTo({ center, zoom, duration: 450 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return (
    <div
      className={`lkdv-map ${className ?? ''}`.trim()}
      style={style}
      data-base={effectiveBase}
      data-ready={ready ? '1' : '0'}
    >
      <div className="lkdv-map-canvas" ref={containerRef} data-testid="lkdv-map" />
      {children}
      {/* Attribution Maptoolkit obligatoire (TOS §8) : logo ≥ 24 px + liens actifs. */}
      {!hideAttribution ? (
        <div
          className="lkdv-map-attribution"
          data-testid="lkdv-attribution"
          style={{ bottom: attributionOffsetBottom }}
        >
          <img src={MAPTOOLKIT_LOGO} alt="Maptoolkit" height={24} loading="lazy" />
          <a href={MAPTOOLKIT_COPYRIGHT} target="_blank" rel="noopener noreferrer">
            © Maptoolkit
          </a>
          <a href={OSM_COPYRIGHT} target="_blank" rel="noopener noreferrer">
            © Openstreetmap
          </a>
          {hybridActive ? (
            <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">
              Powered by Esri
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="lkdv-map-error">{error}</p> : null}
    </div>
  );
});

export default LKDVMap;
