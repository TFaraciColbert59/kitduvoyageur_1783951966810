'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface GeoJSONLineString {
  type: 'LineString';
  coordinates: number[][];
}

interface Trail {
  id: string;
  name: string;
  trail_type: string;
  difficulty: string;
  distance_km: number;
  elevation_gain: number;
  altitude_max: number;
  duration_hours: number;
  country: string;
  region: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  is_loop: boolean;
  source: string;
  geojson: GeoJSONLineString | null;
  description: string | null;
  surface: string | null;
  metadata: Record<string, unknown> | null;
}

interface OutdoorPoint {
  id: string;
  category: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  altitude: number;
  country: string;
  region: string;
  metadata: Record<string, unknown>;
}

interface MapFilters {
  difficulty: string;
  trailType: string;
  search: string;
  minDistance: number;
  maxDistance: number;
  minElevation: number;
  maxElevation: number;
  durationMode: string; // 'all' | 'half' | 'day' | 'multi'
}

interface InteractiveMapProps {
  onTrailSelect?: (trail: Trail | null) => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f59e0b',
  hard: '#ef4444',
  expert: '#7c3aed',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  moderate: 'Modéré',
  hard: 'Difficile',
  expert: 'Expert',
};

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  refuge: { icon: '🏠', color: '#1e40af', label: 'Refuges' },
  water: { icon: '💧', color: '#0891b2', label: "Points d'eau" },
  summit: { icon: '▲', color: '#ef4444', label: 'Sommets' },
  camping: { icon: '⛺', color: '#16a34a', label: 'Camping' },
  waterfall: { icon: '🌊', color: '#0284c7', label: 'Cascades' },
  viewpoint: { icon: '👁', color: '#7c3aed', label: 'Points de vue' },
  col: { icon: '⛰', color: '#92400e', label: 'Cols' },
  cave: { icon: '🕳', color: '#374151', label: 'Grottes' },
  lake: { icon: '🏞', color: '#0369a1', label: 'Lacs' },
  spring: { icon: '💦', color: '#06b6d4', label: 'Sources' },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG);

