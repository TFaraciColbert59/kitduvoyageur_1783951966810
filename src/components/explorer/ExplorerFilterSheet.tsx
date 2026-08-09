'use client';

import React, { useEffect } from 'react';
import type { FilterStates } from './types';

interface ExplorerFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterStates;
  onChange: (f: FilterStates) => void;
}

const FILTER_SECTIONS = [
  {
    key: 'type' as keyof FilterStates,
    label: 'Type d\'aventure',
    options: [
      { value: 'randonnee', label: 'Randonnée', icon: '🥾' },
      { value: 'trek', label: 'Trek', icon: '⛰' },
      { value: 'bivouac', label: 'Bivouac', icon: '🏕' },
      { value: 'velo', label: 'Vélo', icon: '🚴' },
      { value: 'famille', label: 'Famille', icon: '👨‍👩‍👧' },
      { value: 'voyage', label: 'Voyage', icon: '✈️' },
    ],
  },
  {
    key: 'difficulty' as keyof FilterStates,
    label: 'Difficulté',
    options: [
      { value: 'easy', label: 'Facile', icon: '🟢' },
      { value: 'moderate', label: 'Modérée', icon: '🟡' },
      { value: 'hard', label: 'Difficile', icon: '🔴' },
      { value: 'expert', label: 'Expert', icon: '⚫' },
    ],
  },
  {
    key: 'duration' as keyof FilterStates,
    label: 'Durée',
    options: [
      { value: '2h', label: '< 2h', icon: '⚡' },
      { value: 'half', label: 'Demi-journée', icon: '🌤' },
      { value: 'day', label: 'Journée', icon: '☀️' },
      { value: 'multi', label: 'Plusieurs jours', icon: '🌙' },
    ],
  },
  {
    key: 'ambiance' as keyof FilterStates,
    label: 'Ambiance',
    options: [
      { value: 'montagne', label: 'Montagne', icon: '🏔' },
      { value: 'foret', label: 'Forêt', icon: '🌲' },
      { value: 'mer', label: 'Mer', icon: '🌊' },
      { value: 'desert', label: 'Désert', icon: '🏜' },
      { value: 'urbain', label: 'Urbain', icon: '🏙' },
    ],
  },
];

export default function ExplorerFilterSheet({ open, onClose, filters, onChange }: ExplorerFilterSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const toggle = (key: keyof FilterState, value: string) => {
    const current = (filters[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated });
  };

  const clearAll = () => {
    onChange({ type: [], difficulty: [], duration: [], ambiance: [], terrain_type: [], family_friendly: null });
  };

  const totalActive = Object.values(filters).flat().length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[2100] bg-[#0d1a12]/98 border-t border-[#2D5A27]/30 rounded-t-3xl shadow-2xl backdrop-blur-2xl max-h-[88vh] flex flex-col" style={{ animation: 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-[#2D5A27]/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-[#2D5A27]/15">
          <div>
            <h2 className="text-white font-bold text-base">Filtrer les aventures</h2>
            {totalActive > 0 && (
              <p className="text-[#8BAF7C]/50 text-xs mt-0.5">{totalActive} filtre{totalActive > 1 ? 's' : ''} actif{totalActive > 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalActive > 0 && (
              <button
                onClick={clearAll}
                className="text-[#8BAF7C]/60 text-xs font-mono hover:text-[#8BAF7C] transition-colors px-2 py-1 rounded-lg hover:bg-[#2D5A27]/15"
              >
                Effacer tout
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#2D5A27]/15 border border-[#2D5A27]/25 flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-[#8BAF7C]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable filters */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {FILTER_SECTIONS.map((section) => (
            <div key={section.key}>
              <p className="text-[#8BAF7C]/50 text-[10px] font-mono uppercase tracking-widest mb-3">
                {section.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {section.options.map((opt) => {
                  const active = ((filters[section.key] as string[]) || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggle(section.key, opt.value)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 active:scale-95 ${
                        active
                          ? 'bg-[#2D5A27] border-[#4A8A3F] text-white shadow-md shadow-[#2D5A27]/20'
                          : 'bg-[#111f14]/60 border-[#2D5A27]/20 text-[#8BAF7C]/70 hover:border-[#2D5A27]/50 hover:text-[#8BAF7C]'
                      }`}
                    >
                      <span className="text-base leading-none">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Apply button */}
        <div className="flex-shrink-0 px-5 pb-8 pt-4 border-t border-[#2D5A27]/15">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-[#2D5A27] hover:bg-[#3A7035] text-white font-bold text-sm transition-all duration-200 active:scale-[0.98] shadow-lg shadow-[#2D5A27]/25"
          >
            Appliquer les filtres
            {totalActive > 0 && (
              <span className="ml-2 text-[#8BAF7C]/80 font-normal">({totalActive})</span>
            )}
          </button>
        </div>
      </div>

    </>
  );
}