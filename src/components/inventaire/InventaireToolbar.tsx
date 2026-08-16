'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export type CategoryFilter = 'all' | 'couchage' | 'portage' | 'cuisine' | 'vêtement' | 'navigation' | 'sécurité' | 'autre';
export type SortOption = 'weight' | 'name' | 'condition' | 'price' | 'usage';

interface InventaireToolbarProps {
  search: string;
  onSearchChange: (q: string) => void;
  activeCategory: CategoryFilter;
  onCategoryChange: (cat: CategoryFilter) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  categoryCounts: Record<string, number>;
}

export default function InventaireToolbar({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  categoryCounts,
}: InventaireToolbarProps) {
  const categories: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: `Tous (${categoryCounts.all || 0})` },
    { id: 'couchage', label: `Couchage (${categoryCounts.couchage || 0})` },
    { id: 'portage', label: `Portage (${categoryCounts.portage || 0})` },
    { id: 'cuisine', label: `Cuisine (${categoryCounts.cuisine || 0})` },
    { id: 'vêtement', label: `Vêtements (${categoryCounts.vêtement || 0})` },
    { id: 'navigation', label: `Nav / Élec (${categoryCounts.navigation || 0})` },
    { id: 'sécurité', label: `Sécurité (${categoryCounts.sécurité || 0})` },
  ];

  return (
    <div className="bg-white rounded-[0.75rem] p-4 sm:p-5 border border-[#E8E4D8] shadow-sm mb-8 space-y-4 font-sans active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Icon
            name="MagnifyingGlassIcon"
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#132219]/40"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un article, une marque..."
            className="w-full bg-[#F5F3ED] border border-[#E8E4D8] rounded-full pl-11 pr-4 py-2.5 text-xs sm:text-sm text-[#132219] font-medium placeholder-[#132219]/40 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#132219]/40 hover:text-[#132219]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills (Horizontal Scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {categories.map((c) => {
            const isActive = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onCategoryChange(c.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#132219] text-white shadow-md'
                    : 'bg-[#F5F3ED] text-[#132219]/70 hover:bg-[#E8E4D8] hover:text-[#132219]'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Sort & View Mode Toggles */}
        <div className="flex items-center gap-3 shrink-0 justify-end">
          
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="appearance-none bg-[#F5F3ED] border border-[#E8E4D8] rounded-full px-4 py-2 pr-8 text-xs font-extrabold text-[#132219] outline-none cursor-pointer hover:bg-[#E8E4D8] transition-colors"
            >
              <option value="weight">Trier par poids ↓</option>
              <option value="name">Nom (A-Z)</option>
              <option value="condition">État du matériel</option>
              <option value="price">Prix d&apos;achat</option>
              <option value="usage">Nombre d&apos;utilisations</option>
            </select>
            <Icon
              name="ChevronDownIcon"
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#132219]/60 pointer-events-none"
            />
          </div>

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-[#F5F3ED] border border-[#E8E4D8] rounded-full p-1">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white text-[#132219] shadow-sm'
                  : 'text-[#132219]/50 hover:text-[#132219]'
              }`}
              title="Vue Grille"
            >
              <Icon name="Squares2X2Icon" size={14} />
              <span className="hidden sm:inline">Grille</span>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-[#132219] shadow-sm'
                  : 'text-[#132219]/50 hover:text-[#132219]'
              }`}
              title="Vue Liste"
            >
              <Icon name="ListBulletIcon" size={14} />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
