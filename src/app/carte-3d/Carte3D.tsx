'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import {
  Play,
  Pause,
  Layers,
  Thermometer,
  Eye,
  Moon,
  TreePine,
  Flame,
  Sliders,
  Download,
  ChevronLeft,
  X,
  Compass,
  Video,
} from 'lucide-react';

// Configuration worker local MapLibre pour éviter tout blocage réseau externe
if (typeof window !== 'undefined' && typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
}

// --- CONFIGURATION DES 3 SECTEURS FRANÇAIS CANONIQUES ---
export interface TrailPoint {
  name?: string;
  lng: number;
  lat: number;
  ele: number;
  dist: number;
  slope: number;
  temp: number;
  wind: number;
}

export interface SectorConfig {
  key: string;
  title: string;
  region: string;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  baseEle: number;
  totalDistKm: number;
  ridgeRadius: number;
  trail: TrailPoint[];
}

export const SECTORS: Record<string, SectorConfig> = {
  TMB_CHAMONIX: {
    key: 'TMB_CHAMONIX',
    title: '🏔️ Massif du Mont-Blanc (Chamonix → Col de Voza)',
    region: 'MASSIF DU MONT-BLANC // ORTHOPHOTO IGN 20CM',
    center: [6.775, 45.873],
    zoom: 14.2,
    pitch: 70,
    bearing: -135,
    baseEle: 1490,
    totalDistKm: 24.5,
    ridgeRadius: 0.014,
    trail: [
      { name: 'Chamonix-Mont-Blanc', lng: 6.8694, lat: 45.9237, ele: 1035, dist: 0.0, slope: 4.2, temp: 16.5, wind: 12 },
      { name: 'Les Houches', lng: 6.798, lat: 45.891, ele: 1008, dist: 6.4, slope: 15.4, temp: 14.8, wind: 19 },
      { name: 'Forêt de Bellevue', lng: 6.775, lat: 45.873, ele: 1490, dist: 9.5, slope: 19.5, temp: 10.8, wind: 28 },
      { name: 'Col de Voza', lng: 6.7664, lat: 45.8647, ele: 1657, dist: 11.2, slope: 14.0, temp: 8.9, wind: 35 },
      { name: 'Bellevue (1801m)', lng: 6.7715, lat: 45.8565, ele: 1801, dist: 12.6, slope: 25.4, temp: 7.2, wind: 42 },
      { name: 'Col de Tricot', lng: 6.752, lat: 45.834, ele: 2120, dist: 18.4, slope: 32.8, temp: 4.5, wind: 50 },
      { name: 'Les Contamines', lng: 6.726, lat: 45.819, ele: 1167, dist: 24.5, slope: -11.5, temp: 13.8, wind: 16 },
    ],
  },
  MONT_SAINT_MICHEL: {
    key: 'MONT_SAINT_MICHEL',
    title: '🏰 Le Mont-Saint-Michel (Abbaye 3D & Baie)',
    region: 'NORMANDIE // BAIE DU MONT-SAINT-MICHEL (GR 223)',
    center: [-1.5114, 48.636],
    zoom: 16.5,
    pitch: 72,
    bearing: -35,
    baseEle: 15,
    totalDistKm: 3.1,
    ridgeRadius: 0.004,
    trail: [
      { name: 'Barrage du Couesnon', lng: -1.5152, lat: 48.6185, ele: 6, dist: 0.0, slope: 0.5, temp: 14.5, wind: 28 },
      { name: 'Passerelle Estacade', lng: -1.5131, lat: 48.6285, ele: 7, dist: 1.2, slope: 1.2, temp: 14.0, wind: 34 },
      { name: 'Remparts & Porte', lng: -1.512, lat: 48.6348, ele: 18, dist: 2.1, slope: 14.5, temp: 13.4, wind: 40 },
      { name: 'Abbaye du Mont-St-Michel', lng: -1.5114, lat: 48.6361, ele: 82, dist: 2.6, slope: 24.0, temp: 12.4, wind: 48 },
      { name: 'Jardins du Nord', lng: -1.5118, lat: 48.6368, ele: 42, dist: 3.1, slope: -18.0, temp: 13.1, wind: 44 },
    ],
  },
  GR20_BAVELLA: {
    key: 'GR20_BAVELLA',
    title: '⛰️ Corse — Aiguilles de Bavella (GR20)',
    region: 'CORSE // AIGUILLES DE BAVELLA (GR 20 SUD)',
    center: [9.225, 41.7955],
    zoom: 14.4,
    pitch: 72,
    bearing: -60,
    baseEle: 1218,
    totalDistKm: 8.5,
    ridgeRadius: 0.014,
    trail: [
      { name: 'Col de Bavella (1218m)', lng: 9.225, lat: 41.7955, ele: 1218, dist: 0.0, slope: 18.0, temp: 15.2, wind: 38 },
      { name: 'Trou de la Bombe', lng: 9.2345, lat: 41.799, ele: 1480, dist: 2.4, slope: 26.5, temp: 12.8, wind: 46 },
      { name: "Variante Alpine Punt'Alta", lng: 9.212, lat: 41.805, ele: 1660, dist: 5.1, slope: 34.0, temp: 9.5, wind: 55 },
      { name: "Refuge d'Asinau", lng: 9.201, lat: 41.814, ele: 1536, dist: 8.5, slope: -16.0, temp: 11.4, wind: 32 },
    ],
  },
};

export type RenderMode =
  | 'IGN_ORTHO_TAC'
  | 'LIDAR_DARK'
  | 'IGN_TOPO_SLOPE'
  | 'FOREST_GROUND'
  | 'DUSK_THERMAL';

// --- FONCTIONS CINÉMATIQUES & EASING (SLERP / LERP) ---

/**
 * Calcul trigonométrique précis du cap (bearing) entre deux points GPS en degrés (0 à 360)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Interpolation linéaire douce (LERP) pour éliminer tout effet de micro-saccade
 */
export function lerp(start: number, end: number, amt: number): number {
  return (1 - amt) * start + amt * end;
}

/**
 * Interpolation angulaire sur le cercle trigonométrique (chemin le plus court, évite les sauts 359° -> 0°)
 */
