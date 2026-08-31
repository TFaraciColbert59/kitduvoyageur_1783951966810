'use client';

import React from 'react';
import { SearchIcon as SearchAnimated } from '@/components/icons/search';
import { RotateCCWIcon as RotateCcwAnimated } from '@/components/icons/rotate-ccw';
import { getDifficultyColor } from './types';

export interface PoiFilterItem {
  id: string;
  label: string;
  color: string;
}

export const POI_FILTERS: PoiFilterItem[] = [
  { id: 'refuge', label: 'Refuges & Cabanes', color: '#17402C' },
  { id: 'water', label: "Points d'eau", color: '#0284C7' },
  { id: 'summit', label: 'Sommets & Pics', color: '#2D6B4A' },
  { id: 'camping', label: 'Bivouac & Camping', color: '#16A34A' },
  { id: 'col', label: 'Cols', color: '#D97706' },
  { id: 'waterfall', label: 'Cascades', color: '#0EA5E9' },
  { id: 'viewpoint', label: 'Points de vue', color: '#7C3AED' },
];

interface ExplorerFilterPanelProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  activeDifficulties: string[];
  activeDuration: string | null;
  activeCategory: string;
  familyOnly: boolean;
  activePoiCategories?: string[];
  hasFilters: boolean;
  onToggleDifficulty: (d: string) => void;
  onSelectDuration: (label: string | null) => void;
  onSelectCategory: (c: string) => void;
  onToggleFamily: () => void;
  onTogglePoiCategory?: (poiId: string) => void;
  onReset: () => void;
}

const DIFFICULTY_FILTERS = ['Facile', 'Modérée', 'Difficile', 'Expert'];
const DURATION_FILTERS = [
  { label: '< 2h', min: 0, max: 2 },
  { label: '2–4h', min: 2, max: 4 },
  { label: '4–8h', min: 4, max: 8 },
  { label: '+ 8h', min: 8, max: Infinity },
];
const CATEGORIES = ['Tout', 'Refuge', 'Itinéraire', 'Bivouac', 'Escalade', 'Multi-jours', 'Famille'];

export default function ExplorerFilterPanel({
  searchQuery,
  onSearchChange,
  activeDifficulties,
  activeDuration,
  activeCategory,
  familyOnly,
  activePoiCategories = [],
  hasFilters,
  onToggleDifficulty,
  onSelectDuration,
  onSelectCategory,
  onToggleFamily,
  onTogglePoiCategory,
  onReset,
}: ExplorerFilterPanelProps) {
  const sectionLabel =
    'text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-1';

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Recherche intégrée */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Recherche directe</span>
        <div className="relative w-full">
          <SearchAnimated size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A7064]" />
          <input
            type="text"
            placeholder="Rechercher par nom, lieu…"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full h-9 pl-9 pr-8 rounded-full text-xs font-semibold text-[#17402C] placeholder:text-[#5A7064]/70 bg-white/70 hover:bg-white/90 focus:bg-white border border-white/80 shadow-2xs outline-none focus-visible:ring-1.5 focus-visible:ring-[#17402C]/30 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-[#17402C] text-[10px] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="self-start glass-capsule-btn primary !py-1 !px-3 text-[10px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <RotateCcwAnimated size={10} />
          <span>Réinitialiser les filtres</span>
        </button>
      )}

      {/* Difficulté */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Difficulté</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DIFFICULTY_FILTERS.map((d) => {
            const active = activeDifficulties.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggleDifficulty(d)}
                className={`glass-capsule-btn !py-1 !px-3 text-[10.5px] font-bold transition-all cursor-pointer ${
                  active ? '!text-white !border-transparent shadow-xs scale-105' : 'hover:scale-105'
                }`}
                style={active ? { backgroundColor: getDifficultyColor(d) } : {}}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Durée */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Durée estimée</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DURATION_FILTERS.map((f) => {
            const active = activeDuration === f.label;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => onSelectDuration(active ? null : f.label)}
                className={`glass-capsule-btn !py-1 !px-3 text-[10.5px] font-bold transition-all cursor-pointer ${
                  active ? 'primary shadow-xs scale-105' : 'hover:scale-105'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catégorie */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Type de parcours</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => {
            const active = activeCategory === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onSelectCategory(c)}
                className={`glass-capsule-btn !py-1 !px-3 text-[10.5px] font-bold transition-all cursor-pointer ${
                  active ? 'primary shadow-xs scale-105' : 'hover:scale-105'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Famille */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-[#17402C]/10">
        <span className={sectionLabel}>Public</span>
        <button
          type="button"
          onClick={onToggleFamily}
          className={`self-start glass-capsule-btn !py-1 !px-3 text-[10.5px] font-bold transition-all cursor-pointer ${
            familyOnly ? 'primary shadow-xs scale-105' : 'hover:scale-105'
          }`}
        >
          <span>Adapté aux familles</span>
        </button>
      </div>

      {/* Points d'intérêt (POIs sur la carte) */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#17402C]/10">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Points d'intérêt & Équipements</span>
          {activePoiCategories.length > 0 && (
            <span className="text-[9px] font-mono text-[#5B7F55] font-bold">
              {activePoiCategories.length} sélectionné{activePoiCategories.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {POI_FILTERS.map((poi) => {
            const active = activePoiCategories.includes(poi.id);
            return (
              <button
                key={poi.id}
                type="button"
                onClick={() => onTogglePoiCategory?.(poi.id)}
                className={`glass-capsule-btn !py-1 !px-3 text-[10.5px] font-bold transition-all cursor-pointer ${
                  active ? '!text-white !border-transparent shadow-xs scale-105' : 'hover:scale-105'
                }`}
                style={active ? { backgroundColor: poi.color } : {}}
              >
                <span>{poi.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
