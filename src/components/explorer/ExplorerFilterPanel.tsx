'use client';

import React from 'react';
import { RotateCcw, Users } from 'lucide-react';
import { getDifficultyColor } from './types';

interface ExplorerFilterPanelProps {
  activeDifficulties: string[];
  activeDuration: string | null;
  activeCategory: string;
  familyOnly: boolean;
  hasFilters: boolean;
  onToggleDifficulty: (d: string) => void;
  onSelectDuration: (label: string | null) => void;
  onSelectCategory: (c: string) => void;
  onToggleFamily: () => void;
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
  activeDifficulties,
  activeDuration,
  activeCategory,
  familyOnly,
  hasFilters,
  onToggleDifficulty,
  onSelectDuration,
  onSelectCategory,
  onToggleFamily,
  onReset,
}: ExplorerFilterPanelProps) {
  const sectionLabel =
    'text-[9px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-1';

  return (
    <div className="flex flex-col gap-2.5">
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="self-start inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[#17402C] text-white text-[9.5px] font-bold  active:scale-95 transition-all"
        >
          <RotateCcw size={9} />
          Réinitialiser
        </button>
      )}

      {/* Difficulté */}
      <div className="flex flex-col gap-1">
        <span className={sectionLabel}>Difficulté</span>
        <div className="flex items-center gap-1 flex-wrap">
          {DIFFICULTY_FILTERS.map((d) => {
            const active = activeDifficulties.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggleDifficulty(d)}
                className={`h-6 px-2.5 rounded-full text-[10px] font-bold transition-all border ${
                  active
                    ? 'text-white border-transparent '
                    : 'bg-white text-[#365233] border-stone-200'
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
      <div className="flex flex-col gap-1">
        <span className={sectionLabel}>Durée</span>
        <div className="flex items-center gap-1 flex-wrap">
          {DURATION_FILTERS.map((f) => {
            const active = activeDuration === f.label;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => onSelectDuration(active ? null : f.label)}
                className={`h-6 px-2.5 rounded-full text-[10px] font-bold transition-all border ${
                  active
                    ? 'bg-[#17402C] text-white border-transparent '
                    : 'bg-white text-[#365233] border-stone-200'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catégorie */}
      <div className="flex flex-col gap-1">
        <span className={sectionLabel}>Type</span>
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIES.map((c) => {
            const active = activeCategory === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onSelectCategory(c)}
                className={`h-6 px-2.5 rounded-full text-[10px] font-bold transition-all border ${
                  active
                    ? 'bg-[#17402C] text-white border-transparent '
                    : 'bg-white text-[#365233] border-stone-200'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Famille */}
      <div className="flex flex-col gap-1">
        <span className={sectionLabel}>Public</span>
        <button
          type="button"
          onClick={onToggleFamily}
          className={`self-start inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold transition-all border ${
            familyOnly
              ? 'bg-[#17402C] text-white border-transparent '
              : 'bg-white text-[#365233] border-stone-200'
          }`}
        >
          <Users size={10} />
          Adapté aux familles
        </button>
      </div>
    </div>
  );
}