export function lerpAngleDeg(start: number, end: number, amt: number): number {
  let diff = (end - start) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (start + diff * amt + 360) % 360;
}

/**
 * Suivi dynamique à 3 degrés de liberté :
 * L'assiette (pitch) s'incline selon la pente exacte du sentier GR :
 * - Montées (+%) : la caméra penche vers l'avant pour cadrer le sentier qui grimpe
 * - Descentes (-%) : la caméra relève son champ de vision pour ouvrir l'horizon
 */
export function calculateDynamicPitch(basePitch: number, slopePercent: number): number {
  if (slopePercent > 0) {
    return Math.min(84, basePitch + Math.min(10, slopePercent * 0.35));
  } else {
    return Math.max(45, basePitch - Math.min(12, Math.abs(slopePercent) * 0.35));
  }
}

// Fonction de génération de crêtes incandescentes organiques
function createRidgeGeoJSON(center: [number, number], radius: number): GeoJSON.FeatureCollection {
  const coords: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const jitter = 0.85 + 0.22 * Math.sin(a * 5) + 0.14 * Math.cos(a * 3);
    coords.push([
      center[0] + Math.cos(a) * radius * jitter * 1.4,
      center[1] + Math.sin(a) * radius * jitter,
    ]);
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      },
    ],
  };
}

