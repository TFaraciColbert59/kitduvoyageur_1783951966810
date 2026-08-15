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
  type: 'refuge' | 'summit' | 'water';
  lat: number;
  lng: number;
  details: string;
  altitude?: number | null;
}

function getDifficultyColor(diff: string | null | undefined): string {
  if (!diff) return '#22c55e';
  const d = diff.toLowerCase();
  if (d.includes('facile') || d.includes('easy')) return '#22c55e';
  if (d.includes('modéré') || d.includes('moderate')) return '#f97316';
  if (d.includes('difficile') || d.includes('hard')) return '#ef4444';
  if (d.includes('expert')) return '#7c3aed';
  return '#22c55e';
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
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);

  const [trails, setTrails] = useState<MapTrail[]>([]);
  const [pois, setPois] = useState<MapPOI[]>([]);
  const [loading, setLoading] = useState(true);
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

  // 2. Fetch POIs once
  useEffect(() => {
    async function loadPOIs() {
      try {
        const [
          { data: refuges },
          { data: summits },
          { data: waterPoints }
        ] = await Promise.all([
          supabase.from('map_refuges').select('*'),
          supabase.from('map_summits').select('*'),
          supabase.from('map_water_points').select('*')
        ]);

        const formattedPois: MapPOI[] = [
          ...(refuges || []).map((r: any) => ({
            id: `refuge-${r.id}`,
            name: r.name,
            type: 'refuge' as const,
            lat: Number(r.lat),
            lng: Number(r.lng),
            altitude: r.altitude_m,
            details: `🏡 Refuge · ${r.capacity ? `${r.capacity} lits` : 'Ouvert'} · ${r.price_per_night ? `${r.price_per_night}€/nuit` : ''}`
          })),
          ...(summits || []).map((s: any) => ({
            id: `summit-${s.id}`,
            name: s.name,
            type: 'summit' as const,
            lat: Number(s.lat),
            lng: Number(s.lng),
            altitude: s.altitude_m,
            details: `⛰️ Sommet · ${s.altitude_m ? `${s.altitude_m}m` : ''} · ${s.massif || ''}`
          })),
          ...(waterPoints || []).map((w: any) => ({
            id: `water-${w.id}`,
            name: w.name,
            type: 'water' as const,
            lat: Number(w.lat),
            lng: Number(w.lng),
            altitude: w.altitude_m,
            details: `💧 Point d'eau · ${w.is_potable ? 'Eau potable ✅' : 'Non potable ⚠️'}`
          }))
        ].filter(p => !isNaN(p.lat) && !isNaN(p.lng));

        setPois(formattedPois);
      } catch (err) {
        console.error('Error loading POIs:', err);
      }
    }
    loadPOIs();
  }, [supabase]);

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
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      
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
      });

      const initialLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
        maxNativeZoom: 18,
        keepBuffer: 6,
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      mapRef.current = map;
      setMapReady(true);
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
      if (p.type === 'summit' && !showSummits) return false;
      if (p.type === 'water' && !showWaterPoints) return false;
      return true;
    });
  }, [pois, showRefuges, showSummits, showWaterPoints]);

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

      // @ts-expect-error markerClusterGroup plugin extension
      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: function (cluster: any) {
          const count = cluster.getChildCount();
          const html = `
            <div style="
              background: #1C2620;
              color: white;
              font-weight: 700;
              font-size: 11px;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
              border: 2px solid white;
            ">${count}</div>
          `;
          return L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
        }
      });

      const linesGroup = L.layerGroup();
      const allCoords: [number, number][] = [];

      // A. Render Quality Trails
      if (showTrails) {
        trails.forEach(trail => {
          const isSelected = trail.id === selectedTrailId;
          const diffColor = getDifficultyColor(trail.difficulty);
          
          let greenColor = '#4ade80';
          switch ((trail.difficulty || '').toLowerCase()) {
            case 'facile': greenColor = '#86efac'; break;
            case 'modérée':
            case 'moderate': greenColor = '#4ade80'; break;
            case 'difficile':
            case 'difficult': greenColor = '#22c55e'; break;
            case 'expert':
            case 'très difficile': greenColor = '#16a34a'; break;
          }

          if (trail.geojson && isSelected) {
            try {
              const geoLayer = L.geoJSON(trail.geojson, {
                style: {
                  color: '#1C2620',
                  weight: 6,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round',
                }
              });

              geoLayer.bindPopup(`
                <div style="padding: 4px; font-family: system-ui;">
                  <h4 style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1C2620;">${trail.name}</h4>
                  <p style="font-size: 12px; color: #5C6B5E; margin: 0;">
                    📏 <strong>${trail.distance_km ? `${Number(trail.distance_km).toFixed(1)} km` : 'N/A'}</strong> 
                    ${trail.duration_hours ? `· ⏱️ ${trail.duration_hours}h` : ''} 
                    ${trail.difficulty ? `· <span style="color:${greenColor};font-weight:bold;">${trail.difficulty}</span>` : ''}
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
                background: ${isSelected ? '#1C2620' : 'white'};
                color: ${isSelected ? 'white' : '#1C2620'};
                font-weight: 700;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 999px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                white-space: nowrap;
                border: 1px solid ${isSelected ? '#1C2620' : '#E8E4D8'};
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
            clusterGroup.addLayer(marker);
          }
        });
      }

      // B. Render POIs
      filteredPois.forEach(poi => {
        allCoords.push([poi.lat, poi.lng]);
        const emoji = poi.type === 'refuge' ? '🏡' : poi.type === 'summit' ? '⛰️' : '💧';
        const bgColor = poi.type === 'refuge' ? '#17402C' : poi.type === 'summit' ? '#1C2620' : '#2563EB';

        const poiIcon = L.divIcon({
          html: `
            <div style="
              background-color: ${bgColor};
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2.5px solid white;
              box-shadow: 0 3px 8px rgba(0,0,0,0.35);
              font-size: 15px;
              cursor: pointer;
            ">${emoji}</div>
          `,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon, zIndexOffset: 2000 });
        marker.bindPopup(`
          <div style="padding: 6px; font-family: system-ui;">
            <strong style="font-size: 14px; color: #1C2620; display: block; margin-bottom: 2px;">${emoji} ${poi.name}</strong>
            <p style="font-size: 12px; color: #5C6B5E; margin: 0;">${poi.details}</p>
          </div>
        `);
        marker.on('click', () => {
          setSelectedPoiId(poi.id);
          setSelectedTrailId(null);
        });
        clusterGroup.addLayer(marker);
      });

      clusterGroup.addTo(map);
      linesGroup.addTo(map);
      
      const parentGroup = L.layerGroup([clusterGroup, linesGroup]);
      layerGroupRef.current = parentGroup;

      // Fit bounds when trails load
      if (allCoords.length > 0 && !selectedTrailId && !selectedPoiId) {
        try {
          const bounds = L.latLngBounds(allCoords);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
        } catch (e) {}
      }
    });
  }, [mapReady, trails, filteredPois, selectedTrailId, selectedPoiId, showTrails]);

  // Reset bounds to show all features
  const handleResetBounds = useCallback(() => {
    if (!mapRef.current) return;
    import('leaflet').then((L) => {
      const coords: [number, number][] = [];
      trails.forEach(t => { if (t.lat && t.lng) coords.push([t.lat, t.lng]); });
      filteredPois.forEach(p => coords.push([p.lat, p.lng]));
      if (coords.length > 0) {
        mapRef.current!.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
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

  return (
    <div className="relative w-full sm:h-[calc(100vh-64px)] h-dvh flex overflow-hidden font-sans">
      
      {/* ── SIDEBAR PANEL ── */}
      <div className={`${showMobileFilters ? 'fixed inset-0 z-50 sm:relative sm:inset-auto flex' : 'hidden'} sm:flex sm:w-[400px] bg-white border-r border-[#E8E4D8] flex-col shadow-xl`}>
        
        {/* Header & Filters */}
        <div className="p-4 border-b border-[#E8E4D8] bg-[#FAFAF7] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-800 text-lg text-[#1C2620]">Carte des Randonnées</h2>
              <p className="text-[11px] text-[#5C6B5E] font-medium">Filtre qualité AllTrails (≥ 2 km)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileFilters(false)}
                className="sm:hidden text-[11px] font-700 bg-white border border-[#E8E4D8] text-[#5C6B5E] px-3 py-1.5 rounded-full hover:bg-[#F5F3ED] transition-all"
              >
                ✕ Fermer
              </button>
              <button
                onClick={handleResetBounds}
                className="text-[11px] font-700 bg-[#1C2620] text-white px-3 py-1.5 rounded-full hover:bg-[#2A3830] transition-all shadow-sm"
              >
                Zoom global
              </button>
            </div>
          </div>

          {/* Distance Filter Chips */}
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-[#9CA89E] uppercase font-bold tracking-wider">Distance du parcours :</p>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar text-[11px] pb-1">
              {DISTANCE_RANGES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedDistanceRange(r.id)}
                  className={`px-3 py-1.5 rounded-full font-600 whitespace-nowrap transition-all ${
                    selectedDistanceRange === r.id
                      ? 'bg-[#1C2620] text-white shadow-sm'
                      : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Filter Chips */}
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-[#9CA89E] uppercase font-bold tracking-wider">Difficulté :</p>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar text-[11px]">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDifficulty(d.id)}
                  className={`px-3 py-1.5 rounded-full font-600 whitespace-nowrap transition-all ${
                    selectedDifficulty === d.id
                      ? 'bg-[#1C2620] text-white shadow-sm'
                      : 'bg-white border border-[#E8E4D8] text-[#5C6B5E] hover:border-[#C8C3B0]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layer Visibility Checkboxes */}
          <div className="bg-white p-2.5 rounded-2xl border border-[#E8E4D8] text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showTrails} 
                  onChange={e => setShowTrails(e.target.checked)} 
                  className="rounded text-emerald-600 focus:ring-0" 
                />
                <span className="font-600 text-[#1C2620]">🗺️ Sentiers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showRefuges} 
                  onChange={e => setShowRefuges(e.target.checked)} 
                  className="rounded text-emerald-600 focus:ring-0" 
                />
                <span className="font-600 text-[#1C2620]">🏡 Refuges</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showSummits} 
                  onChange={e => setShowSummits(e.target.checked)} 
                  className="rounded text-emerald-600 focus:ring-0" 
                />
                <span className="font-600 text-[#1C2620]">⛰️ Sommets</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showWaterPoints} 
                  onChange={e => setShowWaterPoints(e.target.checked)} 
                  className="rounded text-emerald-600 focus:ring-0" 
                />
                <span className="font-600 text-[#1C2620]">💧 Points d'eau</span>
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
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#E8E4D8] rounded-xl text-xs text-[#1C2620] focus:outline-none focus:border-[#1C2620]"
            />
            <span className="absolute left-3 top-2.5 text-xs text-[#9CA89E]">🔍</span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-xs text-[#9CA89E]">✕</button>
            )}
          </div>
        </div>

        {/* Trail Count Banner */}
        <div className="px-4 py-2 bg-[#EDEAE0] border-b border-[#E8E4D8] flex items-center justify-between text-xs text-[#5C6B5E]">
          <span className="font-700">{trails.length} randonnée{trails.length !== 1 ? 's' : ''} de qualité affichée{trails.length !== 1 ? 's' : ''}</span>
          <span className="text-[10px] font-mono">Backend SQL Filtered</span>
        </div>

        {/* Trail List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E8E4D8]">
          {loading ? (
            <div className="p-8 text-center text-xs text-[#9CA89E]">Filtrage et chargement des randonnées...</div>
          ) : trails.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9CA89E]">Aucune randonnée ne correspond à ces critères.</div>
          ) : (
            trails.map(t => {
              const isSelected = t.id === selectedTrailId;
              const diffColor = getDifficultyColor(t.difficulty);
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTrail(t)}
                  className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-[#2A3B32] text-white' : 'hover:bg-[#FAFAF7] bg-white text-[#1C2620]'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-700 text-xs leading-snug ${isSelected ? 'text-white' : 'text-[#1C2620]'}`}>{t.name}</h3>
                    <span 
                      className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2 flex-shrink-0"
                      style={{ backgroundColor: `${diffColor}20`, color: isSelected ? '#A7D3A6' : diffColor }}
                    >
                      {t.difficulty || 'Rando'}
                    </span>
                  </div>
                  
                  <div className={`flex items-center gap-3 text-[10px] mt-2 font-mono ${isSelected ? 'text-[#A7D3A6]' : 'text-[#9CA89E]'}`}>
                    <span>📏 {t.distance_km ? `${Number(t.distance_km).toFixed(1)} km` : 'N/A'}</span>
                    {t.duration_hours && <span>⏱️ {t.duration_hours}h</span>}
                    {t.elevation_gain && <span>📈 +{t.elevation_gain}m</span>}
                    {t.geojson && <span className="text-emerald-500 font-bold">🗺️ Tracé GPS</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile filter toggle FAB */}
      {!showMobileFilters && (
        <button
          onClick={() => setShowMobileFilters(true)}
          className="sm:hidden fixed top-20 left-3 z-30 bg-[#1C2620] text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-sm"
          aria-label="Toggle filters"
        >
          🔍
        </button>
      )}

      {/* ── MAP CONTAINER ── */}
      <div className="flex-1 h-full relative min-h-[240px]">
        <div ref={containerRef} className="w-full h-full z-0" />

        {/* Floating Zoom Controls — identiques à « Préparer la randonnée » (compact, bord gauche) */}
        <div className="absolute left-2 bottom-2 z-[400] flex flex-col gap-2">
          <div className="flex flex-col bg-white/80 backdrop-blur-md border border-white/60 rounded-xl shadow-xl overflow-hidden text-[#1C2620]">
            <button
              onClick={handleZoomIn}
              title="Zoom avant"
              className="w-8 h-8 flex items-center justify-center font-bold text-base hover:bg-[#8BAF7C]/35 hover:text-[#17402C] transition-all border-b border-black/10 cursor-pointer active:scale-95"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom arrière"
              className="w-8 h-8 flex items-center justify-center font-bold text-base hover:bg-[#8BAF7C]/35 hover:text-[#17402C] transition-all cursor-pointer active:scale-95"
            >
              −
            </button>
          </div>
        </div>

        {/* Floating Tile Switcher — identiques à « Préparer la randonnée » (icônes seules, bord droit) */}
        <div className="absolute right-2 bottom-2 z-[400] flex items-center bg-white/80 backdrop-blur-md border border-white/60 rounded-xl shadow-xl px-1 py-1 gap-1 shrink-0 flex-nowrap whitespace-nowrap">
          <button
            onClick={() => handleTileChange('osm')}
            className={`flex items-center rounded-xl transition-all cursor-pointer shrink-0 w-8 h-8 justify-center ${tileMode === 'osm' ? 'bg-[#17402C] text-white shadow-sm' : 'text-[#5C6B5E] hover:bg-[#8BAF7C]/30 hover:text-[#17402C]'}`}
            title="Carte"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M3 6l6-3 6 3 6-3v12l-6 3-6-3-6 3V6z"></path><path d="M9 3v12"></path><path d="M15 6v12"></path>
            </svg>
          </button>
          <button
            onClick={() => handleTileChange('topo')}
            className={`flex items-center rounded-xl transition-all cursor-pointer shrink-0 w-8 h-8 justify-center ${tileMode === 'topo' ? 'bg-[#17402C] text-white shadow-sm' : 'text-[#5C6B5E] hover:bg-[#8BAF7C]/30 hover:text-[#17402C]'}`}
            title="Relief"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M8 3l4 8 5-5 5 15H2L8 3z"></path>
            </svg>
          </button>
          <button
            onClick={() => handleTileChange('satellite')}
            className={`flex items-center rounded-xl transition-all cursor-pointer shrink-0 w-8 h-8 justify-center ${tileMode === 'satellite' ? 'bg-[#17402C] text-white shadow-sm' : 'text-[#5C6B5E] hover:bg-[#8BAF7C]/30 hover:text-[#17402C]'}`}
            title="Satellite"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>
            </svg>
          </button>
        </div>

        {/* Selected Trail Overlay Card */}
        {selectedTrail && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-sm px-4">
            <div className="bg-[#1C2620] text-white rounded-3xl p-5 shadow-2xl border border-white/20 relative">
              <button 
                onClick={() => setSelectedTrailId(null)}
                className="absolute top-4 right-4 text-white/60 hover:text-white text-xs bg-white/10 w-6 h-6 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
              
              <span className="text-[9px] font-mono tracking-widest text-[#A7D3A6] uppercase">Randonnée Sélectionnée</span>
              <h3 className="font-display font-800 text-lg leading-tight mt-1 mb-2 pr-6">{selectedTrail.name}</h3>
              
              <div className="flex items-center gap-4 text-xs font-mono text-white/80 mb-4 bg-white/10 p-3 rounded-2xl">
                <div>
                  <p className="text-[9px] text-white/50 uppercase">Distance</p>
                  <p className="font-700">{selectedTrail.distance_km ? `${Number(selectedTrail.distance_km).toFixed(1)} km` : 'N/A'}</p>
                </div>
                {selectedTrail.duration_hours && (
                  <div>
                    <p className="text-[9px] text-white/50 uppercase">Durée</p>
                    <p className="font-700">{selectedTrail.duration_hours}h</p>
                  </div>
                )}
                {selectedTrail.elevation_gain && (
                  <div>
                    <p className="text-[9px] text-white/50 uppercase">Dénivelé</p>
                    <p className="font-700">+{selectedTrail.elevation_gain}m</p>
                  </div>
                )}
              </div>

              {selectedTrail.geojson ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-600">
                  <span>✅ Tracé GPS de qualité affiché sur la carte</span>
                </div>
              ) : (
                <div className="text-xs text-white/50">Point de départ affiché sur la carte</div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
