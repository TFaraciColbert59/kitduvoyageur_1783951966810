// CountryDetailsHeader.tsx
// Header spécifique pour la page pays avec infos identité

import React from 'react';
import type { Country } from '@/lib/countries';

interface CountryDetailsHeaderProps {
  country: Country;
  onBack: () => void;
  className?: string;
}

export default function CountryDetailsHeader({
  country,
  onBack,
  className = ''
}: CountryDetailsHeaderProps) {
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
    <div className={`space-y-6 ${className}`}>
      {/* Navigation retour */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Retour à Earth</span>
        </button>
        
        <div className="text-sm text-white/40">
          Exploration en cours
        </div>
      </div>

      {/* Identité du pays */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-4">
          <div className="text-5xl">{getFlagEmoji(country.code)}</div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">{country.nom}</h1>
            <div className="flex items-center justify-center space-x-4 text-white/70 mt-2">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {country.capital}
              </span>
              <span>•</span>
              <span>{country.continent}</span>
            </div>
          </div>
        </div>

        {/* Badge danger */}
        <div className={`inline-flex items-center px-4 py-2 rounded-full ${dangerBadge.bg} ${dangerBadge.color}`}>
          <span className="font-medium">{dangerBadge.text}</span>
        </div>

        {/* Phrase éditoriale */}
        <p className="text-lg text-emerald-200/70 font-light max-w-2xl mx-auto">
          Une destination {country.danger_level === 'low' ? 'sereine' : country.danger_level === 'medium' ? 'aventureuse' : 'exigeante'} 
          {country.continent.toLowerCase().includes('europe') ? ' au cœur de l\'Europe' : 
           country.continent.toLowerCase().includes('asie') ? ' aux traditions millénaires' :
           country.continent.toLowerCase().includes('afrique') ? ' aux paysages époustouflants' :
           country.continent.toLowerCase().includes('amérique') ? ' aux vastes étendues' : ' aux horizons lointains'}.
        </p>
      </div>
    </div>
  );
}