export default function InteractiveMap({ onTrailSelect }: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const polylinesRef = useRef<unknown[]>([]);
  const clusterGroupRef = useRef<unknown>(null);
  const mapInitialized = useRef(false);
  const lastBboxRef = useRef<string>('');

  const [trails, setTrails] = useState<Trail[]>([]);
  const [points, setPoints] = useState<OutdoorPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({ trails: 0, points: 0 });
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);

  const [filters, setFilters] = useState<MapFilters>({
    difficulty: '',
    trailType: '',
    search: '',
    minDistance: 0,
    maxDistance: 200,
    minElevation: 0,
    maxElevation: 5000,
    durationMode: 'all',
  });

  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>(
    ALL_CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: true }), {})
  );
  const [showTrails, setShowTrails] = useState(true);

  const getDurationFilter = (mode: string): { min: number; max: number } => {
    switch (mode) {
      case 'half': return { min: 0, max: 4 };
      case 'day': return { min: 4, max: 12 };
      case 'multi': return { min: 12, max: 99999 };
      default: return { min: 0, max: 99999 };
    }
  };

  const loadData = useCallback(async (bbox?: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.trailType) params.set('type', filters.trailType);
      if (filters.search) params.set('q', filters.search);
      if (filters.minDistance > 0) params.set('min_distance', String(filters.minDistance));
      if (filters.maxDistance < 200) params.set('max_distance', String(filters.maxDistance));
      if (filters.minElevation > 0) params.set('min_elevation', String(filters.minElevation));
      if (filters.maxElevation < 5000) params.set('max_elevation', String(filters.maxElevation));

      const dur = getDurationFilter(filters.durationMode);
      if (dur.min > 0) params.set('min_duration', String(dur.min));
      if (dur.max < 99999) params.set('max_duration', String(dur.max));

      if (bbox) {
        params.set('min_lat', String(bbox.minLat));
        params.set('min_lng', String(bbox.minLng));
        params.set('max_lat', String(bbox.maxLat));
        params.set('max_lng', String(bbox.maxLng));
      }

      const activeCats = Object.entries(activeCategories)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (activeCats.length > 0) params.set('categories', activeCats.join(','));

      const res = await fetch(`/api/map/explore?${params}`);
      const data = await res.json();
      setTrails(data.trails || []);
      setPoints(data.outdoor_points || []);
      setStats({ trails: data.trails?.length || 0, points: data.outdoor_points?.length || 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filters, activeCategories]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInitialized.current) return;
    mapInitialized.current = true;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapContainerRef.current!, {
        center: [46.0, 8.0],
        zoom: 5,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenTopoMap for outdoor feel
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17,
        opacity: 0.9,
      }).addTo(map);

      mapRef.current = map;

      // Auto-sync when map moves to new zone (debounced)
      let moveTimer: ReturnType<typeof setTimeout>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('moveend', () => {
        clearTimeout(moveTimer);
        moveTimer = setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bounds = (map as any).getBounds();
          const bboxKey = `${bounds.getSouth().toFixed(1)},${bounds.getWest().toFixed(1)},${bounds.getNorth().toFixed(1)},${bounds.getEast().toFixed(1)}`;
          if (bboxKey !== lastBboxRef.current) {
            lastBboxRef.current = bboxKey;
            // Reload data for new viewport
            const zoom = (map as any).getZoom();
            if (zoom >= 7) {
              loadData({
                minLat: bounds.getSouth(),
                minLng: bounds.getWest(),
                maxLat: bounds.getNorth(),
                maxLng: bounds.getEast(),
              });
            }
          }
        }, 800);
      });
    });

    return () => {
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove();
        mapRef.current = null;
        mapInitialized.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render when data or filters change
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderMapData(L, mapRef.current as any, trails, points, showTrails, activeCategories);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trails, points, showTrails, activeCategories]);

  function renderMapData(
    L: unknown,
    map: unknown,
    trailData: Trail[],
    pointData: OutdoorPoint[],
    showT: boolean,
    activeCats: Record<string, boolean>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Lx = L as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapx = map as any;

    // Clear existing layers
    markersRef.current.forEach((m) => (m as { remove: () => void }).remove());
    polylinesRef.current.forEach((p) => (p as { remove: () => void }).remove());
    markersRef.current = [];
    polylinesRef.current = [];

    // ── Trails ──────────────────────────────────────────────
    if (showT) {
      trailData.forEach(trail => {
        if (!trail.start_lat || !trail.start_lng) return;
        const color = DIFFICULTY_COLORS[trail.difficulty] || '#6b7280';

        // Use full GeoJSON geometry if available, otherwise start→end line
        let coords: [number, number][] = [];
        if (trail.geojson?.coordinates && trail.geojson.coordinates.length >= 2) {
          // GeoJSON is [lng, lat] — Leaflet needs [lat, lng]
          coords = trail.geojson.coordinates.map(c => [c[1], c[0]] as [number, number]);
        } else {
          coords = [[trail.start_lat, trail.start_lng]];
          if (trail.end_lat && trail.end_lng && !trail.is_loop) {
            coords.push([trail.end_lat, trail.end_lng]);
          }
        }

        const polyline = Lx.polyline(coords, {
          color,
          weight: coords.length > 2 ? 4 : 3,
          opacity: 0.85,
          dashArray: trail.is_loop ? '8,4' : undefined,
        }).addTo(mapx);

        const startIcon = Lx.divIcon({
          html: `<div style="background:${color};width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5)"></div>`,
          className: '',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        const marker = Lx.marker([trail.start_lat, trail.start_lng], { icon: startIcon }).addTo(mapx);

        const popupHtml = buildTrailPopup(trail, color);

        marker.bindPopup(popupHtml, { maxWidth: 280 });
        polyline.bindPopup(popupHtml, { maxWidth: 280 });

        // Click on trail → select it for detail panel
        const handleClick = () => {
          setSelectedTrail(trail);
          onTrailSelect?.(trail);
        };
        marker.on('click', handleClick);
        polyline.on('click', handleClick);

        polylinesRef.current.push(polyline);
        markersRef.current.push(marker);
      });
    }

    // ── Outdoor Points ────────────────────────────────────────
    pointData.forEach(pt => {
      if (!pt.lat || !pt.lng) return;
      if (!activeCats[pt.category]) return;

      const cfg = CATEGORY_CONFIG[pt.category] || { icon: '📍', color: '#6b7280', label: pt.category };
      const meta = pt.metadata || {};

      const icon = Lx.divIcon({
        html: `<div style="background:${cfg.color};color:white;width:26px;height:26px;border-radius:${pt.category === 'summit' ? '4px' : '50%'};display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 5px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.8)">${cfg.icon}</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      let popupBody = '';
      if (pt.category === 'refuge') {
        const m = meta as { capacity?: number; is_staffed?: boolean; price_per_night?: number; has_meals?: boolean };
        popupBody = `
          ${pt.altitude ? `⛰ Altitude: <strong>${pt.altitude}m</strong><br/>` : ''}
          ${m.capacity ? `👥 Capacité: <strong>${m.capacity} pers.</strong><br/>` : ''}
          ${m.is_staffed !== undefined ? (m.is_staffed ? '✅ Gardé' : '🔓 Non gardé') : ''}
          ${m.has_meals ? ' &nbsp;|&nbsp; 🍽 Repas' : ''}
          ${m.price_per_night ? `<br/>💶 <strong>${m.price_per_night}€/nuit</strong>` : ''}`;
      } else if (pt.category === 'summit') {
        const m = meta as { prominence?: number; massif?: string };
        popupBody = `
          ${pt.altitude ? `⛰ Altitude: <strong>${pt.altitude}m</strong><br/>` : ''}
          ${m.prominence ? `Prominence: <strong>${m.prominence}m</strong><br/>` : ''}
          ${m.massif ? `Massif: ${m.massif}` : ''}`;
      } else if (pt.category === 'water') {
        const m = meta as { water_type?: string; is_potable?: boolean; is_seasonal?: boolean };
        popupBody = `
          ${m.water_type ? `🏷 ${m.water_type}<br/>` : ''}
          ${m.is_potable !== undefined ? (m.is_potable ? '✅ Potable' : '⚠️ Non potable') : ''}
          ${m.is_seasonal ? ' &nbsp;|&nbsp; 🌸 Saisonnier' : ''}
          ${pt.altitude ? `<br/>⛰ ${pt.altitude}m` : ''}`;
      } else if (pt.category === 'waterfall') {
        const m = meta as { height_m?: number };
        popupBody = `${m.height_m ? `Hauteur: <strong>${m.height_m}m</strong>` : ''}`;
      } else {
        popupBody = `${pt.altitude ? `⛰ ${pt.altitude}m` : ''}`;
      }

      const marker = Lx.marker([pt.lat, pt.lng], { icon }).addTo(mapx);
      marker.bindPopup(`
        <div style="min-width:190px;font-family:sans-serif;font-size:12px">
          <div style="background:${cfg.color};color:white;padding:7px 12px;border-radius:6px 6px 0 0;margin:-12px -12px 8px -12px">
            <strong>${cfg.icon} ${pt.name || cfg.label}</strong>
          </div>
          <div style="line-height:1.7;color:#374151">
            ${popupBody}
            ${(pt.region || pt.country) ? `<br/>📍 ${[pt.region, pt.country].filter(v => v != null && v !== 'undefined').join(', ')}` : ''}
            ${pt.description ? `<br/><em style="color:#6b7280;font-size:11px">${pt.description.slice(0, 80)}${pt.description.length > 80 ? '…' : ''}</em>` : ''}
          </div>
        </div>`, { maxWidth: 260 });

      markersRef.current.push(marker);
    });
  }

  function buildTrailPopup(trail: Trail, color: string): string {
    return `
      <div style="min-width:220px;font-family:sans-serif;font-size:13px">
        <div style="background:${color};color:white;padding:8px 12px;border-radius:6px 6px 0 0;margin:-12px -12px 8px -12px">
          <strong>🥾 ${trail.name || 'Sentier'}</strong>
        </div>
        <div style="padding:0 2px;line-height:1.7;color:#374151">
          <span style="background:${color}22;color:${color};padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600">${DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty || 'Modéré'}</span>
          <br/>
          ${trail.distance_km ? `📏 <strong>${trail.distance_km} km</strong>` : ''}
          ${trail.elevation_gain ? ` &nbsp;⬆️ <strong>${trail.elevation_gain}m D+</strong>` : ''}
          ${trail.duration_hours ? `<br/>⏱ <strong>${trail.duration_hours}h</strong>` : ''}
          ${trail.country ? `<br/>📍 ${trail.region ? trail.region + ' · ' : ''}${trail.country}` : ''}
          ${trail.trail_type ? `<br/>🏷 ${trail.trail_type}` : ''}
          <br/><em style="color:#6b7280;font-size:11px">Cliquez pour voir les détails</em>
        </div>
      </div>`;
  }

  const syncRegion = async (regionName: string) => {
    setSyncing(true);
    setSyncMsg(`Synchronisation de ${regionName}…`);

    const controller = new AbortController();
    const clientTimeout = setTimeout(() => controller.abort(), 55000);

    try {
      const res = await fetch('/api/map/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: regionName, force: true }),
        signal: controller.signal,
      });
      clearTimeout(clientTimeout);

      const data = await res.json();

      if (!res.ok) {
        setSyncMsg(`⚠️ Overpass indisponible — données de secours affichées`);
        return;
      }

      if (data.cached) {
        setSyncMsg(`✅ ${regionName} déjà synchronisé`);
      } else if (data.success) {
        const inserted = data.records_inserted ?? 0;
        if (inserted > 0) {
          setSyncMsg(`✅ ${inserted} éléments ajoutés`);
        } else {
          setSyncMsg(`✅ Synchronisation terminée`);
        }
        await loadData();
      } else {
        setSyncMsg(`⚠️ Overpass indisponible — données de secours affichées`);
      }
    } catch (err) {
      clearTimeout(clientTimeout);
      const isAbort = (err as Error).name === 'AbortError';
      setSyncMsg(isAbort ? '⏱ Délai dépassé — données de secours affichées' : '❌ Erreur de synchronisation');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1C2620]/80 z-[1000]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white text-sm font-medium">Chargement des données mondiales…</p>
          </div>
        </div>
      )}

      {/* Top search bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Rechercher sentiers, sommets, refuges, pays…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full bg-[#1C2620]/95 backdrop-blur-sm text-white placeholder-white/40 text-sm px-4 py-2.5 pl-9 rounded-xl border border-white/10 focus:outline-none focus:border-[#E4501C] shadow-xl"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xl ${showFilters ? 'bg-[#E4501C] text-white' : 'bg-[#1C2620]/95 backdrop-blur-sm text-white/70 border border-white/10 hover:text-white'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="absolute top-16 left-3 z-[1000] bg-[#1C2620]/97 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl p-4 w-80 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Filtres avancés</h4>
            <button onClick={() => setFilters({ difficulty: '', trailType: '', search: '', minDistance: 0, maxDistance: 200, minElevation: 0, maxElevation: 5000, durationMode: 'all' })} className="text-white/40 text-xs hover:text-white">Réinitialiser</button>
          </div>

          {/* Trail toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm">Sentiers de randonnée</span>
            <button
              onClick={() => setShowTrails(v => !v)}
              className={`w-10 h-5 rounded-full transition-all relative ${showTrails ? 'bg-[#E4501C]' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${showTrails ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Difficulty */}
          <div className="mb-3">
            <label className="text-white/50 text-xs mb-1.5 block">Difficulté</label>
            <div className="grid grid-cols-3 gap-1">
              {[{ id: '', label: 'Toutes' }, { id: 'easy', label: '🟢 Facile' }, { id: 'moderate', label: '🟡 Modéré' }, { id: 'hard', label: '🔴 Difficile' }, { id: 'expert', label: '⚫ Expert' }].map(d => (
                <button key={d.id} onClick={() => setFilters(f => ({ ...f, difficulty: d.id }))}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.difficulty === d.id ? 'bg-[#E4501C] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trail type */}
          <div className="mb-3">
            <label className="text-white/50 text-xs mb-1.5 block">Activité</label>
            <div className="grid grid-cols-3 gap-1">
              {[{ id: '', label: 'Tous' }, { id: 'hiking', label: '🥾 Rando' }, { id: 'trek', label: '🏔 Trek' }, { id: 'trail_running', label: '🏃 Trail' }, { id: 'cycling', label: '🚴 Vélo' }, { id: 'bivouac', label: '⛺ Bivouac' }].map(t => (
                <button key={t.id} onClick={() => setFilters(f => ({ ...f, trailType: t.id }))}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.trailType === t.id ? 'bg-[#E4501C] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="mb-3">
            <label className="text-white/50 text-xs mb-1.5 block">Durée</label>
            <div className="grid grid-cols-2 gap-1">
              {[{ id: 'all', label: 'Toutes' }, { id: 'half', label: '< 4h (demi-journée)' }, { id: 'day', label: '4–12h (journée)' }, { id: 'multi', label: '> 12h (multi-jours)' }].map(d => (
                <button key={d.id} onClick={() => setFilters(f => ({ ...f, durationMode: d.id }))}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.durationMode === d.id ? 'bg-[#E4501C] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Distance slider */}
          <div className="mb-3">
            <label className="text-white/50 text-xs mb-1.5 flex justify-between">
              <span>Distance</span>
              <span className="text-white">{filters.minDistance}–{filters.maxDistance >= 200 ? '200+' : filters.maxDistance} km</span>
            </label>
            <div className="flex gap-2 items-center">
              <input type="range" min="0" max="200" step="5" value={filters.minDistance}
                onChange={e => setFilters(f => ({ ...f, minDistance: parseInt(e.target.value) }))}
                className="flex-1 accent-[#E4501C]" />
              <input type="range" min="0" max="200" step="5" value={filters.maxDistance}
                onChange={e => setFilters(f => ({ ...f, maxDistance: parseInt(e.target.value) }))}
                className="flex-1 accent-[#E4501C]" />
            </div>
          </div>

          {/* Elevation slider */}
          <div className="mb-3">
            <label className="text-white/50 text-xs mb-1.5 flex justify-between">
              <span>Dénivelé</span>
              <span className="text-white">{filters.minElevation}–{filters.maxElevation >= 5000 ? '5000+' : filters.maxElevation}m</span>
            </label>
            <div className="flex gap-2 items-center">
              <input type="range" min="0" max="5000" step="100" value={filters.minElevation}
                onChange={e => setFilters(f => ({ ...f, minElevation: parseInt(e.target.value) }))}
                className="flex-1 accent-[#E4501C]" />
              <input type="range" min="0" max="5000" step="100" value={filters.maxElevation}
                onChange={e => setFilters(f => ({ ...f, maxElevation: parseInt(e.target.value) }))}
                className="flex-1 accent-[#E4501C]" />
            </div>
          </div>

          {/* POI categories */}
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Points d&apos;intérêt</label>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => (
                <button key={cat} onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCategories[cat] ? 'bg-white/10 text-white' : 'bg-white/3 text-white/30'}`}>
                  <span>{cfg.icon}</span>
                  <span className="truncate">{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Layer controls (right side) */}
      <div className="absolute top-16 right-3 z-[1000] bg-[#1C2620]/95 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-white/10 space-y-1.5 min-w-[150px]">
        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Couches OSM</p>
        {Object.entries(CATEGORY_CONFIG).slice(0, 6).map(([cat, cfg]) => (
          <button key={cat} onClick={() => toggleCategory(cat)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCategories[cat] ? 'text-white' : 'text-white/30'}`}>
            <span>{cfg.icon}</span>
            <span className="flex-1 text-left">{cfg.label}</span>
            <div className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: activeCategories[cat] ? cfg.color : '#374151' }} />
          </button>
        ))}
      </div>

      {/* OSM Sync button */}
      <div className="absolute bottom-16 right-3 z-[1000]">
        <div className="relative group">
          <button
            onClick={() => syncRegion('Alpes françaises')}
            disabled={syncing}
            className="flex items-center gap-2 bg-[#1C2620]/95 backdrop-blur-sm text-white/70 hover:text-white text-xs px-3 py-2 rounded-xl border border-white/10 shadow-xl transition-all hover:border-[#E4501C]/40 disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Sync OSM</span>
          </button>
          {syncMsg && (
            <div className="absolute bottom-full right-0 mb-2 bg-[#1C2620] text-white text-xs px-3 py-2 rounded-lg border border-white/10 whitespace-nowrap shadow-xl">
              {syncMsg}
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="absolute bottom-3 left-3 z-[1000] flex gap-2 flex-wrap">
          <div className="bg-[#1C2620]/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
            <span className="text-[#E4501C]">🥾</span>
            <strong>{stats.trails}</strong>
            <span className="text-white/50">sentiers</span>
          </div>
          <div className="bg-[#1C2620]/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
            <span className="text-[#E4501C]">📍</span>
            <strong>{stats.points}</strong>
            <span className="text-white/50">points d&apos;intérêt</span>
          </div>
          <div className="bg-[#E4501C]/20 backdrop-blur-sm text-[#E4501C] text-xs px-3 py-1.5 rounded-full border border-[#E4501C]/20 flex items-center gap-1.5">
            <span>🌍</span>
            <span>OpenStreetMap</span>
          </div>
        </div>
      )}

      {/* Trail detail panel (bottom slide-up) */}
      {selectedTrail && (
        <TrailDetailPanel
          trail={selectedTrail}
          onClose={() => { setSelectedTrail(null); onTrailSelect?.(null); }}
        />
      )}
    </div>
  );
}

// ── Trail Detail Panel ────────────────────────────────────────

interface TrailDetailPanelProps {
  trail: Trail;
  onClose: () => void;
}

function TrailDetailPanel({ trail, onClose }: TrailDetailPanelProps) {
  const color = DIFFICULTY_COLORS[trail.difficulty] || '#6b7280';
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;

  const handleCreateAdventure = () => {
    // Dispatch custom event to trigger AdventureGenerator with trail context
    const event = new CustomEvent('createAdventureFromTrail', {
      detail: {
        trailName: trail.name,
        region: trail.region || trail.country,
        distance: trail.distance_km,
        elevation: trail.elevation_gain,
        difficulty: trail.difficulty,
        duration: trail.duration_hours,
        trailType: trail.trail_type,
      },
    });
    window.dispatchEvent(event);
    onClose();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[2000] bg-[#1a2420] border-t border-white/10 shadow-2xl rounded-t-2xl">
      {/* Handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>

      <div className="px-4 pb-4 max-h-80 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🥾</span>
              <h3 className="text-white font-bold text-base truncate">{trail.name}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
                {diffLabel}
              </span>
              {trail.trail_type && (
                <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-full">{trail.trail_type}</span>
              )}
              {trail.is_loop && (
                <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-full">🔄 Boucle</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white ml-3 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { icon: '📏', label: 'Distance', value: trail.distance_km ? `${trail.distance_km} km` : '—' },
            { icon: '⬆️', label: 'Dénivelé', value: trail.elevation_gain ? `${trail.elevation_gain}m` : '—' },
            { icon: '⏱', label: 'Durée', value: trail.duration_hours ? `${trail.duration_hours}h` : '—' },
            { icon: '⛰', label: 'Altitude max', value: trail.altitude_max ? `${trail.altitude_max}m` : '—' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-2 text-center">
              <div className="text-base mb-0.5">{stat.icon}</div>
              <div className="text-white font-bold text-xs">{stat.value}</div>
              <div className="text-white/40 text-[10px]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Location */}
        {(trail.region || trail.country) && (
          <div className="flex items-center gap-1.5 text-white/50 text-xs mb-2">
            <span>📍</span>
            <span>{[trail.region, trail.country].filter(Boolean).join(' · ')}</span>
          </div>
        )}

        {/* Surface */}
        {trail.surface && (
          <div className="flex items-center gap-1.5 text-white/50 text-xs mb-2">
            <span>🏔</span>
            <span>Surface : {trail.surface}</span>
          </div>
        )}

        {/* Description */}
        {trail.description && (
          <p className="text-white/60 text-xs leading-relaxed mb-3 bg-white/5 rounded-xl p-3">
            {trail.description}
          </p>
        )}

        {/* GPS trace indicator */}
        {trail.geojson?.coordinates && trail.geojson.coordinates.length > 2 && (
          <div className="flex items-center gap-1.5 text-xs mb-3 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
            <span className="text-green-400">✓</span>
            <span className="text-green-400">Trace GPS complète disponible ({trail.geojson.coordinates.length} points)</span>
          </div>
        )}

        {/* CTA: Create adventure with AI */}
        <button
          onClick={handleCreateAdventure}
          className="w-full bg-gradient-to-r from-[#E4501C] to-[#f97316] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-[#E4501C]/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
          </svg>
          Créer cette aventure avec l&apos;IA
        </button>
      </div>
    </div>
  );
}
