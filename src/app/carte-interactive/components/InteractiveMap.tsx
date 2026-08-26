'use client';

import React from 'react';



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

type _OutdoorPoint = {
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
};

type _MapFilters = {
  difficulty: string;
  trailType: string;
  search: string;
  minDistance: number;
  maxDistance: number;
  minElevation: number;
  maxElevation: number;
  durationMode: string;
};

type MapMode = 'exploration' | 'navigation' | 'preparation';

type _InteractiveMapProps = {
  onTrailSelect?: (trail: Trail | null) => void;
};

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

const _ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG);

const _MAP_TILE_LAYERS: Record<MapMode, { url: string; attribution: string; label: string; icon: string; desc: string }> = {
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

export default function InteractiveMap() {
  return null;
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

function _TrailDetailPanel({ trail, isSaved, isSaving, onClose, onSave, onShare, onDownloadGPX }: TrailDetailPanelProps) {
  const color = DIFFICULTY_COLORS[trail.difficulty] || '#17402C';
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
    <div className="absolute bottom-0 left-0 right-0 z-[2000] bg-[#141e1a] border-t border-white/10  rounded-t-2xl">
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
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium bg-[#17402C]/15 border border-[#17402C]/30 text-[#17402C] hover:bg-[#17402C]/25 transition-all"
          >
            <span className="text-base">🤖</span>
            <span>IA</span>
          </button>
        </div>

        {/* Main CTA */}
        <button
          onClick={handleCreateAdventure}
          className="w-full bg-gradient-to-r from-[#17402C] to-[#f97316] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 hover:opacity-90 transition-opacity  shadow-[#17402C]/25 text-sm"
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
