// CountrySafetyPanel.tsx
// Panel SÉCURITÉ pour la page pays (zone DROITE)

import React from 'react';
import type { Country } from '@/lib/countries';

interface CountrySafetyPanelProps {
  country: Country;
  className?: string;
}

export default function CountrySafetyPanel({
  country,
  className = ''
}: CountrySafetyPanelProps) {
  // Données de sécurité simulées
  const safetyData = {
    level: country.danger_level,
    risks: [
      'Pickpockets dans les zones touristiques',
      'Routes en montagne parfois dangereuses',
      'Conditions météo changeantes',
      'Faune sauvage dans certaines régions'
    ],
    advice: [
      'Gardez vos documents en sécurité',
      'Respectez les sentiers balisés',
      'Informez quelqu\'un de votre itinéraire',
      'Ayez une assurance voyage complète'
    ],
    emergency: {
      police: '112',
      medical: '118',
      embassy: '+33 1 45 20 33 33'
    }
  };

  const getSafetyColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-rose-400';
      default: return 'text-white/60';
    }
  };

  const getSafetyLabel = (level: string): string => {
    switch (level) {
      case 'low': return 'Niveau bas';
      case 'medium': return 'Niveau modéré';
      case 'high': return 'Niveau élevé';
      default: return 'Non évalué';
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Titre section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          Sécurité & Santé
        </h2>
        <p className="text-sm text-white/60">
          Informations essentielles pour voyager sereinement
        </p>
      </div>

      {/* Niveau de danger */}
      <div className={`p-4 rounded-2xl bg-gradient-to-br ${
        country.danger_level === 'low' ? 'from-emerald-900/30 to-emerald-800/30 border-emerald-500/20' :
        country.danger_level === 'medium' ? 'from-amber-900/30 to-amber-800/30 border-amber-500/20' :
        'from-rose-900/30 to-rose-800/30 border-rose-500/20'
      } border`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`text-lg font-bold ${getSafetyColor(country.danger_level)}`}>
            {getSafetyLabel(country.danger_level)}
          </div>
          <div className="text-2xl">
            {country.danger_level === 'low' ? '🟢' : country.danger_level === 'medium' ? '🟡' : '🔴'}
          </div>
        </div>
        <div className="text-sm text-white/80">
          {country.danger_level === 'low' 
            ? 'Destination généralement sûre avec précautions standards.' 
            : country.danger_level === 'medium'
            ? 'Vigilance recommandée dans certaines zones ou situations.'
            : 'Précautions particulières nécessaires, certaines zones à éviter.'
          }
        </div>
      </div>

      {/* Risques principaux */}
      <div className="space-y-4">
        <div className="text-sm text-white/60 mb-2">⚠️ Risques principaux</div>
        <div className="space-y-3">
          {safetyData.risks.map((risk, index) => (
            <div 
              key={index}
              className="flex items-start p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="text-rose-400/70 mr-3 mt-0.5">•</div>
              <div className="text-sm text-white/90">{risk}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Conseils de sécurité */}
      <div className="space-y-4">
        <div className="text-sm text-white/60 mb-2">💡 Conseils essentiels</div>
        <div className="space-y-3">
          {safetyData.advice.map((advice, index) => (
            <div 
              key={index}
              className="flex items-start p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="text-emerald-400/70 mr-3 mt-0.5">✓</div>
              <div className="text-sm text-white/90">{advice}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Numéros d'urgence */}
      <div className="pt-4 border-t border-white/10">
        <div className="text-sm text-white/60 mb-3">🆘 Numéros d'urgence</div>
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center mr-3">
                <span className="text-rose-400">🚔</span>
              </div>
              <div>
                <div className="text-sm text-white">Police/Secours</div>
                <div className="text-xs text-white/60">Numéro unique européen</div>
              </div>
            </div>
            <div className="font-mono font-bold text-white">{safetyData.emergency.police}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mr-3">
                <span className="text-emerald-400">🏥</span>
              </div>
              <div>
                <div className="text-sm text-white">Urgences médicales</div>
                <div className="text-xs text-white/60">Ambulance</div>
              </div>
            </div>
            <div className="font-mono font-bold text-white">{safetyData.emergency.medical}</div>
          </div>
        </div>
      </div>

      {/* Note importante */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-slate-800/30 to-slate-900/30 border border-white/10">
        <div className="text-xs text-white/60 mb-1">📝 Note importante</div>
        <div className="text-sm text-white/80">
          Ces informations sont indicatives. Consultez toujours les conseils aux voyageurs du gouvernement français avant votre départ.
        </div>
      </div>
    </div>
  );
}
