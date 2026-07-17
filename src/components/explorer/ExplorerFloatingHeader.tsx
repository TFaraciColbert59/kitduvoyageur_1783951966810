'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface ExplorerFloatingHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLocate: () => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  trailCount: number;
  loading: boolean;
}

const SUGGESTIONS = [
  'Randonnée facile près de Lille',
  'Road trip Alpes',
  'Bivouac lac de montagne',
  'Trek côte bretonne',
  'Sommet panoramique Pyrénées',
];

export default function ExplorerFloatingHeader({
  searchQuery,
  onSearchChange,
  onLocate,
  onOpenFilters,
  activeFilterCount,
  trailCount,
  loading,
}: ExplorerFloatingHeaderProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onSearchChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-[1500] px-3 pt-safe-top pt-3">
      <div className="flex items-center gap-2">
        {/* Back button */}
        <Link
          href="/"
          className="flex-shrink-0 w-11 h-11 rounded-2xl bg-[#0d1a12]/85 border border-[#2D5A27]/30 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-black/20 active:scale-95 transition-transform"
          aria-label="Retour"
        >
          <svg className="w-4 h-4 text-[#8BAF7C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Search bar */}
        <div className="flex-1 relative">
          <div
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border backdrop-blur-xl shadow-lg shadow-black/20 transition-all duration-300 ${
              focused
                ? 'bg-[#0d1a12]/95 border-[#2D5A27]/70 shadow-[#2D5A27]/10'
                : 'bg-[#0d1a12]/85 border-[#2D5A27]/25'
            }`}
          >
            {/* Logo mark */}
            <div className="flex-shrink-0 flex flex-col leading-none">
              <span className="text-[7px] font-mono text-[#8BAF7C]/40 tracking-[0.15em] uppercase">Kit du</span>
              <span className="text-[10px] font-bold text-[#8BAF7C] tracking-tight leading-none">EXPLORER</span>
            </div>

            <div className="w-px h-5 bg-[#2D5A27]/30 flex-shrink-0" />

            <div className="flex-shrink-0 text-[#8BAF7C]/50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Rechercher une aventure, un lieu…"
              className="flex-1 bg-transparent text-white placeholder-[#8BAF7C]/35 text-sm focus:outline-none min-w-0"
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex-shrink-0 text-[#8BAF7C]/40 hover:text-[#8BAF7C]/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <div className="flex-shrink-0 text-[#8BAF7C]/30 text-[10px] font-mono">
                {loading ? '…' : trailCount}
              </div>
            )}
          </div>

          {/* Suggestions dropdown */}
          {focused && !searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d1a12]/98 border border-[#2D5A27]/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl z-50">
              <div className="px-4 pt-3 pb-1.5">
                <p className="text-[9px] font-mono text-[#8BAF7C]/40 uppercase tracking-widest">Suggestions</p>
              </div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onMouseDown={() => { onSearchChange(s); setFocused(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#2D5A27]/15 transition-colors"
                >
                  <span className="text-[#8BAF7C]/40 text-xs">⛰</span>
                  <span className="text-[#C8D9B8] text-sm">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Locate button */}
        <button
          onClick={onLocate}
          className="flex-shrink-0 w-11 h-11 rounded-2xl bg-[#0d1a12]/85 border border-[#2D5A27]/30 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-black/20 active:scale-95 transition-transform"
          aria-label="Ma position"
        >
          <svg className="w-4.5 h-4.5 text-[#8BAF7C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        </button>

        {/* Filter button */}
        <button
          onClick={onOpenFilters}
          className={`flex-shrink-0 w-11 h-11 rounded-2xl backdrop-blur-xl flex items-center justify-center shadow-lg shadow-black/20 active:scale-95 transition-all relative ${
            activeFilterCount > 0
              ? 'bg-[#2D5A27] border border-[#4A8A3F]'
              : 'bg-[#0d1a12]/85 border border-[#2D5A27]/30'
          }`}
          aria-label="Filtres"
        >
          <svg className={`w-4 h-4 ${activeFilterCount > 0 ? 'text-white' : 'text-[#8BAF7C]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M13 16h-2" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C8A96E] rounded-full text-[9px] font-bold text-[#0d1a12] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
