'use client';

import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { LkvButton } from '@/components/ui/LkvButton';
import { GlassCard } from '@/components/ui/GlassCard';
import type { TripFilters, TripStatus, TripDifficulty, TripActivityType } from '../types/trip.types';

export interface TripFiltersBarProps {
  filters: TripFilters;
  onChange: (filters: TripFilters) => void;
  onReset: () => void;
}

export function TripFiltersBar({ filters, onChange, onReset }: TripFiltersBarProps) {
  const hasActiveFilters = Boolean(
    filters.search ||
      (filters.status && filters.status !== 'all') ||
      (filters.difficulty && filters.difficulty !== 'all') ||
      (filters.activity && filters.activity !== 'all')
  );

  return (
    <GlassCard tone="neutral" blur="sm" className="p-3 sm:p-4 rounded-[24px] border border-white/70 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Barre de Recherche Texte */}
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5B7F55] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Rechercher par titre ou destination..."
            value={filters.search || ''}
            onChange={e => onChange({ ...filters, search: e.target.value, page: 1 })}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/70 border border-black/10 focus:border-[#5B7F55] focus:bg-white text-[16px] sm:text-sm text-[#17402C] placeholder-[#5B7F55]/60 outline-none transition-all shadow-inner"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '', page: 1 })}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Effacer la recherche"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtres Dropdowns / Selects */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Difficulté */}
          <select
            value={filters.difficulty || 'all'}
            aria-label="Difficulté"
            onChange={e =>
              onChange({
                ...filters,
                difficulty: e.target.value as TripDifficulty | 'all',
                page: 1,
              })
            }
            className="px-3 py-2 rounded-full bg-white/70 border border-black/10 text-xs sm:text-sm text-[#17402C] focus:border-[#5B7F55] outline-none font-medium cursor-pointer"
          >
            <option value="all">Toutes difficultés</option>
            <option value="easy">Facile</option>
            <option value="moderate">Modéré</option>
            <option value="hard">Difficile</option>
            <option value="expert">Expert</option>
          </select>

          {/* Activité */}
          <select
            value={filters.activity || 'all'}
            aria-label="Activité"
            onChange={e =>
              onChange({
                ...filters,
                activity: e.target.value as TripActivityType | 'all',
                page: 1,
              })
            }
            className="px-3 py-2 rounded-full bg-white/70 border border-black/10 text-xs sm:text-sm text-[#17402C] focus:border-[#5B7F55] outline-none font-medium cursor-pointer"
          >
            <option value="all">Toutes activités</option>
            <option value="hiking">Randonnée</option>
            <option value="trekking">Trek</option>
            <option value="bivouac">Bivouac</option>
            <option value="roadtrip">Roadtrip</option>
            <option value="cultural">Culture</option>
            <option value="bushcraft">Bushcraft</option>
            <option value="mixed">Mixte</option>
          </select>

          {/* Statut */}
          <select
            value={filters.status || 'all'}
            aria-label="Statut"
            onChange={e =>
              onChange({
                ...filters,
                status: e.target.value as TripStatus | 'all',
                page: 1,
              })
            }
            className="px-3 py-2 rounded-full bg-white/70 border border-black/10 text-xs sm:text-sm text-[#17402C] focus:border-[#5B7F55] outline-none font-medium cursor-pointer"
          >
            <option value="all">Tous statuts</option>
            <option value="planned">Planifié</option>
            <option value="active">En cours</option>
            <option value="completed">Terminé</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <LkvButton
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-xs text-[#A8443A] hover:bg-[#A8443A]/10 rounded-full px-3"
            >
              <RotateCcw size={13} className="mr-1" />
              Réinitialiser
            </LkvButton>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
