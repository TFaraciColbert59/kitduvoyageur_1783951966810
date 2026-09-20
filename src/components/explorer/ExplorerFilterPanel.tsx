'use client';

import React from 'react';
import { RotateCCWIcon as RotateCcwAnimated } from '@/components/icons/rotate-ccw';
import { Button, Chip, SearchField } from '@/components/ui';

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
    'text-[length:var(--lkv-text-caption-2)] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)] px-1';

  return (
    <div className="flex flex-col gap-3 font-sans">
      {/* Recherche intégrée */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Recherche directe</span>
        <SearchField
          value={searchQuery ?? ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onClear={() => onSearchChange?.('')}
          placeholder="Rechercher par nom, lieu…"
          aria-label="Rechercher un sentier par nom ou lieu"
        />
      </div>

      {hasFilters && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onReset}
          icon={<RotateCcwAnimated size={10} />}
          className="self-start"
        >
          Réinitialiser les filtres
        </Button>
      )}

      {/* Difficulté */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Difficulté</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DIFFICULTY_FILTERS.map((d) => (
            <Chip
              key={d}
              selected={activeDifficulties.includes(d)}
              onClick={() => onToggleDifficulty(d)}
            >
              {d}
            </Chip>
          ))}
        </div>
      </div>

      {/* Durée */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Durée estimée</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DURATION_FILTERS.map((f) => {
            const active = activeDuration === f.label;
            return (
              <Chip
                key={f.label}
                selected={active}
                onClick={() => onSelectDuration(active ? null : f.label)}
              >
                {f.label}
              </Chip>
            );
          })}
        </div>
      </div>

      {/* Catégorie */}
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Type de parcours</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              selected={activeCategory === c}
              onClick={() => onSelectCategory(c)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {/* Famille */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-[color:var(--lkv-border)]">
        <span className={sectionLabel}>Public</span>
        <Chip selected={familyOnly} onClick={onToggleFamily} className="self-start">
          Adapté aux familles
        </Chip>
      </div>

      {/* Points d'intérêt (POIs sur la carte) */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[color:var(--lkv-border)]">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Points d'intérêt & Équipements</span>
          {activePoiCategories.length > 0 && (
            <span className="text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-secondary)] font-bold">
              {activePoiCategories.length} sélectionné{activePoiCategories.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {POI_FILTERS.map((poi) => (
            <Chip
              key={poi.id}
              selected={activePoiCategories.includes(poi.id)}
              onClick={() => onTogglePoiCategory?.(poi.id)}
            >
              {poi.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
