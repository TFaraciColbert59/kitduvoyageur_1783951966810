'use client';

import * as React from 'react';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import {
  DEFAULT_CARTO_OPTIONS,
  MAPTOOLKIT_COPYRIGHT,
  MAPTOOLKIT_LOGO,
  MAPTOOLKIT_STYLE_3D,
  OSM_COPYRIGHT,
  buildCartoStyle,
  type CartoOptions,
} from './maptoolkit';

/**
 * `LKDVMap` — composant cartographique partagé (chantier CARTO).
 *
 * Un seul moteur (MapLibre GL JS 6), une seule base (Maptoolkit Hiking 3D),
 * un hybride satellite optionnel, une attribution conforme au TOS Maptoolkit.
 *
 * Ce composant ne touche pas à `src/components/map/engine/*` : HUB et Compas
 * gardent leur moteur actuel (compatibilité explicite, voir docs/carto/PLAN.md).
 */

export interface LKDVMapProps {
  /** Centre initial [lng, lat]. */
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
  /** Base : Maptoolkit hiking (défaut) ou hybride satellite. */
  base?: CartoOptions['base'];
  /** Relief 3D (DEM Maptoolkit). */
  terrain3d?: boolean;
  /** Interaction (désactivable pour les mini-cartes). */
  interactive?: boolean;
  /** Applique un `padding` pour ne pas cacher le contenu sous un tiroir. */
  padding?: { top: number; bottom: number; left?: number; right?: number };
  className?: string;
  /** Appelé quand la carte est prête (poser des couches LKDV). */
  onReady?: (map: MapLibreMap) => void;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  /** Contenu superposé (marqueurs DOM, contrôles). */
  children?: React.ReactNode;
}

let stylePromise: Promise<StyleSpecification> | null = null;

/** Charge le style officiel une seule fois (jamais de copie en dur). */
function loadOfficialStyle(): Promise<StyleSpecification> {
  if (!stylePromise) {
    stylePromise = fetch(MAPTOOLKIT_STYLE_3D, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`style Maptoolkit ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .catch((error) => {
        stylePromise = null;
        throw error;
      });
  }
  return stylePromise;
}

/** Style de secours si Maptoolkit est injoignable : jamais d'écran blanc muet. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'lkdv-fallback', type: 'background', paint: { 'background-color': '#EFF2EA' } }],
};

export default function LKDVMap({
  center,
  zoom,
  pitch = 0,
  bearing = 0,
  base = DEFAULT_CARTO_OPTIONS.base,
  terrain3d = DEFAULT_CARTO_OPTIONS.terrain3d,
  interactive = true,
  padding,
  className,
  onReady,
  onMoveEnd,
  children,
}: LKDVMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  // Hybride effectif : dépend de la présence de la clé ArcGIS.
  const hybrid = base === 'hybrid' && Boolean(process.env.NEXT_PUBLIC_ARCGIS_API_KEY);

  // Création de l'instance : une seule fois par montage.
  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    (async () => {
      const maplibre = await import('maplibre-gl');
      // TOS Maptoolkit §9 : 10 requêtes non cachées/s en non enregistré.
      // `setMaxParallelImageRequests` ne couvre que les images ; les tuiles
      // vectorielles passent par le protocole throttlé (seau à jetons 8/s).
      maplibre.setMaxParallelImageRequests(6);
      // NOTE : le protocole throttlé (`throttle.ts`) est prêt et testé mais PAS
      // branché : sa première mise en œuvre vidait les sources vectorielles.
      // À rebrancher après diagnostic (docs/carto/BLOCAGES.md · B1).
      let style: StyleSpecification;
      try {
        const official = await loadOfficialStyle();
        style = buildCartoStyle(official, {
          base,
          terrain3d,
          arcgisKey: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
        });
      } catch (loadError) {
        if (!cancelled) setError('Fond cartographique indisponible');
        console.error('[carto] style Maptoolkit', loadError);
        style = FALLBACK_STYLE;
      }
      if (cancelled) return;

      const map = new maplibre.Map({
        container,
        style,
        center,
        zoom,
        pitch,
        bearing,
        interactive,
        attributionControl: false,
      });
      mapRef.current = map;
      // Accès de recette (captures, diagnostic du style). Instances multiples
      // possibles : c'est la dernière montée qui gagne.
      (window as unknown as { __lkdvMap?: MapLibreMap }).__lkdvMap = map;

      const markReady = () => {
        if (cancelled) return;
        setReady(true);
        onReady?.(map);
      };
      // `load` attend **toutes** les sources : avec un fond mondial, il peut
      // tarder (ou ne jamais venir si une source tierce traîne). On signale la
      // disponibilité dès que le style est appliqué, puis on rejoue les effets.
      map.on('style.load', () => {
        if (padding) map.setPadding(padding);
        if (terrain3d && map.getSource('rgb-tiles')) {
          map.setTerrain({ source: 'rgb-tiles', exaggeration: 1.1 });
        }
        markReady();
      });
      map.on('load', markReady);
      map.on('error', (event) => {
        // Une tuile manquante ne doit pas casser l'écran.
        console.warn('[carto]', event.error?.message ?? event);
      });
      map.on('moveend', () => {
        const current = map.getCenter();
        onMoveEnd?.([current.lng, current.lat], map.getZoom());
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Les props initiales ne doivent pas recréer la carte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bascule Maptoolkit ⇄ hybride satellite : on reconstruit le style (les
  // sources Maptoolkit restent identiques, seule la couche raster s'ajoute).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const official = await loadOfficialStyle();
        if (cancelled) return;
        map.setStyle(
          buildCartoStyle(official, {
            base,
            terrain3d,
            arcgisKey: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
          }),
        );
        map.once('styledata', () => {
          if (terrain3d && map.getSource('rgb-tiles')) {
            map.setTerrain({ source: 'rgb-tiles', exaggeration: 1.1 });
          }
        });
      } catch (error) {
        console.error('[carto] bascule de base', error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // Terrain dynamique.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (terrain3d && map.getSource('rgb-tiles')) {
      map.setTerrain({ source: 'rgb-tiles', exaggeration: 1.1 });
    } else if (!terrain3d) {
      map.setTerrain(null);
    }
  }, [terrain3d, ready]);

  // Recentrage contrôlé.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.easeTo({ center, zoom, duration: 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return (
    <div className={`lkdv-map ${className ?? ''}`.trim()} data-base={base} data-ready={ready ? '1' : '0'}>
      <div className="lkdv-map-canvas" ref={containerRef} data-testid="lkdv-map" />
      {children}
      {/* Attribution Maptoolkit obligatoire (TOS §8) : logo ≥ 24 px + liens. */}
      <div className="lkdv-map-attribution" data-testid="lkdv-attribution">
        <img src={MAPTOOLKIT_LOGO} alt="Maptoolkit" height={24} loading="lazy" />
        <a href={MAPTOOLKIT_COPYRIGHT} target="_blank" rel="noopener noreferrer">
          © Maptoolkit
        </a>
        <a href={OSM_COPYRIGHT} target="_blank" rel="noopener noreferrer">
          © Openstreetmap
        </a>
        {hybrid ? (
          <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">
            Powered by Esri
          </a>
        ) : null}
      </div>
      {error ? <p className="lkdv-map-error">{error}</p> : null}
    </div>
  );
}
