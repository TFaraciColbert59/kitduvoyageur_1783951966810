'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import {
  Play,
  Pause,
  Layers,
  Mountain,
  Thermometer,
  Eye,
  Navigation,
  Activity,
  Sun,
  Moon,
  TreePine,
  Flame,
  Sliders,
  MapPin,
  Download,
  Radio,
  ChevronLeft,
  X,
} from 'lucide-react';

// Configuration worker local MapLibre pour éviter tout appel externe bloquant
if (typeof window !== 'undefined' && typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
}

// --- DONNÉES GPX / TÉLÉMÉTRIE DU TOUR DU MONT-BLANC (CHAMONIX -> COL DE VOZA -> LES CONTAMINES) ---
interface TrailPoint {
  id: number;
  name?: string;
  lng: number;
  lat: number;
  ele: number;
  distKm: number;
  slopePct: number;
  tempC: number;
  windKmh: number;
  riskLevel: number; // 0 to 1
}

const TMB_TRAIL: TrailPoint[] = [
  { id: 0, name: 'Chamonix-Mont-Blanc', lng: 6.8694, lat: 45.9237, ele: 1035, distKm: 0.0, slopePct: 4.2, tempC: 16.5, windKmh: 12, riskLevel: 0.1 },
  { id: 1, lng: 6.8520, lat: 45.9150, ele: 1015, distKm: 1.8, slopePct: -2.1, tempC: 16.2, windKmh: 14, riskLevel: 0.1 },
  { id: 2, lng: 6.8310, lat: 45.9080, ele: 1005, distKm: 3.6, slopePct: 1.5, tempC: 15.8, windKmh: 15, riskLevel: 0.15 },
  { id: 3, name: 'Les Houches', lng: 6.7980, lat: 45.8910, ele: 1008, distKm: 6.4, slopePct: 14.8, tempC: 15.0, windKmh: 18, riskLevel: 0.25 },
  { id: 4, lng: 6.7840, lat: 45.8810, ele: 1280, distKm: 8.1, slopePct: 22.4, tempC: 12.4, windKmh: 24, riskLevel: 0.55 },
  { id: 5, lng: 6.7750, lat: 45.8730, ele: 1490, distKm: 9.5, slopePct: 19.5, tempC: 10.8, windKmh: 28, riskLevel: 0.65 },
  { id: 6, name: 'Col de Voza', lng: 6.7664, lat: 45.8647, ele: 1657, distKm: 11.2, slopePct: 12.0, tempC: 8.9, windKmh: 35, riskLevel: 0.75 },
  { id: 7, name: 'Bellevue (Téléphérique)', lng: 6.7715, lat: 45.8565, ele: 1801, distKm: 12.6, slopePct: 24.5, tempC: 7.2, windKmh: 42, riskLevel: 0.85 },
  { id: 8, name: 'Pont Suspendu de Bionnassay', lng: 6.7690, lat: 45.8430, ele: 1320, distKm: 15.1, slopePct: -28.0, tempC: 11.0, windKmh: 26, riskLevel: 0.70 },
  { id: 9, name: 'Col de Tricot', lng: 6.7520, lat: 45.8340, ele: 2120, distKm: 18.4, slopePct: 31.2, tempC: 4.5, windKmh: 48, riskLevel: 0.92 },
  { id: 10, name: 'Refuge de Miage', lng: 6.7400, lat: 45.8220, ele: 1560, distKm: 21.0, slopePct: -24.0, tempC: 9.5, windKmh: 22, riskLevel: 0.45 },
  { id: 11, name: 'Les Contamines-Montjoie', lng: 6.7260, lat: 45.8190, ele: 1167, distKm: 24.5, slopePct: -11.5, tempC: 13.8, windKmh: 15, riskLevel: 0.2 },
];

type RenderMode = 'SATELLITE_TAC' | 'LIDAR_DARK' | 'TOPO_SLOPE' | 'FOREST_GROUND' | 'DUSK_THERMAL';

