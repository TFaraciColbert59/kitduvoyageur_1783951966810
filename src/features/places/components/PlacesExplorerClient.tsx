'use client';

import React, { useState, useMemo } from 'react';
import { PlaceCard } from './PlaceCard';
import { AddPlaceToTripModal, type UserTripOption } from './AddPlaceToTripModal';
import { Search, MapPin, X } from 'lucide-react';
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

export function PlacesExplorerClient({
  initialPlaces,
  userTrips,
}: PlacesExplorerClientProps) {
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
    <div className="space-y-6">
      {/* Barre de Recherche et Filtres */}
      <div className="bg-white/80 backdrop-blur-md border border-stone-200/80 rounded-[24px] p-4 sm:p-5 shadow-sm space-y-4">
        {/* Champ de recherche */}
        <div className="relative">
          <Search className="w-5 h-5 text-stone-600 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un refuge, un col, une source d’eau..."
            className="w-full h-12 pl-12 pr-10 rounded-2xl bg-stone-100/80 border border-stone-200 text-sm text-stone-900 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#17402C]/20 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-stone-600 hover:text-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sélecteur de Pays (Tabs horizontaux) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setSelectedCountry(c.code)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[40px] border ${
                selectedCountry === c.code
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Sélecteur de Catégorie (Chips) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-[#5B7F55] text-white border-[#5B7F55]'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Résumé des résultats */}
      <div className="flex items-center justify-between text-xs text-stone-600 px-1">
        <span>
          <strong className="text-stone-900 font-bold">{filteredPlaces.length}</strong> lieux répertoriés
        </span>
        {filteredPlaces.length > 0 && (
          <span className="text-stone-600">
            Triés par score bayésien & preuve terrain
          </span>
        )}
      </div>

      {/* Grille des Lieux */}
      {filteredPlaces.length === 0 ? (
        <div className="p-12 text-center bg-white/70 border border-stone-200/80 rounded-[28px]">
          <MapPin className="w-8 h-8 text-stone-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-stone-900">
            Aucun lieu ne correspond à ces critères
          </h3>
          <p className="text-xs text-stone-600 mt-1">
            Essayez d’élargir vos filtres de pays ou de catégorie.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
