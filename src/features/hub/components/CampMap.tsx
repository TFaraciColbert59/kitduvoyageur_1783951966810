'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DrawerEmpty } from '@/components/ui/drawer';
import { WebGLArbiter, type MapViewState } from '../webgl/WebGLArbiter';

export interface CampMapProps {
  routeCoords?: Array<[number, number]>; // [lat, lng]
  title?: string;
  className?: string;
}

export function CampMap({
  routeCoords = [],
  title = 'Carte du Camp de Base',
  className = '',
}: CampMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isDegraded, setIsDegraded] = useState(() =>
    WebGLArbiter.getInstance().isContextDegraded()
  );
  const [mapLoaded, setMapLoaded] = useState(false);

  // Écoute de la perte de contexte WebGL
  useEffect(() => {
    const arbiter = WebGLArbiter.getInstance();
    const unsub = arbiter.onContextLost(() => {
      setIsDegraded(true);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // Ignore error during context lost
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

    async function initMap() {
      await arbiter.acquire('camp-map');
      if (cancelled || !containerRef.current) return;

      const unregister = arbiter.registerReleaseHandler('camp-map', () => {
        if (mapInstanceRef.current) {
          try {
            const center = mapInstanceRef.current.getCenter();
            arbiter.saveMapState({
              center: [center.lng, center.lat],
              zoom: mapInstanceRef.current.getZoom(),
              pitch: mapInstanceRef.current.getPitch(),
              bearing: mapInstanceRef.current.getBearing(),
            });
            mapInstanceRef.current.remove();
          } catch {
            // map disposal cleanup
          }
          mapInstanceRef.current = null;
          setMapLoaded(false);
        }
      });

      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !containerRef.current) {
          unregister();
          return;
        }

        const savedState = arbiter.getSavedMapState();
        const initialCenter: [number, number] = savedState
          ? savedState.center
          : [routeCoords[0][1], routeCoords[0][0]]; // [lng, lat]

        const map = new maplibre.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
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
          center: initialCenter,
          zoom: savedState ? savedState.zoom : 12,
          pitch: savedState ? savedState.pitch : 0,
          bearing: savedState ? savedState.bearing : 0,
        });

        map.on('load', () => {
          if (cancelled) return;
          setMapLoaded(true);

          // Ajout du tracé GPX s'il y a plus d'un point
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
                'line-color': '#226148',
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

        // Interception context loss
        const canvas = map.getCanvas();
        if (canvas) {
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            arbiter.triggerContextLost();
          });
        }

        mapInstanceRef.current = map;
      } catch (err) {
        console.warn('[CampMap] Erreur initialisation WebGL MapLibre, mode dégradé actif', err);
        setIsDegraded(true);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        try {
          const center = mapInstanceRef.current.getCenter();
          arbiter.saveMapState({
            center: [center.lng, center.lat],
            zoom: mapInstanceRef.current.getZoom(),
            pitch: mapInstanceRef.current.getPitch(),
            bearing: mapInstanceRef.current.getBearing(),
          });
          mapInstanceRef.current.remove();
        } catch {
          // ignore error
        }
        mapInstanceRef.current = null;
      }
      arbiter.release('camp-map');
    };
  }, [isDegraded, routeCoords]);

  // Si aucune coordonnée active pour l'aventure en cours : état vide honnête
  if (routeCoords.length === 0) {
    return (
      <div
        className={`camp-map-container lkdv-camp-map-empty ${className}`}
        style={{
          width: '100%',
          minHeight: '220px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--hub-surface, #F5F7F3)',
          borderRadius: '24px',
          border: '1px solid var(--hub-border, rgba(23,43,36,0.12))',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        <DrawerEmpty
          title="Aucun tracé cartographique actif"
          hint="Ce projet ne comporte pas encore d'itinéraire géolocalisé pour le camp de base."
        />
      </div>
    );
  }

  // Mode dégradé 2D en cas de perte de contexte GPU
  if (isDegraded) {
    return (
      <div
        className={`camp-map-container lkdv-camp-map-degraded ${className}`}
        style={{
          width: '100%',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--hub-surface-muted, #EDF1EA)',
          borderRadius: '24px',
          border: '1px solid var(--hub-border, rgba(23,43,36,0.12))',
          padding: '16px',
          boxSizing: 'border-box',
          textAlign: 'center',
          gap: '8px',
        }}
      >
        <b style={{ color: 'var(--hub-primary, #17402C)' }}>{title} (Mode 2D simplifié)</b>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--hub-text-secondary, #56665D)' }}>
          Accélération 3D/WebGL indisponible. Tracé de {routeCoords.length} points sauvegardé.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`camp-map-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '260px',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '1px solid var(--hub-border, rgba(23,43,36,0.12))',
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
      {!mapLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--hub-surface, #F5F7F3)',
            color: 'var(--hub-text-muted, #46584D)',
            fontSize: '13px',
          }}
        >
          Chargement de la carte du camp…
        </div>
      )}
    </div>
  );
}
