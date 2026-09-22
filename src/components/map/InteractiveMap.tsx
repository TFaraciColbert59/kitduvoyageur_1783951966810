'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import type { UnifiedPOI } from '@/lib/queries/pois';
import { XIcon as XAnimated } from '@/components/icons/x';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  ListItem,
  LoadingState,
  SearchField,
  Sheet,
  Spinner,
  Tabs,
} from '@/components/ui';

interface MapTrail {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  duration_hours: number | null;
  difficulty: string | null;
  elevation_gain: number | null;
  terrain_type: string | null;
  family_friendly: boolean;
  geojson: any | null;
}

const DEFAULT_CENTER: [number, number] = [45.9237, 6.8694]; // Chamonix-Mont-Blanc (Haut-lieu de la randonnée)

function getDifficultyColor(diff: string | null | undefined): string {
  if (!diff) return '#5B7F55';
  const d = diff.toLowerCase();
  if (d.includes('facile') || d.includes('easy')) return '#5B7F55';
  if (d.includes('modéré') || d.includes('moderate')) return '#C89A3B';
  if (d.includes('difficile') || d.includes('hard')) return '#A8443A';
  if (d.includes('expert')) return '#4B6B7C';
  return '#5B7F55';
}

function toGeoJSONFeature(geo: any) {
  if (!geo) return null;
  const parsed = typeof geo === 'string' ? JSON.parse(geo) : geo;
  if (parsed.type === 'FeatureCollection' || parsed.type === 'Feature') {
    return parsed;
  }
  if (parsed.type === 'MultiLineString' || parsed.type === 'LineString' || parsed.type === 'Polygon') {
    return {
      type: 'Feature',
      properties: {},
      geometry: parsed,
    };
  }
  return parsed;
}

// Distance Haversine en km
function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DISTANCE_RANGES = [
  { id: 'default', label: 'Toutes (≥ 2 km)', min: 2, max: null },
  { id: '2-5', label: '2 – 5 km', min: 2, max: 5 },
  { id: '5-10', label: '5 – 10 km', min: 5, max: 10 },
  { id: '10-20', label: '10 – 20 km', min: 10, max: 20 },
  { id: '20-30', label: '20 – 30 km', min: 20, max: 30 },
  { id: '30plus', label: '30 km+', min: 30, max: null },
  { id: 'under2', label: '< 2 km (Incomplets)', min: 0, max: 2, includeShort: true },
];

const DIFFICULTIES = [
  { id: 'all', label: 'Toutes difficultés' },
  { id: 'facile', label: 'Facile' },
  { id: 'modérée', label: 'Modérée' },
  { id: 'difficile', label: 'Difficile' },
  { id: 'expert', label: 'Expert' },
];

