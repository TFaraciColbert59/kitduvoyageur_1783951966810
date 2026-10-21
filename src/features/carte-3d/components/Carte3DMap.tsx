'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ATLAS_TILES } from '@/components/map/engine/createMapStyle';
import type {
  Carte3DBasemap,
  Carte3DTrail,
  Carte3DWaypoint,
  ScrubberState,
  WaypointCategory,
} from '../types';

function getOrCreateArrowIcon(map: MapLibreMap) {
  if (map.hasImage('trail-arrow-icon')) return;
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillStyle = '#FBFAF6';
    ctx.shadowColor = 'rgba(17, 24, 20, 0.8)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(18, 12);
    ctx.lineTo(6, 20);
    ctx.lineTo(10, 12);
    ctx.closePath();
    ctx.fill();
    const imgData = ctx.getImageData(0, 0, 24, 24);
    map.addImage('trail-arrow-icon', imgData);
  }
}

interface Carte3DMapProps {
  trail: Carte3DTrail;
  scrubberState: ScrubberState;
  is3D: boolean;
  basemap: Carte3DBasemap;
  activeCategories: Set<WaypointCategory>;
  onBearingChange: (bearing: number) => void;
  onSelectWaypoint: (wpt: Carte3DWaypoint | null) => void;
  selectedWaypoint: Carte3DWaypoint | null;
  onUserInteracted: () => void;
  forwardedMapRef?: React.MutableRefObject<MapLibreMap | null>;
}

