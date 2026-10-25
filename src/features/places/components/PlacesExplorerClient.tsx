'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useMemo } from 'react';
import { PlaceCard } from './PlaceCard';
import { AddPlaceToTripModal, type UserTripOption } from './AddPlaceToTripModal';
import { Card, Chip, EmptyState, SearchField, Tabs } from '@/components/ui';
import type { PlaceWithDistance, PlaceCategory } from '../types/place.types';

export interface PlacesExplorerClientProps {
  initialPlaces: PlaceWithDistance[];
  userTrips: UserTripOption[];
}

const COUNTRIES = [
  { code: 'ALL', label: 'Toutes destinations' },
  { code: 'FR', label: 'France (Alpes & Pyrénées)' },
  { code: 'NP', label: 'Népal (Himalaya)' },
  { code: 'PE', label: 'Pérou (Andes)' },
  { code: 'IS', label: 'Islande (Hautes Terres)' },
  { code: 'MA', label: 'Maroc (Haut-Atlas)' },
];

const CATEGORIES: Array<{ id: 'ALL' | PlaceCategory; label: string }> = [
  { id: 'ALL', label: 'Toutes catégories' },
  { id: 'refuge', label: 'Refuges Alpins' },
  { id: 'bivouac', label: 'Bivouacs' },
  { id: 'water_source', label: 'Sources d’eau' },
  { id: 'pass', label: 'Cols d’altitude' },
  { id: 'viewpoint', label: 'Belvédères' },
  { id: 'lake', label: 'Lacs' },
  { id: 'campground', label: 'Campements' },
];

export function PlacesExplorerClient({ initialPlaces, userTrips }: PlacesExplorerClientProps) {
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | PlaceCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlaceForTrip, setSelectedPlaceForTrip] = useState<PlaceWithDistance | null>(null);

  const filteredPlaces = useMemo(() => {
    return initialPlaces.filter((p) => {
      if (selectedCountry !== 'ALL' && p.country_code !== selectedCountry) {
        return false;
      }
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesRegion = (p.region || '').toLowerCase().includes(q);
        const matchesCity = (p.city || '').toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRegion && !matchesCity && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [initialPlaces, selectedCountry, selectedCategory, searchQuery]);

  return (
    <div className="space-y-[var(--space-6)]">
      {/* Barre de Recherche et Filtres */}
      <Card className="space-y-[var(--space-4)] p-[var(--space-4)] sm:p-[var(--space-5)]">
        {/* Champ de recherche */}
        <SearchField
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Rechercher un refuge, un col, une source d’eau..."
          aria-label="Rechercher un lieu"
        />

        {/* Sélecteur de Pays (Tabs horizontaux) */}
        <Tabs
          variant="scrollable"
          ariaLabel="Filtrer par pays"
          options={COUNTRIES.map((c) => ({ id: c.code, label: c.label }))}
          value={selectedCountry}
          onChange={setSelectedCountry}
        />

        {/* Sélecteur de Catégorie (Chips) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Résumé des résultats */}
      <div className="flex items-center justify-between px-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
        <span>
          <strong className="font-bold text-[color:var(--lkv-text-primary)]">{filteredPlaces.length}</strong> lieux
          répertoriés
        </span>
        {filteredPlaces.length > 0 && (
          <span>Triés par score bayésien & preuve terrain</span>
        )}
      </div>

      {/* Grille des Lieux */}
      {filteredPlaces.length === 0 ? (
        <EmptyState
          icon={<Icon name="map-pin" className="h-8 w-8" />}
          title="Aucun lieu ne correspond à ces critères"
          description="Essayez d’élargir vos filtres de pays ou de catégorie."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              onAddToTrip={(p) => setSelectedPlaceForTrip(p)}
            />
          ))}
        </div>
      )}

      {/* Modale d'ajout au voyage */}
      <AddPlaceToTripModal
        place={selectedPlaceForTrip}
        isOpen={!!selectedPlaceForTrip}
        onClose={() => setSelectedPlaceForTrip(null)}
        userTrips={userTrips}
      />
    </div>
  );
}