export default function Carte3D() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pipMapRef = useRef<maplibregl.Map | null>(null);

  // États de contrôle et télémétrie
  const [renderMode, setRenderMode] = useState<RenderMode>('SATELLITE_TAC');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0); // 0 à 100
  const [showPip, setShowPip] = useState<boolean>(true);
  const [showContours, setShowContours] = useState<boolean>(true);
  const [showSlopeHeat, setShowSlopeHeat] = useState<boolean>(true);
  const [show3DTrees, setShow3DTrees] = useState<boolean>(true);
  const [terrainExaggeration, setTerrainExaggeration] = useState<number>(1.65);
  const [sunAzimuth, setSunAzimuth] = useState<number>(210);
  const [cameraFollow, setCameraFollow] = useState<'ORBIT' | 'DRONE_FOLLOW' | 'FREE'>('ORBIT');
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Interpolation de la position courante le long du GR
  const currentTelemetry = useMemo(() => {
    const scaled = (progress / 100) * (TMB_TRAIL.length - 1);
    const idx = Math.floor(scaled);
    const nextIdx = Math.min(idx + 1, TMB_TRAIL.length - 1);
    const t = scaled - idx;

    const p1 = TMB_TRAIL[idx];
    const p2 = TMB_TRAIL[nextIdx];

    return {
      lng: p1.lng + (p2.lng - p1.lng) * t,
      lat: p1.lat + (p2.lat - p1.lat) * t,
      ele: Math.round(p1.ele + (p2.ele - p1.ele) * t),
      distKm: +(p1.distKm + (p2.distKm - p1.distKm) * t).toFixed(2),
      slopePct: +(p1.slopePct + (p2.slopePct - p1.slopePct) * t).toFixed(1),
      tempC: +(p1.tempC + (p2.tempC - p1.tempC) * t).toFixed(1),
      windKmh: Math.round(p1.windKmh + (p2.windKmh - p1.windKmh) * t),
      riskLevel: +(p1.riskLevel + (p2.riskLevel - p1.riskLevel) * t).toFixed(2),
      nearestName: p1.name || p2.name || 'Sentier GR Tour du Mont-Blanc',
    };
  }, [progress]);

  // Génération des zones de crêtes / périmètres lumineux (comme les contours incandescents de la vidéo)
  const perimeterPolygons = useMemo(() => {
    const createRing = (centerLng: number, centerLat: number, radiusDeg: number, points = 36) => {
      const coords: [number, number][] = [];
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const jitter = 0.82 + 0.25 * Math.sin(angle * 5) + 0.15 * Math.cos(angle * 3);
        coords.push([
          centerLng + Math.cos(angle) * radiusDeg * jitter * 1.4,
          centerLat + Math.sin(angle) * radiusDeg * jitter,
        ]);
      }
      return coords;
    };

    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { level: 'high', label: 'Zone Haute Altitude / Crête' },
          geometry: { type: 'Polygon' as const, coordinates: [createRing(6.768, 45.858, 0.018)] },
        },
        {
          type: 'Feature' as const,
          properties: { level: 'medium', label: 'Secteur Tricot - Bionnassay' },
          geometry: { type: 'Polygon' as const, coordinates: [createRing(6.755, 45.838, 0.024)] },
        },
      ],
    };
  }, []);

  // Initialisation de la carte 3D principale + Couche Three.js (Arbres 3D + Drone/Marqueur)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [6.785, 45.875],
      zoom: 13.2,
      pitch: 68,
      bearing: -135,
      maxPitch: 85,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          topo: {
            type: 'raster',
            tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 17,
          },
          terrainSource: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
          hillshadeSource: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15,
          },
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-contrast': 0.18,
              'raster-saturation': -0.05,
              'raster-brightness-max': 0.95,
            },
          },
          {
            id: 'topo-layer',
            type: 'raster',
            source: 'topo',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 0.9 },
          },
          {
            id: 'hillshade-layer',
            type: 'hillshade',
            source: 'hillshadeSource',
            paint: {
              'hillshade-exaggeration': 0.75,
              'hillshade-shadow-color': '#05070a',
              'hillshade-highlight-color': '#ff9e5e',
              'hillshade-accent-color': '#ff5500',
              'hillshade-illumination-direction': 210,
            },
          },
        ],
        terrain: {
          source: 'terrainSource',
          exaggeration: 1.65,
        },
      },
    });

    mapRef.current = map;

    map.on('load', () => {
      // 1. Source et couches du périmètre topographique / thermique (effet 00:01 - 00:10)
      map.addSource('tactical-perimeters', {
        type: 'geojson',
        data: perimeterPolygons,
      });

      map.addLayer({
        id: 'perimeter-fill',
        type: 'fill',
        source: 'tactical-perimeters',
        paint: {
          'fill-color': [
            'match',
            ['get', 'level'],
            'high',
            '#ff3b00',
            '#ff8800',
          ],
          'fill-opacity': 0.18,
        },
      });

      map.addLayer({
        id: 'perimeter-glow',
        type: 'line',
        source: 'tactical-perimeters',
        paint: {
          'line-color': '#ff5500',
          'line-width': 8,
          'line-blur': 6,
          'line-opacity': 0.75,
        },
      });

      map.addLayer({
        id: 'perimeter-line',
        type: 'line',
        source: 'tactical-perimeters',
        paint: {
          'line-color': '#ffaa44',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      // 2. Source et couches du sentier GR (Tracé incandescent)
      const trailGeoJSON = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: TMB_TRAIL.map((p) => [p.lng, p.lat]),
        },
      };

      map.addSource('gr-trail', {
        type: 'geojson',
        data: trailGeoJSON,
      });

      // Halo externe du sentier
      map.addLayer({
        id: 'gr-trail-glow',
        type: 'line',
        source: 'gr-trail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ff5500',
          'line-width': 12,
          'line-blur': 8,
          'line-opacity': 0.8,
        },
      });

      // Coeur lumineux du sentier
      map.addLayer({
        id: 'gr-trail-core',
        type: 'line',
        source: 'gr-trail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffd27d',
          'line-width': 3.5,
        },
      });

      // 3. Points d'intérêt / Waypoints
      const waypointsGeoJSON = {
        type: 'FeatureCollection' as const,
        features: TMB_TRAIL.filter((p) => p.name).map((p) => ({
          type: 'Feature' as const,
          properties: {
            title: `${p.name} · ${p.ele}m`,
            ele: p.ele,
            slope: p.slopePct,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [p.lng, p.lat],
          },
        })),
      };

      map.addSource('waypoints', {
        type: 'geojson',
        data: waypointsGeoJSON,
      });

      map.addLayer({
        id: 'waypoints-circle',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 5,
          'circle-color': '#ff5500',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'waypoints-label',
        type: 'symbol',
        source: 'waypoints',
        layout: {
          'text-field': ['get', 'title'],
          'text-size': 11,
          'text-offset': [0, -1.4],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#090b10',
          'text-halo-width': 2,
        },
      });

      // 4. Point du randonneur / drone actif
      map.addSource('active-runner', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { label: 'CAPTEUR LKDV-01' },
          geometry: {
            type: 'Point',
            coordinates: [TMB_TRAIL[0].lng, TMB_TRAIL[0].lat],
          },
        },
      });

      map.addLayer({
        id: 'active-runner-pulse',
        type: 'circle',
        source: 'active-runner',
        paint: {
          'circle-radius': 16,
          'circle-color': '#ff5500',
          'circle-opacity': 0.35,
          'circle-blur': 0.6,
        },
      });

      map.addLayer({
        id: 'active-runner-dot',
        type: 'circle',
        source: 'active-runner',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ff5500',
        },
      });

      // 5. Couche WebGL Three.js pour la forêt de conifères 3D (comme à 00:13 - 00:16 dans la vidéo)
      try {
        const modelOrigin: [number, number] = [6.775, 45.873];
        const modelAltitude = 1480;
        const mercatorCoord = maplibregl.MercatorCoordinate.fromLngLat(
          modelOrigin,
          modelAltitude
        );
        const scale = mercatorCoord.meterInMercatorCoordinateUnits();

        const customThreeLayer: maplibregl.CustomLayerInterface = {
          id: 'three-forest-layer',
          type: 'custom',
          renderingMode: '3d',
          onAdd: function (_map: any, gl: any) {
            try {
              const camera = new THREE.Camera();
              const scene = new THREE.Scene();

              const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
              scene.add(ambientLight);

              const dirLight = new THREE.DirectionalLight(0xffddaa, 1.4);
              dirLight.position.set(80, -120, 150).normalize();
              scene.add(dirLight);

              // Génération instanciée de 350 conifères 3D le long du secteur forestier
              const coneGeo = new THREE.ConeGeometry(4.5, 16, 7);
              coneGeo.rotateX(Math.PI / 2);
              const coneMat = new THREE.MeshLambertMaterial({ color: 0x2d4c2b });

              const instancedTrees = new THREE.InstancedMesh(coneGeo, coneMat, 350);
              const dummy = new THREE.Object3D();

              for (let i = 0; i < 350; i++) {
                const spreadX = (Math.random() - 0.5) * 1200;
                const spreadY = (Math.random() - 0.5) * 1200;
                const s = 0.7 + Math.random() * 1.1;
                dummy.position.set(spreadX, spreadY, 8 * s);
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                instancedTrees.setMatrixAt(i, dummy.matrix);
              }
              scene.add(instancedTrees);

              (this as any).camera = camera;
              (this as any).scene = scene;
              (this as any).renderer = new THREE.WebGLRenderer({
                canvas: _map.getCanvas(),
                context: gl,
                antialias: true,
              });
              (this as any).renderer.autoClear = false;
            } catch (err) {
              console.warn('[ThreeLayer:onAdd] Fallback non-bloquant:', err);
            }
          },
          render: function (_gl: any, matrix: any) {
            try {
              if (!(this as any).renderer || !(this as any).scene || !(this as any).camera) return;
              const m = new THREE.Matrix4().fromArray(matrix);
              const l = new THREE.Matrix4()
                .makeTranslation(mercatorCoord.x, mercatorCoord.y, mercatorCoord.z)
                .scale(new THREE.Vector3(scale, -scale, scale));

              (this as any).camera.projectionMatrix.copy(m.multiply(l));
              (this as any).renderer.resetState();
              (this as any).renderer.render((this as any).scene, (this as any).camera);
            } catch (err) {
              console.warn('[ThreeLayer:render] Fallback non-bloquant:', err);
            }
          },
        };

        map.addLayer(customThreeLayer);
      } catch (err) {
        console.warn('[ThreeForestLayer] Initialisation Three.js ignorée:', err);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [perimeterPolygons]);

  // Initialisation de la mini-carte PIP Thermique / Infrarouge (comme à 00:00 dans la vidéo)
  useEffect(() => {
    if (!pipContainerRef.current || pipMapRef.current || !showPip) return;

    const pipMap = new maplibregl.Map({
      container: pipContainerRef.current,
      center: [currentTelemetry.lng, currentTelemetry.lat],
      zoom: 12.2,
      pitch: 0,
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
          {
            id: 'pip-bg',
            type: 'background',
            paint: { 'background-color': '#090014' },
          },
          {
            id: 'pip-thermal-hillshade',
            type: 'hillshade',
            source: 'demPip',
            paint: {
              'hillshade-exaggeration': 1.0,
              'hillshade-shadow-color': '#12002b',
              'hillshade-highlight-color': '#ffee00',
              'hillshade-accent-color': '#ff0066',
            },
          },
        ],
      },
    });

    pipMapRef.current = pipMap;

    return () => {
      pipMap.remove();
      pipMapRef.current = null;
    };
  }, [showPip]);

  // Synchronisation de la position du randonneur/drone et de la caméra
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const runnerSource = map.getSource('active-runner') as maplibregl.GeoJSONSource;
    if (runnerSource) {
      runnerSource.setData({
        type: 'Feature',
        properties: { label: 'LKDV-TRACKER' },
        geometry: {
          type: 'Point',
          coordinates: [currentTelemetry.lng, currentTelemetry.lat],
        },
      });
    }

    if (pipMapRef.current) {
      pipMapRef.current.setCenter([currentTelemetry.lng, currentTelemetry.lat]);
    }

    if (cameraFollow === 'DRONE_FOLLOW') {
      map.easeTo({
        center: [currentTelemetry.lng, currentTelemetry.lat],
        zoom: 15.8,
        pitch: 76,
        bearing: (map.getBearing() + 0.6) % 360,
        duration: 120,
      });
    } else if (cameraFollow === 'ORBIT' && isPlaying) {
      map.easeTo({
        center: [currentTelemetry.lng, currentTelemetry.lat],
        bearing: (map.getBearing() + 0.35) % 360,
        duration: 120,
      });
    }
  }, [currentTelemetry, cameraFollow, isPlaying]);

  // Changement de Mode Visuel (les 5 presets de la vidéo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const showTopo = renderMode === 'TOPO_SLOPE';
    if (map.getLayer('topo-layer')) {
      map.setLayoutProperty('topo-layer', 'visibility', showTopo ? 'visible' : 'none');
    }

    if (renderMode === 'FOREST_GROUND') {
      setCameraFollow('DRONE_FOLLOW');
      map.easeTo({
        center: [6.775, 45.873],
        zoom: 16.2,
        pitch: 78,
        bearing: -150,
        duration: 1400,
      });
    } else if (renderMode === 'SATELLITE_TAC') {
      map.easeTo({ pitch: 68, zoom: 13.3, duration: 1000 });
    }
  }, [renderMode]);

  // Mise à jour de l'exagération du relief et de l'azimut solaire
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setTerrain({ source: 'terrainSource', exaggeration: terrainExaggeration });
    if (map.getLayer('hillshade-layer')) {
      map.setPaintProperty('hillshade-layer', 'hillshade-illumination-direction', sunAzimuth);
    }
  }, [terrainExaggeration, sunAzimuth]);

  // Visibilité des calques
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const perimVis = showSlopeHeat ? 'visible' : 'none';
    ['perimeter-fill', 'perimeter-glow', 'perimeter-line'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', perimVis);
    });

    if (map.getLayer('three-forest-layer')) {
      map.setLayoutProperty('three-forest-layer', 'visibility', show3DTrees ? 'visible' : 'none');
    }

    if (map.getLayer('waypoints-circle') && map.getLayer('waypoints-label')) {
      const wayVis = showContours ? 'visible' : 'none';
      map.setLayoutProperty('waypoints-circle', 'visibility', wayVis);
      map.setLayoutProperty('waypoints-label', 'visibility', wayVis);
    }
  }, [showSlopeHeat, show3DTrees, showContours]);

  // Boucle d'animation de la timeline
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        return +(prev + 0.18 * speed).toFixed(2);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Filtre CSS WebGL dynamique selon le shader choisi (LiDAR, Crépuscule, Topo, Satellite)
  const canvasFilterStyle = useMemo(() => {
    switch (renderMode) {
      case 'LIDAR_DARK':
        return 'grayscale(100%) contrast(165%) brightness(65%)';
      case 'TOPO_SLOPE':
        return 'contrast(112%) saturate(130%)';
      case 'DUSK_THERMAL':
        return 'sepia(35%) hue-rotate(-22deg) contrast(135%) brightness(75%) saturate(160%)';
      case 'FOREST_GROUND':
        return 'contrast(115%) saturate(120%) brightness(95%)';
      default:
        return 'contrast(115%) saturate(110%)';
    }
  }, [renderMode]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c0d10] text-[#1c1b18] font-mono select-none flex flex-col">
      {/* BARRE SUPÉRIEURE : SÉLECTEUR DE SHADERS & STATUT SYSTÈME */}
      <header className="min-h-10 bg-[#e6dfd3] border-b border-[#c5bcad] px-3 py-1 flex items-center justify-between z-30 text-xs gap-2">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <Link
            href="/explorer"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#d8d0c2] hover:bg-[#cac1b0] text-[#3a3630] font-bold text-[11px] transition shadow-sm"
            title="Quitter et revenir à l'application"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QUITTER</span>
          </Link>
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-[#181715]">
            <Mountain className="w-4 h-4 text-[#d9480f]" />
            <span className="truncate max-w-[140px] sm:max-w-none">LKDV // GEOSPATIAL TACTICAL TWIN</span>
          </div>
          <span className="text-[#7c7569] hidden lg:inline">|</span>
          <span className="px-2 py-0.5 bg-[#d8d0c2] rounded text-[11px] font-semibold hidden lg:inline">
            SECTEUR : MASSIF DU MONT-BLANC (GR TMB)
          </span>
        </div>

        {/* Boutons des 5 modes de la vidéo (avec scroll horizontal sur mobile) */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {[
            { id: 'SATELLITE_TAC', label: '01. SAT + CRÊTES', icon: Flame },
            { id: 'LIDAR_DARK', label: '02. LIDAR', icon: Eye },
            { id: 'TOPO_SLOPE', label: '03. TOPO PENTES', icon: Layers },
            { id: 'FOREST_GROUND', label: '04. FORÊT 3D', icon: TreePine },
            { id: 'DUSK_THERMAL', label: '05. CRÉPUSCULE', icon: Moon },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = renderMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setRenderMode(mode.id as RenderMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-[#d9480f] text-white shadow-sm'
                    : 'bg-[#d8d0c2] text-[#3a3630] hover:bg-[#cac1b0]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 md:gap-3 text-[11px] font-semibold shrink-0">
          <span className="flex items-center gap-1 text-[#b83200]">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE DEM 3D
          </span>
          <span className="hidden xl:inline">
            {currentTelemetry.lat.toFixed(4)}°N, {currentTelemetry.lng.toFixed(4)}°E
          </span>
          {/* Bouton bascule panneau latéral sur mobile */}
          <button
            onClick={() => setMobilePanelOpen(!mobilePanelOpen)}
            className="md:hidden flex items-center gap-1 px-2 py-0.5 rounded bg-[#d8d0c2] text-[#3a3630] font-bold text-[11px]"
            title="Afficher/masquer les paramètres"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ZONE CENTRALE : VIEWPORT 3D + PIP THERMIQUE + INSPECTEUR DROIT */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* CANEVAS 3D PRINCIPAL */}
        <div className="relative flex-1 h-full overflow-hidden bg-black">
          <div
            ref={mapContainerRef}
            style={{ filter: canvasFilterStyle }}
            className="w-full h-full transition-all duration-500"
          />

          {/* OVERLAY GRILLE DE VISÉE / HUD EN HAUT À GAUCHE */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-1.5">
            <div className="bg-[#121318]/85 backdrop-blur-md border border-white/15 text-[#f4efe6] px-3 py-2 rounded shadow-lg max-w-[280px] sm:max-w-none">
              <div className="text-[10px] uppercase tracking-widest text-[#ff7b3a] font-bold">
                POINT D&apos;INTÉRÊT ACTIF
              </div>
              <div className="text-sm font-bold flex items-center gap-2 truncate">
                <MapPin className="w-4 h-4 text-[#ff5500] shrink-0" />
                <span>{currentTelemetry.nearestName}</span>
              </div>
              <div className="text-[11px] text-white/70 mt-0.5">
                ALT : <strong className="text-white">{currentTelemetry.ele} m</strong> · PENTE :{' '}
                <strong
                  className={
                    Math.abs(currentTelemetry.slopePct) > 20 ? 'text-[#ff5500]' : 'text-[#40c057]'
                  }
                >
                  {currentTelemetry.slopePct}%
                </strong>{' '}
                · KM : <strong className="text-white">{currentTelemetry.distKm} / 24.5 km</strong>
              </div>
            </div>
          </div>

          {/* FENÊTRE FLOTTANTE PIP THERMIQUE / IR (COMME À 00:00 DANS LA VIDÉO) */}
          {showPip && (
            <div className="absolute top-3 right-4 z-20 w-60 sm:w-72 h-36 sm:h-44 bg-[#090014] border-2 border-[#ff5500]/80 rounded shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-[#180828] px-2.5 py-1 flex items-center justify-between text-[10px] text-[#ffdd55] font-bold border-b border-[#ff5500]/40">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-[#ff0066]" />
                  FLIR // ANALYSE THERMIQUE
                </span>
                <button
                  onClick={() => setShowPip(false)}
                  className="text-white/70 hover:text-white px-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="relative flex-1">
                <div
                  ref={pipContainerRef}
                  className="w-full h-full"
                  style={{ filter: 'contrast(155%) saturate(220%) hue-rotate(-15deg)' }}
                />
                {/* Réticule radar thermique */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-12 h-12 border border-[#ffee00]/60 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-[#ff0055] rounded-full animate-ping" />
                  </div>
                </div>
                <div className="absolute bottom-1 left-2 text-[9px] text-[#ffee00] bg-black/60 px-1.5 py-0.5 rounded">
                  IR-TEMP : {currentTelemetry.tempC}°C | VENT : {currentTelemetry.windKmh} km/h
                </div>
              </div>
            </div>
          )}

          {/* Toast de confirmation d'export */}
          {exportNotice && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[#1c1b18] border border-[#ff7b3a] text-[#f4efe6] px-4 py-2 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-[#ff7b3a]">✓</span>
              <span>{exportNotice}</span>
            </div>
          )}
        </div>

        {/* PANNEAU LATÉRAL DROIT : CONTRÔLE DES CALQUES & TÉLÉMÉTRIE (STYLE BEIGE TECHNIQUE DE LA VIDÉO) */}
        <aside
          className={`absolute md:relative top-0 right-0 h-full w-80 bg-[#e6dfd3] border-l border-[#c5bcad] flex flex-col justify-between overflow-y-auto p-3 text-xs z-30 transition-transform duration-300 ${
            mobilePanelOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-4">
            {/* Bouton fermeture sur mobile */}
            <div className="flex md:hidden items-center justify-between pb-2 border-b border-[#c5bcad]">
              <span className="font-bold text-xs uppercase tracking-wider">PANNEAU DE CONTRÔLE</span>
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="p-1 rounded bg-[#d8d0c2] text-[#3a3630]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1 : Calques et couches 3D */}
            <div className="bg-[#ded6c6] border border-[#c5bcad] rounded p-2.5">
              <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-[#4a443c] mb-2 pb-1 border-b border-[#c5bcad]">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#d9480f]" /> CALQUES GÉOSPATIAUX
                </span>
                <span>ACTIFS</span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#ff5500] inline-block" />
                    Périmètres & Crêtes (Glow)
                  </span>
                  <input
                    type="checkbox"
                    checked={showSlopeHeat}
                    onChange={(e) => setShowSlopeHeat(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#2d5a27] inline-block" />
                    Forêt 3D Procédurale (Conifères)
                  </span>
                  <input
                    type="checkbox"
                    checked={show3DTrees}
                    onChange={(e) => setShow3DTrees(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#9b00e8] inline-block" />
                    Fenêtre PIP Thermique (FLIR)
                  </span>
                  <input
                    type="checkbox"
                    checked={showPip}
                    onChange={(e) => setShowPip(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#eab308] inline-block" />
                    Balises & Refuges GR
                  </span>
                  <input
                    type="checkbox"
                    checked={showContours}
                    onChange={(e) => setShowContours(e.target.checked)}
                    className="accent-[#d9480f]"
                  />
                </label>
              </div>
            </div>

            {/* Section 2 : Contrôle Caméra & Poursuite 3D */}
            <div className="bg-[#ded6c6] border border-[#c5bcad] rounded p-2.5">
              <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-[#4a443c] mb-2 pb-1 border-b border-[#c5bcad]">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#d9480f]" /> MODE DE CAMÉRA 3D
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'ORBIT', label: 'ORBITE' },
                  { id: 'DRONE_FOLLOW', label: 'SUIVI SOL' },
                  { id: 'FREE', label: 'LIBRE' },
                ].map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => setCameraFollow(cam.id as any)}
                    className={`py-1.5 px-2 rounded font-bold text-[10px] transition ${
                      cameraFollow === cam.id
                        ? 'bg-[#1c1b18] text-[#f4efe6]'
                        : 'bg-[#cfc6b6] text-[#3a3630] hover:bg-[#c2b8a6]'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3 : Réglages du Moteur de Relief (DEM & Soleil) */}
            <div className="bg-[#ded6c6] border border-[#c5bcad] rounded p-2.5 space-y-2.5">
              <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-[#4a443c] pb-1 border-b border-[#c5bcad]">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#d9480f]" /> PARAMÈTRES TOPO & SOLEIL
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Exagération Relief 3D</span>
                  <span className="font-bold">{terrainExaggeration.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="2.6"
                  step="0.05"
                  value={terrainExaggeration}
                  onChange={(e) => setTerrainExaggeration(parseFloat(e.target.value))}
                  className="w-full accent-[#d9480f]"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="flex items-center gap-1">
                    <Sun className="w-3 h-3 text-[#d9480f]" /> Azimut Solaire (Ombres)
                  </span>
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

            {/* Section 4 : Grille de Télémétrie Temps Réel */}
            <div className="bg-[#ded6c6] border border-[#c5bcad] rounded p-2.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#4a443c] mb-2 pb-1 border-b border-[#c5bcad] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#d9480f]" /> TÉLÉMÉTRIE DU SENTIER
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#e8e2d5] p-2 rounded border border-[#c5bcad]">
                  <div className="text-[10px] text-[#6e675c]">ALTITUDE</div>
                  <div className="text-base font-bold text-[#181715]">{currentTelemetry.ele} m</div>
                </div>
                <div className="bg-[#e8e2d5] p-2 rounded border border-[#c5bcad]">
                  <div className="text-[10px] text-[#6e675c]">INCLINAISON</div>
                  <div
                    className={`text-base font-bold ${
                      Math.abs(currentTelemetry.slopePct) > 20 ? 'text-[#d9480f]' : 'text-[#181715]'
                    }`}
                  >
                    {currentTelemetry.slopePct}%
                  </div>
                </div>
                <div className="bg-[#e8e2d5] p-2 rounded border border-[#c5bcad]">
                  <div className="text-[10px] text-[#6e675c]">TEMPÉRATURE</div>
                  <div className="text-base font-bold text-[#181715]">{currentTelemetry.tempC} °C</div>
                </div>
                <div className="bg-[#e8e2d5] p-2 rounded border border-[#c5bcad]">
                  <div className="text-[10px] text-[#6e675c]">VENT CRÊTE</div>
                  <div className="text-base font-bold text-[#181715]">
                    {currentTelemetry.windKmh} km/h
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5 : Liste des Waypoints cliquables */}
            <div className="bg-[#ded6c6] border border-[#c5bcad] rounded p-2.5">
              <div className="font-bold text-[11px] uppercase tracking-wider text-[#4a443c] mb-2 pb-1 border-b border-[#c5bcad]">
                SEGMENTS CLÉS (ACCÈS DIRECT)
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {TMB_TRAIL.filter((p) => p.name).map((pt) => (
                  <button
                    key={pt.id}
                    onClick={() => {
                      const targetProgress = (pt.id / (TMB_TRAIL.length - 1)) * 100;
                      setProgress(targetProgress);
                      mapRef.current?.flyTo({
                        center: [pt.lng, pt.lat],
                        zoom: 15.2,
                        pitch: 72,
                        duration: 1200,
                      });
                    }}
                    className="w-full text-left px-2 py-1 rounded bg-[#e8e2d5] hover:bg-[#d8cfc0] flex items-center justify-between text-[11px] transition"
                  >
                    <span className="font-semibold truncate">{pt.name}</span>
                    <span className="text-[#d9480f] font-bold">{pt.ele}m</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bouton Export GPX */}
          <button
            onClick={() => {
              setExportNotice('Export GPX & Rapport Topographique LKDV généré.');
              setTimeout(() => setExportNotice(null), 3500);
            }}
            className="mt-3 w-full py-2 bg-[#1c1b18] hover:bg-[#312f2a] text-[#f4efe6] font-bold rounded flex items-center justify-center gap-2 text-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-[#ff7b3a]" />
            EXPORTER GPX & PACK ÉQUIPEMENT
          </button>
        </aside>
      </div>

      {/* DOCK INFÉRIEUR : TIMELINE & MULTI-GRAPHIQUES TÉLÉMÉTRIQUES (COMME EN BAS DE LA VIDÉO) */}
      <footer className="h-44 bg-[#e6dfd3] border-t border-[#c5bcad] px-4 py-2 flex flex-col justify-between z-30">
        {/* Barre de contrôle du lecteur + Scrubber */}
        <div className="flex items-center gap-3 md:gap-4 border-b border-[#c5bcad] pb-2 overflow-x-auto">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded bg-[#d9480f] text-white flex items-center justify-center hover:bg-[#b83b0a] transition shadow shrink-0"
            aria-label={isPlaying ? 'Mettre en pause' : 'Lancer la simulation 3D'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Sélecteur de vitesse */}
          <div className="flex items-center gap-1 bg-[#d8d0c2] p-0.5 rounded border border-[#c5bcad] shrink-0">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  speed === s ? 'bg-[#1c1b18] text-white' : 'text-[#4a443c] hover:bg-[#cac1b0]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Scrubber temporel */}
          <div className="flex-1 flex items-center gap-2 md:gap-3 min-w-[200px]">
            <span className="text-[11px] font-bold w-16 shrink-0">KM {currentTelemetry.distKm}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={(e) => setProgress(parseFloat(e.target.value))}
              className="flex-1 accent-[#d9480f] cursor-pointer min-w-[100px]"
            />
            <span className="text-[11px] font-bold w-16 text-right shrink-0">24.5 KM</span>
          </div>

          <div className="text-[11px] font-bold text-[#4a443c] bg-[#d8d0c2] px-2.5 py-1 rounded shrink-0 hidden sm:inline-block">
            D+ CUMULÉ : 1 840 m | D- : 1 710 m
          </div>
        </div>

        {/* 3 Graphiques synchronisés côte à côte (Profil Altimétrique, Pente & Exposition, Vent & Thermique) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 flex-1 pt-2 overflow-x-auto">
          {/* GRAPHE 1 : PROFIL ALTIMÉTRIQUE (DEM ELEVATION) */}
          <div className="bg-[#dfd8c8] border border-[#c5bcad] rounded p-2 flex flex-col justify-between relative overflow-hidden min-w-[220px]">
            <div className="flex justify-between text-[10px] font-bold text-[#4a443c]">
              <span>01 // PROFIL ALTIMÉTRIQUE (M)</span>
              <span className="text-[#d9480f]">{currentTelemetry.ele} m</span>
            </div>
            <svg className="w-full h-16 overflow-visible" viewBox="0 0 300 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9480f" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#d9480f" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <polygon
                fill="url(#eleGrad)"
                points={`0,60 ${TMB_TRAIL.map(
                  (p, i) => `${(i / (TMB_TRAIL.length - 1)) * 300},${60 - ((p.ele - 900) / 1400) * 52}`
                ).join(' ')} 300,60`}
              />
              <polyline
                fill="none"
                stroke="#d9480f"
                strokeWidth="2"
                points={TMB_TRAIL.map(
                  (p, i) => `${(i / (TMB_TRAIL.length - 1)) * 300},${60 - ((p.ele - 900) / 1400) * 52}`
                ).join(' ')}
              />
              {/* Curseur de progression */}
              <line
                x1={(progress / 100) * 300}
                y1="0"
                x2={(progress / 100) * 300}
                y2="60"
                stroke="#181715"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
            </svg>
            <div className="flex justify-between text-[9px] text-[#6e675c]">
              <span>Chamonix (1035m)</span>
              <span>Col de Voza (1657m)</span>
              <span>Col de Tricot (2120m)</span>
            </div>
          </div>

          {/* GRAPHE 2 : INCLINAISON DE PENTE & EFFORT (%) */}
          <div className="bg-[#dfd8c8] border border-[#c5bcad] rounded p-2 flex flex-col justify-between relative overflow-hidden min-w-[220px]">
            <div className="flex justify-between text-[10px] font-bold text-[#4a443c]">
              <span>02 // GRADIENT DE PENTE & RISQUE (%)</span>
              <span className="text-[#b83200]">{currentTelemetry.slopePct}%</span>
            </div>
            <div className="flex items-end gap-1 h-16 pt-2">
              {TMB_TRAIL.map((p, idx) => {
                const heightPct = Math.min(100, Math.max(15, Math.abs(p.slopePct) * 3));
                const isCurrent = Math.round((progress / 100) * (TMB_TRAIL.length - 1)) === idx;
                return (
                  <div key={p.id} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        isCurrent
                          ? 'bg-[#181715]'
                          : Math.abs(p.slopePct) > 20
                          ? 'bg-[#d9480f]'
                          : 'bg-[#8c8273]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-[#6e675c]">
              <span>Seuil Critique &gt; 25%</span>
              <span>Indice Exposition : {(currentTelemetry.riskLevel * 10).toFixed(1)}/10</span>
            </div>
          </div>

          {/* GRAPHE 3 : VENT EN CRÊTE & THERMIQUE (°C / KM/H) */}
          <div className="bg-[#dfd8c8] border border-[#c5bcad] rounded p-2 flex flex-col justify-between relative overflow-hidden min-w-[220px]">
            <div className="flex justify-between text-[10px] font-bold text-[#4a443c]">
              <span>03 // MÉTÉO CRÊTE (VENT & THERMIQUE)</span>
              <span className="text-[#181715]">
                {currentTelemetry.tempC}°C · {currentTelemetry.windKmh} km/h
              </span>
            </div>
            <svg className="w-full h-16 overflow-visible" viewBox="0 0 300 60" preserveAspectRatio="none">
              {/* Courbe Vent */}
              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                points={TMB_TRAIL.map(
                  (p, i) => `${(i / (TMB_TRAIL.length - 1)) * 300},${60 - (p.windKmh / 55) * 50}`
                ).join(' ')}
              />
              {/* Courbe Température */}
              <polyline
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                points={TMB_TRAIL.map(
                  (p, i) => `${(i / (TMB_TRAIL.length - 1)) * 300},${60 - (p.tempC / 22) * 50}`
                ).join(' ')}
              />
              <line
                x1={(progress / 100) * 300}
                y1="0"
                x2={(progress / 100) * 300}
                y2="60"
                stroke="#181715"
                strokeWidth="1.5"
                strokeDasharray="2,2"
              />
            </svg>
            <div className="flex justify-between text-[9px] text-[#6e675c]">
              <span className="text-[#dc2626] font-bold">■ Température (°C)</span>
              <span className="text-[#2563eb] font-bold">■ Rafales Vent (km/h)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
