'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DrawerEmpty } from '@/components/ui/drawer';
import { WebGLArbiter } from '../webgl/WebGLArbiter';

export interface CampMapProps {
  routeCoords?: Array<[number, number]>; // [lat, lng]
  title?: string;
  className?: string;
}

function resolveActionLineColor(): string {
  if (typeof window === 'undefined') return 'rgb(34, 97, 72)';
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--hub-action-rgb')
    .trim();
  if (raw) {
    return `rgb(${raw})`;
  }
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue('--hub-action')
    .trim();
  return token || 'rgb(34, 97, 72)';
}

export function CampMap({
  routeCoords = [],
  title = 'Carte du Camp de base',
  className = '',
}: CampMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isDegraded, setIsDegraded] = useState(() =>
    WebGLArbiter.getInstance().isContextDegraded()
  );
  const [mapLoaded, setMapLoaded] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const initialCenterLngLat: [number, number] =
    routeCoords.length > 0 ? [routeCoords[0][1], routeCoords[0][0]] : [0, 0];

  const [viewState, setViewState] = useState<{
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
    layer: 'standard' | 'topo';
  }>(() => {
    const saved = WebGLArbiter.getInstance().getSavedMapState();
    if (saved) {
      return {
        center: saved.center,
        zoom: saved.zoom,
        pitch: saved.pitch,
        bearing: saved.bearing,
        layer: saved.layer ?? 'standard',
      };
    }
    return {
      center: initialCenterLngLat,
      zoom: 12,
      pitch: 0,
      bearing: 0,
      layer: 'standard',
    };
  });

  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  useEffect(() => {
    if (routeCoords.length > 0 && !WebGLArbiter.getInstance().getSavedMapState()) {
      setViewState((prev) =>
        prev.center[0] === 0 && prev.center[1] === 0
          ? { ...prev, center: [routeCoords[0][1], routeCoords[0][0]] }
          : prev
      );
    }
  }, [routeCoords]);

  const persistCurrentMapState = useCallback(
    (next: {
      center: [number, number];
      zoom: number;
      pitch: number;
      bearing: number;
      layer: 'standard' | 'topo';
    }) => {
      setViewState(next);
      WebGLArbiter.getInstance().saveMapState(next);
    },
    []
  );

  // Écoute de la dégradation définitive du contexte WebGL
  useEffect(() => {
    const arbiter = WebGLArbiter.getInstance();
    const unsub = arbiter.onContextLost(() => {
      setIsDegraded(true);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // Ignore error during context lost cleanup
        }
        mapInstanceRef.current = null;
      }
    });
    return unsub;
  }, []);

  // Cycle de vie WebGL Arbiter
  useEffect(() => {
    if (isDegraded || routeCoords.length === 0) return;

    const arbiter = WebGLArbiter.getInstance();
    let cancelled = false;
    let unregisterRelease: (() => void) | null = null;
    let unregisterRestore: (() => void) | null = null;

    async function initMap() {
      await arbiter.acquire('camp-map');
      if (cancelled || !containerRef.current) return;

      unregisterRelease = arbiter.registerReleaseHandler('camp-map', () => {
        const current = viewStateRef.current;
        if (mapInstanceRef.current) {
          try {
            const center = mapInstanceRef.current.getCenter();
            arbiter.saveMapState({
              center: [center.lng, center.lat],
              zoom: mapInstanceRef.current.getZoom(),
              pitch: mapInstanceRef.current.getPitch(),
              bearing: mapInstanceRef.current.getBearing(),
              layer: current.layer,
            });
            mapInstanceRef.current.remove();
          } catch {
            arbiter.saveMapState(current);
          }
          mapInstanceRef.current = null;
          setMapLoaded(false);
        } else {
          arbiter.saveMapState(current);
        }
      });

      unregisterRestore = arbiter.registerRestoreHandler('camp-map', () => {
        if (cancelled) return false;
        setReloadNonce((n) => n + 1);
        return true;
      });

      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !containerRef.current) {
          unregisterRelease?.();
          unregisterRestore?.();
          return;
        }

        const savedState = arbiter.getSavedMapState();
        const startCenter: [number, number] = savedState
          ? savedState.center
          : [routeCoords[0][1], routeCoords[0][0]];
        const startZoom = savedState ? savedState.zoom : 12;
        const startPitch = savedState ? savedState.pitch : 0;
        const startBearing = savedState ? savedState.bearing : 0;
        const startLayer = savedState?.layer ?? viewStateRef.current.layer;

        setViewState({
          center: startCenter,
          zoom: startZoom,
          pitch: startPitch,
          bearing: startBearing,
          layer: startLayer,
        });

        const tileUrl =
          startLayer === 'topo'
            ? 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png'
            : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

        const map = new maplibre.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: [tileUrl],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap Contributors',
              },
            },
            layers: [
              {
                id: 'osm-tiles',
                type: 'raster',
                source: 'osm',
                minzoom: 0,
                maxzoom: 19,
              },
            ],
          },
          center: startCenter,
          zoom: startZoom,
          pitch: startPitch,
          bearing: startBearing,
        });

        map.on('moveend', () => {
          if (cancelled || !mapInstanceRef.current) return;
          try {
            const c = map.getCenter();
            persistCurrentMapState({
              center: [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))],
              zoom: Number(map.getZoom().toFixed(2)),
              pitch: Number(map.getPitch().toFixed(1)),
              bearing: Number(map.getBearing().toFixed(1)),
              layer: viewStateRef.current.layer,
            });
          } catch {
            // ignore transient map state errors
          }
        });

        map.on('load', () => {
          if (cancelled) return;
          setMapLoaded(true);

          if (routeCoords.length > 1) {
            const coordinates = routeCoords.map(([lat, lng]) => [lng, lat]);
            map.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates,
                },
              },
            });

            map.addLayer({
              id: 'route-line',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': resolveActionLineColor(),
                'line-width': 4,
                'line-opacity': 0.85,
              },
            });

            if (!savedState) {
              const bounds = coordinates.reduce(
                (acc, coord) => [
                  [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
                  [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])],
                ],
                [
                  [coordinates[0][0], coordinates[0][1]],
                  [coordinates[0][0], coordinates[0][1]],
                ]
              );
              map.fitBounds(bounds as any, { padding: 40 });
            }
          }
        });

        const canvas = map.getCanvas();
        if (canvas) {
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            arbiter.triggerContextLost();
          });
          canvas.addEventListener('webglcontextrestored', () => {
            arbiter.notifyContextRestored();
          });
        }

        mapInstanceRef.current = map;
      } catch (err) {
        console.warn('[CampMap] Initialisation WebGL MapLibre indisponible, mode 2D activé', err);
        setIsDegraded(true);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      unregisterRelease?.();
      unregisterRestore?.();
      const current = viewStateRef.current;
      if (mapInstanceRef.current) {
        try {
          const center = mapInstanceRef.current.getCenter();
          arbiter.saveMapState({
            center: [Number(center.lng.toFixed(5)), Number(center.lat.toFixed(5))],
            zoom: Number(mapInstanceRef.current.getZoom().toFixed(2)),
            pitch: Number(mapInstanceRef.current.getPitch().toFixed(1)),
            bearing: Number(mapInstanceRef.current.getBearing().toFixed(1)),
            layer: current.layer,
          });
          mapInstanceRef.current.remove();
        } catch {
          arbiter.saveMapState(current);
        }
        mapInstanceRef.current = null;
      } else {
        arbiter.saveMapState(current);
      }
      arbiter.release('camp-map');
    };
  }, [isDegraded, routeCoords, reloadNonce, persistCurrentMapState]);

  const handleAdjustZoom = useCallback(
    (delta: number) => {
      const current = viewStateRef.current;
      const nextZoom = Math.max(2, Math.min(18, Number((current.zoom + delta).toFixed(2))));
      const next = { ...current, zoom: nextZoom };
      persistCurrentMapState(next);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.setZoom(nextZoom);
        } catch {
          // ignore
        }
      }
    },
    [persistCurrentMapState]
  );

  const handleNudgeNorth = useCallback(() => {
    const current = viewStateRef.current;
    const nextCenter: [number, number] = [
      current.center[0],
      Number((current.center[1] + 0.02).toFixed(5)),
    ];
    const next = { ...current, center: nextCenter };
    persistCurrentMapState(next);
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.setCenter(nextCenter);
      } catch {
        // ignore
      }
    }
  }, [persistCurrentMapState]);

  const handleToggleLayer = useCallback(() => {
    const current = viewStateRef.current;
    const nextLayer: 'standard' | 'topo' = current.layer === 'standard' ? 'topo' : 'standard';
    const next = { ...current, layer: nextLayer };
    persistCurrentMapState(next);
  }, [persistCurrentMapState]);

  if (routeCoords.length === 0) {
    return (
      <div
        data-testid="camp-map-empty"
        className={`camp-map-container lkdv-camp-map-empty ${className}`}
        style={{
          width: '100%',
          minHeight: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--hub-surface)',
          borderRadius: 'var(--hub-radius-card)',
          border: '1px solid var(--hub-border)',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        <DrawerEmpty
          title="Aucun tracé cartographique actif"
          hint="Ce projet ne comporte pas encore d’itinéraire géolocalisé pour le camp de base."
        />
      </div>
    );
  }

  if (isDegraded) {
    return (
      <div
        data-testid="camp-map-degraded"
        data-map-center={`${viewState.center[0].toFixed(4)},${viewState.center[1].toFixed(4)}`}
        data-map-zoom={String(viewState.zoom)}
        data-map-layer={viewState.layer}
        data-route-points={String(routeCoords.length)}
        className={`camp-map-container lkdv-camp-map-degraded ${className}`}
        style={{
          width: '100%',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--hub-surface-muted)',
          borderRadius: 'var(--hub-radius-card)',
          border: '1px solid var(--hub-border)',
          padding: '16px',
          boxSizing: 'border-box',
          textAlign: 'center',
          gap: '8px',
        }}
      >
        <strong style={{ color: 'var(--hub-primary)' }}>{title} — vue simplifiée</strong>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--hub-text-secondary)' }}>
          L’affichage 3D de la carte est suspendu sur cet appareil. Votre tracé ({routeCoords.length} étapes) reste conservé.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            data-testid="camp-map-zoom-in"
            aria-label="Zoomer sur la carte"
            onClick={() => handleAdjustZoom(1)}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
          >
            Zoom +
          </button>
          <button
            type="button"
            data-testid="camp-map-pan-north"
            aria-label="Déplacer la carte vers le nord"
            onClick={handleNudgeNorth}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
          >
            Nord ↑
          </button>
          <button
            type="button"
            data-testid="camp-map-layer-toggle"
            aria-label="Basculer la couche cartographique"
            onClick={handleToggleLayer}
            className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)]"
          >
            Couche : {viewState.layer === 'topo' ? 'Topo' : 'Standard'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="camp-map-active"
      data-map-center={`${viewState.center[0].toFixed(4)},${viewState.center[1].toFixed(4)}`}
      data-map-zoom={String(viewState.zoom)}
      data-map-layer={viewState.layer}
      data-route-points={String(routeCoords.length)}
      className={`camp-map-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '260px',
        borderRadius: 'var(--hub-radius-card)',
        overflow: 'hidden',
        border: '1px solid var(--hub-border)',
        boxShadow: '0 4px 18px rgba(11, 31, 23, 0.08)',
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '260px',
        }}
      />
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5"
        role="group"
        aria-label="Contrôles de carte accessibles"
      >
        <button
          type="button"
          data-testid="camp-map-zoom-in"
          aria-label="Zoomer sur la carte"
          onClick={() => handleAdjustZoom(1)}
          className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
        >
          +
        </button>
        <button
          type="button"
          data-testid="camp-map-zoom-out"
          aria-label="Dézoomer sur la carte"
          onClick={() => handleAdjustZoom(-1)}
          className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
        >
          −
        </button>
        <button
          type="button"
          data-testid="camp-map-pan-north"
          aria-label="Déplacer la carte vers le nord"
          onClick={handleNudgeNorth}
          className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
        >
          ↑
        </button>
        <button
          type="button"
          data-testid="camp-map-layer-toggle"
          aria-label="Basculer la couche cartographique"
          onClick={handleToggleLayer}
          className="min-h-[44px] px-3 rounded-xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] text-xs font-semibold text-[var(--hub-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hub-action)]"
        >
          {viewState.layer === 'topo' ? 'Topo' : 'Standard'}
        </button>
      </div>
      {!mapLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--hub-surface)',
            color: 'var(--hub-text-muted)',
            fontSize: '13px',
          }}
        >
          Chargement de la carte du camp…
        </div>
      )}
    </div>
  );
}
