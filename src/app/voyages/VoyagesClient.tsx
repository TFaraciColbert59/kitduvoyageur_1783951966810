'use client';

import React, { useState, useMemo } from 'react';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { TripCard } from '@/features/trips/components/TripCard';
import { TripFiltersBar } from '@/features/trips/components/TripFiltersBar';
import { QuickCreateTripModal } from '@/features/trips/components/QuickCreateTripModal';
import { GlassCard, GlassCapsuleBtn, GlassSubCard, GlassPill } from '@/components/ui';
import { EmptyState } from '@/components/ui/EmptyState';
import { Compass, Plus, Sparkles, Filter } from 'lucide-react';
import { createTripAction } from './actions';
import type {
  TripSummary,
  TripWithDetails,
  TripFilters,
} from '@/features/trips/types/trip.types';

export interface VoyagesClientProps {
  initialPublicTrips: TripSummary[];
  initialUserTrips: TripWithDetails[];
  publicTotal: number;
  isAuthenticated: boolean;
  currentUserId?: string;
}

export default function VoyagesClient({
  initialPublicTrips,
  initialUserTrips,
  isAuthenticated,
}: VoyagesClientProps) {
  const [activeTab, setActiveTab] = useState<'public' | 'user'>(
    isAuthenticated && initialUserTrips.length > 0 ? 'user' : 'public'
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  React.useEffect(() => {
    const handleTabEvent = (e: any) => {
      if (e.detail === 'user' || e.detail === 'public') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('voyages-hub-tab-change', handleTabEvent);
    return () => window.removeEventListener('voyages-hub-tab-change', handleTabEvent);
  }, []);

  const handleTabChange = (tab: 'user' | 'public') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('voyages-hub-tab-change', { detail: tab }));
    }
  };

  // Filtres
  const [filters, setFilters] = useState<TripFilters>({
    search: '',
    status: 'all',
    difficulty: 'all',
    activity: 'all',
  });

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      difficulty: 'all',
      activity: 'all',
    });
  };

  // Liste active filtrée côté client
  const displayedTrips = useMemo(() => {
    const list = activeTab === 'user' ? initialUserTrips : initialPublicTrips;

    return list.filter(trip => {
      // Recherche
      if (filters.search && filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const matchTitle = trip.title.toLowerCase().includes(query);
        const matchDest = trip.destination_name?.toLowerCase().includes(query) || false;
        if (!matchTitle && !matchDest) return false;
      }

      // Difficulté
      if (filters.difficulty && filters.difficulty !== 'all') {
        if (trip.difficulty !== filters.difficulty) return false;
      }

      // Activité
      if (filters.activity && filters.activity !== 'all') {
        if (trip.primary_activity !== filters.activity) return false;
      }

      // Statut
      if (filters.status && filters.status !== 'all') {
        if (trip.status !== filters.status) return false;
      }

      return true;
    });
  }, [activeTab, initialUserTrips, initialPublicTrips, filters]);

  // Colonne Gauche Desktop (260px)
  const renderSidebarLeft = () => (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-y-auto no-scrollbar border border-white/40 shadow-sm select-none gap-3">
      <div className="space-y-3 shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--lkv-text-secondary)]">
          <Compass size={15} />
          <span>Module Voyage</span>
        </div>

        {/* Bouton Créer */}
        <GlassCapsuleBtn
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 !py-2.5 shadow-md min-h-[var(--lkv-touch-min)] cursor-pointer"
        >
          <Plus size={16} />
          <span>Nouveau voyage</span>
        </GlassCapsuleBtn>

        {/* Sélecteur de vue vertical pilule desktop */}
        {isAuthenticated && (
          <div className="space-y-1">
            {[
              { id: 'user' as const, label: 'Mes voyages', count: initialUserTrips.length },
              { id: 'public' as const, label: 'Explorer', count: initialPublicTrips.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs flex items-center justify-between border transition-all min-h-[var(--lkv-touch-min)] cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                    : 'glass-sub-card border border-white/50 text-[var(--lkv-text-primary)] hover:bg-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Résumé des filtres */}
        <GlassSubCard className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--lkv-text-primary)]">
            <span className="flex items-center gap-1">
              <Filter size={12} />
              <span>Filtres actifs</span>
            </span>
            {(filters.activity !== 'all' || filters.difficulty !== 'all' || filters.status !== 'all' || filters.search) && (
              <button
                onClick={handleResetFilters}
                className="text-[10px] text-[var(--lkv-text-secondary)] hover:underline cursor-pointer"
              >
                Effacer
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 text-[10px]">
            <GlassPill>{displayedTrips.length} affichés</GlassPill>
            {filters.activity !== 'all' && <GlassPill tone="info">{filters.activity}</GlassPill>}
            {filters.difficulty !== 'all' && <GlassPill tone="warn">{filters.difficulty}</GlassPill>}
          </div>
        </GlassSubCard>
      </div>

      <div className="pt-3 border-t border-[var(--lkv-border-subtle)] text-[10px] text-[var(--lkv-text-secondary)] space-y-1">
        <div>Catalogue des treks & itinéraires</div>
        <div className="font-mono">LKDV EXPEDITIONS</div>
      </div>
    </aside>
  );

  // Colonne Droite Desktop (300px)
  const renderSidebarRight = () => (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      <GlassCard className="p-3.5 space-y-2.5 text-forest-900">
        <span className="text-xs font-bold uppercase tracking-wider text-sage-800 flex items-center gap-1.5">
          <Sparkles size={13} />
          <span>Statistiques</span>
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Total public</span>
            <span className="font-semibold text-forest-900">{initialPublicTrips.length}</span>
          </div>
          <div className="p-2 rounded-xl bg-white/40 border border-white/60">
            <span className="text-[10px] text-sage-700 block">Mes voyages</span>
            <span className="font-semibold text-forest-900">{initialUserTrips.length}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-3.5 text-xs text-forest-800 space-y-2">
        <h4 className="font-bold text-forest-900">Conseil d’expédition</h4>
        <p className="text-[11px] leading-relaxed text-sage-800">
          Chaque voyage calculera automatiquement vos phases : <strong>Préparer</strong> (avant départ), <strong>Vivre</strong> (cockpit direct), et <strong>Raconter</strong> (retour et partage).
        </p>
      </GlassCard>
    </aside>
  );

  return (
    <AppShellDesktop
      sidebarLeft={renderSidebarLeft()}
      sidebarRight={renderSidebarRight()}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={true}>
          <div className="max-w-7xl mx-auto px-4 py-4 pb-28 text-[var(--lkv-text-primary)]">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Expéditions</h1>
                <p className="text-xs text-[var(--lkv-text-secondary)]">Planifiez et suivez vos aventures.</p>
              </div>
              <GlassCapsuleBtn
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1 min-h-[var(--lkv-touch-min)] cursor-pointer"
              >
                <Plus size={14} />
                <span>Nouveau</span>
              </GlassCapsuleBtn>
            </div>

            <TripFiltersBar
              filters={filters}
              onChange={setFilters}
              onReset={handleResetFilters}
            />

            <div className="grid grid-cols-1 gap-4 pt-2">
              {displayedTrips.map(trip => (
                <TripCard key={trip.id} trip={trip} showRole={activeTab === 'user'} />
              ))}
            </div>
          </div>
        </MobilePageShell>
      }
    >
      <div className="space-y-4">
        {/* Barre de recherche et filtres principale */}
        <div className="p-3.5 rounded-[var(--lkv-radius-card)] glass border border-white/60">
          <TripFiltersBar
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* Grille de voyages */}
        {displayedTrips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedTrips.map(trip => (
              <TripCard key={trip.id} trip={trip} showRole={activeTab === 'user'} />
            ))}
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              title={
                activeTab === 'user'
                  ? 'Aucun voyage créé pour le moment'
                  : 'Aucun voyage ne correspond à vos critères'
              }
              description={
                activeTab === 'user'
                  ? 'Créez votre première expédition pour commencer à planifier vos étapes et votre sac à dos.'
                  : 'Essayez de réinitialiser vos filtres ou de modifier votre recherche.'
              }
              actionLabel={activeTab === 'user' ? 'Créer un voyage' : 'Réinitialiser les filtres'}
              onAction={
                activeTab === 'user'
                  ? () => setIsCreateModalOpen(true)
                  : handleResetFilters
              }
            />
          </div>
        )}
      </div>

      {/* Modal de création rapide */}
      <QuickCreateTripModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmitTrip={createTripAction}
      />
    </AppShellDesktop>
  );
}
