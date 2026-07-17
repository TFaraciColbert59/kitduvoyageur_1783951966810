'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { ExploreTrail } from '@/components/explorer/AdventureScore';
import AIExplorerSearch from '@/components/explorer/AIExplorerSearch';
import TrailCard from '@/components/explorer/TrailCard';
import TrailPanel from '@/components/explorer/TrailPanel';

// Dynamic import for map (no SSR — Leaflet requires browser)
const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0f1a16]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#E4501C]/40 border-t-[#E4501C] rounded-full animate-spin" />
        <p className="text-white/30 text-xs font-mono">Chargement de la carte…</p>
      </div>
    </div>
  ),
});

type FilterDifficulty = 'all' | 'easy' | 'moderate' | 'hard' | 'expert';

export default function ExplorerPage() {
  const [trails, setTrails] = useState<ExploreTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<ExploreTrail | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load trails from Supabase
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('explore_trails')
          .select('*')
          .limit(200);

        if (err) throw err;
        setTrails((data as ExploreTrail[]) || []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur de chargement';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleTrailClick = useCallback((trail: ExploreTrail) => {
    setSelectedTrail(trail);
    setSidebarOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedTrail(null);
    setSidebarOpen(false);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  // Filtered trails for sidebar list
  const filteredTrails = trails.filter((t) => {
    const matchDiff = filterDifficulty === 'all' || t.difficulty === filterDifficulty;
    const matchSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.terrain_type || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchDiff && matchSearch;
  });

  const diffFilters: { key: FilterDifficulty; label: string; color: string }[] = [
    { key: 'all', label: 'Toutes', color: 'text-white/60' },
    { key: 'easy', label: 'Facile', color: 'text-emerald-400' },
    { key: 'moderate', label: 'Modérée', color: 'text-orange-400' },
    { key: 'hard', label: 'Difficile', color: 'text-red-400' },
    { key: 'expert', label: 'Expert', color: 'text-violet-400' },
  ];

  return (
    <div className="fixed inset-0 bg-[#0f1a16] flex flex-col overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 z-[1500] flex items-center gap-3 px-4 py-3 bg-[#0f1a16]/95 border-b border-white/8 backdrop-blur-md">
        {/* Back to home */}
        <Link
          href="/"
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Retour"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Logo / title */}
        <div className="flex-shrink-0 hidden sm:flex flex-col leading-none">
          <span className="text-[8px] font-mono text-white/25 tracking-[0.2em] uppercase">Le Kit du</span>
          <span className="font-bold text-white text-sm tracking-tight">EXPLORER</span>
        </div>

        {/* AI Search — center */}
        <div className="flex-1 min-w-0">
          <AIExplorerSearch onSearch={handleSearch} />
        </div>

        {/* Trail count */}
        <div className="flex-shrink-0 hidden sm:flex flex-col items-end">
          <span className="text-[10px] font-mono text-white/25 uppercase tracking-wider">Randonnées</span>
          <span className="text-white font-mono font-bold text-sm">
            {loading ? '…' : filteredTrails.length}
          </span>
        </div>

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex-shrink-0 md:hidden w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Liste des randonnées"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left sidebar (desktop) / drawer (mobile) ── */}
        <div
          className={`
            flex-shrink-0 flex flex-col bg-[#0f1a16]/98 border-r border-white/8 backdrop-blur-md
            transition-all duration-300 overflow-hidden
            ${isMobile
              ? `fixed inset-y-0 left-0 z-[1400] w-[85vw] max-w-sm ${sidebarOpen && !selectedTrail ? 'translate-x-0' : '-translate-x-full'}`
              : `w-80 xl:w-96 ${selectedTrail ? 'hidden' : 'flex'}`
            }
          `}
        >
          {/* Sidebar header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold text-sm">Randonnées</h2>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center"
                >
                  <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Difficulty filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {diffFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterDifficulty(f.key)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    filterDifficulty === f.key
                      ? 'bg-white/15 text-white border border-white/20'
                      : `bg-white/4 border border-white/8 ${f.color} hover:bg-white/8`
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trail list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-6 h-6 border-2 border-[#E4501C]/40 border-t-[#E4501C] rounded-full animate-spin" />
                <p className="text-white/30 text-xs font-mono">Chargement…</p>
              </div>
            )}

            {error && (
              <div className="mx-1 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-xs font-mono">{error}</p>
              </div>
            )}

            {!loading && !error && filteredTrails.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="text-3xl">🗺</span>
                <p className="text-white/30 text-xs font-mono text-center">
                  Aucune randonnée trouvée
                </p>
              </div>
            )}

            {!loading &&
              filteredTrails.map((trail) => (
                <TrailCard
                  key={trail.id}
                  trail={trail}
                  selected={selectedTrail?.id === trail.id}
                  onClick={(t) => {
                    handleTrailClick(t);
                    if (isMobile) setSidebarOpen(false);
                  }}
                />
              ))}
          </div>
        </div>

        {/* Mobile sidebar backdrop */}
        {isMobile && sidebarOpen && !selectedTrail && (
          <div
            className="fixed inset-0 z-[1300] bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Map ── */}
        <div className="flex-1 relative overflow-hidden">
          <ExplorerMap
            trails={trails}
            selectedTrailId={selectedTrail?.id || null}
            onTrailClick={handleTrailClick}
          />

          {/* Loading overlay on map */}
          {loading && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-[#0f1a16]/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#E4501C]/30 border-t-[#E4501C] rounded-full animate-spin" />
                <p className="text-white/50 text-sm font-mono">Chargement des randonnées…</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop trail panel (right side) ── */}
        {selectedTrail && !isMobile && (
          <div className="flex-shrink-0 w-80 xl:w-96 overflow-hidden">
            <TrailPanel
              trail={selectedTrail}
              onClose={handleClosePanel}
              isMobile={false}
            />
          </div>
        )}
      </div>

      {/* ── Mobile bottom sheet panel ── */}
      {selectedTrail && isMobile && (
        <TrailPanel
          trail={selectedTrail}
          onClose={handleClosePanel}
          isMobile={true}
        />
      )}
    </div>
  );
}