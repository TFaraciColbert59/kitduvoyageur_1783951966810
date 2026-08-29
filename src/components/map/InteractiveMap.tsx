'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { createClient } from '@/lib/supabase/client';

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

interface MapPOI {
  id: string;
  name: string;
  type: 'refuge' | 'summit' | 'water' | 'viewpoint' | 'waterfall' | 'col' | 'camping';
  lat: number;
  lng: number;
  details: string;
  altitude?: number | null;
  source?: string;
  is_verified?: boolean;
}

function getDifficultyColor(diff: string | null | undefined): string {
  if (!diff) return '#5B7F55';
  const d = diff.toLowerCase();
  if (d.includes('facile') || d.includes('easy')) return '#5B7F55';
  if (d.includes('modéré') || d.includes('moderate')) return '#C89A3B';
  if (d.includes('difficile') || d.includes('hard')) return '#A8443A';
  if (d.includes('expert')) return '#4B6B7C';
  return '#5B7F55';
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

  const [trails, setTrails] = useState<MapTrail[]>([]);
  const [pois, setPois] = useState<MapPOI[]>([]);
  const [loading, setLoading] = useState(true);
  const [poisLoading, setPoisLoading] = useState(true);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter States
  const [selectedDistanceRange, setSelectedDistanceRange] = useState<string>('default');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  
  // Layer visibility toggles
  const [showTrails, setShowTrails] = useState(true);
  const [showRefuges, setShowRefuges] = useState(true);
  const [showSummits, setShowSummits] = useState(true);
  const [showWaterPoints, setShowWaterPoints] = useState(true);
  const [showViewpoints, setShowViewpoints] = useState(true);
  const [showCampings, setShowCampings] = useState(true);

  const [mapReady, setMapReady] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // 1. Fetch Trails with Server-side Filtering from /api/hikes
  const fetchTrails = useCallback(async () => {
    setLoading(true);
    try {
      const range = DISTANCE_RANGES.find(r => r.id === selectedDistanceRange) || DISTANCE_RANGES[0];
      const params = new URLSearchParams();

      if (range.min !== undefined && range.min !== null) params.set('min_dist', range.min.toString());
      if (range.max !== undefined && range.max !== null) params.set('max_dist', range.max.toString());
      if (range.includeShort) params.set('include_short', 'true');
      if (selectedDifficulty !== 'all') params.set('difficulty', selectedDifficulty);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/hikes?${params.toString()}`);
      const trailsData = res.ok ? await res.json() : [];
      setTrails(trailsData || []);
    } catch (err) {
      console.error('Error fetching filtered trails:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDistanceRange, selectedDifficulty, searchQuery]);

  useEffect(() => {
    fetchTrails();
  }, [fetchTrails]);

  // 2. Fetch Unified POIs from /api/pois
  useEffect(() => {
    async function loadPOIs() {
      setPoisLoading(true);
      try {
        const res = await fetch('/api/pois');
        if (!res.ok) throw new Error(`Failed to fetch POIs: ${res.status}`);
        const data = await res.json();

        const formattedPois: MapPOI[] = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name || 'Point d\'intérêt',
          type: p.category || 'viewpoint',
          lat: Number(p.lat),
          lng: Number(p.lng),
          altitude: p.altitude_m,
          details: p.details || (p.altitude_m ? `${p.altitude_m}m d'altitude` : ''),
          source: p.source,
          is_verified: p.is_verified,
        })).filter((p: any) => !isNaN(p.lat) && !isNaN(p.lng));

        setPois(formattedPois);
      } catch (err) {
        console.error('Error loading POIs from /api/pois:', err);
      } finally {
        setPoisLoading(false);
      }
    }
    loadPOIs();
  }, []);

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
        keepBuffer: 6,
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

  // 3. Initialize Leaflet Map
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
        center: [50.4, 2.8],
        zoom: 9,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        tap: false,
        preferCanvas: true,
        bounceAtZoomLimits: false,
      } as any);

      L.control.attribution({ prefix: false }).addAttribution('© OSM France').addTo(map);

      const initialLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openstreetmap.fr">OSM France</a>',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      mapRef.current = map;
      setMapReady(true);

      // Invalidation pour redimensionnement dynamique
      setTimeout(() => {
        try { map.invalidateSize(); } catch {}
      }, 150);
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Filtered POIs based on toggles
  const filteredPois = useMemo(() => {
    return pois.filter(p => {
      if (p.type === 'refuge' && !showRefuges) return false;
      if ((p.type === 'summit' || p.type === 'col') && !showSummits) return false;
      if ((p.type === 'water' || p.type === 'waterfall') && !showWaterPoints) return false;
      if (p.type === 'viewpoint' && !showViewpoints) return false;
      if (p.type === 'camping' && !showCampings) return false;
      return true;
    });
  }, [pois, showRefuges, showSummits, showWaterPoints, showViewpoints, showCampings]);

  // 4. Render Layers on Map
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
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: function (cluster: any) {
          const count = cluster.getChildCount();
          const html = `
            <div style="
              background: #17402C;
              color: white;
              font-weight: 700;
              font-size: 11px;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(23,64,44,0.25);
              border: 2px solid white;
            ">${count}</div>
          `;
          return L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
        }
      });

      // POI cluster group (distinct style and separate clustering)
      // @ts-expect-error markerClusterGroup plugin extension
      const poiClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 35,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: function (cluster: any) {
          const count = cluster.getChildCount();
          const html = `
            <div style="
              background: #2D6B4A;
              color: white;
              font-weight: 700;
              font-size: 11px;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(45,107,74,0.35);
              border: 2px solid #E4DED3;
            ">📍${count}</div>
          `;
          return L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
        }
      });

      const linesGroup = L.layerGroup();
      const allCoords: [number, number][] = [];

      // A. Render Quality Trails
      if (showTrails) {
        trails.forEach(trail => {
          const isSelected = trail.id === selectedTrailId;
          const diffColor = getDifficultyColor(trail.difficulty);
          
          let trailColor = '#5B7F55';
          switch ((trail.difficulty || '').toLowerCase()) {
            case 'facile': trailColor = '#5B7F55'; break;
            case 'modérée':
            case 'moderate': trailColor = '#C89A3B'; break;
            case 'difficile':
            case 'difficult': trailColor = '#A8443A'; break;
            case 'expert':
            case 'très difficile': trailColor = '#365233'; break;
          }

          if (trail.geojson && isSelected) {
            try {
              const geoLayer = L.geoJSON(trail.geojson, {
                style: {
                  color: '#17402C',
                  weight: 6,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round',
                }
              });

              geoLayer.bindPopup(`
                <div style="padding: 4px; font-family: system-ui;">
                  <h4 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #17402C;">${trail.name}</h4>
                  <p style="font-size: 12px; color: #365233; margin: 0;">
                    📏 <strong>${trail.distance_km ? `${Number(trail.distance_km).toFixed(1)} km` : 'N/A'}</strong> 
                    ${trail.duration_hours ? `· ⏱️ ${trail.duration_hours}h` : ''} 
                    ${trail.difficulty ? `· <span style="color:${trailColor};font-weight:bold;">${trail.difficulty}</span>` : ''}
                  </p>
                </div>
              `);

              geoLayer.on('click', () => {
                setSelectedTrailId(trail.id);
                setSelectedPoiId(null);
              });
              linesGroup.addLayer(geoLayer);
            } catch (e) {
              console.warn('Invalid GeoJSON for trail:', trail.id);
            }
          }

          if (trail.lat && trail.lng && !isNaN(trail.lat) && !isNaN(trail.lng)) {
            allCoords.push([trail.lat, trail.lng]);

            const label = trail.distance_km ? `${Number(trail.distance_km).toFixed(1)}km`.replace('.', ',').replace(',0', '') : trail.name.substring(0, 10);
            const iconHtml = `
              <div style="
                background: ${isSelected ? '#17402C' : 'white'};
                color: ${isSelected ? 'white' : '#17402C'};
                font-weight: 700;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 999px;
                box-shadow: 0 2px 6px rgba(23,64,44,0.08);
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

      // B. Render POIs with specific category styling
      filteredPois.forEach(poi => {
        allCoords.push([poi.lat, poi.lng]);
        const isSelected = poi.id === selectedPoiId;
        
        let emoji = '👁️';
        let bgColor = '#7C3AED';
        
        switch (poi.type) {
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
              width: ${isSelected ? '36px' : '30px'};
              height: ${isSelected ? '36px' : '30px'};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid white;
              box-shadow: 0 3px 8px rgba(0,0,0,0.35);
              font-size: ${isSelected ? '16px' : '14px'};
              cursor: pointer;
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: transform 0.15s ease;
            ">${emoji}</div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon, zIndexOffset: isSelected ? 3000 : 2000 });
        marker.bindPopup(`
          <div style="padding: 6px; font-family: system-ui; min-width: 160px;">
            <strong style="font-size: 13px; color: #17402C; display: block; margin-bottom: 2px;">${emoji} ${poi.name}</strong>
            ${poi.altitude ? `<span style="font-size: 11px; font-weight: 600; color: #5B7F55; display: block; margin-bottom: 2px;">📈 ${poi.altitude}m</span>` : ''}
            <p style="font-size: 11px; color: #365233; margin: 0;">${poi.details || 'Point d\'intérêt'}</p>
          </div>
        `);
        marker.on('click', () => {
          setSelectedPoiId(poi.id);
          setSelectedTrailId(null);
        });
        poiClusterGroup.addLayer(marker);
      });

      trailClusterGroup.addTo(map);
      poiClusterGroup.addTo(map);
      linesGroup.addTo(map);
      
      const parentGroup = L.layerGroup([trailClusterGroup, poiClusterGroup, linesGroup]);
      layerGroupRef.current = parentGroup;

      // Fit bounds when features load on initial load (focus on France outdoor region)
      if (allCoords.length > 0 && !selectedTrailId && !selectedPoiId) {
        try {
          const franceCoords = allCoords.filter(([lat, lng]) => lat >= 41.5 && lat <= 51.2 && lng >= -5.0 && lng <= 9.6);
          const targetCoords = franceCoords.length > 0 ? franceCoords : allCoords;
          const bounds = L.latLngBounds(targetCoords);
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
        } catch (e) {}
      }
    });
  }, [mapReady, trails, filteredPois, selectedTrailId, selectedPoiId, showTrails]);

  // Reset bounds to show all features (France hexagon)
  const handleResetBounds = useCallback(() => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      const coords: [number, number][] = [];
      trails.forEach(t => { if (t.lat && t.lng) coords.push([t.lat, t.lng]); });
      filteredPois.forEach(p => coords.push([p.lat, p.lng]));
      const franceCoords = coords.filter(([lat, lng]) => lat >= 41.5 && lat <= 51.2 && lng >= -5.0 && lng <= 9.6);
      const targetCoords = franceCoords.length > 0 ? franceCoords : coords;
      if (targetCoords.length > 0) {
        mapRef.current!.fitBounds(L.latLngBounds(targetCoords), { padding: [30, 30] });
      }
    });
  }, [trails, filteredPois]);

  const handleSelectTrail = useCallback((trail: MapTrail) => {
    setSelectedTrailId(trail.id);
    setSelectedPoiId(null);
    if (mapRef.current && trail.lat && trail.lng) {
      mapRef.current.flyTo([trail.lat, trail.lng], 13, { duration: 1.2 });
    }
  }, []);

  const selectedTrail = useMemo(() => {
    return trails.find(t => t.id === selectedTrailId) || null;
  }, [trails, selectedTrailId]);

  const selectedPoi = useMemo(() => {
    return pois.find(p => p.id === selectedPoiId) || null;
  }, [pois, selectedPoiId]);

  return (
    <div className="relative w-full h-full flex overflow-hidden font-sans bg-[#FAF8F5]">
      
      {/* ── SIDEBAR PANEL (scroll interne) ── */}
      <div className={`${showMobileFilters ? 'fixed inset-0 z-50 sm:relative sm:inset-auto flex flex-col' : 'hidden'} sm:flex sm:w-[400px] sm:shrink-0 bg-white border-r border-[#E4DED3] overflow-hidden`}>
        <div className="overflow-y-auto min-h-0 flex-1">
        
          {/* Header & Filters */}
          <div className="p-4 border-b border-[#E4DED3] bg-[#FAF8F5] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold tracking-tight text-lg text-[#17402C]">Carte des Randonnées</h2>
                <p className="text-[11px] text-[#365233] font-medium">Filtre qualité AllTrails (≥ 2 km)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="glass-capsule-btn secondary sm:hidden h-7 px-3 text-[11px] font-bold"
                >
                  ✕ Fermer
                </button>
                <button
                  onClick={handleResetBounds}
                  className="glass-capsule-btn secondary h-7 px-3 text-[11px] font-bold"
                >
                  Zoom global
                </button>
              </div>
            </div>

            {/* Distance Filter Chips */}
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-[#5A7064] uppercase font-bold tracking-wider">Distance du parcours :</p>
              <div className="glass-capsule-bar w-full overflow-x-auto flex-nowrap">
                {DISTANCE_RANGES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedDistanceRange(r.id)}
                    className={`glass-capsule-segment shrink-0 px-3 ${selectedDistanceRange === r.id ? 'active' : ''}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter Chips */}
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-[#5A7064] uppercase font-bold tracking-wider">Difficulté :</p>
              <div className="glass-capsule-bar w-full overflow-x-auto flex-nowrap">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDifficulty(d.id)}
                    className={`glass-capsule-segment shrink-0 px-3 ${selectedDifficulty === d.id ? 'active' : ''}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layer Visibility Checkboxes */}
            <div className="bg-[#FAF8F5] p-2.5 rounded-2xl border border-[#E4DED3] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#5A7064] uppercase tracking-wider">Couches & POIs :</span>
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
                placeholder="Chercher une randonnée..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
            <span className="font-bold">{trails.length} randonnée{trails.length !== 1 ? 's' : ''} de qualité affichée{trails.length !== 1 ? 's' : ''}</span>
            <span className="text-[10px] font-mono text-[#5A7064]">Backend SQL Filtered</span>
          </div>

          {/* Trail List */}
          <div className="divide-y divide-[#E4DED3]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#5A7064]">Filtrage et chargement des randonnées...</div>
            ) : trails.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5A7064]">Aucune randonnée ne correspond à ces critères.</div>
            ) : (
              trails.map(t => {
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
                      {t.geojson && <span className="text-sage-600 font-bold">🗺️ Tracé GPS</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter toggle FAB */}
      {!showMobileFilters && (
        <button
          onClick={() => setShowMobileFilters(true)}
          className="glass-capsule-btn primary sm:hidden fixed top-20 left-3 z-30 w-10 h-10 p-0 rounded-full justify-center text-sm"
          aria-label="Toggle filters"
        >
          🔍
        </button>
      )}

      {/* ── MAP CONTAINER ── */}
      <div className="flex-1 h-full relative min-h-[240px]" style={{ touchAction: 'none', overscrollBehavior: 'none' }}>
        <div ref={containerRef} className="w-full h-full z-0" style={{ width: '100%', height: '100%', touchAction: 'none', overscrollBehavior: 'none' }} />

        {/* Floating Zoom Controls */}
        <div className="absolute left-2 bottom-2 z-[400] flex flex-col gap-2">
          <div className="glass flex flex-col rounded-xl overflow-hidden text-[#17402C]">
            <button
              onClick={handleZoomIn}
              title="Zoom avant"
              className="w-8 h-8 flex items-center justify-center font-bold text-base hover:bg-sage-300/40 hover:text-[#17402C] transition-all border-b border-[#17402C]/10 cursor-pointer active:scale-95"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom arrière"
              className="w-8 h-8 flex items-center justify-center font-bold text-base hover:bg-sage-300/40 hover:text-[#17402C] transition-all cursor-pointer active:scale-95"
            >
              −
            </button>
          </div>
        </div>

        {/* Floating Tile Switcher */}
        <div className="glass absolute right-2 bottom-2 z-[400] flex items-center rounded-xl px-1 py-1 gap-1 shrink-0 flex-nowrap whitespace-nowrap">
          <button
            onClick={() => handleTileChange('osm')}
            className={`flex items-center rounded-xl transition-all cursor-pointer shrink-0 w-8 h-8 justify-center ${tileMode === 'osm' ? 'bg-[#17402C] text-white' : 'text-[#365233] hover:bg-sage-300/30 hover:text-[#17402C]'}`}
            title="Carte"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path><path d="M9 3v12"></path><path d="M15 6v12"></path>
            </svg>
          </button>
          <button
            onClick={() => handleTileChange('topo')}
            className={`flex items-center rounded-xl transition-all cursor-pointer shrink-0 w-8 h-8 justify-center ${tileMode === 'topo' ? 'bg-[#17402C] text-white' : 'text-[#365233] hover:bg-sage-300/30 hover:text-[#17402C]'}`}
            title="Relief"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
            </svg>
          </button>
          <button
            onClick={() => handleTileChange('satellite')}
            className={`flex items-center rounded-xl transition-all cursor-pointer shrink-0 w-8 h-8 justify-center ${tileMode === 'satellite' ? 'bg-[#17402C] text-white' : 'text-[#365233] hover:bg-sage-300/30 hover:text-[#17402C]'}`}
            title="Satellite"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>
            </svg>
          </button>
        </div>

        {/* Selected Trail Overlay Card */}
        {selectedTrail && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4"
            style={{ bottom: 'calc(var(--bottom-tab-base-height, 68px) + 12px)' }}
          >
            <div className="bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] rounded-[12px] p-5 relative shadow-lg backdrop-blur-md">
              <button 
                onClick={() => setSelectedTrailId(null)}
                className="absolute top-4 right-4 text-[#17402C]/60 hover:text-[#17402C] text-xs bg-[#17402C]/10 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
              
              <span className="text-[9px] font-mono tracking-widest text-[#365233] uppercase">Randonnée Sélectionnée</span>
              <h3 className="font-display font-bold text-lg leading-tight mt-1 mb-2 pr-6 text-[#17402C]">{selectedTrail.name}</h3>
              
              <div className="flex items-center gap-4 text-xs font-mono text-[#17402C] mb-4 bg-[#17402C]/5 p-3 rounded-[9px]">
                <div>
                  <p className="text-[9px] text-[#5A7064] uppercase">Distance</p>
                  <p className="font-bold">{selectedTrail.distance_km ? `${Number(selectedTrail.distance_km).toFixed(1)} km` : 'N/A'}</p>
                </div>
                {selectedTrail.duration_hours && (
                  <div>
                    <p className="text-[9px] text-[#5A7064] uppercase">Durée</p>
                    <p className="font-bold">{selectedTrail.duration_hours}h</p>
                  </div>
                )}
                {selectedTrail.elevation_gain && (
                  <div>
                    <p className="text-[9px] text-[#5A7064] uppercase">Dénivelé</p>
                    <p className="font-bold">+{selectedTrail.elevation_gain}m</p>
                  </div>
                )}
              </div>

              {selectedTrail.geojson ? (
                <div className="flex items-center gap-2 text-xs text-sage-600 font-semibold">
                  <span>✅ Tracé GPS de qualité affiché sur la carte</span>
                </div>
              ) : (
                <div className="text-xs text-[#365233]">Point de départ affiché sur la carte</div>
              )}
            </div>
          </div>
        )}

        {/* Selected POI Overlay Card */}
        {selectedPoi && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4"
            style={{ bottom: 'calc(var(--bottom-tab-base-height, 68px) + 12px)' }}
          >
            <div className="bg-[rgba(255,255,255,0.95)] border border-[#E4DED3] rounded-[14px] p-5 relative shadow-xl backdrop-blur-md">
              <button 
                onClick={() => setSelectedPoiId(null)}
                className="absolute top-4 right-4 text-[#17402C]/60 hover:text-[#17402C] text-xs bg-[#17402C]/10 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono tracking-wider font-bold text-[#17402C] uppercase bg-[#17402C]/10 px-2 py-0.5 rounded-md">
                  {selectedPoi.type === 'refuge' ? '🏡 Refuge' : selectedPoi.type === 'summit' ? '⛰️ Sommet' : selectedPoi.type === 'water' ? '💧 Point d\'eau' : selectedPoi.type === 'viewpoint' ? '👁️ Panorama' : selectedPoi.type === 'camping' ? '⛺ Bivouac / Camping' : selectedPoi.type === 'waterfall' ? '🌊 Cascade' : '⛰️ Col'}
                </span>
                {selectedPoi.is_verified && (
                  <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Vérifié ✓</span>
                )}
              </div>

              <h3 className="font-display font-bold text-lg leading-tight mt-1.5 mb-2 pr-6 text-[#17402C]">{selectedPoi.name}</h3>
              
              {selectedPoi.details && (
                <p className="text-xs text-[#365233] leading-relaxed mb-3">
                  {selectedPoi.details}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] font-mono text-[#5A7064] pt-2 border-t border-[#E4DED3]">
                <span>📍 {selectedPoi.lat.toFixed(4)}, {selectedPoi.lng.toFixed(4)}</span>
                {selectedPoi.altitude ? <span className="font-bold text-[#17402C]">📈 {selectedPoi.altitude}m</span> : null}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
