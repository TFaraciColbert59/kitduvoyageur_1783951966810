// EarthHeader.tsx
// Zone HAUT de l'interface Earth - Titre, accroche, recherche discrète

import React, { useState } from 'react';

interface EarthHeaderProps {
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  className?: string;
}

export default function EarthHeader({
  onSearchChange,
  searchValue = '',
  className = ''
}: EarthHeaderProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Titre EARTH */}
      <div className="text-center space-y-2">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
          EARTH
        </h1>
        <p className="text-lg text-emerald-200/70 font-light max-w-2xl mx-auto">
          Explorez le monde, préparez vos aventures, découvrez chaque pays sous un nouvel angle
        </p>
      </div>

      {/* Recherche discrète */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-md group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative">
            <input
              type="text"
              value={localSearch}
              onChange={handleSearchChange}
              placeholder="Rechercher un pays..."
              className="w-full px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all duration-200"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Indicateur subtil */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-2 text-sm text-white/40">
          <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse"></div>
          <span>190 pays à explorer</span>
          <div className="w-2 h-2 rounded-full bg-cyan-500/50 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
