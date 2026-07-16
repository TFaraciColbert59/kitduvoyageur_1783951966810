'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import AdventureGenerator from './components/AdventureGenerator';

const InteractiveMap = dynamic(() => import('./components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1C2620]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/60 text-sm">Chargement de la carte mondiale…</p>
      </div>
    </div>
  ),
});

type ActivePanel = 'generator' | 'legend' | null;

const WORLD_STATS = [
  { icon: '🥾', label: 'Sentiers', value: '15M+', desc: 'dans le monde' },
  { icon: '🏔', label: 'Sommets', value: '500K+', desc: 'répertoriés' },
  { icon: '🏠', label: 'Refuges', value: '50K+', desc: 'en montagne' },
  { icon: '💧', label: 'Sources', value: '2M+', desc: 'points d\'eau' },
];

export default function CarteInteractivePage() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('generator');
  const [lastAdventure, setLastAdventure] = useState('');

  // Inject Leaflet CSS
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);

  // Listen for trail-to-adventure event: auto-open generator panel
  useEffect(() => {
    const handleTrailEvent = () => {
      setActivePanel('generator');
    };
    window.addEventListener('createAdventureFromTrail', handleTrailEvent);
    return () => window.removeEventListener('createAdventureFromTrail', handleTrailEvent);
  }, []);

  return (
    <div className="min-h-screen bg-[#1C2620] flex flex-col">
      <Header />

      {/* Hero bar */}
      <div className="bg-gradient-to-r from-[#1C2620] via-[#1e2a24] to-[#1C2620] border-b border-white/10 px-4 py-2.5">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#E4501C]/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name="MapIcon" className="w-5 h-5 text-[#E4501C]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">Moteur Mondial d&apos;Aventures</h1>
              <p className="text-white/40 text-xs">OpenStreetMap · Overpass API · IA Gemini · PostGIS</p>
            </div>
          </div>

          {/* World stats — hidden on mobile */}
          <div className="hidden lg:flex items-center gap-4">
            {WORLD_STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-white font-bold text-sm">{s.icon} {s.value}</div>
                <div className="text-white/40 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Panel toggles */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setActivePanel(activePanel === 'generator' ? null : 'generator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === 'generator' ?'bg-[#E4501C] text-white shadow-lg shadow-[#E4501C]/20' :'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Icon name="SparklesIcon" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Créer une aventure</span>
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'legend' ? null : 'legend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === 'legend' ?'bg-white/20 text-white' :'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Icon name="InformationCircleIcon" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Légende</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 118px)' }}>

        {/* Map area */}
        <div className="flex-1 relative p-2">
          <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <InteractiveMap />
          </div>
        </div>

        {/* Side panel */}
        {activePanel && (
          <div className="w-80 xl:w-96 flex-shrink-0 border-l border-white/10 bg-[#1a2420] flex flex-col overflow-hidden">
            {activePanel === 'generator' && (
              <AdventureGenerator onAdventureGenerated={setLastAdventure} />
            )}
            {activePanel === 'legend' && (
              <div className="p-4 overflow-y-auto">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
                  <Icon name="InformationCircleIcon" className="w-4 h-4 text-[#E4501C]" />
                  Légende & Sources de données
                </h3>

                <div className="space-y-4">
                  {/* Data source */}
                  <div className="bg-[#E4501C]/10 border border-[#E4501C]/20 rounded-xl p-3">
                    <h4 className="text-[#E4501C] text-xs font-semibold mb-2">🌍 Source des données</h4>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Toutes les données proviennent d&apos;OpenStreetMap via l&apos;Overpass API.
                      Les données sont synchronisées et mises en cache dans Supabase PostGIS.
                    </p>
                  </div>

                  {/* Trails */}
                  <div>
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Sentiers</h4>
                    <div className="space-y-1.5">
                      {[
                        { color: '#22c55e', label: 'Facile', desc: 'Accessible à tous' },
                        { color: '#f59e0b', label: 'Modéré', desc: 'Bonne condition physique' },
                        { color: '#ef4444', label: 'Difficile', desc: 'Expérience requise' },
                        { color: '#7c3aed', label: 'Expert', desc: 'Alpiniste confirmé' },
                      ].map(({ color, label, desc }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className="w-8 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          <div>
                            <span className="text-white text-xs font-medium">{label}</span>
                            <span className="text-white/40 text-xs ml-2">{desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* POIs */}
                  <div>
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Points d&apos;intérêt OSM</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { icon: '🏠', color: '#1e40af', label: 'Refuge' },
                        { icon: '💧', color: '#0891b2', label: "Point d'eau" },
                        { icon: '▲', color: '#ef4444', label: 'Sommet' },
                        { icon: '⛺', color: '#16a34a', label: 'Camping' },
                        { icon: '🌊', color: '#0284c7', label: 'Cascade' },
                        { icon: '👁', color: '#7c3aed', label: 'Point de vue' },
                        { icon: '⛰', color: '#92400e', label: 'Col' },
                        { icon: '🕳', color: '#374151', label: 'Grotte' },
                      ].map(({ icon, color, label }) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                            style={{ background: `${color}33`, border: `1px solid ${color}66` }}>
                            {icon}
                          </div>
                          <span className="text-white/70 text-xs">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI */}
                  <div className="bg-white/5 rounded-xl p-3">
                    <h4 className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Icon name="SparklesIcon" className="w-3.5 h-3.5 text-[#E4501C]" />
                      Créateur d&apos;aventure IA
                    </h4>
                    <ul className="space-y-1 text-white/50 text-xs">
                      <li>• Décrivez votre envie en langage naturel</li>
                      <li>• Gemini analyse et construit l&apos;itinéraire</li>
                      <li>• Plan jour par jour avec lieux réels</li>
                      <li>• Budget, équipement, transport inclus</li>
                      <li>• Sauvegardez vos aventures favorites</li>
                    </ul>
                  </div>

                  {/* OSM Sync */}
                  <div className="bg-white/5 rounded-xl p-3">
                    <h4 className="text-white text-xs font-semibold mb-2">🔄 Synchronisation OSM</h4>
                    <p className="text-white/50 text-xs leading-relaxed">
                      Cliquez sur &ldquo;Sync OSM&rdquo; sur la carte pour importer les données réelles
                      d&apos;OpenStreetMap pour la région affichée. Cache 24h pour éviter la surcharge.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Adventure result toast */}
      {lastAdventure && activePanel !== 'generator' && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#1C2620] border border-[#E4501C]/30 rounded-xl p-3 shadow-2xl max-w-xs">
          <div className="flex items-center gap-2">
            <Icon name="SparklesIcon" className="w-4 h-4 text-[#E4501C] flex-shrink-0" />
            <p className="text-white text-xs font-medium">Aventure générée !</p>
            <button
              onClick={() => setActivePanel('generator')}
              className="ml-auto text-[#E4501C] text-xs hover:underline"
            >
              Voir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
