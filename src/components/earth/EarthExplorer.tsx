// EarthExplorer.tsx
// Zone GAUCHE de l'interface Earth - Exploration, continents, filtres légers

import React from 'react';

// Types pour les continents
type ContinentFilter = 'all' | 'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania';

interface EarthExplorerProps {
  onContinentSelect?: (continent: ContinentFilter) => void;
  selectedContinent?: ContinentFilter;
  className?: string;
}

const CONTINENTS: { id: ContinentFilter; name: string; emoji: string; color: string }[] = [
  { id: 'all', name: 'Tous', emoji: '🌍', color: 'from-emerald-500/20 to-emerald-600/20' },
  { id: 'europe', name: 'Europe', emoji: '🏔️', color: 'from-blue-500/20 to-indigo-600/20' },
  { id: 'asia', name: 'Asie', emoji: '🗺️', color: 'from-amber-500/20 to-orange-600/20' },
  { id: 'africa', name: 'Afrique', emoji: '🦁', color: 'from-green-500/20 to-emerald-600/20' },
  { id: 'north-america', name: 'Amérique du Nord', emoji: '🦅', color: 'from-red-500/20 to-rose-600/20' },
  { id: 'south-america', name: 'Amérique du Sud', emoji: '🌿', color: 'from-lime-500/20 to-green-600/20' },
  { id: 'oceania', name: 'Océanie', emoji: '🌊', color: 'from-cyan-500/20 to-blue-600/20' },
];

export default function EarthExplorer({
  onContinentSelect,
  selectedContinent = 'all',
  className = ''
}: EarthExplorerProps) {
  const handleContinentClick = (continentId: ContinentFilter) => {
    onContinentSelect?.(continentId);
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Titre section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🧭</span>
          Explorer le monde
        </h2>
        <p className="text-sm text-white/60">
          Naviguez par continent pour découvrir des destinations uniques
        </p>
      </div>

      {/* Continents - Filtres légers */}
      <div className="space-y-3">
        {CONTINENTS.map((continent) => (
          <button
            key={continent.id}
            onClick={() => handleContinentClick(continent.id)}
            className={`
              w-full text-left p-4 rounded-2xl transition-all duration-200
              ${selectedContinent === continent.id
                ? `bg-gradient-to-r ${continent.color} border border-white/20`
                : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{continent.emoji}</span>
                <div>
                  <div className="font-medium text-white">{continent.name}</div>
                  <div className="text-xs text-white/40 mt-1">
                    {continent.id === 'all' ? '190 pays' : 
                     continent.id === 'europe' ? '44 pays' :
                     continent.id === 'asia' ? '48 pays' :
                     continent.id === 'africa' ? '54 pays' :
                     continent.id === 'north-america' ? '23 pays' :
                     continent.id === 'south-america' ? '12 pays' : '14 pays'}
                  </div>
                </div>
              </div>
              {selectedContinent === continent.id && (
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Danger level filter - discret */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <div className="text-sm text-white/60">Niveau de sécurité</div>
        <div className="flex space-x-2">
          {[
            { id: 'all', label: 'Tous', color: 'bg-white/20' },
            { id: 'low', label: 'Sûr', color: 'bg-emerald-500/60' },
            { id: 'medium', label: 'Vigilance', color: 'bg-amber-500/60' },
            { id: 'high', label: 'Risqué', color: 'bg-rose-500/60' },
          ].map((level) => (
            <button
              key={level.id}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${selectedContinent === level.id 
                  ? 'text-white ring-1 ring-white/30' 
                  : 'text-white/70 hover:text-white'
                } ${level.color}
              `}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Indicateur d'exploration */}
      <div className="pt-4 border-t border-white/10">
        <div className="text-xs text-white/40">
          <div className="flex justify-between mb-1">
            <span>Exploration mondiale</span>
            <span>72%</span>
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
              style={{ width: '72%' }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
