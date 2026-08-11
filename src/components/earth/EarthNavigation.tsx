// EarthNavigation.tsx
// Zone BAS de l'interface Earth - Mini navigation, indicateurs, actions

import React from 'react';

interface EarthNavigationProps {
  selectedCountry?: string | null;
  totalCountries?: number;
  filteredCountries?: number;
  onResetView?: () => void;
  onToggleFullscreen?: () => void;
  className?: string;
}

export default function EarthNavigation({
  selectedCountry = null,
  totalCountries = 190,
  filteredCountries = 190,
  onResetView,
  onToggleFullscreen,
  className = ''
}: EarthNavigationProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Partie gauche - Informations */}
      <div className="flex items-center space-x-6">
        {/* Compteur pays */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
            <div className="absolute -inset-1 rounded-full bg-emerald-400/20 animate-ping"></div>
          </div>
          <div className="text-sm text-white/80">
            <span className="font-semibold text-white">{filteredCountries}</span>
            <span className="text-white/60">/{totalCountries} pays</span>
            {selectedCountry && (
              <span className="ml-2 text-emerald-300">• Sélectionné</span>
            )}
          </div>
        </div>

        {/* Indicateurs d'interaction */}
        <div className="hidden md:flex items-center space-x-4 text-xs text-white/50">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-white/40"></div>
            <span>Cliquez sur un pays</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-white/40"></div>
            <span>Glissez pour tourner</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-white/40"></div>
            <span>Scroll pour zoomer</span>
          </div>
        </div>
      </div>

      {/* Partie centre - Navigation principale */}
      <div className="flex items-center space-x-4">
        {/* Bouton reset */}
        <button
          onClick={onResetView}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Vue mondiale</span>
        </button>

        {/* Séparateur */}
        <div className="w-px h-6 bg-white/20"></div>

        {/* Actions secondaires */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Plein écran"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Partager">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Partie droite - État et actions */}
      <div className="flex items-center space-x-4">
        {/* État de sélection */}
        {selectedCountry && (
          <div className="flex items-center space-x-2">
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <span className="text-sm font-medium text-emerald-300">Pays sélectionné</span>
            </div>
            <button className="text-sm text-white/70 hover:text-white transition-colors">
              Explorer →
            </button>
          </div>
        )}

        {/* Indicateur en ligne */}
        <div className="flex items-center space-x-2 text-xs text-white/50">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <div className="absolute -inset-1 rounded-full bg-emerald-400/20 animate-pulse"></div>
          </div>
          <span>En ligne</span>
        </div>
      </div>
    </div>
  );
}
