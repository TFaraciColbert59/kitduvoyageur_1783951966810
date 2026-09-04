'use client';

import React, { useState, useMemo } from 'react';
import AppShell from '@/components/shell/AppShell';
import { TripCard } from '@/features/trips/components/TripCard';
import { TripFiltersBar } from '@/features/trips/components/TripFiltersBar';
import { QuickCreateTripModal } from '@/features/trips/components/QuickCreateTripModal';
import LkvButton from '@/components/ui/LkvButton';
import { EmptyState } from '@/components/ui/EmptyState';
import IOSSegmentedControl from '@/components/ui/IOSSegmentedControl';
import { Compass, Plus } from 'lucide-react';
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

  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Header de la page */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5B7F55] mb-1">
              <Compass size={15} />
              Module Voyage
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17402C] tracking-tight">
              Expéditions & Treks
            </h1>
            <p className="text-xs sm:text-sm text-[#5B7F55] mt-1 max-w-xl">
              Planifiez vos aventures en autonomie, tracez vos étapes et préparez votre équipement de terrain.
            </p>
          </div>

          <LkvButton
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            className="self-start sm:self-center shadow-lg hover:shadow-xl transition-all"
          >
            <Plus size={16} className="mr-1.5" />
            Nouveau voyage
          </LkvButton>
        </div>

        {/* Sélecteur d'onglets (si connecté) */}
        {isAuthenticated && (
          <div className="mb-6 max-w-md">
            <IOSSegmentedControl
              options={[
                { id: 'user', label: `Mes voyages (${initialUserTrips.length})` },
                { id: 'public', label: `Explorer (${initialPublicTrips.length})` },
              ]}
              value={activeTab}
              onChange={(val: string) => setActiveTab(val as 'public' | 'user')}
            />
          </div>
        )}

        {/* Barre de filtres */}
        <TripFiltersBar
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* Grille de voyages */}
        {displayedTrips.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </AppShell>
  );
}
