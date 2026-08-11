// CountryActivitiesPanel.tsx
// Panel ACTIVITÉS pour la page pays (zone BAS)

import React from 'react';
import type { Country } from '@/lib/countries';

interface CountryActivitiesPanelProps {
  country: Country;
  className?: string;
}

export default function CountryActivitiesPanel({
  country,
  className = ''
}: CountryActivitiesPanelProps) {
  // Données d'activités basées sur les tags
  const activities = [
    { icon: '🥾', name: 'Randonnée', level: 'Intermédiaire', duration: '3-6h', tags: ['rando', 'montagne'] },
    { icon: '🏔️', name: 'Alpinisme', level: 'Avancé', duration: '6-12h', tags: ['montagne', 'aventure'] },
    { icon: '🚴', name: 'VTT', level: 'Débutant', duration: '2-4h', tags: ['vélo', 'nature'] },
    { icon: '🏕️', name: 'Camping', level: 'Tous niveaux', duration: 'Nuit', tags: ['bivouac', 'nature'] },
    { icon: '📸', name: 'Photographie', level: 'Tous niveaux', duration: 'Flexible', tags: ['photo', 'paysage'] },
    { icon: '🍽️', name: 'Gastronomie', level: 'Tous niveaux', duration: '2-3h', tags: ['culinaire', 'culture'] },
  ];

  // Filtrer les activités pertinentes basées sur les tags du pays
  const relevantActivities = activities.filter(activity =>
    activity.tags.some(tag => country.tags.includes(tag))
  ).slice(0, 4);

  // Ajouter des activités par défaut si pas assez de correspondances
  const displayedActivities = relevantActivities.length >= 3 
    ? relevantActivities 
    : [...relevantActivities, ...activities.slice(0, 3 - relevantActivities.length)];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Titre section */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Activités & Expériences
        </h2>
        <p className="text-sm text-white/60">
          Découvrez les meilleures expériences outdoor et culturelles
        </p>
      </div>

      {/* Grille d'activités */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {displayedActivities.map((activity, index) => (
          <div 
            key={index}
            className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 hover:border-white/20 transition-all duration-200 group"
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">
              {activity.icon}
            </div>
            <div className="space-y-2">
              <div className="font-medium text-white">{activity.name}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">{activity.level}</span>
                <span className="text-emerald-300/80">{activity.duration}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Points d'intérêt */}
      <div className="space-y-4">
        <div className="text-sm text-white/60 mb-2">📍 Points d'intérêt incontournables</div>
        <div className="space-y-3">
          {[
            { name: 'Parc National des Cévennes', type: 'Nature', distance: '45km' },
            { name: 'Vieille Ville historique', type: 'Culture', distance: 'Centre-ville' },
            { name: 'Lac de montagne', type: 'Paysage', distance: '18km' },
          ].map((point, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mr-3">
                  <span className="text-emerald-300">
                    {point.type === 'Nature' ? '🌿' : point.type === 'Culture' ? '🏛️' : '🏞️'}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-white">{point.name}</div>
                  <div className="text-xs text-white/60">{point.type} • {point.distance}</div>
                </div>
              </div>
              <button className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                Voir
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Préparer mon voyage */}
      <div className="pt-6 border-t border-white/10">
        <div className="text-center space-y-4">
          <div className="text-white/80">
            <span className="font-semibold text-white">Prêt à explorer {country.nom} ?</span>
            <br />
            <span className="text-sm">Configurez votre kit de voyage sur mesure</span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold transition-all duration-200 flex items-center justify-center space-x-2">
              <span>Préparer mon voyage</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            
            <button className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors">
              Voir les itinéraires
            </button>
          </div>
          
          <div className="text-xs text-white/40">
            Accès à notre configurateur de kit et conseils d'experts
          </div>
        </div>
      </div>
    </div>
  );
}
