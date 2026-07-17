'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

import { createClient } from '@/lib/supabase/client';
import type { ExploreTrail } from '@/components/explorer/AdventureScore';
import ExplorerBottomSheet from '@/components/explorer/ExplorerBottomSheet';
import ExplorerFilterSheet from '@/components/explorer/ExplorerFilterSheet';
import AdventureDetailPanel from '@/components/explorer/AdventureDetailPanel';
import ExplorerFloatingHeader from '@/components/explorer/ExplorerFloatingHeader';
import type { FilterState } from '@/components/explorer/types';
import { DEFAULT_FILTERS } from '@/components/explorer/types';

const ExplorerMap = dynamic(() => import('@/components/explorer/ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1a12]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-[#2D5A27]/30 rounded-full" />
          <div className="absolute inset-0 border-2 border-t-[#2D5A27] rounded-full animate-spin" />
        </div>
        <p className="text-[#8BAF7C]/60 text-xs font-mono tracking-widest uppercase">Chargement de la carte…</p>
      </div>
    </div>
  ),
});

export default function ExplorerPage() {
  const [trails, setTrails] = useState<ExploreTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrail, setSelectedTrail] = useState<ExploreTrail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('explore_trails')
          .select('*')
          .limit(200);
        setTrails((data as ExploreTrail[]) || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  const handleTrailClick = useCallback((trail: ExploreTrail) => {
    setSelectedTrail(trail);
    setDetailOpen(true);
    setBottomSheetExpanded(false);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedTrail(null);
  }, []);

  const filteredTrails = trails.filter((t) => {
    const matchSearch =
      !searchQuery ||
      (t.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchDiff =
      filters.difficulty.length === 0 || filters.difficulty.includes(t.difficulty);

    return matchSearch && matchDiff;
  });

  const activeFilterCount =
    filters.type.length +
    filters.difficulty.length +
    filters.duration.length +
    filters.ambiance.length;

  return (
    <div className="fixed inset-0 bg-[#0d1a12] overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <ExplorerMap
          trails={filteredTrails}
          selectedTrailId={selectedTrail?.id || null}
          onTrailClick={handleTrailClick}
          userLocation={userLocation}
        />
      </div>

      {/* Floating header */}
      <ExplorerFloatingHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLocate={handleLocate}
        onOpenFilters={() => setFilterSheetOpen(true)}
        activeFilterCount={activeFilterCount}
        trailCount={filteredTrails.length}
        loading={loading}
      />

      {/* Bottom sheet with adventure cards */}
      {!detailOpen && (
        <ExplorerBottomSheet
          trails={filteredTrails}
          loading={loading}
          expanded={bottomSheetExpanded}
          onExpandChange={setBottomSheetExpanded}
          onTrailSelect={handleTrailClick}
          selectedTrailId={selectedTrail?.id || null}
        />
      )}

      {/* Filter bottom sheet */}
      <ExplorerFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
      />

      {/* Adventure detail panel */}
      {detailOpen && selectedTrail && (
        <AdventureDetailPanel
          trail={selectedTrail}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}