export default function Carte3D() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pipMapRef = useRef<maplibregl.Map | null>(null);

  // Callback Three.js pour mettre à jour la forêt au relief
  const updateForestElevationRef = useRef<((sec: SectorConfig) => void) | null>(null);

  // États applicatifs de secteur & rendu
  const [currentSectorKey, setCurrentSectorKey] = useState<string>('TMB_CHAMONIX');
  const currentSectorKeyRef = useRef<string>('TMB_CHAMONIX');
  currentSectorKeyRef.current = currentSectorKey;

  const [renderMode, setRenderMode] = useState<RenderMode>('IGN_ORTHO_TAC');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(40); // 0 à 100
  const progressRef = useRef<number>(40);
  progressRef.current = progress;

  // Mode de caméra cinématique & 3-DOF
  const [camMode, setCamMode] = useState<'CINEMATIC_FPV' | 'FREE_ORBIT'>('CINEMATIC_FPV');
  const camModeRef = useRef<'CINEMATIC_FPV' | 'FREE_ORBIT'>('CINEMATIC_FPV');
  camModeRef.current = camMode;

  const [camHeight, setCamHeight] = useState<number>(45);
  const camHeightRef = useRef<number>(45);
  camHeightRef.current = camHeight;

  const [camPitch, setCamPitch] = useState<number>(68);
  const camPitchRef = useRef<number>(68);
  camPitchRef.current = camPitch;

  const sec = SECTORS[currentSectorKey] || SECTORS.TMB_CHAMONIX;

  // Valeurs continues interpolées (LERP/SLERP) pour éliminer tout à-coup
  const currentLngRef = useRef<number>(sec.center[0]);
  const currentLatRef = useRef<number>(sec.center[1]);
  const currentBearingRef = useRef<number>((sec.bearing + 360) % 360);
  const currentPitchRef = useRef<number>(68);
  const [currentBearingDeg, setCurrentBearingDeg] = useState<number>(() => Math.round((sec.bearing + 360) % 360));

  // Calques
  const [showRidge, setShowRidge] = useState<boolean>(true);
  const [showForest, setShowForest] = useState<boolean>(true);
  const [showBuildings, setShowBuildings] = useState<boolean>(true);
  const [showPip, setShowPip] = useState<boolean>(true);

  // Sliders relief & soleil
  const [terrainExag, setTerrainExag] = useState<number>(1.65);
  const [sunAzimuth, setSunAzimuth] = useState<number>(210);

  // Interface mobile & notifications
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Télémétrie calculée en direct avec calcul de cap trigonométrique
  const currentTelemetry = useMemo(() => {
    const trail = sec.trail;
    const scaled = (progress / 100) * (trail.length - 1);
    const i = Math.floor(scaled);
    const next = Math.min(i + 1, trail.length - 1);
    const t = scaled - i;

    const p1 = trail[i];
    const p2 = trail[next];

    const lng = lerp(p1.lng, p2.lng, t);
    const lat = lerp(p1.lat, p2.lat, t);
    const ele = Math.round(lerp(p1.ele, p2.ele, t));
    const dist = +(lerp(p1.dist, p2.dist, t)).toFixed(1);
    const slope = +(lerp(p1.slope, p2.slope, t)).toFixed(1);
    const temp = +(lerp(p1.temp, p2.temp, t)).toFixed(1);
    const wind = Math.round(lerp(p1.wind, p2.wind, t));

    // Cap (bearing) instantané orienté vers la trajectoire suivante
    let bearing = currentBearingRef.current;
    if (i < trail.length - 1) {
      bearing = calculateBearing(lat, lng, p2.lat, p2.lng);
    }

    return {
      lng,
      lat,
      ele,
      dist,
      slope,
      temp,
      wind,
      bearing,
      name: p1.name || sec.title,
    };
  }, [progress, sec]);

  // Initialisation de la carte principale avec contrôles de rotation fluide
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialSec = SECTORS.TMB_CHAMONIX;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: initialSec.center,
      zoom: initialSec.zoom,
      pitch: camPitchRef.current,
      bearing: initialSec.bearing,
      maxPitch: 85,
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
      style: {
        version: 8,
        sources: {
          // 1. Vraie Orthophoto IGN 20cm (data.geopf.fr — 100% Gratuit sans clé)
          ignOrtho: {
            type: 'raster',
            tiles: [
              'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          // 2. Plan IGN V2 Topographique officiel avec les sentiers GR
          ignTopo: {
            type: 'raster',
            tiles: [
              'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
            ],
            tileSize: 256,
            maxzoom: 18,
          },
          // 3. Modèle Numérique de Terrain 3D (Terrarium)
          terrainDem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          hillshadeDem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          // 4. Bâtiments 3D OpenFreeMap
          openmaptiles: {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet',
          },
        },
        layers: [
          {
            id: 'ign-ortho-layer',
            type: 'raster',
            source: 'ignOrtho',
            paint: { 'raster-contrast': 0.18, 'raster-saturation': 0.05 },
          },
          {
            id: 'ign-topo-layer',
            type: 'raster',
            source: 'ignTopo',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 0.92 },
          },
          {
            id: 'hillshade-layer',
            type: 'hillshade',
            source: 'hillshadeDem',
            paint: {
              'hillshade-exaggeration': 0.78,
              'hillshade-shadow-color': '#05070b',
              'hillshade-highlight-color': '#ffaa66',
              'hillshade-accent-color': '#ff4500',
              'hillshade-illumination-direction': 210,
            },
          },
        ],
        terrain: { source: 'terrainDem', exaggeration: 1.65 },
      },
    });

    mapRef.current = map;

    map.on('load', () => {
      // 1. Extrusion 3D des bâtiments (Abbaye Mont-Saint-Michel, Chamonix, Refuges)
      if (!map.getLayer('osm-3d-buildings')) {
        map.addLayer({
          id: 'osm-3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': '#d6cbb9',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.9,
          },
        });
      }

      // 2. Périmètres de crêtes incandescents
      if (!map.getSource('ridge-src')) {
        map.addSource('ridge-src', {
          type: 'geojson',
          data: createRidgeGeoJSON(initialSec.center, initialSec.ridgeRadius),
        });

        map.addLayer({
          id: 'ridge-fill',
          type: 'fill',
          source: 'ridge-src',
          paint: { 'fill-color': '#ff3b00', 'fill-opacity': 0.2 },
        });

        map.addLayer({
          id: 'ridge-glow',
          type: 'line',
          source: 'ridge-src',
          paint: {
            'line-color': '#ff4500',
            'line-width': 10,
            'line-blur': 6,
            'line-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'ridge-line',
          type: 'line',
          source: 'ridge-src',
          paint: {
            'line-color': '#ffbb55',
            'line-width': 2,
            'line-dasharray': [3, 2],
          },
        });
      }

      // 3. Sentier GR lumineux
      if (!map.getSource('trail-src')) {
        map.addSource('trail-src', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: initialSec.trail.map((p) => [p.lng, p.lat]),
            },
          },
        });

        map.addLayer({
          id: 'trail-glow',
          type: 'line',
          source: 'trail-src',
          paint: {
            'line-color': '#ff4500',
            'line-width': 12,
            'line-blur': 7,
            'line-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'trail-core',
          type: 'line',
          source: 'trail-src',
          paint: { 'line-color': '#ffe194', 'line-width': 3.5 },
        });
      }

      // 4. Capteur Randonneur actif
      if (!map.getSource('rover-src')) {
        map.addSource('rover-src', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: initialSec.center },
          },
        });

        map.addLayer({
          id: 'rover-pulse',
          type: 'circle',
          source: 'rover-src',
          paint: {
            'circle-radius': 16,
            'circle-color': '#ff5500',
            'circle-opacity': 0.4,
            'circle-blur': 0.5,
          },
        });

        map.addLayer({
          id: 'rover-dot',
          type: 'circle',
          source: 'rover-src',
          paint: {
            'circle-radius': 6,
            'circle-color': '#ffffff',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ff5500',
          },
        });
      }

      // 5. Couche Three.js : 400 Conifères 3D plaqués au relief via queryTerrainElevation
      try {
        const count = 400;
        const lowGeo = new THREE.ConeGeometry(5, 13, 7);
        lowGeo.rotateX(Math.PI / 2);
        const lowMat = new THREE.MeshLambertMaterial({ color: 0x264624 });

        const topGeo = new THREE.ConeGeometry(3.6, 11, 7);
        topGeo.rotateX(Math.PI / 2);
        const topMat = new THREE.MeshLambertMaterial({ color: 0x345e30 });

        const lowMesh = new THREE.InstancedMesh(lowGeo, lowMat, count);
        const topMesh = new THREE.InstancedMesh(topGeo, topMat, count);

        const treeOffsets = Array.from({ length: count }, () => ({
          rx: (Math.random() - 0.5) * 1100,
          ry: (Math.random() - 0.5) * 1100,
          s: 0.7 + Math.random() * 1.1,
        }));

        const dummy = new THREE.Object3D();

        const updateTreesElevation = (activeSec: SectorConfig) => {
          for (let i = 0; i < count; i++) {
            const { rx, ry, s } = treeOffsets[i];
            const treeLat = activeSec.center[1] + ry / 111139;
            const treeLng = activeSec.center[0] + rx / (111139 * Math.cos((activeSec.center[1] * Math.PI) / 180));

            let groundEle = activeSec.baseEle;
            if (typeof (map as any).queryTerrainElevation === 'function') {
              const q = (map as any).queryTerrainElevation([treeLng, treeLat]);
              if (typeof q === 'number' && !isNaN(q)) {
                groundEle = q;
              }
            }

            const deltaZ = groundEle - activeSec.baseEle;
            dummy.position.set(rx, ry, deltaZ + 7 * s);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            lowMesh.setMatrixAt(i, dummy.matrix);

            dummy.position.set(rx, ry, deltaZ + 13 * s);
            dummy.updateMatrix();
            topMesh.setMatrixAt(i, dummy.matrix);
          }
          lowMesh.instanceMatrix.needsUpdate = true;
          topMesh.instanceMatrix.needsUpdate = true;
        };

        updateForestElevationRef.current = updateTreesElevation;
        updateTreesElevation(initialSec);

        const customThreeLayer: maplibregl.CustomLayerInterface = {
          id: 'three-forest',
          type: 'custom',
          renderingMode: '3d',
          onAdd: function (_mapInstance: any, gl: any) {
            try {
              (this as any).camera = new THREE.Camera();
              (this as any).scene = new THREE.Scene();

              (this as any).scene.add(new THREE.AmbientLight(0xddeeff, 0.9));
              const sun = new THREE.DirectionalLight(0xffddaa, 1.5);
              sun.position.set(100, -140, 200).normalize();
              (this as any).scene.add(sun);

              (this as any).scene.add(lowMesh);
              (this as any).scene.add(topMesh);

              (this as any).renderer = new THREE.WebGLRenderer({
                canvas: _mapInstance.getCanvas(),
                context: gl,
                antialias: true,
              });
              (this as any).renderer.autoClear = false;
            } catch (e) {
              console.warn('[ThreeLayer:onAdd] Init Three.js:', e);
            }
          },
          render: function (_gl: any, matrix: any) {
            try {
              if (!(this as any).renderer || !(this as any).scene || !(this as any).camera) return;
              const activeSec = SECTORS[currentSectorKeyRef.current] || SECTORS.TMB_CHAMONIX;
              const merc = maplibregl.MercatorCoordinate.fromLngLat(activeSec.center, activeSec.baseEle);
              const sc = merc.meterInMercatorCoordinateUnits();

              const m = new THREE.Matrix4().fromArray(matrix);
              const l = new THREE.Matrix4()
                .makeTranslation(merc.x, merc.y, merc.z)
                .scale(new THREE.Vector3(sc, -sc, sc));

              (this as any).camera.projectionMatrix.copy(m.multiply(l));
              (this as any).renderer.resetState();
              (this as any).renderer.render((this as any).scene, (this as any).camera);
              map.triggerRepaint();
            } catch (e) {
              console.warn('[ThreeLayer:render] Erreur non-bloquante:', e);
            }
          },
        };

        map.addLayer(customThreeLayer);

        map.once('idle', () => {
          updateTreesElevation(initialSec);
        });
      } catch (err) {
        console.warn('[ThreeForest] Fallback non-bloquant:', err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Mini-carte PIP Thermique FLIR
  useEffect(() => {
    if (!pipContainerRef.current || pipMapRef.current || !showPip) return;

    const initialSec = SECTORS[currentSectorKeyRef.current] || SECTORS.TMB_CHAMONIX;

    const pip = new maplibregl.Map({
      container: pipContainerRef.current,
      center: initialSec.center,
      zoom: 12.8,
      interactive: false,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          demPip: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
          },
        },
        layers: [
          { id: 'pip-bg', type: 'background', paint: { 'background-color': '#080014' } },
          {
            id: 'pip-flir',
            type: 'hillshade',
            source: 'demPip',
            paint: {
              'hillshade-exaggeration': 1.0,
              'hillshade-shadow-color': '#14002e',
              'hillshade-highlight-color': '#fffb00',
              'hillshade-accent-color': '#ff0055',
            },
          },
        ],
      },
    });

    pipMapRef.current = pip;

    return () => {
      pip.remove();
      pipMapRef.current = null;
    };
  }, [showPip]);

  // Synchronisation cinématique fluide (LERP/SLERP) & Suivi 3-DOF
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const targetLng = currentTelemetry.lng;
    const targetLat = currentTelemetry.lat;
    const targetBearing = currentTelemetry.bearing;
    const targetPitch = calculateDynamicPitch(camPitchRef.current, currentTelemetry.slope);

    // Easing continu pour supprimer toute saccade lors de l'interpolation
    currentLngRef.current = lerp(currentLngRef.current, targetLng, 0.25);
    currentLatRef.current = lerp(currentLatRef.current, targetLat, 0.25);
    currentBearingRef.current = lerpAngleDeg(currentBearingRef.current, targetBearing, 0.18);
    currentPitchRef.current = lerp(currentPitchRef.current, targetPitch, 0.15);

    const activeBearing = Math.round(currentBearingRef.current);
    setCurrentBearingDeg(activeBearing);

    // En mode DRONE FPV, asservissement cinématique de la caméra
    if (camModeRef.current === 'CINEMATIC_FPV') {
      const zoomAdjust = sec.zoom + (45 - camHeightRef.current) * 0.007;
      map.jumpTo({
        center: [currentLngRef.current, currentLatRef.current],
        zoom: zoomAdjust,
        pitch: currentPitchRef.current,
        bearing: currentBearingRef.current,
      });
    }

    // Mise à jour de la balise randonneur sur la carte principale
    const roverSource = map.getSource('rover-src') as maplibregl.GeoJSONSource;
    if (roverSource) {
      roverSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [currentLngRef.current, currentLatRef.current],
        },
      });
    }

    // Centrage de la mini-carte thermique FLIR
    if (pipMapRef.current) {
      pipMapRef.current.setCenter([currentLngRef.current, currentLatRef.current]);
    }
  }, [currentTelemetry, sec]);

  // Changement de Secteur
  const handleSectorChange = useCallback((newKey: string) => {
    setCurrentSectorKey(newKey);
    const targetSec = SECTORS[newKey] || SECTORS.TMB_CHAMONIX;
    const map = mapRef.current;

    currentLngRef.current = targetSec.center[0];
    currentLatRef.current = targetSec.center[1];
    currentBearingRef.current = (targetSec.bearing + 360) % 360;
    currentPitchRef.current = camPitchRef.current;
    setCurrentBearingDeg(Math.round(currentBearingRef.current));
    setProgress(0);

    if (map && map.isStyleLoaded()) {
      const trailSource = map.getSource('trail-src') as maplibregl.GeoJSONSource;
      if (trailSource) {
        trailSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: targetSec.trail.map((p) => [p.lng, p.lat]),
          },
        });
      }

      const ridgeSource = map.getSource('ridge-src') as maplibregl.GeoJSONSource;
      if (ridgeSource) {
        ridgeSource.setData(createRidgeGeoJSON(targetSec.center, targetSec.ridgeRadius));
      }

      map.flyTo({
        center: targetSec.center,
        zoom: targetSec.zoom,
        pitch: camPitchRef.current,
        bearing: targetSec.bearing,
        duration: 1800,
      });

      if (updateForestElevationRef.current) {
        setTimeout(() => {
          updateForestElevationRef.current?.(targetSec);
        }, 300);
      }
    }

    if (pipMapRef.current) {
      pipMapRef.current.setCenter(targetSec.center);
    }
  }, []);

  // Changement de Mode de Rendu Tactique
  const handleModeChange = useCallback((mode: RenderMode) => {
    setRenderMode(mode);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const activeSec = SECTORS[currentSectorKeyRef.current] || SECTORS.TMB_CHAMONIX;

    if (map.getLayer('ign-topo-layer')) {
      map.setLayoutProperty(
        'ign-topo-layer',
        'visibility',
        mode === 'IGN_TOPO_SLOPE' ? 'visible' : 'none'
      );
    }

    if (mode === 'FOREST_GROUND') {
      map.easeTo({
        center: activeSec.center,
        zoom: 16.5,
        pitch: 79,
        bearing: -145,
        duration: 1400,
      });
    } else {
      map.easeTo({
        center: activeSec.center,
        zoom: activeSec.zoom,
        pitch: activeSec.pitch,
        bearing: activeSec.bearing,
        duration: 1200,
      });
    }
  }, []);

  // Filtre CSS du canevas principal selon le mode
  const canvasFilterStyle = useMemo(() => {
    switch (renderMode) {
      case 'LIDAR_DARK':
        return 'grayscale(100%) contrast(175%) brightness(62%)';
      case 'DUSK_THERMAL':
        return 'sepia(38%) hue-rotate(-24deg) contrast(140%) brightness(72%) saturate(165%)';
      case 'FOREST_GROUND':
        return 'contrast(115%) saturate(120%) brightness(95%)';
      default:
        return 'contrast(112%) saturate(110%)';
    }
  }, [renderMode]);

  // Contrôles des calques
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const rVis = showRidge ? 'visible' : 'none';
    ['ridge-fill', 'ridge-glow', 'ridge-line'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', rVis);
    });

    if (map.getLayer('three-forest')) {
      map.setLayoutProperty('three-forest', 'visibility', showForest ? 'visible' : 'none');
    }

    if (map.getLayer('osm-3d-buildings')) {
      map.setLayoutProperty('osm-3d-buildings', 'visibility', showBuildings ? 'visible' : 'none');
    }
  }, [showRidge, showForest, showBuildings]);

  // Sliders relief & soleil
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setTerrain({ source: 'terrainDem', exaggeration: terrainExag });
    if (map.getLayer('hillshade-layer')) {
      map.setPaintProperty('hillshade-layer', 'hillshade-illumination-direction', sunAzimuth);
    }
  }, [terrainExag, sunAzimuth]);

  // Boucle de vol cinématique fluide (haute fréquence 40ms avec progression calibrée)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev >= 100 ? 0 : +(prev + 0.16).toFixed(2);
        return next;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Calcul des coordonnées SVG pour les graphiques synchronisés
  const chartPoints = useMemo(() => {
    const trail = sec.trail;
    const len = trail.length;
    if (len === 0) return { elePolyline: '', elePolygon: '', slopePolyline: '', forestPolygon: '', forestPolyline: '' };

    const minEle = Math.min(...trail.map((p) => p.ele));
    const maxEle = Math.max(...trail.map((p) => p.ele));
    const rangeEle = Math.max(80, maxEle - minEle);

    const ptsEle = trail.map((p, i) => {
      const x = (i / (len - 1)) * 300;
      const y = 38 - ((p.ele - minEle) / rangeEle) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const ptsSlope = trail.map((p, i) => {
      const x = (i / (len - 1)) * 300;
      const y = 38 - Math.min(32, (Math.abs(p.slope) / 35) * 30);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const ptsForest = trail.map((p, i) => {
      const x = (i / (len - 1)) * 300;
      const y = 38 - Math.min(32, (p.wind / 55) * 28);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      elePolyline: ptsEle.join(' '),
      elePolygon: `0,40 ${ptsEle.join(' ')} 300,40`,
      slopePolyline: ptsSlope.join(' '),
      forestPolyline: ptsForest.join(' '),
      forestPolygon: `0,40 ${ptsForest.join(' ')} 300,40`,
    };
  }, [sec]);

  const xCursor = (progress / 100) * 300;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0d11] text-[#1c1a17] font-mono select-none flex flex-col">
      {/* BARRE SUPÉRIEURE : SÉLECTEUR DE SITE, MODES CAMÉRA & MODES TACTIQUES */}
      <header className="min-h-11 bg-[#ece5d8] border-b border-[#c8bfb0] px-3 py-1 flex items-center justify-between gap-2 z-30 text-[11px] shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/explorer"
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#dbd2c2] hover:bg-[#cec4b3] text-[#181715] font-bold text-[11px] transition shadow-sm"
            title="Quitter et revenir à l'application"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QUITTER</span>
          </Link>
          <span className="font-extrabold text-[#161513] tracking-tight flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#d9480f] animate-pulse" />
            <span className="hidden md:inline">LKDV // CINEMATIC CAMERA ENGINE</span>
            <span className="md:hidden">LKDV 3D</span>
          </span>
          <select
            value={currentSectorKey}
            onChange={(e) => handleSectorChange(e.target.value)}
            className="bg-[#dbd2c2] border border-[#b8ae9e] rounded px-2 py-1 font-bold text-[#181715] cursor-pointer outline-none text-xs"
          >
            <option value="TMB_CHAMONIX">🏔️ Massif du Mont-Blanc (Chamonix → Col de Voza)</option>
            <option value="MONT_SAINT_MICHEL">🏰 Le Mont-Saint-Michel (Abbaye 3D & Baie)</option>
            <option value="GR20_BAVELLA">⛰️ Corse — Aiguilles de Bavella (GR20)</option>
          </select>
        </div>

        {/* Sélecteurs de comportements de caméra cinématique */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="camModeCinematic"
            onClick={() => setCamMode('CINEMATIC_FPV')}
            className={`px-2.5 py-1 rounded font-bold transition shadow-sm flex items-center gap-1 text-[11px] ${
              camMode === 'CINEMATIC_FPV'
                ? 'bg-[#d9480f] text-white'
                : 'bg-[#dbd2c2] text-[#3b3731] hover:bg-[#cec4b3]'
            }`}
          >
            <Video className="w-3 h-3" />
            <span className="hidden sm:inline">CAMÉRA </span>DRONE FPV
          </button>
          <button
            id="camModeOrbit"
            onClick={() => setCamMode('FREE_ORBIT')}
            className={`px-2.5 py-1 rounded font-bold transition flex items-center gap-1 text-[11px] ${
              camMode === 'FREE_ORBIT'
                ? 'bg-[#d9480f] text-white shadow-sm'
                : 'bg-[#dbd2c2] text-[#3b3731] hover:bg-[#cec4b3]'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>ORBITE LIBRE</span>
          </button>
        </div>

        {/* 5 Modes tactiques (avec scroll horizontal sur mobile) */}
        <div className="hidden xl:flex items-center gap-1 overflow-x-auto py-0.5">
          {[
            { id: 'IGN_ORTHO_TAC', label: '01. IGN ORTHO 20CM + CRÊTES', icon: Flame },
            { id: 'LIDAR_DARK', label: '02. LIDAR MONOCHROME', icon: Eye },
            { id: 'IGN_TOPO_SLOPE', label: '03. PLAN IGN TOPO & PENTES', icon: Layers },
            { id: 'FOREST_GROUND', label: '04. IMMERSION FORÊT 3D SOL', icon: TreePine },
            { id: 'DUSK_THERMAL', label: '05. CRÉPUSCULE ALPIN', icon: Moon },
          ].map((mode) => {
            const active = renderMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id as RenderMode)}
                className={`px-2 py-1 rounded font-bold whitespace-nowrap transition-all text-[10px] ${
                  active
                    ? 'bg-[#d9480f] text-white shadow-sm'
                    : 'bg-[#dcd3c4] text-[#3b3731] hover:bg-[#cec4b3]'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-[10px] font-bold bg-[#181715] text-[#f2ece1] px-2.5 py-1 rounded hidden lg:inline-block">
            FLUX IGN 20CM + LERP SMOOTHING
          </div>
          <button
            onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
            className="md:hidden flex items-center gap-1 px-2 py-1 rounded bg-[#dbd2c2] text-[#181715] font-bold text-xs"
            title="Ouvrir les réglages et calques"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ZONE CENTRALE : VIEWPORT 3D + HUD CINÉMATIQUE + PIP FLIR + PANNEAU DROIT */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* CANEVAS 3D PRINCIPAL */}
        <div className="relative flex-1 h-full bg-[#07090d] overflow-hidden">
          <div
            ref={mapContainerRef}
            style={{ filter: canvasFilterStyle }}
            className="w-full h-full transition-all duration-300"
          />

          {/* HUD SUPÉRIEUR GAUCHE AVEC CAP & VITESSE */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none bg-[#111318]/90 backdrop-blur-md border border-white/15 text-[#f5efe6] px-3.5 py-2.5 rounded shadow-xl max-w-[280px] sm:max-w-none">
            <div id="hudRegion" className="text-[10px] text-[#ff7b3a] font-bold uppercase tracking-wider">
              {sec.region}
            </div>
            <div id="hudTitle" className="text-sm font-extrabold mt-0.5 truncate">
              {currentTelemetry.name} ({currentTelemetry.ele}m)
            </div>
            <div className="text-[11px] text-white/80 mt-1 flex items-center gap-3">
              <span>
                ALT : <strong id="hudEle" className="text-white">{currentTelemetry.ele} m</strong>
              </span>
              <span>
                CAP : <strong id="hudBearing" className="text-emerald-400">{currentBearingDeg}°</strong>
              </span>
              <span>
                PENTE :{' '}
                <strong className={Math.abs(currentTelemetry.slope) > 20 ? 'text-[#ff5500]' : 'text-[#40c057]'}>
                  {currentTelemetry.slope}%
                </strong>
              </span>
              <span>
                VITESSE : <strong className="text-[#ff5500]">4.2 km/h</strong>
              </span>
              <span className="hidden sm:inline">
                MODE : <strong className="text-white">{camMode === 'CINEMATIC_FPV' ? 'DRONE FPV' : 'ORBITE'}</strong>
              </span>
            </div>
          </div>

          {/* FENÊTRE PIP THERMIQUE FLIR */}
          {showPip && (
            <div
              id="pipBox"
              className="absolute top-3 right-3 z-20 w-60 sm:w-72 h-36 sm:h-44 bg-[#090014] border-2 border-[#ff5500] rounded shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="bg-[#1a062b] px-2.5 py-1 flex items-center justify-between text-[10px] text-[#ffe600] font-bold border-b border-[#ff5500]/40">
                <span className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-[#ff0055]" />
                  FLIR // SUIVI CINÉMATIQUE 3D
                </span>
                <span className="text-[#ff0066] animate-pulse">● LIVE IR</span>
              </div>
              <div className="relative flex-1">
                <div
                  ref={pipContainerRef}
                  className="w-full h-full"
                  style={{ filter: 'contrast(165%) saturate(240%) hue-rotate(-15deg)' }}
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-12 h-12 border border-[#ffe600]/60 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#ff0055] rounded-full animate-ping" />
                  </div>
                </div>
                <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] text-[#ffe600] bg-black/70 px-1.5 py-0.5 rounded">
                  <span>IR : {currentTelemetry.temp}°C</span>
                  <span>VENT : {currentTelemetry.wind} km/h</span>
                  <span className="hidden sm:inline">DEM : TERRARIUM 3D</span>
                </div>
              </div>
            </div>
          )}

          {/* Toast de confirmation export */}
          {exportNotice && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#181715] border border-[#ff7b3a] text-[#f2ece1] px-4 py-2 rounded-xl shadow-2xl text-xs flex items-center gap-2">
              <span className="text-[#ff7b3a]">✓</span>
              <span>{exportNotice}</span>
            </div>
          )}
        </div>

        {/* PANNEAU LATÉRAL DROIT : RÉGLAGES CINÉMATIQUES & INSPECTEUR */}
        <aside
          className={`absolute md:relative top-0 right-0 h-full w-80 bg-[#ece5d8] border-l border-[#c8bfb0] p-3 flex flex-col justify-between overflow-y-auto text-xs z-30 shrink-0 transition-transform duration-300 ${
            mobilePanelOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-3">
            {/* Bouton fermeture sur mobile */}
            <div className="flex md:hidden items-center justify-between pb-2 border-b border-[#c8bfb0]">
              <span className="font-bold text-xs uppercase tracking-wider">RÉGLAGES CAMÉRA & CALQUES</span>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="p-1 rounded bg-[#dbd2c2] text-[#181715]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SECTION RÉGLAGES CAMÉRA CINÉMATIQUE */}
            <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#433e37] pb-1.5 mb-2 border-b border-[#c8bfb0] flex justify-between items-center">
                <span>RÉGLAGES CAMÉRA CINÉMATIQUE</span>
                <span className="text-[10px] text-[#d9480f] font-extrabold">3-DOF LERP</span>
              </div>
              <div className="space-y-2.5">
                {/* Sélecteur de mode dans le panneau */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setCamMode('CINEMATIC_FPV')}
                    className={`px-2 py-1.5 rounded font-bold text-[10px] transition ${
                      camMode === 'CINEMATIC_FPV'
                        ? 'bg-[#d9480f] text-white shadow-sm'
                        : 'bg-[#dbd2c2] text-[#3b3731] hover:bg-[#cec4b3]'
                    }`}
                  >
                    🎥 DRONE FPV
                  </button>
                  <button
                    onClick={() => setCamMode('FREE_ORBIT')}
                    className={`px-2 py-1.5 rounded font-bold text-[10px] transition ${
                      camMode === 'FREE_ORBIT'
                        ? 'bg-[#d9480f] text-white shadow-sm'
                        : 'bg-[#dbd2c2] text-[#3b3731] hover:bg-[#cec4b3]'
                    }`}
                  >
                    🛰️ ORBITE LIBRE
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Hauteur de Vol / Suivi</span>
                    <span id="lblCamHeight" className="font-bold">{camHeight} m</span>
                  </div>
                  <input
                    type="range"
                    id="rngCamHeight"
                    min="15"
                    max="150"
                    step="5"
                    value={camHeight}
                    onChange={(e) => setCamHeight(parseInt(e.target.value, 10))}
                    className="w-full accent-[#d9480f]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Inclinaison (Pitch)</span>
                    <span id="lblCamPitch" className="font-bold">{camPitch}°</span>
                  </div>
                  <input
                    type="range"
                    id="rngCamPitch"
                    min="45"
                    max="82"
                    step="1"
                    value={camPitch}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCamPitch(val);
                      if (mapRef.current) mapRef.current.setPitch(val);
                    }}
                    className="w-full accent-[#d9480f]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Facteur de Lissage (Inertie)</span>
                    <span className="font-bold text-[#d9480f]">Ultra-Fluide (Lerp)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ASTUCE NAVIGATION AMÉLIORÉE */}
            <div className="bg-[#181715] text-[#f2ece1] rounded p-2.5 text-[10px] space-y-1">
              <div className="text-[#ff7b3a] font-bold uppercase">Navigation Améliorée :</div>
              <div>• Clic droit + Glisser : Rotation libre cinématique</div>
              <div>• Molette : Zoom progressif avec amorti</div>
              <div>• Survol automatique : Interpolation linéaire par segments de sentier</div>
            </div>

            {/* Calques Hybrides */}
            <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#433e37] pb-1.5 mb-2 border-b border-[#c8bfb0] flex justify-between">
                <span>CALQUES HYBRIDES LKDV</span>
                <span className="text-[#d9480f]">ACTIFS</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>🔥 Périmètres & Crêtes (Glow)</span>
                  <input
                    type="checkbox"
                    checked={showRidge}
                    onChange={(e) => setShowRidge(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>🌲 Forêt 3D Three.js (Plaquée DEM)</span>
                  <input
                    type="checkbox"
                    checked={showForest}
                    onChange={(e) => setShowForest(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>🏰 Bâtiments 3D OSM Extrudés</span>
                  <input
                    type="checkbox"
                    checked={showBuildings}
                    onChange={(e) => setShowBuildings(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>🌡️ Fenêtre PIP Thermique (FLIR)</span>
                  <input
                    type="checkbox"
                    checked={showPip}
                    onChange={(e) => setShowPip(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>
              </div>
            </div>

            {/* Réglages Relief & Soleil */}
            <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2.5 space-y-2">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#433e37] pb-1 border-b border-[#c8bfb0]">
                RELIEF 3D & OMBRAGE SOLAIRE
              </div>
              <div>
                <div className="flex justify-between text-[11px]">
                  <span>Exagération Relief 3D</span>
                  <span className="font-bold">{terrainExag.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={terrainExag}
                  onChange={(e) => setTerrainExag(parseFloat(e.target.value))}
                  className="w-full accent-[#d9480f]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px]">
                  <span>Azimut Solaire (Ombres)</span>
                  <span className="font-bold">{sunAzimuth}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={sunAzimuth}
                  onChange={(e) => setSunAzimuth(parseInt(e.target.value, 10))}
                  className="w-full accent-[#d9480f]"
                />
              </div>
            </div>

            {/* Télémétrie Temps Réel */}
            <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#433e37] pb-1.5 mb-2 border-b border-[#c8bfb0]">
                TÉLÉMÉTRIE DU SENTIER GR
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-[#ece5d8] p-2 rounded border border-[#c8bfb0]">
                  <div className="text-[9px] text-[#6e675c]">ALTITUDE IGN</div>
                  <div className="text-sm font-extrabold">{currentTelemetry.ele} m</div>
                </div>
                <div className="bg-[#ece5d8] p-2 rounded border border-[#c8bfb0]">
                  <div className="text-[9px] text-[#6e675c]">INCLINAISON PENTE</div>
                  <div className="text-sm font-extrabold text-[#d9480f]">
                    {currentTelemetry.slope}%
                  </div>
                </div>
                <div className="bg-[#ece5d8] p-2 rounded border border-[#c8bfb0]">
                  <div className="text-[9px] text-[#6e675c]">TEMPÉRATURE CRÊTE</div>
                  <div className="text-sm font-extrabold">{currentTelemetry.temp} °C</div>
                </div>
                <div className="bg-[#ece5d8] p-2 rounded border border-[#c8bfb0]">
                  <div className="text-[9px] text-[#6e675c]">RAFALES VENT</div>
                  <div className="text-sm font-extrabold">{currentTelemetry.wind} km/h</div>
                </div>
              </div>
            </div>

            {/* Architecture Info */}
            <div className="bg-[#181715] text-[#f2ece1] rounded p-2.5 text-[10px] space-y-1">
              <div className="text-[#ff7b3a] font-bold uppercase">Stack Technique Active :</div>
              <div>• <strong>Caméra :</strong> Moteur Cinématique 3-DOF Lerp</div>
              <div>• <strong>Fond Photo :</strong> IGN Orthophotos 20cm (WMTS)</div>
              <div>• <strong>Fond Topo :</strong> Plan IGN V2 officiel (Sentiers GR)</div>
              <div>• <strong>Végétation :</strong> 400 Conifères 3D Three.js plaqués</div>
            </div>

            {/* Bouton Export GPX */}
            <button
              onClick={() => {
                setExportNotice('Export GPX & Rapport Topographique LKDV généré.');
                setTimeout(() => setExportNotice(null), 3500);
              }}
              className="w-full py-2 bg-[#181715] hover:bg-[#2c2a26] text-[#f2ece1] font-bold rounded flex items-center justify-center gap-2 text-xs transition"
            >
              <Download className="w-3.5 h-3.5 text-[#ff7b3a]" />
              EXPORTER GPX & RAPPORT 3D
            </button>
          </div>
        </aside>
      </div>

      {/* DOCK INFÉRIEUR : LECTEUR FLUIDE & COURBES SYNCHRONISÉES */}
      <footer className="h-36 bg-[#ece5d8] border-t border-[#c8bfb0] px-4 py-2 flex flex-col justify-between z-30 shrink-0">
        <div className="flex items-center gap-3 border-b border-[#c8bfb0] pb-1.5">
          <button
            id="btnPlay"
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 rounded bg-[#d9480f] text-white font-bold text-xs hover:bg-[#b83b0a] transition shadow flex items-center gap-1.5 shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>PAUSE SURVOL</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>LANCER SURVOL 3D</span>
              </>
            )}
          </button>
          <div className="flex-1 flex items-center gap-3">
            <span id="lblDist" className="text-[11px] font-bold w-20 shrink-0">KM {currentTelemetry.dist}</span>
            <input
              type="range"
              id="rngProgress"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={(e) => setProgress(parseFloat(e.target.value))}
              className="flex-1 cursor-pointer accent-[#d9480f]"
            />
            <span className="text-[11px] font-bold w-20 text-right shrink-0">
              {sec.totalDistKm} KM
            </span>
          </div>
          <button
            onClick={() => {
              setExportNotice('Export GPX & Rapport Topographique LKDV généré.');
              setTimeout(() => setExportNotice(null), 3500);
            }}
            className="px-2.5 py-1 bg-[#181715] hover:bg-[#2c2a26] text-[#f2ece1] font-bold rounded flex items-center gap-1.5 text-xs transition shrink-0"
            title="Exporter GPX & Rapport 3D"
          >
            <Download className="w-3.5 h-3.5 text-[#ff7b3a]" />
            <span>EXPORTER GPX</span>
          </button>
        </div>

        {/* 3 Graphiques synchronisés */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 pt-1.5 overflow-x-auto">
          {/* Graphe 1 : Profil Altimétrique IGN */}
          <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2 flex flex-col justify-between min-w-[200px]">
            <div className="flex justify-between text-[10px] font-bold text-[#433e37]">
              <span>01 // PROFIL ALTIMÉTRIQUE IGN (M)</span>
              <span className="text-[#d9480f]">{currentTelemetry.ele} m</span>
            </div>
            <svg className="w-full h-10 overflow-visible" viewBox="0 0 300 40" preserveAspectRatio="none">
              <polygon fill="rgba(217,72,15,0.25)" points={chartPoints.elePolygon} />
              <polyline fill="none" stroke="#d9480f" strokeWidth="2" points={chartPoints.elePolyline} />
              <line
                x1={xCursor}
                y1="0"
                x2={xCursor}
                y2="40"
                stroke="#181715"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
            </svg>
          </div>

          {/* Graphe 2 : Gradient de Pente & Exposition */}
          <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2 flex flex-col justify-between min-w-[200px]">
            <div className="flex justify-between text-[10px] font-bold text-[#433e37]">
              <span>02 // GRADIENT DE PENTE & EXPOSITION (%)</span>
              <span className="text-[#b83200]">{currentTelemetry.slope}%</span>
            </div>
            <svg className="w-full h-10 overflow-visible" viewBox="0 0 300 40" preserveAspectRatio="none">
              <polyline fill="none" stroke="#b83200" strokeWidth="2" points={chartPoints.slopePolyline} />
              <line
                x1={xCursor}
                y1="0"
                x2={xCursor}
                y2="40"
                stroke="#181715"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
            </svg>
          </div>

          {/* Graphe 3 : Densité Forêt 3D & Vent Crête */}
          <div className="bg-[#e0d8c8] border border-[#c8bfb0] rounded p-2 flex flex-col justify-between min-w-[200px]">
            <div className="flex justify-between text-[10px] font-bold text-[#433e37]">
              <span>03 // DENSITÉ FORÊT 3D & VENT CRÊTE</span>
              <span className="text-[#17402C]">Rafales {currentTelemetry.wind} km/h</span>
            </div>
            <svg className="w-full h-10 overflow-visible" viewBox="0 0 300 40" preserveAspectRatio="none">
              <polygon fill="rgba(38,70,36,0.3)" points={chartPoints.forestPolygon} />
              <polyline fill="none" stroke="#264624" strokeWidth="2" points={chartPoints.forestPolyline} />
              <line
                x1={xCursor}
                y1="0"
                x2={xCursor}
                y2="40"
                stroke="#181715"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
            </svg>
          </div>
        </div>

        <div className="text-[10px] text-[#6e675c] flex justify-between pt-1">
          <span>Moteur de caméra vectoriel avec calcul d&apos;azimut par splines d&apos;interpolation</span>
          <span>LKDV Engine 2026</span>
        </div>
      </footer>
    </div>
  );
}
