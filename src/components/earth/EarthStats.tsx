// EarthStats.tsx
// Zone DROITE de l'interface Earth - Statistiques, pays populaires, découverte

import React from 'react';

interface EarthStatsProps {
  className?: string;
}

const POPULAR_COUNTRIES = [
  { code: 'FR', name: 'France', continent: 'Europe', visitors: '85M', trend: '↑', color: 'bg-blue-500/20' },
  { code: 'IT', name: 'Italie', continent: 'Europe', visitors: '62M', trend: '↑', color: 'bg-green-500/20' },
  { code: 'ES', name: 'Espagne', continent: 'Europe', visitors: '84M', trend: '→', color: 'bg-red-500/20' },
  { code: 'US', name: 'États-Unis', continent: 'Amérique', visitors: '79M', trend: '↑', color: 'bg-indigo-500/20' },
  { code: 'JP', name: 'Japon', continent: 'Asie', visitors: '31M', trend: '↑↑', color: 'bg-rose-500/20' },
];

const STATS = [
  { label: 'Pays explorés', value: '137', change: '+8 ce mois', icon: '🌍', color: 'text-emerald-400' },
  { label: 'Aventures planifiées', value: '2.4K', change: '+12%', icon: '🧭', color: 'text-cyan-400' },
  { label: 'Communauté active', value: '18.7K', change: '+5%', icon: '👥', color: 'text-blue-400' },
  { label: 'Kits configurés', value: '8.9K', change: '+23%', icon: '🎒', color: 'text-amber-400' },
];

export default function EarthStats({
  className = ''
}: EarthStatsProps) {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Titre section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Découverte
        </h2>
        <p className="text-sm text-white/60">
          Statistiques mondiales et destinations populaires
        </p>
      </div>

      {/* Statistiques globales */}
      <div className="space-y-4">
        <div className="text-sm text-white/60 mb-2">Statistiques LKDV</div>
        {STATS.map((stat, index) => (
          <div 
            key={index}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/80">
                  {stat.change}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pays populaires */}
      <div className="space-y-4">
        <div className="text-sm text-white/60 mb-2">Destinations populaires</div>
        {POPULAR_COUNTRIES.map((country) => (
          <div 
            key={country.code}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${country.color}`}>
                  <span className="text-lg">
                    {String.fromCodePoint(...country.code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)))}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                    {country.name}
                  </div>
                  <div className="text-xs text-white/50">{country.continent}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{country.visitors}</div>
                <div className={`text-xs ${country.trend.includes('↑') ? 'text-emerald-400' : 'text-white/60'}`}>
                  {country.trend} visiteurs
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommandation du jour */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border border-emerald-500/20">
        <div className="text-sm text-emerald-300/80 mb-2">💎 Recommandation</div>
        <div className="text-white font-medium mb-2">Islande en été</div>
        <div className="text-sm text-white/70">
          Conditions idéales de juin à août pour les randonnées et aurores boréales
        </div>
        <button className="mt-3 w-full py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          Explorer l'Islande
        </button>
      </div>

      {/* Note discrète */}
      <div className="text-xs text-white/40 text-center pt-4 border-t border-white/10">
        Données mises à jour quotidiennement
      </div>
    </div>
  );
}
