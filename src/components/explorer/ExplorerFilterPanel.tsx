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
    'text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-1';

  return (
    <div className="flex flex-col gap-3 font-sans">
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="self-start inline-flex items-center gap-1.5 h-6 px-3 rounded-full bg-[#17402C] text-white text-[10px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <RotateCcw size={10} />
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
                className={`h-7 px-3 rounded-full text-[10.5px] font-bold transition-all border cursor-pointer ${
                  active
                    ? 'text-white border-transparent shadow-xs scale-105'
                    : 'glass bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs hover:shadow-xs'
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
                className={`h-7 px-3 rounded-full text-[10.5px] font-bold transition-all border cursor-pointer ${
                  active
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-xs'
                    : 'glass bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs hover:shadow-xs'
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
                className={`h-7 px-3 rounded-full text-[10.5px] font-bold transition-all border cursor-pointer ${
                  active
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-xs'
                    : 'glass bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs hover:shadow-xs'
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
          className={`self-start inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[10.5px] font-bold transition-all border cursor-pointer ${
            familyOnly
              ? 'bg-[#5B7F55] text-white border-transparent shadow-xs'
              : 'glass bg-white/80 hover:bg-white text-[#17402C] border-white/70 shadow-2xs hover:shadow-xs'
          }`}
        >
          <Users size={11} />
          <span>Adapté aux familles</span>
        </button>
      </div>
    </div>
  );
}
