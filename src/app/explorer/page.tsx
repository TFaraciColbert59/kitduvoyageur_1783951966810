'use client';

import React, { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import type { MapTrail } from '@/components/explorer/types';
import { getDifficultyColor, getDifficultyLabel, formatDistance, formatDuration, getTrailImage } from '@/components/explorer/types';
import ExplorerListCard from '@/components/explorer/ExplorerListCard';
import TrailDetailPanel from '@/components/explorer/TrailDetailPanel';
import AventuresHero from '@/components/explorer/AventuresHero';
import AventureCard from '@/components/explorer/AventureCard';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import BackButton from '@/components/ui/BackButton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import ExplorerMap from '@/components/explorer/ExplorerMap';

const DIFFICULTY_FILTERS = ['Facile', 'Modérée', 'Difficile', 'Expert'];
const DURATION_FILTERS = [
  { label: '< 2h', min: 0, max: 2 },
  { label: '2–4h', min: 2, max: 4 },
  { label: '4–8h', min: 4, max: 8 },
  { label: '+ 8h', min: 8, max: Infinity },
];

export default function ExplorerPage() {
  const router = useRouter();
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<MapTrail | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDifficulties, setActiveDifficulties] = useState<string[]>([]);
  const [activeDuration, setActiveDuration] = useState<string | null>(null);
  const [familyOnly, setFamilyOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('Tout');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  const { data: trailsData, isLoading, error, refetch } = useQuery<MapTrail[]>({
    queryKey: ['hikes'],
    queryFn: async () => {
      const res = await fetch('/api/hikes');
      if (!res.ok) throw new Error('Failed to fetch trails');
      return (await res.json()) as MapTrail[];
    },
    staleTime: 300_000,
  });

  const trails = trailsData ?? [];

  const filteredTrails = useMemo(() => {
    return trails.filter((t) => {
      // FORCE FILTER OUT < 2km (Stale cache protection + strict rule)
      const dist = t.distance_km !== null && t.distance_km !== undefined ? Number(t.distance_km) : 0;
      if (dist < 2.0) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inName = (t.name || '').toLowerCase().includes(q);
        const inRef = (t.ref || '').toLowerCase().includes(q);
        const inTerrain = (t.terrain_type || '').toLowerCase().includes(q);
        if (!inName && !inRef && !inTerrain) return false;
      }
      // Difficulty filter
      if (activeDifficulties.length > 0) {
        const d = (t.difficulty || '').toLowerCase();
        const match = activeDifficulties.some((f) => d.includes(f.toLowerCase()));
        if (!match) return false;
      }
      // Duration filter
      if (activeDuration) {
        const dur = DURATION_FILTERS.find((f) => f.label === activeDuration);
        if (dur && t.duration_hours !== null && t.duration_hours !== undefined) {
          if (t.duration_hours < dur.min || t.duration_hours >= dur.max) return false;
        }
      }
      // Family filter
      if (familyOnly && !t.family_friendly) return false;
      // Category filter (from mobile hero chips)
      if (activeCategory && activeCategory !== 'Tout') {
        const cat = activeCategory.toLowerCase();
        const terrain = (t.terrain_type || '').toLowerCase();
        const network = (t.network || '').toLowerCase();
        const name_ = (t.name || '').toLowerCase();
        const match = terrain.includes(cat) || network.includes(cat) || name_.includes(cat);
        if (!match) return false;
      }
      return true;
    });
  }, [trails, searchQuery, activeDifficulties, activeDuration, familyOnly, activeCategory]);

  const handleTrailClick = useCallback((trail: MapTrail) => {
    setSelectedTrailId(trail.id);
    setSelectedTrail(trail);
    setDetailPanelOpen(true);
  }, []);

  const handleLocationUpdate = useCallback((loc: [number, number]) => {
    setUserLocation(loc);
  }, []);

  const toggleDifficulty = (d: string) => {
    setActiveDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const hasFilters = activeDifficulties.length > 0 || activeDuration || familyOnly;

  return (
    <>
      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block">
        <div className="flex flex-col h-screen bg-[#F5F2EA] font-sans overflow-hidden">
          {/* ── TOP SEARCH BAR ── */}
          <header className="flex-shrink-0 bg-white border-b border-[#E4E0D4] shadow-sm z-30">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Back to home + Logo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <BackButton href="/" label="Accueil" variant="ghost" className="text-xs px-2.5 py-1.5" />
                <div className="w-px h-5 bg-[#E4E0D4]" />
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#1C2620] rounded-lg flex items-center justify-center">
                    <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
                      <path d="M3 17l4-8 4 4 3-6 4 10H3z" />
                    </svg>
                  </div>
                  <span className="font-bold text-[#1C2620] text-sm hidden lg:block">Explorer</span>
                </Link>
              </div>

              {/* Search input */}
              <div className="flex-1 relative max-w-xl">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8A7D]" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Chercher une randonnée, un massif, une région…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#F5F2EA] rounded-xl text-sm text-[#1C2620] placeholder:text-[#9AA89C] border border-[#E4E0D4] focus:outline-none focus:border-[#1C2620]/30 focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA89C] hover:text-[#1C2620]">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Result count */}
              <span className="text-xs text-[#7A8A7D] flex-shrink-0 hidden md:block">
                {isLoading ? '…' : `${filteredTrails.length} randonnée${filteredTrails.length !== 1 ? 's' : ''}`}
              </span>

              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E0D4] text-[#1C2620] text-xs font-medium hover:bg-[#F5F2EA] transition-colors"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="18" rx="1" />
                  <rect x="14" y="3" width="7" height="18" rx="1" />
                </svg>
                <span className="hidden sm:block">Liste</span>
              </button>
            </div>

            {/* ── FILTER CHIPS ── */}
            <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
              {/* Tout réinitialiser */}
              {hasFilters && (
                <button
                  onClick={() => { setActiveDifficulties([]); setActiveDuration(null); setFamilyOnly(false); }}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1C2620] text-white text-xs font-medium"
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Réinitialiser
                </button>
              )}

              {/* Difficulty chips */}
              {DIFFICULTY_FILTERS.map((d) => {
                const active = activeDifficulties.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDifficulty(d)}
                    style={active ? { backgroundColor: getDifficultyColor(d), color: 'white', borderColor: getDifficultyColor(d) } : {}}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      active
                        ? 'shadow-sm'
                        : 'bg-white border-[#E4E0D4] text-[#3A4A3D] hover:border-[#1C2620]/40 hover:bg-[#F5F2EA]'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}

              {/* Duration chips */}
              {DURATION_FILTERS.map((f) => {
                const active = activeDuration === f.label;
                return (
                  <button
                    key={f.label}
                    onClick={() => setActiveDuration(active ? null : f.label)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#1C2620] text-white border-[#1C2620]'
                        : 'bg-white border-[#E4E0D4] text-[#3A4A3D] hover:border-[#1C2620]/40 hover:bg-[#F5F2EA]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}

              {/* Family filter */}
              <button
                onClick={() => setFamilyOnly((v) => !v)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  familyOnly
                    ? 'bg-[#1C2620] text-white border-[#1C2620]'
                    : 'bg-white border-[#E4E0D4] text-[#3A4A3D] hover:border-[#1C2620]/40 hover:bg-[#F5F2EA]'
                }`}
              >
                <svg width="12" height="12" fill={familyOnly ? 'white' : '#3A4A3D'} viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Famille
              </button>
            </div>
          </header>

          {/* ── BODY (Sidebar + Map) ── */}
          <div className="flex flex-1 overflow-hidden">
            {/* ── LEFT SIDEBAR ── */}
            {sidebarOpen && (
              <aside className="w-full md:w-[400px] lg:w-[440px] flex-shrink-0 flex flex-col bg-white border-r border-[#E4E0D4] overflow-hidden z-20">
                {/* List header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E4D8]">
                  <div>
                    <p className="text-sm font-semibold text-[#1C2620]">
                      {isLoading ? 'Chargement…' : `${filteredTrails.length} randonnée${filteredTrails.length !== 1 ? 's' : ''}`}
                    </p>
                    {!isLoading && (
                      <p className="text-[11px] text-[#7A8A7D]">
                        {error ? 'Erreur de chargement' : 'Triées par pertinence'}
                      </p>
                    )}
                  </div>
                  {/* Sort pill (cosmetic) */}
                  <button className="flex items-center gap-1.5 text-xs text-[#3A4A3D] border border-[#E4E0D4] px-2.5 py-1.5 rounded-lg hover:bg-[#F5F2EA] transition-colors">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="9" y2="18" />
                    </svg>
                    Trier
                  </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {isLoading && (
                    <div className="flex flex-col gap-3 p-4">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                          <div className="w-24 h-20 rounded-xl bg-[#E8E4D8]" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-3 bg-[#E8E4D8] rounded-full w-3/4" />
                            <div className="h-2 bg-[#E8E4D8] rounded-full w-1/2" />
                            <div className="h-2 bg-[#E8E4D8] rounded-full w-2/3 mt-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isLoading && error && (
                    <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                      <svg width="32" height="32" fill="none" stroke="#7A8A7D" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-3">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <p className="text-sm font-medium text-[#1C2620]">Erreur de chargement</p>
                      <p className="text-xs text-[#7A8A7D] mt-1">Impossible de charger les randonnées</p>
                    </div>
                  )}

                  {!isLoading && !error && filteredTrails.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                      <svg width="32" height="32" fill="none" stroke="#7A8A7D" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-3">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <p className="text-sm font-medium text-[#1C2620]">Aucun résultat</p>
                      <p className="text-xs text-[#7A8A7D] mt-1">Essayez d'élargir vos filtres</p>
                    </div>
                  )}

                  {!isLoading && !error && filteredTrails.map((trail) => (
                    <ExplorerListCard
                      key={trail.id}
                      trail={trail}
                      isSelected={selectedTrailId === trail.id}
                      onClick={() => handleTrailClick(trail)}
                    />
                  ))}
                </div>
              </aside>
            )}

            {/* ── MAP ── */}
            <div className="relative flex-1">
              <ExplorerMap
                trails={filteredTrails}
                selectedTrailId={selectedTrailId}
                onTrailClick={handleTrailClick}
                userLocation={userLocation}
                onLocationUpdate={handleLocationUpdate}
              />

              {/* ── SELECTED TRAIL POPUP ── */}
              {selectedTrail && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] w-[340px] max-w-[90vw]">
                  <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#E4E0D4]">
                    <div className="flex gap-3 p-3">
                      {/* Thumb */}
                      <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#E7E3D6]">
                        <img
                          src={getTrailImage(selectedTrail.id)}
                          alt={selectedTrail.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[#1C2620] text-sm leading-tight line-clamp-2 mb-1">
                          {selectedTrail.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-[#7A8A7D]">
                          {selectedTrail.distance_km && (
                            <span>{formatDistance(selectedTrail.distance_km)}</span>
                          )}
                          {selectedTrail.duration_hours && (
                            <>
                              <span>·</span>
                              <span>{formatDuration(selectedTrail.duration_hours)}</span>
                            </>
                          )}
                          {selectedTrail.difficulty && (
                            <>
                              <span>·</span>
                              <span style={{ color: getDifficultyColor(selectedTrail.difficulty) }} className="font-medium">
                                {selectedTrail.difficulty}
                              </span>
                            </>
                          )}
                        </div>
                        {selectedTrail.elevation_gain !== null && selectedTrail.elevation_gain !== undefined && (
                          <p className="text-[11px] text-[#7A8A7D] mt-0.5">↑ +{selectedTrail.elevation_gain} m dénivelé</p>
                        )}
                      </div>
                      {/* Close */}
                      <button
                        onClick={() => { setSelectedTrailId(null); setSelectedTrail(null); }}
                        className="flex-shrink-0 w-7 h-7 rounded-full bg-[#F5F2EA] flex items-center justify-center text-[#7A8A7D] hover:bg-[#E8E4D8] transition-colors self-start"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    {/* CTA */}
                    <div className="px-3 pb-3 space-y-1.5">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/preparer-randonnee?routeId=${selectedTrail.id}`);
                        }}
                        className="w-full py-2 bg-[#17402C] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#0F2B1D] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>🎒</span>
                        <span>Préparer la randonnée</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDetailPanelOpen(true);
                        }}
                        className="w-full py-1.5 bg-[#F5F2EA] text-[#1C2620] text-xs font-medium rounded-xl hover:bg-[#EAE6D8] transition-colors"
                      >
                        Voir le détail →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Count badge on map */}
              {!sidebarOpen && (
                <div className="absolute top-4 left-4 z-[400] bg-white rounded-xl shadow-md px-3 py-2 border border-[#E4E0D4]">
                  <p className="text-xs font-semibold text-[#1C2620]">
                    {filteredTrails.length} randonnée{filteredTrails.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Trail detail panel */}
          {detailPanelOpen && selectedTrail && (
            <TrailDetailPanel
              trail={selectedTrail}
              onClose={() => setDetailPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <AventuresHero
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalTrailsCount={filteredTrails.length}
          />
          {/* Mobile-adapted interactive map */}
          <div style={{ height: '250px', width: '100%', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(11,31,23,0.08)' }}>
            <ExplorerMap
              trails={filteredTrails}
              selectedTrailId={selectedTrailId}
              onTrailClick={handleTrailClick}
              userLocation={userLocation}
              onLocationUpdate={handleLocationUpdate}
            />
            {selectedTrail && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  zIndex: 500,
                }}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 24px rgba(11,31,23,0.15)',
                    border: '1px solid rgba(11,31,23,0.06)',
                    overflow: 'hidden',
                    padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div
                      style={{
                        width: '72px',
                        height: '56px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: '#EDF3ED',
                      }}
                    >
                      <img
                        src={getTrailImage(selectedTrail.id)}
                        alt={selectedTrail.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4
                        style={{
                          fontWeight: 600,
                          color: '#0B1F17',
                          fontSize: '13px',
                          lineHeight: 1.3,
                          marginBottom: '4px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {selectedTrail.name}
                      </h4>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          color: '#6B7A72',
                        }}
                      >
                        {selectedTrail.distance_km !== null &&
                          selectedTrail.distance_km !== undefined && (
                            <span>
                              {formatDistance(selectedTrail.distance_km)}
                            </span>
                          )}
                        {selectedTrail.duration_hours !== null &&
                          selectedTrail.duration_hours !== undefined && (
                            <>
                              <span>·</span>
                              <span>
                                {formatDuration(selectedTrail.duration_hours)}
                              </span>
                            </>
                          )}
                        {selectedTrail.difficulty && (
                          <>
                            <span>·</span>
                            <span
                              style={{
                                color: getDifficultyColor(
                                  selectedTrail.difficulty
                                ),
                                fontWeight: 500,
                              }}
                            >
                              {selectedTrail.difficulty}
                            </span>
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={() => setDetailPanelOpen(true)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            background: '#17402C',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '10px',
                            textAlign: 'center',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Voir le détail
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTrailId(null);
                            setSelectedTrail(null);
                          }}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid rgba(11,31,23,0.08)',
                            borderRadius: '10px',
                            background: 'transparent',
                            color: '#6B7A72',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px 8px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#6B7A72', fontWeight: 500 }}>
              {isLoading ? '…' : `${filteredTrails.length} résultat${filteredTrails.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {/* Card list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 16px 16px' }}>
            {isLoading && (
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    border: '2px solid rgba(11,31,23,0.12)',
                    borderTopColor: '#17402C',
                    animation: 'lkdv-spin 0.8s linear infinite',
                  }}
                />
                <span style={{ fontSize: '12px', color: '#6B7A72', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Chargement des sentiers…
                </span>
                <style jsx>{`
                  @keyframes lkdv-spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            {!isLoading && error && (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FBFAF6', borderRadius: '16px', border: '1px solid rgba(11,31,23,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>⚠️</div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#0B1F17' }}>Impossible de charger les sentiers</div>
                <button
                  onClick={() => refetch()}
                  style={{
                    padding: '8px 16px',
                    background: '#17402C',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Réessayer
                </button>
              </div>
            )}

            {!isLoading && !error && filteredTrails.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FBFAF6', borderRadius: '16px', border: '1px solid rgba(11,31,23,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '24px' }}>🧭</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0B1F17' }}>Aucun itinéraire trouvé</div>
                <div style={{ fontSize: '12px', color: '#6B7A72', maxWidth: '240px', lineHeight: 1.4 }}>
                  Ajustez vos filtres de recherche ou de difficulté pour explorer de nouvelles aventures.
                </div>
              </div>
            )}

            {!isLoading && !error && filteredTrails.map((trail) => (
              <AventureCard
                key={trail.id}
                trailId={trail.id}
                difficulty={getDifficultyLabel(trail.difficulty)}
                location={trail.network || trail.terrain_type || 'Alpes'}
                title={trail.name}
                distance={formatDistance(trail.distance_km)}
                elevation={trail.elevation_gain != null && trail.elevation_gain != undefined ? `+${Math.round(trail.elevation_gain)} m` : '—'}
                duration={formatDuration(trail.duration_hours)}
                imageUrl={getTrailImage(trail.id)}
                onClick={() => {
                  setSelectedTrailId(trail.id);
                  setSelectedTrail(trail);
                  setDetailPanelOpen(true);
                }}
                onPrepareClick={() => {
                  router.push(`/preparer-randonnee?routeId=${trail.id}`);
                }}
                onStartClick={() => {
                  router.push(`/randonnee-active?routeId=${trail.id}`);
                }}
              />
            ))}
          </div>

          {/* Footer spacer for bottom tab bar */}

        </MobilePageShell>

        {/* Trail detail panel (shared, positioned fixed) */}
        {detailPanelOpen && selectedTrail && (
          <TrailDetailPanel
            trail={selectedTrail}
            onClose={() => setDetailPanelOpen(false)}
          />
        )}
      </div>
    </>
  );
}