export function Carte3DMap({
  trail,
  scrubberState,
  is3D,
  basemap,
  activeCategories,
  onBearingChange,
  onSelectWaypoint,
  selectedWaypoint,
  onUserInteracted,
  forwardedMapRef,
}: Carte3DMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hikerMarkerRef = useRef<Marker | null>(null);
  const waypointMarkersRef = useRef<Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // 1. Initialisation de MapLibre
  useEffect(() => {
    if (!containerRef.current) return;

    // Détection WebGL
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      setWebGlSupported(false);
      return;
    }

    setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

    const [minLng, minLat, maxLng, maxLat] = trail.bounds;
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const initialStyle: any = {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: ATLAS_TILES.satellite.tiles,
          tileSize: ATLAS_TILES.satellite.tileSize,
          maxzoom: ATLAS_TILES.satellite.maxzoom,
          attribution: ATLAS_TILES.satellite.attribution,
        },
        'ign-ortho': {
          type: 'raster',
          tiles: [
            'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: '&copy; IGN GeoPF',
        },
        'topo-outdoor': {
          type: 'raster',
          tiles: ATLAS_TILES.topo.tiles,
          tileSize: ATLAS_TILES.topo.tileSize,
          maxzoom: ATLAS_TILES.topo.maxzoom,
          attribution: ATLAS_TILES.topo.attribution,
        },
        'aws-terrarium-dem': {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        },
      },
      layers: [
        {
          id: 'bg',
          type: 'background',
          paint: { 'background-color': '#111814' },
        },
        {
          id: 'layer-topo-outdoor',
          type: 'raster',
          source: 'topo-outdoor',
          layout: { visibility: basemap === 'topo-outdoor' ? 'visible' : 'none' },
          paint: { 'raster-fade-duration': 200 },
        },
        {
          id: 'layer-ign-ortho',
          type: 'raster',
          source: 'ign-ortho',
          layout: { visibility: basemap === 'ign-ortho' ? 'visible' : 'none' },
          paint: { 'raster-fade-duration': 200 },
        },
        {
          id: 'layer-esri-satellite',
          type: 'raster',
          source: 'esri-satellite',
          layout: { visibility: basemap === 'satellite-esri' ? 'visible' : 'none' },
          paint: { 'raster-fade-duration': 200 },
        },
      ],
    };

    const map = new MapLibreMap({
      container: containerRef.current,
      style: initialStyle,
      center: [centerLng, centerLat],
      zoom: 12.2,
      pitch: is3D ? 58 : 0,
      bearing: 25,
      maxPitch: 85,
      attributionControl: false,
    });

    mapRef.current = map;
    if (forwardedMapRef) forwardedMapRef.current = map;

    map.on('style.load', () => {
      // Configuration 3D Relief & Atmosphère
      try {
        map.setTerrain({ source: 'aws-terrarium-dem', exaggeration: 1.25 });
        map.setSky({
          'sky-color': '#94b39b',
          'horizon-color': '#eef2ee',
          'fog-color': '#e8eee8',
          'sky-horizon-blend': 0.7,
          'atmosphere-blend': 0.85,
        });
      } catch (err) {
        console.warn('[Carte3DMap] 3D terrain/sky initialization note:', err);
      }

      // Ajout de la source du sentier drapée
      const lineStringGeoJson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: trail.coordinates.map((c) => [c[0], c[1]]),
        },
      };

      map.addSource('trail-track-source', {
        type: 'geojson',
        data: lineStringGeoJson,
      });

      // Halo lumineux blanc/clair sous le tracé
      map.addLayer({
        id: 'trail-halo-layer',
        type: 'line',
        source: 'trail-track-source',
        paint: {
          'line-color': '#FBFAF6',
          'line-width': 6,
          'line-opacity': 0.75,
        },
      });

      // Tracé principal (LKDV Forest Green #17402C)
      map.addLayer({
        id: 'trail-main-layer',
        type: 'line',
        source: 'trail-track-source',
        paint: {
          'line-color': '#17402C',
          'line-width': 3.5,
          'line-opacity': 0.95,
        },
      });

      // Flèches directionnelles épousant le relief 3D
      getOrCreateArrowIcon(map);
      map.addLayer({
        id: 'trail-arrows-layer',
        type: 'symbol',
        source: 'trail-track-source',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 85,
          'icon-image': 'trail-arrow-icon',
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
        },
        paint: {
          'icon-opacity': 0.85,
        },
      });

      // Tracé progressif (parcouru) en bleu ciel haute visibilité
      const initialProgressCoords = trail.coordinates.slice(
        0,
        Math.max(2, Math.floor(trail.coordinates.length * scrubberState.progress))
      );
      map.addSource('trail-progress-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: initialProgressCoords.map((c) => [c[0], c[1]]),
          },
        },
      });

      map.addLayer({
        id: 'trail-progress-layer',
        type: 'line',
        source: 'trail-progress-source',
        paint: {
          'line-color': '#48CAE4',
          'line-width': 4.5,
          'line-opacity': 0.9,
        },
      });

      try {
        const scale = new ScaleControl({ maxWidth: 90, unit: 'metric' });
        map.addControl(scale, 'bottom-left');
      } catch (_e) {
        // scale control fallback
      }

      setMapLoaded(true);
    });

    // Événements de rotation et interaction utilisateur
    map.on('rotate', () => {
      onBearingChange(map.getBearing());
    });

    map.on('dragstart', () => {
      onUserInteracted();
    });

    map.on('zoomstart', () => {
      onUserInteracted();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      if (forwardedMapRef) forwardedMapRef.current = null;
    };
  }, []);

  // 2. Mise à jour de la visibilité des fonds de carte
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    map.setLayoutProperty(
      'layer-esri-satellite',
      'visibility',
      basemap === 'satellite-esri' ? 'visible' : 'none'
    );
    map.setLayoutProperty(
      'layer-ign-ortho',
      'visibility',
      basemap === 'ign-ortho' ? 'visible' : 'none'
    );
    map.setLayoutProperty(
      'layer-topo-outdoor',
      'visibility',
      basemap === 'topo-outdoor' ? 'visible' : 'none'
    );
  }, [basemap, mapLoaded]);

  // 3. Bascule 3D / 2D
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      pitch: is3D ? 58 : 0,
      duration: 700,
    });
  }, [is3D]);

  // 4. Changement de tracé : centrage et rechargement de la géométrie
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource('trail-track-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: trail.coordinates.map((c) => [c[0], c[1]]),
        },
      });
    }

    // Caméra fit sur le nouveau sentier
    const [minLng, minLat, maxLng, maxLat] = trail.bounds;
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: { top: 80, bottom: 200, left: 60, right: 60 },
        pitch: is3D ? 58 : 0,
        bearing: 25,
        duration: 1200,
      }
    );
  }, [trail, mapLoaded]);

  // 5. Waypoints sur le relief 3D
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Nettoyage des anciens marqueurs
    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    // Création des nouveaux marqueurs filtrés
    trail.waypoints.forEach((wpt) => {
      if (!activeCategories.has(wpt.category)) return;

      const el = document.createElement('div');
      el.className = 'carte3d-marker-container group cursor-pointer';

      const isSummit = wpt.category === 'summit';
      const isRefuge = wpt.category === 'refuge';
      const isWater = wpt.category === 'water';
      const isPass = wpt.category === 'pass';
      const isPhoto = wpt.category === 'photo';

      const icon = isSummit
        ? '▲'
        : isRefuge
        ? '🏡'
        : isWater
        ? '💧'
        : isPass
        ? '🚩'
        : isPhoto
        ? '📸'
        : '📍';

      const badgeStyle = isSummit
        ? 'bg-rose-900/90 text-white border-rose-400'
        : isRefuge
        ? 'bg-stone-900/90 text-white border-stone-400'
        : isWater
        ? 'bg-sky-900/90 text-white border-sky-400'
        : isPass
        ? 'bg-amber-900/90 text-white border-amber-400'
        : isPhoto
        ? 'bg-purple-900/90 text-white border-purple-400'
        : 'bg-stone-900/90 text-white border-stone-400';

      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full text-[11px] font-bold shadow-lg border border-white/60 backdrop-blur-md transition-transform group-hover:scale-110 flex items-center gap-1 ${badgeStyle}">
            <span>${icon}</span>
            <span class="max-w-[120px] truncate">${wpt.name}</span>
            <span class="font-mono text-[9px] opacity-90">${wpt.altitudeM}m</span>
          </div>
          <div class="w-1.5 h-3 bg-white/80 shadow-md"></div>
        </div>
      `;

      el.onclick = (e) => {
        e.stopPropagation();
        onSelectWaypoint(wpt);
      };

      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([wpt.lng, wpt.lat])
        .addTo(map);

      waypointMarkersRef.current.push(marker);
    });
  }, [trail.waypoints, activeCategories, mapLoaded, onSelectWaypoint]);

  // 6. Marqueur de position du randonneur (Avatar / Scrubber live marker)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!hikerMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'hiker-position-marker relative flex items-center justify-center';
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full bg-white/30 animate-ping"></div>
          <div class="relative w-7 h-7 rounded-full bg-[#17402C] border-2 border-white shadow-xl flex items-center justify-center text-white">
            <svg id="hiker-arrow" class="w-4 h-4 transition-transform duration-100" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `;

      hikerMarkerRef.current = new Marker({ element: el, anchor: 'center' })
        .setLngLat(scrubberState.currentCoordinate)
        .addTo(map);
    } else {
      hikerMarkerRef.current.setLngLat(scrubberState.currentCoordinate);
      const arrow = document.getElementById('hiker-arrow');
      if (arrow) {
        arrow.style.transform = `rotate(${scrubberState.currentBearingDeg}deg)`;
      }
    }

    // Mise à jour du tracé parcouru (basé sur le profil kilométrique exact)
    const progressSource = map.getSource('trail-progress-source') as GeoJSONSource | undefined;
    if (progressSource && trail.elevationProfile.length > 0) {
      let idx = 0;
      const targetDist = scrubberState.currentDistanceKm;
      while (
        idx < trail.elevationProfile.length - 1 &&
        trail.elevationProfile[idx + 1].distanceKm <= targetDist
      ) {
        idx++;
      }
      const covered = trail.coordinates.slice(0, Math.min(trail.coordinates.length, idx + 1));
      // Ajout du point courant interpolé précis
      covered.push([
        scrubberState.currentCoordinate[0],
        scrubberState.currentCoordinate[1],
        scrubberState.currentElevationM,
      ]);
      progressSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: covered.map((c) => [c[0], c[1]]),
        },
      });
    }

    // Suivi caméra 3D dynamique
    if (scrubberState.chaseCamera) {
      map.easeTo({
        center: scrubberState.currentCoordinate,
        bearing: scrubberState.currentBearingDeg,
        pitch: is3D ? 58 : 0,
        duration: 150,
      });
    }
  }, [
    scrubberState.currentCoordinate,
    scrubberState.currentBearingDeg,
    scrubberState.currentDistanceKm,
    scrubberState.chaseCamera,
    mapLoaded,
    is3D,
    trail.coordinates,
    trail.elevationProfile,
    scrubberState.currentElevationM,
  ]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#111814]">
      {!webGlSupported ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-stone-900 text-stone-200">
          <div>
            <div className="text-3xl mb-2">⚠️</div>
            <div className="font-bold text-lg">Accélération WebGL requise</div>
            <p className="text-sm text-stone-400 mt-1 max-w-sm">
              Votre navigateur ou appareil ne supporte pas le rendu 3D matériel WebGL requis pour
              la Carte Vivante 3D.
            </p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}

      {/* Bulle flottante éphémère (Liquid Glass) directement sur la carte */}
      {selectedWaypoint && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 max-w-sm w-[90%] md:w-auto z-30 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-3xl backdrop-blur-2xl bg-white/95 dark:bg-stone-950/95 border border-white/60 dark:border-white/10 shadow-2xl p-4 text-stone-900 dark:text-stone-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {selectedWaypoint.category === 'summit'
                    ? '🏔️'
                    : selectedWaypoint.category === 'refuge'
                    ? '🏡'
                    : selectedWaypoint.category === 'water'
                    ? '💧'
                    : selectedWaypoint.category === 'pass'
                    ? '🚩'
                    : selectedWaypoint.category === 'photo'
                    ? '📸'
                    : selectedWaypoint.category === 'weather'
                    ? '⛅'
                    : '📍'}
                </span>
                <div>
                  <div className="font-bold text-base leading-tight">
                    {selectedWaypoint.name}
                  </div>
                  <div className="text-xs font-mono text-stone-600 dark:text-stone-300">
                    {selectedWaypoint.altitudeM} m d&apos;altitude
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectWaypoint(null)}
                aria-label="Fermer la fiche repère"
                className="w-7 h-7 rounded-full flex items-center justify-center bg-stone-200/60 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 hover:bg-stone-300"
              >
                ✕
              </button>
            </div>

            {selectedWaypoint.details && (
              <p className="mt-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {selectedWaypoint.details}
              </p>
            )}

            {/* Météo au sommet/refuge si disponible */}
            {selectedWaypoint.weatherSnapshot && (
              <div className="mt-3 flex items-center justify-between p-2 rounded-2xl bg-stone-200/50 dark:bg-stone-800/50 text-xs font-mono">
                <span className="font-sans font-semibold text-stone-700 dark:text-stone-300">
                  Météo sur place
                </span>
                <span className="font-bold">
                  {selectedWaypoint.weatherSnapshot.tempC}°C • Vent {selectedWaypoint.weatherSnapshot.windKmh} km/h • {selectedWaypoint.weatherSnapshot.condition}
                </span>
              </div>
            )}

            {/* Photo communautaire si présente */}
            {selectedWaypoint.photoUrl && (
              <div className="mt-3 rounded-2xl overflow-hidden aspect-video border border-stone-200 dark:border-stone-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedWaypoint.photoUrl}
                  alt={selectedWaypoint.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
