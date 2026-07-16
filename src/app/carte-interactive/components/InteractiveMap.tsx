'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface GeoJSONLineString {
  type: 'LineString';
  coordinates: number[][];
}

interface Trail {
  id: string;
  name: string;
  trail_type: string;
  activity_type: string;
  difficulty: string;
  distance_km: number;
  elevation_gain: number;
  altitude_max: number;
  altitude_min?: number;
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
  metadata?: Record<string, unknown> | null;
  gps_points_count?: number;
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
  durationMode: string;
}

type MapMode = 'exploration' | 'navigation' | 'preparation';

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

const MAP_TILE_LAYERS: Record<MapMode, { url: string; attribution: string; label: string; icon: string; desc: string }> = {
  exploration: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    label: 'Exploration',
    icon: '🗺',
    desc: 'Topo · Relief · Courbes',
  },
  navigation: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    label: 'Navigation',
    icon: '🧭',
    desc: 'Routes · Chemins · Clair',
  },
  preparation: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    label: 'Préparation',
    icon: '🛰',
    desc: 'Satellite · Terrain réel',
  },
};

export default function InteractiveMap({ onTrailSelect }: InteractiveMapProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const polylinesRef = useRef<unknown[]>([]);
  const tileLayerRef = useRef<unknown>(null);
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
  const [mapMode, setMapMode] = useState<MapMode>('exploration');
  const [showModePanel, setShowModePanel] = useState(false);
  const [savedTrailIds, setSavedTrailIds] = useState<Set<string>>(new Set());
  const [savingTrailId, setSavingTrailId] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState('');

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

  // Load saved trails for current user
  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_trails')
      .select('trail_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedTrailIds(new Set(data.map((r: { trail_id: string }) => r.trail_id)));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      const params = new URLSearchParams({ limit: '200', page: '0' });
      if (filters.difficulty) params.set('difficulty', filters.difficulty);
      if (filters.trailType) params.set('type', filters.trailType);
      if (filters.search) params.set('q', filters.search);

      if (bbox) {
        params.set('min_lat', String(bbox.minLat));
        params.set('min_lng', String(bbox.minLng));
        params.set('max_lat', String(bbox.maxLat));
        params.set('max_lng', String(bbox.maxLng));
      }

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
  }, [filters]);

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

      // Default tile layer
      const tileLayer = L.tileLayer(MAP_TILE_LAYERS.exploration.url, {
        attribution: MAP_TILE_LAYERS.exploration.attribution,
        maxZoom: 17,
        opacity: 0.9,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapRef.current = map;

      let moveTimer: ReturnType<typeof setTimeout>;
      map.on('moveend', () => {
        clearTimeout(moveTimer);
        moveTimer = setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bounds = (map as any).getBounds();
          const bboxKey = `${bounds.getSouth().toFixed(1)},${bounds.getWest().toFixed(1)},${bounds.getNorth().toFixed(1)},${bounds.getEast().toFixed(1)}`;
          if (bboxKey !== lastBboxRef.current) {
            lastBboxRef.current = bboxKey;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Switch tile layer when mapMode changes
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapRef.current as any;
      if (tileLayerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tileLayerRef.current as any).remove();
      }
      const cfg = MAP_TILE_LAYERS[mapMode];
      const newLayer = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: 17,
        opacity: 0.9,
      }).addTo(map);
      tileLayerRef.current = newLayer;
    });
  }, [mapMode]);

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

    markersRef.current.forEach((m) => (m as { remove: () => void }).remove());
    polylinesRef.current.forEach((p) => (p as { remove: () => void }).remove());
    markersRef.current = [];
    polylinesRef.current = [];

    // ── Trails ──────────────────────────────────────────────
    if (showT) {
      trailData.forEach(trail => {
        // Only render trails that have real GPS geometry
        if (!trail.geojson?.coordinates || trail.geojson.coordinates.length < 2) return;

        const color = DIFFICULTY_COLORS[trail.difficulty] || '#E4501C';

        // Convert GeoJSON [lng, lat] → Leaflet [lat, lng]
        const coords: [number, number][] = trail.geojson.coordinates.map(
          (point) => [point[1], point[0]] as [number, number]
        );

        // Outer shadow for depth and contrast
        const shadow = Lx.polyline(coords, {
          color: 'rgba(0,0,0,0.45)',
          weight: 10,
          opacity: 1,
          lineJoin: 'round',
          lineCap: 'round',
          interactive: false,
        }).addTo(mapx);

        // Main colored trail line — premium outdoor style
        const polyline = Lx.polyline(coords, {
          color,
          weight: 5,
          opacity: 0.92,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: trail.is_loop ? '12,6' : undefined,
        }).addTo(mapx);

        // Highlight on hover
        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: 8, opacity: 1 });
        });
        polyline.on('mouseout', () => {
          polyline.setStyle({ weight: 5, opacity: 0.92 });
        });

        // Start dot marker
        const startIcon = Lx.divIcon({
          html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.7)"></div>`,
          className: '',
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const marker = Lx.marker(coords[0], { icon: startIcon }).addTo(mapx);

        const handleClick = () => {
          setSelectedTrail(trail);
          onTrailSelect?.(trail);
        };
        marker.on('click', handleClick);
        polyline.on('click', handleClick);
        shadow.on('click', handleClick);

        polylinesRef.current.push(shadow, polyline);
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
        html: `<div style="background:${cfg.color};color:white;width:28px;height:28px;border-radius:${pt.category === 'summit' ? '5px' : '50%'};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2.5px solid rgba(255,255,255,0.9)">${cfg.icon}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
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
        setSyncMsg(`⚠️ Overpass indisponible`);
        return;
      }
      if (data.cached) {
        setSyncMsg(`✅ ${regionName} déjà synchronisé`);
      } else if (data.success) {
        const inserted = data.records_inserted ?? 0;
        setSyncMsg(inserted > 0 ? `✅ ${inserted} éléments ajoutés` : `✅ Synchronisation terminée`);
        await loadData();
      } else {
        setSyncMsg(`⚠️ Overpass indisponible`);
      }
    } catch (err) {
      clearTimeout(clientTimeout);
      const isAbort = (err as Error).name === 'AbortError';
      setSyncMsg(isAbort ? '⏱ Délai dépassé' : '❌ Erreur de synchronisation');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 5000);
    }
  };

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Save / unsave trail
  const toggleSaveTrail = async (trail: Trail) => {
    if (!user) {
      setShareMsg('Connectez-vous pour sauvegarder');
      setTimeout(() => setShareMsg(''), 3000);
      return;
    }
    setSavingTrailId(trail.id);
    const isSaved = savedTrailIds.has(trail.id);
    try {
      if (isSaved) {
        await supabase.from('saved_trails').delete().eq('user_id', user.id).eq('trail_id', trail.id);
        setSavedTrailIds(prev => { const n = new Set(prev); n.delete(trail.id); return n; });
      } else {
        await supabase.from('saved_trails').insert({
          user_id: user.id,
          trail_id: trail.id,
          trail_name: trail.name,
          trail_data: {
            difficulty: trail.difficulty,
            distance_km: trail.distance_km,
            elevation_gain: trail.elevation_gain,
            duration_hours: trail.duration_hours,
            country: trail.country,
            region: trail.region,
            trail_type: trail.trail_type,
          },
        });
        setSavedTrailIds(prev => new Set([...prev, trail.id]));
      }
    } catch {
      // silent
    } finally {
      setSavingTrailId(null);
    }
  };

  // Share trail
  const shareTrail = (trail: Trail) => {
    const text = `${trail.name} — ${trail.distance_km}km, ${trail.elevation_gain}m D+ | Le Kit du Voyageur`;
    if (navigator.share) {
      navigator.share({ title: trail.name, text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${window.location.href}`).then(() => {
        setShareMsg('Lien copié !');
        setTimeout(() => setShareMsg(''), 2500);
      });
    }
  };

  // Download GPX
  const downloadGPX = (trail: Trail) => {
    if (!trail.geojson?.coordinates) {
      setShareMsg('Pas de trace GPS disponible');
      setTimeout(() => setShareMsg(''), 3000);
      return;
    }
    const coords = trail.geojson.coordinates;
    const trkpts = coords.map(c => `    <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>`).join('\n');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${trail.name || 'Sentier'}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(trail.name || 'sentier').replace(/\s+/g, '-').toLowerCase()}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
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
            <p className="text-white text-sm font-medium">Chargement des données…</p>
          </div>
        </div>
      )}

      {/* Top search bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Rechercher sentiers, sommets, refuges…"
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

          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm">Sentiers de randonnée</span>
            <button
              onClick={() => setShowTrails(v => !v)}
              className={`w-10 h-5 rounded-full transition-all relative ${showTrails ? 'bg-[#E4501C]' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${showTrails ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

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

          <div className="mb-3">
            <label className="text-white/50 text-xs mb-1.5 block">Durée</label>
            <div className="grid grid-cols-2 gap-1">
              {[{ id: 'all', label: 'Toutes' }, { id: 'half', label: '< 4h' }, { id: 'day', label: '4–12h' }, { id: 'multi', label: '> 12h' }].map(d => (
                <button key={d.id} onClick={() => setFilters(f => ({ ...f, durationMode: d.id }))}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.durationMode === d.id ? 'bg-[#E4501C] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

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

      {/* Map Mode Switcher */}
      <div className="absolute top-16 right-3 z-[1000]">
        <div className="relative">
          <button
            onClick={() => setShowModePanel(v => !v)}
            className="flex items-center gap-2 bg-[#1C2620]/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-xl border border-white/10 shadow-xl hover:border-[#E4501C]/40 transition-all"
          >
            <span>{MAP_TILE_LAYERS[mapMode].icon}</span>
            <span className="font-medium">{MAP_TILE_LAYERS[mapMode].label}</span>
            <svg className={`w-3 h-3 text-white/40 transition-transform ${showModePanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showModePanel && (
            <div className="absolute top-full right-0 mt-1.5 bg-[#1C2620]/97 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl overflow-hidden w-52">
              <div className="px-3 pt-2.5 pb-1">
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Mode carte</p>
              </div>
              {(Object.entries(MAP_TILE_LAYERS) as [MapMode, typeof MAP_TILE_LAYERS[MapMode]][]).map(([mode, cfg]) => (
                <button
                  key={mode}
                  onClick={() => { setMapMode(mode); setShowModePanel(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${mapMode === mode ? 'bg-[#E4501C]/15 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className="text-lg">{cfg.icon}</span>
                  <div>
                    <div className="text-xs font-semibold">{cfg.label}</div>
                    <div className="text-[10px] text-white/40">{cfg.desc}</div>
                  </div>
                  {mapMode === mode && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E4501C]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Layer controls */}
      <div className="absolute top-28 right-3 z-[1000] bg-[#1C2620]/95 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-white/10 space-y-1.5 min-w-[150px]">
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
            <span className="text-white/50">POI</span>
          </div>
          <div className="bg-[#E4501C]/20 backdrop-blur-sm text-[#E4501C] text-xs px-3 py-1.5 rounded-full border border-[#E4501C]/20 flex items-center gap-1.5">
            <span>🌍</span>
            <span>OpenStreetMap</span>
          </div>
        </div>
      )}

      {/* Share/save toast */}
      {shareMsg && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[3000] bg-[#1C2620] border border-white/20 text-white text-xs px-4 py-2 rounded-full shadow-2xl">
          {shareMsg}
        </div>
      )}

      {/* Trail detail panel */}
      {selectedTrail && (
        <TrailDetailPanel
          trail={selectedTrail}
          isSaved={savedTrailIds.has(selectedTrail.id)}
          isSaving={savingTrailId === selectedTrail.id}
          onClose={() => { setSelectedTrail(null); onTrailSelect?.(null); }}
          onSave={() => toggleSaveTrail(selectedTrail)}
          onShare={() => shareTrail(selectedTrail)}
          onDownloadGPX={() => downloadGPX(selectedTrail)}
        />
      )}
    </div>
  );
}

// ── Trail Detail Panel ────────────────────────────────────────

interface TrailDetailPanelProps {
  trail: Trail;
  isSaved: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  onDownloadGPX: () => void;
}

function TrailDetailPanel({ trail, isSaved, isSaving, onClose, onSave, onShare, onDownloadGPX }: TrailDetailPanelProps) {
  const color = DIFFICULTY_COLORS[trail.difficulty] || '#E4501C';
  const diffLabel = DIFFICULTY_LABELS[trail.difficulty] || trail.difficulty;
  const activityType = trail.activity_type || trail.trail_type || 'hiking';

  const handleCreateAdventure = () => {
    const event = new CustomEvent('createAdventureFromTrail', {
      detail: {
        trailName: trail.name,
        region: trail.region || trail.country,
        distance: trail.distance_km,
        elevation: trail.elevation_gain,
        difficulty: trail.difficulty,
        duration: trail.duration_hours,
        trailType: activityType,
      },
    });
    window.dispatchEvent(event);
    onClose();
  };

  const trailTypeLabel: Record<string, string> = {
    hiking: '🥾 Randonnée',
    trek: '🏔 Trek',
    trail_running: '🏃 Trail',
    cycling: '🚴 Vélo',
    bivouac: '⛺ Bivouac',
    alpinisme: '🧗 Alpinisme',
    foot: '🚶 Pédestre',
    path: '🌿 Chemin',
    track: '🛤 Piste',
  };

  // Compute distance from GPS coordinates if not available
  const gpsCoords = trail.geojson?.coordinates;
  const gpsDistance = (() => {
    if (trail.distance_km) return null; // already have it
    if (!gpsCoords || gpsCoords.length < 2) return null;
    let total = 0;
    for (let i = 1; i < gpsCoords.length; i++) {
      const [lng1, lat1] = gpsCoords[i - 1];
      const [lng2, lat2] = gpsCoords[i];
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return Math.round(total * 10) / 10;
  })();

  const displayDistance = trail.distance_km ?? gpsDistance;

  const sourceLabel = (() => {
    const s = (trail.source || '').toLowerCase();
    if (s.includes('openstreetmap') || s.includes('osm') || s === 'openstreetmap') return 'OpenStreetMap';
    if (s.includes('overpass')) return 'OpenStreetMap';
    return trail.source || 'OpenStreetMap';
  })();

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[2000] bg-[#141e1a] border-t border-white/10 shadow-2xl rounded-t-2xl">
      {/* Handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>

      <div className="px-4 pb-5 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl">🥾</span>
              <h3 className="text-white font-bold text-base leading-tight">{trail.name || 'Sentier sans nom'}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: `${color}25`, color, border: `1px solid ${color}50` }}>
                {diffLabel}
              </span>
              {activityType && (
                <span className="text-xs text-white/60 bg-white/8 px-2 py-0.5 rounded-full">
                  {trailTypeLabel[activityType] || activityType}
                </span>
              )}
              {trail.is_loop && (
                <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-full">🔄 Boucle</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white ml-3 flex-shrink-0 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { icon: '📏', label: 'Distance', value: displayDistance ? `${displayDistance} km` : '—' },
            { icon: '⬆️', label: 'D+', value: trail.elevation_gain ? `${trail.elevation_gain}m` : '—' },
            { icon: '⏱', label: 'Durée', value: trail.duration_hours ? `${trail.duration_hours}h` : '—' },
            { icon: '⛰', label: 'Alt. max', value: trail.altitude_max ? `${trail.altitude_max}m` : '—' },
          ].map(stat => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
              <div className="text-base mb-0.5">{stat.icon}</div>
              <div className="text-white font-bold text-xs">{stat.value}</div>
              <div className="text-white/35 text-[10px] mt-0.5">{stat.label}</div>
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

        {/* Source OpenStreetMap */}
        <div className="flex items-center gap-1.5 text-xs mb-3 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2">
          <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span className="text-blue-300 font-medium">Source : {sourceLabel}</span>
          {gpsCoords && gpsCoords.length > 0 && (
            <span className="ml-auto text-blue-400/60">{gpsCoords.length} pts GPS</span>
          )}
        </div>

        {/* Description */}
        {trail.description && (
          <p className="text-white/55 text-xs leading-relaxed mb-3 bg-white/4 rounded-xl p-3 border border-white/5">
            {trail.description}
          </p>
        )}

        {/* Actions: Save + Favorite */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all border ${
              isSaved
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className="text-base">{isSaving ? '⏳' : isSaved ? '⭐' : '☆'}</span>
            <span>{isSaved ? 'Sauvegardé' : 'Enregistrer'}</span>
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all border ${
              isSaved
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' :'bg-white/5 border-white/10 text-white/70 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20'
            }`}
          >
            <span className="text-base">{isSaved ? '❤️' : '🤍'}</span>
            <span>{isSaved ? 'Favori' : 'Ajouter aux favoris'}</span>
          </button>
        </div>

        {/* Secondary actions */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={onShare}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <span className="text-base">📤</span>
            <span>Partager</span>
          </button>

          <button
            onClick={onDownloadGPX}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <span className="text-base">⬇</span>
            <span>GPX</span>
          </button>

          <button
            onClick={handleCreateAdventure}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-[#E4501C]/15 border border-[#E4501C]/30 text-[#E4501C] hover:bg-[#E4501C]/25 transition-all"
          >
            <span className="text-base">🤖</span>
            <span>IA</span>
          </button>
        </div>

        {/* Main CTA */}
        <button
          onClick={handleCreateAdventure}
          className="w-full bg-gradient-to-r from-[#E4501C] to-[#f97316] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 hover:opacity-90 transition-opacity shadow-lg shadow-[#E4501C]/25 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Créer mon aventure avec l&apos;IA
        </button>
      </div>
    </div>
  );
}
