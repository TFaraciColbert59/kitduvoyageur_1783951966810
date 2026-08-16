// EarthCountryPanel.tsx
// Panel dynamique pour afficher les informations d'un pays sélectionné

import React from 'react';
import type { Country } from '@/lib/countries';

interface EarthCountryPanelProps {
  country: Country | null;
  isVisible: boolean;
  onClose: () => void;
  onExploreCountry: (code: string) => void;
  className?: string;
}

export default function EarthCountryPanel({
  country,
  isVisible,
  onClose,
  onExploreCountry,
  className = ''
}: EarthCountryPanelProps) {
  if (!country || !isVisible) return null;

  const getFlagEmoji = (code: string): string => {
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
  };

  const getDangerBadge = (level: string): { text: string; color: string; bg: string } => {
    switch (level) {
      case 'low': return { text: '🟢 Sûr', color: 'text-emerald-300', bg: 'bg-emerald-500/20' };
      case 'medium': return { text: '🟡 Vigilance', color: 'text-amber-300', bg: 'bg-amber-500/20' };
      case 'high': return { text: '🔴 Risqué', color: 'text-rose-300', bg: 'bg-rose-500/20' };
      default: return { text: 'N/A', color: 'text-white/60', bg: 'bg-white/10' };
    }
  };

  const dangerBadge = getDangerBadge(country.danger_level);

  return (
    <div className={`
      fixed inset-x-0 bottom-0 md:bottom-8 md:inset-x-auto md:right-8 md:top-1/2 md:-translate-y-1/2
      z-50 transition-all duration-300 transform
      ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full md:translate-y-0 md:translate-x-full opacity-0'}
      ${className}
    `}>
      {/* Overlay pour fermer */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      
      {/* Panel principal */}
      <div className="relative w-full md:w-96 max-h-[80vh] overflow-y-auto">
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Contenu du panel */}
        <div className="bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl border border-white/20 rounded-2xl md:rounded-[0.75rem] overflow-hidden shadow-2xl">
          {/* Header avec drapeau et nom */}
          <div className="p-6 bg-gradient-to-r from-white/5 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="text-4xl">{getFlagEmoji(country.code)}</div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{country.nom}</h3>
                  <div className="flex items-center space-x-2 text-sm text-white/70">
                    <span>{country.continent}</span>
                    <span>•</span>
                    <span>Capitale: {country.capital}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge danger */}
            <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${dangerBadge.bg} ${dangerBadge.color}`}>
              <span className="font-medium">{dangerBadge.text}</span>
            </div>
          </div>

          {/* Informations principales */}
          <div className="p-6 space-y-6">
            {/* Meilleure saison */}
            <div>
              <div className="text-sm text-white/60 mb-2">🌤️ Meilleure période</div>
              <div className="text-white font-medium">{country.meilleure_saison}</div>
            </div>

            {/* Monnaie */}
            <div>
              <div className="text-sm text-white/60 mb-2">💰 Monnaie</div>
              <div className="text-white font-medium">{country.monnaie}</div>
            </div>

            {/* Tags */}
            <div>
              <div className="text-sm text-white/60 mb-2">🏷️ Activités</div>
              <div className="flex flex-wrap gap-2">
                {country.tags.slice(0, 5).map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Statistiques rapides */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div className="text-center p-3 rounded-xl bg-white/5">
                <div className="text-2xl font-bold text-emerald-300">190</div>
                <div className="text-xs text-white/60">Jours soleil/an</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/5">
                <div className="text-2xl font-bold text-cyan-300">8.4</div>
                <div className="text-xs text-white/60">Note sécurité</div>
              </div>
            </div>

            {/* Recommandations */}
            <div className="pt-4 border-t border-white/10">
              <div className="text-sm text-white/60 mb-3">🎯 Recommandé pour</div>
              <ul className="space-y-2">
                {[
                  'Randonnées en montagne',
                  'Culture et histoire',
                  'Gastronomie locale',
                  'Photographie paysage'
                ].map((item, index) => (
                  <li key={index} className="flex items-center text-white/90">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-3"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Bouton d'action principal */}
            <div className="pt-6 border-t border-white/10">
              <button
                onClick={() => onExploreCountry(country.code)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <span>Explorer {country.nom}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-black/30 border-t border-white/10">
            <div className="text-xs text-white/40 text-center">
              Données mises à jour le 10/08/2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
