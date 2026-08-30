'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import type { UnifiedPOI } from '@/lib/queries/pois';

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

      // Load default location (Chamonix) IMMEDIATELY for instant zero-wait startup
      setLocationLabel('Chamonix-Mont-Blanc (Rayon 10 km)');
      currentLoadedCenterRef.current = DEFAULT_CENTER;
      load10kmRadiusData(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);

      // Asynchronous Geolocation upgrade if user allows GPS
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos: GeolocationPosition) => {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            setUserLocation([userLat, userLng]);
            setLocationLabel('Position actuelle (Rayon 10 km)');

            const userIcon = L.divIcon({
              html: `
                <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
                  <div style="position:absolute;inset:0;border-radius:50%;background:#3B82F6;opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
                  <div style="width:14px;height:14px;border-radius:50%;background:#2563EB;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
                </div>
              `,
              className: '',
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            });

            if (userMarkerRef.current) {
              map.removeLayer(userMarkerRef.current);
            }
            userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon, zIndexOffset: 5000 }).addTo(map);

            map.setView([userLat, userLng], 12);
            load10kmRadiusData(userLat, userLng);
          },
          () => {
            // Geolocation denied or unavailable -> keep default Chamonix
          },
          {
            timeout: 3000,
            maximumAge: 60000,
            enableHighAccuracy: true,
          }
        );
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

  return (
    <div className="relative w-full h-full flex overflow-hidden font-sans bg-[#FAF8F5]">
      
      {/* ── SIDEBAR PANEL (scroll interne) ── */}
      <div className={`${showMobileFilters ? 'fixed inset-0 z-50 sm:relative sm:inset-auto flex flex-col' : 'hidden'} sm:flex sm:w-[380px] sm:shrink-0 bg-white border-r border-[#E4DED3] overflow-hidden`}>
        <div className="overflow-y-auto min-h-0 flex-1">
        
          {/* Header & Location Banner */}
          <div className="p-4 border-b border-[#E4DED3] bg-[#FAF8F5] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold tracking-tight text-lg text-[#17402C]">Carte Aventure</h2>
                <p className="text-[11px] text-[#365233] font-semibold flex items-center gap-1">
                  <span>📍</span>
                  <span>{locationLabel}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="glass-capsule-btn secondary sm:hidden h-7 px-3 text-[11px] font-bold"
                >
                  ✕ Fermer
                </button>
                <button
                  onClick={handleRecenter}
                  className="glass-capsule-btn secondary h-7 px-3 text-[11px] font-bold"
                  title="Recentrer sur ma position (10 km)"
                >
                  🎯 Ma zone
                </button>
              </div>
            </div>

            {/* Distance Filter Chips */}
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-[#5A7064] uppercase font-bold tracking-wider">Distance :</p>
              <div className="glass-capsule-bar w-full overflow-x-auto flex-nowrap">
                {DISTANCE_RANGES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedDistanceRange(r.id);
                      if (currentLoadedCenterRef.current) {
                        load10kmRadiusData(currentLoadedCenterRef.current[0], currentLoadedCenterRef.current[1]);
                      }
                    }}
                    className={`glass-capsule-segment shrink-0 px-3 ${selectedDistanceRange === r.id ? 'active' : ''}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Strict POI & Layer Category Checkboxes */}
            <div className="bg-white p-3 rounded-2xl border border-[#E4DED3] text-xs space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#5A7064] uppercase tracking-wider">Filtres affichés :</span>
                <span className="text-[10px] font-mono text-emerald-800 font-bold bg-emerald-100/80 px-1.5 py-0.5 rounded">
                  {filteredPois.length} POI{filteredPois.length > 1 ? 's' : ''} actif{filteredPois.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showTrails} 
                    onChange={e => setShowTrails(e.target.checked)} 
                    className="rounded text-sage-600 focus:ring-0" 
                  />
                  <span className="font-semibold text-[#17402C]">🗺️ Sentiers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showRefuges} 
                    onChange={e => setShowRefuges(e.target.checked)} 
                    className="rounded text-sage-600 focus:ring-0" 
                  />
                  <span className="font-semibold text-[#17402C]">🏡 Refuges</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showSummits} 
                    onChange={e => setShowSummits(e.target.checked)} 
                    className="rounded text-sage-600 focus:ring-0" 
                  />
                  <span className="font-semibold text-[#17402C]">⛰️ Sommets</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showWaterPoints} 
                    onChange={e => setShowWaterPoints(e.target.checked)} 
                    className="rounded text-sage-600 focus:ring-0" 
                  />
                  <span className="font-semibold text-[#17402C]">💧 Points d'eau</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showViewpoints} 
                    onChange={e => setShowViewpoints(e.target.checked)} 
                    className="rounded text-sage-600 focus:ring-0" 
                  />
                  <span className="font-semibold text-[#17402C]">👁️ Panoramas</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showCampings} 
                    onChange={e => setShowCampings(e.target.checked)} 
                    className="rounded text-sage-600 focus:ring-0" 
                  />
                  <span className="font-semibold text-[#17402C]">⛺ Bivouacs</span>
                </label>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Chercher dans cette zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && currentLoadedCenterRef.current) {
                    load10kmRadiusData(currentLoadedCenterRef.current[0], currentLoadedCenterRef.current[1]);
                  }
                }}
                className="glass-input w-full pl-9 pr-8 py-2 text-xs text-[#17402C]"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#5A7064]">🔍</span>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5A7064]">✕</button>
              )}
            </div>
          </div>

          {/* Trail Count Banner */}
          <div className="px-4 py-2 bg-[#F1EDE6] border-b border-[#E4DED3] flex items-center justify-between text-xs text-[#365233]">
            <span className="font-bold">{filteredTrails.length} randonnée{filteredTrails.length !== 1 ? 's' : ''} (Rayon 10 km)</span>
            <span className="text-[10px] font-mono text-[#5A7064]">Fluide 60 fps</span>
          </div>

          {/* Trail List */}
          <div className="divide-y divide-[#E4DED3]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#5A7064]">Chargement de votre zone (10 km)...</div>
            ) : filteredTrails.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5A7064]">
                Aucune randonnée dans ce rayon de 10 km. Déplacez la carte et cliquez sur <strong>« Rechercher dans cette zone »</strong>.
              </div>
            ) : (
              filteredTrails.map(t => {
                const isSelected = t.id === selectedTrailId;
                const diffColor = getDifficultyColor(t.difficulty);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTrail(t)}
                    className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-[#17402C] text-white' : 'hover:bg-[#FAF8F5] bg-white text-[#17402C]'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className={`font-bold text-xs leading-snug ${isSelected ? 'text-white' : 'text-[#17402C]'}`}>{t.name}</h3>
                      <span 
                        className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2 flex-shrink-0"
                        style={{ backgroundColor: `${diffColor}20`, color: isSelected ? '#A6C1A0' : diffColor }}
                      >
                        {t.difficulty || 'Rando'}
                      </span>
                    </div>
                    
                    <div className={`flex items-center gap-3 text-[10px] mt-2 font-mono ${isSelected ? 'text-[#A6C1A0]' : 'text-[#5A7064]'}`}>
                      <span>📏 {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : 'N/A'}</span>
                      {t.duration_hours && <span>⏱️ {t.duration_hours}h</span>}
                      {t.elevation_gain && <span>📈 +{t.elevation_gain}m</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* ── MAP CONTAINER ── */}
      <div className="flex-1 h-full relative min-h-[240px]" style={{ touchAction: 'none', overscrollBehavior: 'none' }}>
        <div ref={containerRef} className="w-full h-full z-0" style={{ width: '100%', height: '100%', touchAction: 'none', overscrollBehavior: 'none' }} />

        {/* ── FLOATING BUTTON : "RECHERCHER DANS CETTE ZONE" (TRIGGERED ONLY ON DEMAND) ── */}
        {hasMovedFromLoadedArea && (
          <div className="absolute top-[calc(env(safe-area-inset-top,0px)+14px)] left-1/2 -translate-x-1/2 z-[500] pointer-events-auto">
            <button
              onClick={handleSearchThisArea}
              disabled={isSearchingZone}
              className="h-10 px-4.5 rounded-full bg-[#17402C] text-white font-bold text-xs shadow-lg border border-white/40 flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span className={isSearchingZone ? 'animate-spin' : ''}>🔄</span>
              <span>{isSearchingZone ? 'Chargement en cours…' : 'Rechercher dans cette zone'}</span>
            </button>
          </div>
        )}

        {/* ── ERGONOMIC FLOATING CONTROLS (APPLE HIG RIGOR) ── */}

        {/* 1. Mobile Filter Toggle Button (Top Left) */}
        {!showMobileFilters && (
          <button
            onClick={() => setShowMobileFilters(true)}
            className="sm:hidden absolute top-[calc(env(safe-area-inset-top,0px)+14px)] left-3 z-[400] h-9 px-3.5 rounded-full bg-white/95 backdrop-blur-md border border-white/80 text-[#17402C] font-bold text-xs shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            aria-label="Ouvrir les filtres"
          >
            <span>🔍</span>
            <span>Filtres</span>
            <span className="bg-[#17402C]/10 text-[#17402C] text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
              {filteredPois.length}
            </span>
          </button>
        )}

        {/* 2. Floating Zoom Controls (+ / −) & Recenter (Top Right) */}
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+14px)] right-3 z-[400] flex flex-col gap-1.5">
          <button
            onClick={handleZoomIn}
            title="Zoom avant"
            aria-label="Zoom avant"
            className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md border border-white/80 text-[#17402C] font-bold text-base shadow-md flex items-center justify-center hover:bg-white active:scale-95 transition-all cursor-pointer"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom arrière"
            aria-label="Zoom arrière"
            className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md border border-white/80 text-[#17402C] font-bold text-base shadow-md flex items-center justify-center hover:bg-white active:scale-95 transition-all cursor-pointer"
          >
            −
          </button>
          <button
            onClick={handleRecenter}
            title="Ma position (10 km)"
            aria-label="Ma position"
            className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-md border border-white/80 text-[#17402C] font-bold text-sm shadow-md flex items-center justify-center hover:bg-white active:scale-95 transition-all cursor-pointer"
          >
            🎯
          </button>
        </div>

        {/* 3. Floating Tile Switcher (Top Right, positioned neatly below Zoom) */}
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+140px)] right-3 z-[400] flex flex-col gap-1.5 bg-white/95 backdrop-blur-md border border-white/80 rounded-2xl p-1 shadow-md">
          <button
            onClick={() => handleTileChange('osm')}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${tileMode === 'osm' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#365233] hover:bg-[#17402C]/10'}`}
            title="Carte Standard (OSM)"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path><path d="M9 3v12"></path><path d="M15 6v12"></path>
            </svg>
          </button>
          <button
            onClick={() => handleTileChange('topo')}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${tileMode === 'topo' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#365233] hover:bg-[#17402C]/10'}`}
            title="Relief / Topographique"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
            </svg>
          </button>
          <button
            onClick={() => handleTileChange('satellite')}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${tileMode === 'satellite' ? 'bg-[#17402C] text-white shadow-xs' : 'text-[#365233] hover:bg-[#17402C]/10'}`}
            title="Vue Satellite"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>
            </svg>
          </button>
        </div>

        {/* Selected Trail Overlay Card (Real GPS Track Loaded) */}
        {selectedTrail && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4 pointer-events-auto"
            style={{ bottom: 'calc(var(--bottom-tab-base-height, 68px) + 12px)' }}
          >
            <div className="bg-[rgba(255,255,255,0.96)] border border-[#E4DED3] rounded-[16px] p-4.5 relative shadow-xl backdrop-blur-md">
              <button 
                onClick={() => setSelectedTrailId(null)}
                className="absolute top-4 right-4 text-[#17402C]/60 hover:text-[#17402C] text-xs bg-[#17402C]/10 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono tracking-widest text-[#365233] uppercase font-bold bg-sage-100/60 px-2 py-0.5 rounded">Randonnée Sélectionnée</span>
                {selectedTrailGeojson && (
                  <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Tracé GPS Réel ✓</span>
                )}
              </div>

              <h3 className="font-display font-bold text-base leading-tight mt-1 mb-2 pr-6 text-[#17402C]">{selectedTrail.name}</h3>
              
              <div className="flex items-center gap-3 text-xs font-mono text-[#17402C] mb-3 bg-[#17402C]/5 p-2.5 rounded-[10px]">
                <div>
                  <p className="text-[8px] text-[#5A7064] uppercase font-bold">Distance</p>
                  <p className="font-bold">{selectedTrail.distance_km ? `${Number(selectedTrail.distance_km).toFixed(1)} km` : 'N/A'}</p>
                </div>
                {selectedTrail.duration_hours && (
                  <div>
                    <p className="text-[8px] text-[#5A7064] uppercase font-bold">Durée</p>
                    <p className="font-bold">{selectedTrail.duration_hours}h</p>
                  </div>
                )}
                {selectedTrail.elevation_gain && (
                  <div>
                    <p className="text-[8px] text-[#5A7064] uppercase font-bold">Dénivelé</p>
                    <p className="font-bold">+{selectedTrail.elevation_gain}m</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E4DED3]">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTrail.lat},${selectedTrail.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-8 rounded-xl bg-gradient-to-b from-[#17402C] to-[#2D6B4A] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-110 active:scale-98 transition-all"
                >
                  <span>🧭</span>
                  <span>Point de départ</span>
                </a>
                <a
                  href={`/materiel/depart/none?route=${selectedTrail.id}`}
                  className="h-8 px-3 rounded-xl bg-[#FAF8F5] hover:bg-white text-[#17402C] text-xs font-bold border border-[#E4DED3] flex items-center justify-center transition-colors"
                >
                  Préparer
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Selected POI Overlay Card (Rich Information & Actionable Details) */}
        {selectedPoi && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4 pointer-events-auto"
            style={{ bottom: 'calc(var(--bottom-tab-base-height, 68px) + 12px)' }}
          >
            <div className="bg-[rgba(255,255,255,0.96)] border border-[#E4DED3] rounded-[16px] p-4.5 relative shadow-xl backdrop-blur-md">
              <button 
                onClick={() => setSelectedPoiId(null)}
                className="absolute top-4 right-4 text-[#17402C]/60 hover:text-[#17402C] text-xs bg-[#17402C]/10 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-mono tracking-wider font-bold text-[#17402C] uppercase bg-[#17402C]/10 px-2 py-0.5 rounded-md">
                  {selectedPoi.category === 'refuge' ? '🏡 Refuge' : selectedPoi.category === 'summit' ? '⛰️ Sommet' : selectedPoi.category === 'water' ? '💧 Point d\'eau' : selectedPoi.category === 'viewpoint' ? '👁️ Panorama' : selectedPoi.category === 'camping' ? '⛺ Bivouac / Camping' : selectedPoi.category === 'waterfall' ? '🌊 Cascade' : '⛰️ Col'}
                </span>
                {selectedPoi.is_verified && (
                  <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Vérifié ✓</span>
                )}
                {selectedPoi.altitude_m && (
                  <span className="text-[10px] font-mono font-bold text-[#17402C] bg-sage-200/50 px-1.5 py-0.5 rounded">
                    📈 {selectedPoi.altitude_m} m
                  </span>
                )}
              </div>

              <h3 className="font-display font-bold text-base leading-tight mt-1 mb-1 pr-6 text-[#17402C]">{selectedPoi.name}</h3>

              {/* Geographical Massif / Region context */}
              {(selectedPoi.massif || selectedPoi.region) && (
                <p className="text-[11px] font-medium text-[#5A7064] mb-2">
                  📍 {[selectedPoi.massif, selectedPoi.region, selectedPoi.country].filter(Boolean).join(' · ')}
                </p>
              )}
              
              {/* Detailed Description */}
              {selectedPoi.details && (
                <p className="text-xs text-[#365233] leading-relaxed mb-3 bg-[#FAF8F5] p-2 rounded-lg border border-[#E4DED3]/60">
                  {selectedPoi.details}
                </p>
              )}

              {/* Category-specific specs */}
              {selectedPoi.category === 'refuge' && (
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#17402C] mb-3 bg-[#17402C]/5 p-2 rounded-lg">
                  <div>
                    <span className="text-[#5A7064] block text-[9px] uppercase">Capacité</span>
                    <span className="font-bold">{selectedPoi.capacity ? `${selectedPoi.capacity} couchages` : 'Ouvert'}</span>
                  </div>
                  <div>
                    <span className="text-[#5A7064] block text-[9px] uppercase">Gardiennage</span>
                    <span className="font-bold">{selectedPoi.is_staffed ? 'Gardé' : 'Libre / Non gardé'}</span>
                  </div>
                </div>
              )}

              {selectedPoi.category === 'water' && selectedPoi.is_potable !== null && selectedPoi.is_potable !== undefined && (
                <div className={`p-2 rounded-lg mb-3 text-xs font-semibold flex items-center gap-2 ${selectedPoi.is_potable ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                  <span>{selectedPoi.is_potable ? '✅' : '⚠️'}</span>
                  <span>{selectedPoi.is_potable ? 'Eau potable contrôlée et potable' : 'Eau naturelle non traitée — filtration recommandée'}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#E4DED3]">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoi.lat},${selectedPoi.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-8 rounded-xl bg-gradient-to-b from-[#17402C] to-[#2D6B4A] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-110 active:scale-98 transition-all"
                >
                  <span>🧭</span>
                  <span>Itinéraire GPS</span>
                </a>
                
                {selectedPoi.phone && (
                  <a
                    href={`tel:${selectedPoi.phone}`}
                    className="h-8 px-3 rounded-xl bg-[#FAF8F5] hover:bg-white text-[#17402C] text-xs font-bold border border-[#E4DED3] flex items-center justify-center gap-1 transition-colors"
                    title="Appeler"
                  >
                    <span>📞</span>
                  </a>
                )}

                {selectedPoi.website && (
                  <a
                    href={selectedPoi.website.startsWith('http') ? selectedPoi.website : `https://${selectedPoi.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-xl bg-[#FAF8F5] hover:bg-white text-[#17402C] text-xs font-bold border border-[#E4DED3] flex items-center justify-center gap-1 transition-colors"
                    title="Site web officiel"
                  >
                    <span>🌐</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