export default function InteractiveMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const userMarkerRef = useRef<any>(null);

  // States for data
  const [trails, setTrails] = useState<MapTrail[]>([]);
  const [pois, setPois] = useState<UnifiedPOI[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setPoisLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('Localisation en cours…');

  // "Rechercher dans cette zone" manual trigger state
  const [hasMovedFromLoadedArea, setHasMovedFromLoadedArea] = useState(false);
  const [isSearchingZone, setIsSearchingZone] = useState(false);
  const currentLoadedCenterRef = useRef<[number, number] | null>(null);

  // Selected Trail & POI (Strictly 1 trace at a time)
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedTrailGeojson, setSelectedTrailGeojson] = useState<any | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter States
  const [selectedDistanceRange, setSelectedDistanceRange] = useState<string>('default');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  
  // Strict Category Filter Checkboxes (unchecked categories will NEVER appear on map)
  const [showTrails, setShowTrails] = useState(true);
  const [showRefuges, setShowRefuges] = useState(true);
  const [showSummits, setShowSummits] = useState(true);
  const [showWaterPoints, setShowWaterPoints] = useState(true);
  const [showViewpoints, setShowViewpoints] = useState(true);
  const [showCampings, setShowCampings] = useState(true);

  const [mapReady, setMapReady] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // 1. Core 10km Radius Data Fetcher (Zero lag, strictly loads only ~10km radius around given center)
  const load10kmRadiusData = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setPoisLoading(true);
    setIsSearchingZone(true);
    setHasMovedFromLoadedArea(false);
    currentLoadedCenterRef.current = [lat, lng];

    const deltaLat = 0.09; // ~10km
    const deltaLng = 0.13 / Math.cos((lat * Math.PI) / 180);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    const poiParams = new URLSearchParams({
      min_lat: minLat.toFixed(4),
      max_lat: maxLat.toFixed(4),
      min_lng: minLng.toFixed(4),
      max_lng: maxLng.toFixed(4),
      limit: '80',
    });

    const trailParams = new URLSearchParams({
      min_lat: minLat.toFixed(4),
      max_lat: maxLat.toFixed(4),
      min_lng: minLng.toFixed(4),
      max_lng: maxLng.toFixed(4),
      limit: '60',
    });

    const range = DISTANCE_RANGES.find(r => r.id === selectedDistanceRange) || DISTANCE_RANGES[0];
    if (range.min !== undefined && range.min !== null) trailParams.set('min_dist', range.min.toString());
    if (range.max !== undefined && range.max !== null) trailParams.set('max_dist', range.max.toString());
    if (range.includeShort) trailParams.set('include_short', 'true');
    if (selectedDifficulty !== 'all') trailParams.set('difficulty', selectedDifficulty);
    if (searchQuery.trim()) trailParams.set('search', searchQuery.trim());

    try {
      const [poisRes, trailsRes] = await Promise.all([
        fetch(`/api/pois?${poiParams.toString()}`),
        fetch(`/api/hikes?${trailParams.toString()}`),
      ]);

      const newPois = poisRes.ok ? await poisRes.json() : [];
      const newTrails = trailsRes.ok ? await trailsRes.json() : [];

      setPois(newPois || []);
      setTrails(newTrails || []);
    } catch (e) {
      console.warn('[InteractiveMap] 10km radius fetch error:', e);
    } finally {
      setLoading(false);
      setPoisLoading(false);
      setIsSearchingZone(false);
    }
  }, [selectedDistanceRange, selectedDifficulty, searchQuery]);

  // Handle "Rechercher dans cette zone" button click
  const handleSearchThisArea = () => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    load10kmRadiusData(center.lat, center.lng);
  };

  // 2. Fetch Real GeoJSON GPS Track ONLY when a trail is selected (one at a time)
  useEffect(() => {
    if (!selectedTrailId) {
      setSelectedTrailGeojson(null);
      return;
    }

    let isMounted = true;
    fetch(`/api/hikes/${selectedTrailId}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.geojson) {
          setSelectedTrailGeojson(data.geojson);
        }
      })
      .catch(err => {
        console.warn('Failed to load real GeoJSON track for hike:', selectedTrailId, err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTrailId]);

  const [tileMode, setTileMode] = useState<'osm' | 'topo' | 'satellite'>('osm');
  const tileLayerRef = useRef<any>(null);

  const handleTileChange = (mode: 'osm' | 'topo' | 'satellite') => {
    setTileMode(mode);
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      if (tileLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      const url = mode === 'topo'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
        : mode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
      
      const newLayer = L.tileLayer(url, {
        attribution: '&copy; OpenStreetMap / CARTO / Esri',
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 4,
      }).addTo(mapRef.current!);
      tileLayerRef.current = newLayer;
    });
  };

  const handleZoomIn = () => {
    if (mapRef.current && (mapRef.current as any)._loaded) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && (mapRef.current as any)._loaded) {
      mapRef.current.zoomOut();
    }
  };

  // 3. Initialize Leaflet Map with Geolocation & 10km initial radius
  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: DEFAULT_CENTER,
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
        fadeAnimation: false,
        markerZoomAnimation: true,
      } as any);

      L.control.attribution({ prefix: false }).addAttribution('© OSM France').addTo(map);

      const initialLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openstreetmap.fr">OSM France</a>',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 4,
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      mapRef.current = map;
      setMapReady(true);
      // 1. Initialisation de la carte Leaflet
      // Si géolocalisation disponible, on charge directement la position de l'utilisateur
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos: GeolocationPosition) => {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            setUserLocation([userLat, userLng]);
            setLocationLabel('Position actuelle (Rayon 10 km)');

            const userIcon = L.divIcon({
              html: `<div style="width:16px;height:16px;background:#17402C;border:3px solid #8BAF7C;border-radius:50%;box-shadow:0 0 0 4px rgba(23,64,44,0.3)"></div>`,
              className: '',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            if (userMarkerRef.current) {
              try { map.removeLayer(userMarkerRef.current); } catch {}
            }
            userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon }).addTo(map);

            map.setView([userLat, userLng], 13);
            currentLoadedCenterRef.current = [userLat, userLng];
            load10kmRadiusData(userLat, userLng);
          },
          () => {
            // Fallback si géolocalisation refusée ou indisponible : Chamonix
            setLocationLabel('Chamonix-Mont-Blanc (Rayon 10 km)');
            currentLoadedCenterRef.current = DEFAULT_CENTER;
            load10kmRadiusData(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        setLocationLabel('Chamonix-Mont-Blanc (Rayon 10 km)');
        currentLoadedCenterRef.current = DEFAULT_CENTER;
        load10kmRadiusData(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      }

      // Check if user panned away from loaded center (> 1.0 km) -> show "Rechercher dans cette zone"
      const handleMoveEnd = () => {
        if (!currentLoadedCenterRef.current) return;
        const currentCenter = map.getCenter();
        const dist = computeDistanceKm(
          currentLoadedCenterRef.current[0],
          currentLoadedCenterRef.current[1],
          currentCenter.lat,
          currentCenter.lng
        );
        if (dist > 1.0) {
          setHasMovedFromLoadedArea(true);
        }
      };

      map.on('moveend', handleMoveEnd);
      map.on('zoomend', () => setHasMovedFromLoadedArea(true));

      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 200);
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [load10kmRadiusData]);

  // Strict Filtered POIs based on checkboxes (If unchecked -> completely absent from map)
  const filteredPois = useMemo(() => {
    return pois.filter(p => {
      if (p.category === 'refuge' && !showRefuges) return false;
      if ((p.category === 'summit' || p.category === 'col') && !showSummits) return false;
      if ((p.category === 'water' || p.category === 'waterfall') && !showWaterPoints) return false;
      if (p.category === 'viewpoint' && !showViewpoints) return false;
      if (p.category === 'camping' && !showCampings) return false;
      return true;
    });
  }, [pois, showRefuges, showSummits, showWaterPoints, showViewpoints, showCampings]);

  // Strict Filtered Trails
  const filteredTrails = useMemo(() => {
    if (!showTrails) return [];
    return trails;
  }, [trails, showTrails]);

  // 4. Render Layers on Map (Ultra Lightweight, No Lag, Instant 60fps)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    Promise.all([
      import('leaflet'),
      import('leaflet.markercluster')
    ]).then(([LModule]) => {
      const L = LModule.default || LModule;

      if (layerGroupRef.current) {
        try { map.removeLayer(layerGroupRef.current); } catch {}
        layerGroupRef.current = null;
      }

      // Trail cluster group
      // @ts-expect-error markerClusterGroup plugin extension
      const trailClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        removeOutsideVisibleBounds: true,
        animateAddingMarkers: false,
        iconCreateFunction: function (cluster: any) {
          const count = cluster.getChildCount();
          const html = `
            <div style="
              background: #17402C;
              color: white;
              font-weight: 700;
              font-size: 11px;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(23,64,44,0.25);
              border: 2px solid white;
            ">${count}</div>
          `;
          return L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
        }
      });

      // POI cluster group
      // @ts-expect-error markerClusterGroup plugin extension
      const poiClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 35,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        removeOutsideVisibleBounds: true,
        animateAddingMarkers: false,
        iconCreateFunction: function (cluster: any) {
          const count = cluster.getChildCount();
          const html = `
            <div style="
              background: #2D6B4A;
              color: white;
              font-weight: 700;
              font-size: 11px;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(45,107,74,0.3);
              border: 2px solid #E4DED3;
            ">📍${count}</div>
          `;
          return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
        }
      });

      const linesGroup = L.layerGroup();

      // A. Render Quality Trail Markers / Pins (Only if showTrails is checked)
      if (showTrails) {
        filteredTrails.forEach(trail => {
          const isSelected = trail.id === selectedTrailId;

          if (trail.lat && trail.lng && !isNaN(trail.lat) && !isNaN(trail.lng)) {
            const label = trail.distance_km ? `${Number(trail.distance_km).toFixed(1)}km`.replace('.', ',').replace(',0', '') : trail.name.substring(0, 10);
            const iconHtml = `
              <div style="
                background: ${isSelected ? '#17402C' : 'white'};
                color: ${isSelected ? 'white' : '#17402C'};
                font-weight: 700;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 999px;
                box-shadow: 0 2px 6px rgba(23,64,44,0.12);
                white-space: nowrap;
                border: 1px solid ${isSelected ? '#17402C' : '#E4DED3'};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              ">${label}</div>
            `;

            const customIcon = L.divIcon({
              html: iconHtml,
              className: '',
              iconSize: [54, 24],
              iconAnchor: [27, 12]
            });

            const marker = L.marker([trail.lat, trail.lng], { icon: customIcon, zIndexOffset: isSelected ? 1000 : 1 });
            marker.on('click', () => {
              setSelectedTrailId(trail.id);
              setSelectedPoiId(null);
            });
            trailClusterGroup.addLayer(marker);
          }
        });
      }

      // B. Render SINGLE Selected Hike GPS Polyline Track (Only 1 at a time when selected)
      if (selectedTrailGeojson && selectedTrailId) {
        try {
          const cleanGeo = toGeoJSONFeature(selectedTrailGeojson);
          if (cleanGeo) {
            // Glow underlay
            const glowLayer = L.geoJSON(cleanGeo, {
              style: {
                color: '#5B7F55',
                weight: 10,
                opacity: 0.4,
                lineCap: 'round',
                lineJoin: 'round',
              }
            });
            linesGroup.addLayer(glowLayer);

            // Sharp Forest Green Route Line
            const geoLayer = L.geoJSON(cleanGeo, {
              style: {
                color: '#17402C',
                weight: 5.5,
                opacity: 1.0,
                lineCap: 'round',
                lineJoin: 'round',
              }
            });
            linesGroup.addLayer(geoLayer);

            // Fit bounds to the exact selected GPS track line
            try {
              const b = geoLayer.getBounds();
              if (b && b.isValid()) {
                map.fitBounds(b, { padding: [60, 60], maxZoom: 15 });
              }
            } catch {}
          }
        } catch (e) {
          console.warn('Invalid GeoJSON for trail:', selectedTrailId, e);
        }
      }

      // C. Render POIs strictly respecting checked categories
      filteredPois.forEach(poi => {
        const isSelected = poi.id === selectedPoiId;
        
        let emoji = '👁️';
        let bgColor = '#7C3AED';
        
        switch (poi.category) {
          case 'refuge':
            emoji = '🏡';
            bgColor = '#17402C';
            break;
          case 'summit':
          case 'col':
            emoji = '⛰️';
            bgColor = '#2D6B4A';
            break;
          case 'water':
            emoji = '💧';
            bgColor = '#0284C7';
            break;
          case 'waterfall':
            emoji = '🌊';
            bgColor = '#0EA5E9';
            break;
          case 'camping':
            emoji = '⛺';
            bgColor = '#16A34A';
            break;
          case 'viewpoint':
          default:
            emoji = '👁️';
            bgColor = '#7C3AED';
            break;
        }

        const poiIcon = L.divIcon({
          html: `
            <div style="
              background-color: ${bgColor};
              width: ${isSelected ? '34px' : '28px'};
              height: ${isSelected ? '34px' : '28px'};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              font-size: ${isSelected ? '15px' : '13px'};
              cursor: pointer;
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: transform 0.15s ease;
            ">${emoji}</div>
          `,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14]
        });

        const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon, zIndexOffset: isSelected ? 3000 : 2000 });
        
        // Rich Popup info
        const categoryLabel = poi.category === 'refuge' ? 'Refuge' : poi.category === 'summit' ? 'Sommet' : poi.category === 'water' ? 'Point d\'eau' : poi.category === 'viewpoint' ? 'Panorama' : poi.category === 'camping' ? 'Bivouac' : 'Point d\'intérêt';
        const altitudeStr = poi.altitude_m ? `<div style="font-size: 11px; font-weight: bold; color: #17402C; margin-top: 2px;">📈 Altitude : ${poi.altitude_m} m</div>` : '';
        const regionStr = poi.region ? `<div style="font-size: 10px; color: #5A7064;">📍 ${poi.region}${poi.country ? `, ${poi.country}` : ''}</div>` : '';
        const descStr = poi.details ? `<div style="font-size: 11px; color: #365233; margin-top: 3px;">${poi.details}</div>` : '';
        const potableBadge = poi.category === 'water' && poi.is_potable !== null && poi.is_potable !== undefined
          ? `<div style="font-size: 10px; font-weight: bold; color: ${poi.is_potable ? '#15803D' : '#B45309'}; margin-top: 2px;">${poi.is_potable ? '✅ Eau potable' : '⚠️ Non traitée / Filtrer'}</div>`
          : '';

        marker.bindPopup(`
          <div style="padding: 6px 8px; font-family: system-ui; min-width: 170px; max-width: 240px;">
            <div style="font-size: 10px; font-weight: 700; color: #5B7F55; text-transform: uppercase;">${emoji} ${categoryLabel}</div>
            <strong style="font-size: 13px; color: #17402C; display: block; margin: 1px 0 2px 0;">${poi.name}</strong>
            ${regionStr}
            ${altitudeStr}
            ${potableBadge}
            ${descStr}
          </div>
        `);

        marker.on('click', () => {
          setSelectedPoiId(poi.id);
          setSelectedTrailId(null);
        });
        poiClusterGroup.addLayer(marker);
      });

      if (showTrails) trailClusterGroup.addTo(map);
      poiClusterGroup.addTo(map);
      linesGroup.addTo(map);
      
      const parentGroup = L.layerGroup([trailClusterGroup, poiClusterGroup, linesGroup]);
      layerGroupRef.current = parentGroup;
    });
  }, [mapReady, filteredTrails, filteredPois, selectedTrailId, selectedTrailGeojson, selectedPoiId, showTrails]);

  // Recenter to user position or default
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;
    const target = userLocation || DEFAULT_CENTER;
    mapRef.current.flyTo(target, 13, { duration: 1.0 });
    load10kmRadiusData(target[0], target[1]);
  }, [userLocation, load10kmRadiusData]);

  const handleSelectTrail = useCallback((trail: MapTrail) => {
    setSelectedTrailId(trail.id);
    setSelectedPoiId(null);
    if (mapRef.current && trail.lat && trail.lng) {
      mapRef.current.flyTo([trail.lat, trail.lng], 13, { duration: 1.0 });
    }
  }, []);

  const selectedTrail = useMemo(() => {
    return filteredTrails.find(t => t.id === selectedTrailId) || null;
  }, [filteredTrails, selectedTrailId]);

  const selectedPoi = useMemo(() => {
    return filteredPois.find(p => p.id === selectedPoiId) || null;
  }, [filteredPois, selectedPoiId]);


// Liens-actions stylés comme les primitives canoniques (pas de <button> imbriqué).
const LINK_PILL =
  'inline-flex min-h-[36px] flex-1 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--card-content)] no-underline transition-transform active:scale-[var(--motion-press-scale)] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LINK_PILL_PRIMARY =
  'inline-flex min-h-[36px] flex-1 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-transparent bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-4)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] no-underline transition-transform active:scale-[var(--motion-press-scale)] hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LINK_ICON =
  'inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--card-content)] no-underline transition-transform active:scale-[var(--motion-press-scale)] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
  const filterPanel = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Header & Location Banner */}
      <div className="space-y-3 border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold tracking-tight text-[color:var(--lkv-text-primary)]">
              Carte Aventure
            </h2>
            <p className="flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-secondary)]">
              <span aria-hidden="true">📍</span>
              <span>{locationLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRecenter}
              title="Recentrer sur ma position (10 km)"
            >
              🎯 Ma zone
            </Button>
          </div>
        </div>

        {/* Distance Filter Chips */}
        <div className="space-y-1">
          <p className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
            Distance :
          </p>
          {/* data-visual-mask : le rendu backdrop-filter (verre) de la barre
              varie d'un run à l'autre en CI (~1,9 k px de diff stable sur
              /carte-interactive) alors que la mise en page est identique. */}
          <div data-visual-mask>
            <Tabs
              variant="scrollable"
              ariaLabel="Filtrer par distance"
              options={DISTANCE_RANGES.map((r) => ({ id: r.id, label: r.label }))}
              value={selectedDistanceRange}
              onChange={(id) => {
                setSelectedDistanceRange(id);
                if (currentLoadedCenterRef.current) {
                  load10kmRadiusData(currentLoadedCenterRef.current[0], currentLoadedCenterRef.current[1]);
                }
              }}
            />
          </div>
        </div>

        {/* Strict POI & Layer Category Chips */}
        <div className="space-y-2 rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] p-3 text-[length:var(--lkv-text-caption)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Filtres affichés :
            </span>
            <Badge tone="sage" className="font-mono">
              {filteredPois.length} POI{filteredPois.length > 1 ? 's' : ''} actif{filteredPois.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected={showTrails} onClick={() => setShowTrails((v) => !v)}>
              🗺️ Sentiers
            </Chip>
            <Chip selected={showRefuges} onClick={() => setShowRefuges((v) => !v)}>
              🏡 Refuges
            </Chip>
            <Chip selected={showSummits} onClick={() => setShowSummits((v) => !v)}>
              ⛰️ Sommets
            </Chip>
            <Chip selected={showWaterPoints} onClick={() => setShowWaterPoints((v) => !v)}>
              💧 Points d'eau
            </Chip>
            <Chip selected={showViewpoints} onClick={() => setShowViewpoints((v) => !v)}>
              👁️ Panoramas
            </Chip>
            <Chip selected={showCampings} onClick={() => setShowCampings((v) => !v)}>
              ⛺ Bivouacs
            </Chip>
          </div>
        </div>

        {/* Search Input */}
        <SearchField
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && currentLoadedCenterRef.current) {
              load10kmRadiusData(currentLoadedCenterRef.current[0], currentLoadedCenterRef.current[1]);
            }
          }}
          placeholder="Chercher dans cette zone..."
          aria-label="Chercher dans cette zone"
        />
      </div>

      {/* Trail Count Banner */}
      <div className="flex items-center justify-between border-b border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-4 py-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">
        <span className="font-bold">{filteredTrails.length} randonnée{filteredTrails.length !== 1 ? 's' : ''} (Rayon 10 km)</span>
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Fluide 60 fps</span>
      </div>

      {/* Trail List */}
      <div className="divide-y divide-[color:var(--lkv-border)]">
        {loading ? (
          <LoadingState compact label="Chargement de votre zone (10 km)..." />
        ) : filteredTrails.length === 0 ? (
          <EmptyState
            compact
            title="Aucune randonnée dans ce rayon de 10 km"
            description="Déplacez la carte et appuyez sur « Rechercher dans cette zone »."
          />
        ) : (
          filteredTrails.map((t) => {
            const isSelected = t.id === selectedTrailId;
            const diffColor = getDifficultyColor(t.difficulty);
            const stats = [
              t.distance_km ? `📏 ${Number(t.distance_km).toFixed(1)} km` : '📏 N/A',
              t.duration_hours ? `⏱️ ${t.duration_hours}h` : null,
              t.elevation_gain ? `📈 +${t.elevation_gain}m` : null,
            ]
              .filter(Boolean)
              .join('  ·  ');
            return (
              <ListItem
                key={t.id}
                as="div"
                selected={isSelected}
                onClick={() => handleSelectTrail(t)}
                title={t.name}
                subtitle={stats}
                metadata={
                  <Badge
                    className="border-transparent uppercase tracking-wider"
                    style={{ backgroundColor: `${diffColor}20`, color: isSelected ? 'var(--lkv-secondary-subtle)' : diffColor }}
                  >
                    {t.difficulty || 'Rando'}
                  </Badge>
                }
                className="px-4 py-3"
              />
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden font-sans">
      {/* ── SIDEBAR PANEL (desktop ; mobile = Sheet canonique) ── */}
      <div className="hidden overflow-hidden border-r border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] sm:flex sm:w-[380px] sm:shrink-0">
        {filterPanel}
      </div>
      {showMobileFilters && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setShowMobileFilters(false);
          }}
          title="Filtres"
          detent="large"
          dragToDismiss
        >
          <div className="-mx-[var(--space-5)] -mt-[var(--space-1)] flex min-h-0 flex-col">{filterPanel}</div>
        </Sheet>
      )}

      {/* ── MAP CONTAINER ── */}
      <div className="relative h-full min-h-[240px] flex-1 touch-none overscroll-none">
        <div ref={containerRef} className="z-0 h-full w-full touch-none overscroll-none" />

        {/* ── FLOATING BUTTON : "RECHERCHER DANS CETTE ZONE" (TRIGGERED ONLY ON DEMAND) ── */}
        {hasMovedFromLoadedArea && (
          <div className="pointer-events-auto absolute left-1/2 top-[calc(var(--safe-top)+14px)] z-[var(--z-fab)] -translate-x-1/2">
            <Button
              variant="primary"
              onClick={handleSearchThisArea}
              disabled={isSearchingZone}
              className="min-h-[38px] px-4 shadow-lg"
            >
              <span className={isSearchingZone ? 'inline-flex' : 'inline-flex'}>
                {isSearchingZone ? <Spinner size="xs" tone="inverted" label="" /> : '🔄'}
              </span>
              <span>{isSearchingZone ? 'Chargement en cours…' : 'Rechercher dans cette zone'}</span>
            </Button>
          </div>
        )}

        {/* ── ERGONOMIC FLOATING CONTROLS (APPLE HIG RIGOR) ── */}

        {/* 1. Mobile Filter Toggle Button (Top Left) */}
        {!showMobileFilters && (
          <div className="absolute left-3 top-[calc(var(--safe-top)+14px)] z-[var(--z-fab)] sm:hidden">
            <Button
              variant="secondary"
              onClick={() => setShowMobileFilters(true)}
              className="min-h-[42px] px-4 shadow-lg"
              aria-label="Ouvrir les filtres"
            >
              <span aria-hidden="true">🔍</span>
              <span>Filtres</span>
              <Badge tone="stone">{filteredPois.length}</Badge>
            </Button>
          </div>
        )}

        {/* 2. Floating Tile Switcher (EN BAS À GAUCHE) */}
        <div className="absolute bottom-[var(--map-control-bottom)] left-3.5 z-[var(--z-fab)] md:bottom-6 md:left-4">
          <Card variant="featured" className="flex items-center gap-1.5 rounded-full p-1 shadow-md">
            <IconButton
              variant={tileMode === 'osm' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => handleTileChange('osm')}
              title="Carte Standard (OSM)"
              aria-label="Carte Standard (OSM)"
              aria-pressed={tileMode === 'osm'}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path><path d="M9 3v12"></path><path d="M15 6v12"></path>
              </svg>
            </IconButton>
            <IconButton
              variant={tileMode === 'topo' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => handleTileChange('topo')}
              title="Relief / Topographique"
              aria-label="Relief / Topographique"
              aria-pressed={tileMode === 'topo'}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
              </svg>
            </IconButton>
            <IconButton
              variant={tileMode === 'satellite' ? 'solid' : 'ghost'}
              size="sm"
              onClick={() => handleTileChange('satellite')}
              title="Vue Satellite"
              aria-label="Vue Satellite"
              aria-pressed={tileMode === 'satellite'}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>
              </svg>
            </IconButton>
          </Card>
        </div>

        {/* 3. Floating Zoom Controls (+ / −) & Recenter (EN BAS À DROITE) */}
        <div className="absolute bottom-[var(--map-control-bottom)] right-3.5 z-[var(--z-fab)] md:bottom-6 md:right-4">
          <Card variant="featured" className="flex flex-col items-center gap-1 rounded-full p-1 shadow-md">
            <IconButton
              variant="glass"
              size="sm"
              onClick={handleRecenter}
              title="Ma position (10 km)"
              aria-label="Ma position"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="1" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="23" />
                <line x1="1" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="23" y2="12" />
              </svg>
            </IconButton>
            <Divider orientation="vertical" spacing="none" className="h-px w-4" />
            <IconButton
              variant="glass"
              size="sm"
              onClick={handleZoomIn}
              title="Zoom avant"
              aria-label="Zoom avant"
              className="font-bold"
            >
              +
            </IconButton>
            <Divider orientation="vertical" spacing="none" className="h-px w-4" />
            <IconButton
              variant="glass"
              size="sm"
              onClick={handleZoomOut}
              title="Zoom arrière"
              aria-label="Zoom arrière"
              className="font-bold"
            >
              −
            </IconButton>
          </Card>
        </div>

        {/* Selected Trail Overlay Card (Real GPS Track Loaded) */}
        {selectedTrail && (
          <div className="pointer-events-auto absolute bottom-[calc(var(--map-control-bottom)-var(--space-1))] left-1/2 z-[var(--z-fab)] w-full max-w-sm -translate-x-1/2 px-4">
            <Card variant="featured" className="relative p-4">
              <IconButton
                variant="glass"
                size="sm"
                onClick={() => setSelectedTrailId(null)}
                className="absolute right-2 top-2"
                aria-label="Fermer la fiche du sentier"
              >
                <XAnimated size={12} />
              </IconButton>

              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone="sage" className="font-mono uppercase tracking-widest">
                  Randonnée Sélectionnée
                </Badge>
                {selectedTrailGeojson && (
                  <Badge tone="info" className="font-mono">Tracé GPS Réel ✓</Badge>
                )}
              </div>

              <h3 className="mb-2 mt-1 pr-6 font-display text-[length:var(--lkv-text-title-sm)] font-bold leading-tight text-[color:var(--lkv-text-primary)]">
                {selectedTrail.name}
              </h3>

              <div className="mb-3 flex items-center gap-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-2.5 font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">
                <div>
                  <p className="text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Distance</p>
                  <p className="font-bold">{selectedTrail.distance_km ? `${Number(selectedTrail.distance_km).toFixed(1)} km` : 'N/A'}</p>
                </div>
                {selectedTrail.duration_hours && (
                  <div>
                    <p className="text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Durée</p>
                    <p className="font-bold">{selectedTrail.duration_hours}h</p>
                  </div>
                )}
                {selectedTrail.elevation_gain && (
                  <div>
                    <p className="text-[length:var(--lkv-text-caption-2)] font-bold uppercase text-[color:var(--lkv-text-muted)]">Dénivelé</p>
                    <p className="font-bold">+{selectedTrail.elevation_gain}m</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[color:var(--lkv-border)] pt-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTrail.lat},${selectedTrail.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_PILL_PRIMARY}
                >
                  <span aria-hidden="true">🧭</span>
                  <span>Point de départ</span>
                </a>
                <Link
                  href={`/preparer-sentier/${selectedTrail.id}`}
                  prefetch={false}
                  className={LINK_PILL}
                >
                  Préparer
                </Link>
              </div>
            </Card>
          </div>
        )}

        {/* Selected POI Overlay Card (Rich Information & Actionable Details) */}
        {selectedPoi && (
          <div className="pointer-events-auto absolute bottom-[calc(var(--map-control-bottom)-var(--space-1))] left-1/2 z-[var(--z-fab)] w-full max-w-sm -translate-x-1/2 px-4">
            <Card variant="featured" className="relative p-4">
              <IconButton
                variant="glass"
                size="sm"
                onClick={() => setSelectedPoiId(null)}
                className="absolute right-2 top-2"
                aria-label="Fermer la fiche du point d'intérêt"
              >
                <XAnimated size={12} />
              </IconButton>

              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone="sage" className="font-mono uppercase tracking-wider">
                  {selectedPoi.category === 'refuge' ? '🏡 Refuge' : selectedPoi.category === 'summit' ? '⛰️ Sommet' : selectedPoi.category === 'water' ? '💧 Point d\'eau' : selectedPoi.category === 'viewpoint' ? '👁️ Panorama' : selectedPoi.category === 'camping' ? '⛺ Bivouac / Camping' : selectedPoi.category === 'waterfall' ? '🌊 Cascade' : '⛰️ Col'}
                </Badge>
                {selectedPoi.is_verified && (
                  <Badge tone="info" className="font-mono">Vérifié ✓</Badge>
                )}
                {selectedPoi.altitude_m && (
                  <Badge tone="stone" className="font-mono">
                    📈 {selectedPoi.altitude_m} m
                  </Badge>
                )}
              </div>

              <h3 className="mb-1 mt-1 pr-6 font-display text-[length:var(--lkv-text-title-sm)] font-bold leading-tight text-[color:var(--lkv-text-primary)]">
                {selectedPoi.name}
              </h3>

              {/* Geographical Massif / Region context */}
              {(selectedPoi.massif || selectedPoi.region) && (
                <p className="mb-2 text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-muted)]">
                  📍 {[selectedPoi.massif, selectedPoi.region, selectedPoi.country].filter(Boolean).join(' · ')}
                </p>
              )}

              {/* Detailed Description */}
              {selectedPoi.details && (
                <p className="mb-3 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-2 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-secondary)]">
                  {selectedPoi.details}
                </p>
              )}

              {/* Category-specific specs */}
              {selectedPoi.category === 'refuge' && (
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-2 font-mono text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)]">
                  <div>
                    <span className="block text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">Capacité</span>
                    <span className="font-bold">{selectedPoi.capacity ? `${selectedPoi.capacity} couchages` : 'Ouvert'}</span>
                  </div>
                  <div>
                    <span className="block text-[length:var(--lkv-text-caption-2)] uppercase text-[color:var(--lkv-text-muted)]">Gardiennage</span>
                    <span className="font-bold">{selectedPoi.is_staffed ? 'Gardé' : 'Libre / Non gardé'}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 border-t border-[color:var(--lkv-border)] pt-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoi.lat},${selectedPoi.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_PILL_PRIMARY}
                >
                  <span aria-hidden="true">🧭</span>
                  <span>Itinéraire GPS</span>
                </a>

                {selectedPoi.phone && (
                  <a
                    href={`tel:${selectedPoi.phone}`}
                    className={LINK_ICON}
                    title="Appeler"
                    aria-label="Appeler"
                  >
                    <span aria-hidden="true">📞</span>
                  </a>
                )}

                {selectedPoi.website && (
                  <a
                    href={selectedPoi.website.startsWith('http') ? selectedPoi.website : `https://${selectedPoi.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_ICON}
                    title="Site web officiel"
                    aria-label="Site web officiel"
                  >
                    <span aria-hidden="true">🌐</span>
                  </a>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
