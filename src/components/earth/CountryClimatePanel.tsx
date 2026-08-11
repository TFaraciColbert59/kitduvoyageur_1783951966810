// CountryClimatePanel.tsx
// Panel CLIMAT pour la page pays (zone GAUCHE)

import React from 'react';
import type { Country } from '@/lib/countries';

interface CountryClimatePanelProps {
  country: Country;
  className?: string;
}

export default function CountryClimatePanel({
  country,
  className = ''
}: CountryClimatePanelProps) {
  // Données climatiques simulées (à remplacer par données réelles)
  const climateData = {
    seasons: [
      { name: 'Printemps', temp: '12-22°C', condition: '🌤️ Doux', bestFor: 'Randonnées légères' },
      { name: 'Été', temp: '18-28°C', condition: '☀️ Ensoleillé', bestFor: 'Toutes activités' },
      { name: 'Automne', temp: '10-20°C', condition: '🍂 Coloré', bestFor: 'Photographie' },
      { name: 'Hiver', temp: '-2-8°C', condition: '❄️ Froid', bestFor: 'Sports d\'hiver' },
    ],
    bestSeason: country.meilleure_saison,
    rainfall: '750 mm/an',
    humidity: '65% moyenne'
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Titre section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🌤️</span>
          Climat & Saisons
        </h2>
        <p className="text-sm text-white/60">
          Conditions météorologiques et périodes idéales
        </p>
      </div>

      {/* Meilleure période */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border border-emerald-500/20">
        <div className="text-sm text-emerald-300/80 mb-1">💎 Meilleure période</div>
        <div className="text-white font-bold text-lg mb-2">{climateData.bestSeason}</div>
        <div className="text-sm text-white/70">
          Conditions optimales pour la plupart des activités outdoor
        </div>
      </div>

      {/* Saisons détaillées */}
      <div className="space-y-4">
        <div className="text-sm text-white/60 mb-2">Saisons détaillées</div>
        {climateData.seasons.map((season, index) => (
          <div 
            key={index}
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-white">{season.name}</div>
              <div className="text-lg">{season.condition}</div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="text-white/80">{season.temp}</div>
              <div className="text-emerald-300/80">{season.bestFor}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Données climatiques */}
      <div className="pt-4 border-t border-white/10">
        <div className="text-sm text-white/60 mb-3">📊 Données climatiques</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <div className="text-2xl font-bold text-cyan-300">{climateData.rainfall}</div>
            <div className="text-xs text-white/60 mt-1">Précipitations annuelles</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <div className="text-2xl font-bold text-amber-300">{climateData.humidity}</div>
            <div className="text-xs text-white/60 mt-1">Humidité moyenne</div>
          </div>
        </div>
      </div>

      {/* Conseils climatiques */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/30 to-slate-900/30 border border-white/10">
        <div className="text-sm text-white/60 mb-2">💡 Conseils pratiques</div>
        <ul className="space-y-2 text-sm text-white/80">
          <li className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></div>
            Équipez-vous en couches pour les variations de température
          </li>
          <li className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></div>
            Prévoyez une protection solaire même par temps nuageux
          </li>
          <li className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></div>
            Consultez les prévisions 48h avant vos activités
          </li>
        </ul>
      </div>
    </div>
  );
}
