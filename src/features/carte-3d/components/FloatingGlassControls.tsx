'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Carte3DBasemap, Carte3DOfflinePack, Carte3DTrail, WaypointCategory } from '../types';
import { PRESET_TRAILS } from '../data/presetTrails';
import { parseGPXStringToTrail } from '../lib/gpxParser';
import {
  fetchSupabaseTrailDetails,
  searchSupabaseTrails,
  type LiveTrailSummary,
} from '../lib/supabaseTrailService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import HeaderBackButton from '@/components/ui/HeaderBackButton';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

interface FloatingGlassControlsProps {
  currentTrail: Carte3DTrail;
  onSelectTrail: (trail: Carte3DTrail) => void;
  is3D: boolean;
  onToggle3D: () => void;
  bearing: number;
  onResetNorth: () => void;
  basemap: Carte3DBasemap;
  onChangeBasemap: (basemap: Carte3DBasemap) => void;
  activeCategories: Set<WaypointCategory>;
  onToggleCategory: (cat: WaypointCategory) => void;
  offlinePack: Carte3DOfflinePack | null;
  isDownloadingOffline: boolean;
  downloadProgress: number;
  onDownloadOffline: () => void;
  onDeleteOffline: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export function FloatingGlassControls({
  currentTrail,
  onSelectTrail,
  is3D,
  onToggle3D,
  bearing,
  onResetNorth,
  basemap,
  onChangeBasemap,
  activeCategories,
  onToggleCategory,
  offlinePack,
  isDownloadingOffline,
  downloadProgress,
  onDownloadOffline,
  onDeleteOffline,
  onZoomIn,
  onZoomOut,
}: FloatingGlassControlsProps) {
  const { triggerHaptic } = useHapticFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trailMenuOpen, setTrailMenuOpen] = useState(false);
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);

  // Onglet dans le menu sentier : 'preset' | 'live'
  const [trailTab, setTrailTab] = useState<'preset' | 'live'>('preset');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState<LiveTrailSummary[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [isLoadingTrail, setIsLoadingTrail] = useState(false);

  // Recherche debounce dans Supabase/PostGIS
  useEffect(() => {
    if (trailTab !== 'live' || !searchQuery.trim()) {
      setLiveResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLive(true);
      try {
        const results = await searchSupabaseTrails(searchQuery);
        setLiveResults(results);
      } finally {
        setIsSearchingLive(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, trailTab]);

  const handleSelectLiveTrail = async (trailSummary: LiveTrailSummary) => {
    try {
      setIsLoadingTrail(true);
      triggerHaptic('selection');
      const fullTrail = await fetchSupabaseTrailDetails(trailSummary.id);
      if (fullTrail) {
        onSelectTrail(fullTrail);
        setTrailMenuOpen(false);
        triggerHaptic('success');
      } else {
        triggerHaptic('error');
      }
    } catch {
      triggerHaptic('error');
    } finally {
      setIsLoadingTrail(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGpxError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const xml = event.target?.result as string;
      const parsed = parseGPXStringToTrail(xml, file.name.replace(/\.gpx$/i, ''));
      if (parsed.success && parsed.trail) {
        triggerHaptic('success');
        onSelectTrail(parsed.trail);
        setTrailMenuOpen(false);
      } else {
        triggerHaptic('error');
      }
    };
    reader.onerror = () => {
      setGpxError('Impossible de lire le fichier.');
    };
    reader.readAsText(file);
  };

  const categoriesConfig: { id: WaypointCategory; label: string; icon: string }[] = [
    { id: 'summit', label: 'Sommets', icon: '🏔️' },
    { id: 'refuge', label: 'Refuges', icon: '🏡' },
    { id: 'water', label: 'Points d’eau', icon: '💧' },
    { id: 'pass', label: 'Cols & Brèches', icon: '🚩' },
    { id: 'viewpoint', label: 'Panoramas', icon: '👁️' },
    { id: 'weather', label: 'Météo', icon: '⛅' },
    { id: 'photo', label: 'Photos', icon: '📸' },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none p-3 md:p-6 flex flex-col justify-between z-20">
      
      {/* ── BARRE SUPÉRIEURE FLOTTANTE (LIQUID GLASS) ──────────────── */}
      <div className="flex items-start justify-between gap-2">
        
        {/* Navigation retour & Sélecteur de parcours (Top Gauche) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <HeaderBackButton fallbackHref="/explorer" label="Quitter la carte 3D" />
          <div className="relative">
          <button
            onClick={() => {
              triggerHaptic('light');
              setTrailMenuOpen(!trailMenuOpen);
              setBasemapMenuOpen(false);
              setFilterMenuOpen(false);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg text-stone-900 dark:text-stone-100 active:scale-95 transition-all"
          >
            <span className="text-base">🥾</span>
            <div className="text-left">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                {currentTrail.massif}
              </div>
              <div className="text-sm font-bold truncate max-w-[140px] xs:max-w-[180px] md:max-w-[240px]">
                {currentTrail.name}
              </div>
            </div>
            <LKDVIcon name="bas" size={16} className={`w-4 h-4 ml-1 text-stone-500 transition-transform ${
 trailMenuOpen ? 'rotate-180' : ''
 }`} />
          </button>

          {/* Tiroir déroulant des sentiers */}
          {trailMenuOpen && (
            <div className="absolute left-0 mt-2 w-80 max-h-[75vh] overflow-y-auto rounded-3xl backdrop-blur-2xl bg-white/95 dark:bg-stone-950/95 border border-white/60 dark:border-white/15 shadow-2xl p-3 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Onglets Sentiers Mythiques vs Recherche PostGIS */}
              <div className="flex items-center gap-1 p-1 bg-stone-200/60 dark:bg-stone-800/60 rounded-2xl mb-2 text-xs font-semibold">
                <button
                  onClick={() => setTrailTab('preset')}
                  className={`flex-1 py-1.5 rounded-xl transition-all ${
                    trailTab === 'preset'
                      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-sm'
                      : 'text-stone-600 dark:text-stone-300 hover:text-black'
                  }`}
                >
                  Mythiques LKDV
                </button>
                <button
                  onClick={() => setTrailTab('live')}
                  className={`flex-1 py-1.5 rounded-xl transition-all ${
                    trailTab === 'live'
                      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-sm'
                      : 'text-stone-600 dark:text-stone-300 hover:text-black'
                  }`}
                >
                  Live PostGIS
                </button>
              </div>

              {trailTab === 'preset' ? (
                <div className="space-y-1.5">
                  {PRESET_TRAILS.map((trail) => {
                    const isSelected = trail.id === currentTrail.id;
                    return (
                      <button
                        key={trail.id}
                        onClick={() => {
                          triggerHaptic('selection');
                          onSelectTrail(trail);
                          setTrailMenuOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-2xl transition-all ${
                          isSelected
                            ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-md'
                            : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        <div className="font-bold text-sm leading-snug">{trail.name}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs opacity-80 font-mono">
                          <span>{trail.distanceKm.toFixed(0)} km</span>
                          <span>•</span>
                          <span>+{trail.elevationGainM}m D+</span>
                          <span>•</span>
                          <span className="capitalize">{trail.difficulty}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher (ex: Mont-Blanc, Gavarnie...)"
                      className="w-full text-xs p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
                    />
                    {isSearchingLive && (
                      <span className="absolute right-3 top-2.5 text-xs text-stone-400">…</span>
                    )}
                  </div>

                  {isLoadingTrail && (
                    <div className="p-3 text-center text-xs text-stone-500 animate-pulse font-mono">
                      Chargement de la trace 3D…
                    </div>
                  )}

                  {liveResults.length > 0 ? (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {liveResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleSelectLiveTrail(r)}
                          className="w-full text-left p-2 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-900 dark:text-stone-100 transition-all"
                        >
                          <div className="font-bold text-xs">{r.name}</div>
                          <div className="text-[10px] text-stone-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{r.massif}</span>
                            <span>•</span>
                            <span>{r.distanceKm} km</span>
                            <span>•</span>
                            <span>+{r.elevationGainM}m</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.trim() && !isSearchingLive ? (
                    <div className="text-[11px] text-stone-500 text-center py-2">
                      Aucun sentier trouvé dans la base PostGIS.
                    </div>
                  ) : (
                    <div className="text-[11px] text-stone-400 text-center py-2">
                      Tapez un massif ou sommet pour explorer la base PostGIS en 3D.
                    </div>
                  )}
                </div>
              )}

              {/* Import GPX personnalisé */}
              <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gpx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-stone-500 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-200/20 transition-all"
                >
                  <LKDVIcon name="exporter" size={16} className="w-4 h-4" />
                  <span>Importer un fichier GPX</span>
                </button>

                {gpxError && (
                  <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl">
                    {gpxError}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Commandes Top Droite (Boussole, Zoom +/-, 3D/2D, Basemap, Filtres, Hors-ligne) */}
        <div className="flex items-center gap-1.5 md:gap-2 pointer-events-auto">
          
          {/* Zoom In & Out */}
          {onZoomIn && onZoomOut && (
            <div className="flex items-center rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  onZoomIn();
                }}
                title="Zoomer sur le relief"
                className="w-9 h-11 flex items-center justify-center text-sm font-bold text-stone-900 dark:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/60 active:scale-95 transition-all"
              >
                +
              </button>
              <div className="w-px h-5 bg-stone-300 dark:bg-stone-700" />
              <button
                onClick={() => {
                  triggerHaptic('light');
                  onZoomOut();
                }}
                title="Dézoomer"
                className="w-9 h-11 flex items-center justify-center text-sm font-bold text-stone-900 dark:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/60 active:scale-95 transition-all"
              >
                −
              </button>
            </div>
          )}

          {/* Basemap Switcher Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic('light');
                setBasemapMenuOpen(!basemapMenuOpen);
                setTrailMenuOpen(false);
                setFilterMenuOpen(false);
              }}
              title="Changer de fond de carte"
              className="w-11 h-11 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg flex items-center justify-center text-stone-900 dark:text-stone-100 active:scale-95 transition-all"
            >
              <span className="text-base">🗺️</span>
            </button>

            {/* Menu des fonds de carte */}
            {basemapMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-stone-950/95 border border-white/60 dark:border-white/15 shadow-2xl p-2 z-30">
                {(
                  [
                    { id: 'satellite-esri', label: 'Satellite Esri', icon: '🛰️' },
                    { id: 'ign-ortho', label: 'IGN Ortho France', icon: '🇫🇷' },
                    { id: 'topo-outdoor', label: 'Topo Outdoor', icon: '🏔️' },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      onChangeBasemap(b.id);
                      setBasemapMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold transition-all ${
                      basemap === b.id
                        ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-sm'
                        : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-900 dark:text-stone-100'
                    }`}
                  >
                    <span>{b.icon}</span>
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtres de calques POI */}
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic('light');
                setFilterMenuOpen(!filterMenuOpen);
                setTrailMenuOpen(false);
                setBasemapMenuOpen(false);
              }}
              title="Filtrer les repères"
              className="w-11 h-11 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg flex items-center justify-center text-stone-900 dark:text-stone-100 active:scale-95 transition-all"
            >
              <span className="text-base">📍</span>
            </button>

            {filterMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-stone-950/95 border border-white/60 dark:border-white/15 shadow-2xl p-2 z-30 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 px-2 py-0.5">
                  Repères sur la carte
                </div>
                {categoriesConfig.map((cat) => {
                  const isActive = activeCategories.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        triggerHaptic('selection');
                        onToggleCategory(cat.id);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-stone-200/80 dark:bg-stone-800/80 text-stone-900 dark:text-stone-100'
                          : 'opacity-50 hover:opacity-80 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                      <span>{isActive ? '✓' : ''}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bascule 3D / 2D */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              onToggle3D();
            }}
            title={is3D ? 'Passer en vue 2D plate' : 'Passer en vue 3D relief'}
            className="w-11 h-11 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg flex items-center justify-center font-bold text-xs tracking-wider text-stone-900 dark:text-stone-100 active:scale-95 transition-all"
          >
            {is3D ? '2D' : '3D'}
          </button>

          {/* Boussole / Reset Nord */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              onResetNorth();
            }}
            title="Réorienter vers le Nord"
            className="w-11 h-11 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg flex items-center justify-center text-stone-900 dark:text-stone-100 active:scale-95 transition-all"
          >
            <div
              className="w-6 h-6 flex items-center justify-center transition-transform duration-200"
              style={{ transform: `rotate(${-bearing}deg)` }}
            >
              <LKDVIcon name="boussole" size={20} className="w-5 h-5" />
            </div>
          </button>

          {/* Bouton Téléchargement Hors-Ligne */}
          <div className="relative">
            {isDownloadingOffline ? (
              <div className="h-11 px-3 rounded-2xl backdrop-blur-xl bg-stone-900 text-white shadow-lg flex items-center gap-2 text-xs font-mono">
                <LKDVIcon name="actualiser" size={16} className="w-4 h-4 animate-spin" />
                <span>{downloadProgress}%</span>
              </div>
            ) : offlinePack ? (
              <div className="flex items-center gap-1">
                <button
                  disabled
                  className="h-11 px-3 rounded-2xl backdrop-blur-xl bg-stone-200/70 dark:bg-stone-800/70 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 shadow-md flex items-center gap-1.5 text-xs font-semibold"
                  title="Disponible pour exploration hors-ligne"
                >
                  <span>✓</span>
                  <span className="hidden sm:inline">Hors-ligne</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic('heavy');
                    onDeleteOffline();
                  }}
                  className="w-8 h-11 rounded-xl hover:bg-rose-500/20 text-stone-400 hover:text-rose-600 transition-colors flex items-center justify-center text-xs"
                  title="Supprimer la zone hors-ligne"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  onDownloadOffline();
                }}
                title="Télécharger cette zone pour un usage hors-ligne"
                className="h-11 px-3 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-stone-950/90 border border-white/60 dark:border-white/15 shadow-lg flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 hover:bg-stone-200/80 dark:hover:bg-stone-800/80 active:scale-95 transition-all"
              >
                <LKDVIcon name="telecharger" size={16} className="w-4 h-4" />
                <span className="hidden sm:inline">Hors-ligne</span>
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
