'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';

import Icon from '@/components/ui/AppIcon';
import AdventureGenerator from './components/AdventureGenerator';

// Dynamic import to avoid SSR issues with Leaflet
const InteractiveMap = dynamic(() => import('./components/InteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#1C2620] rounded-xl">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/60 text-sm">Chargement de la carte…</p>
      </div>
    </div>
  ),
});

interface MapData {
  trails: Array<{ id: string; name: string; difficulty: string; distance_km: number; elevation_gain_m: number; duration_hours: number; region: string; tags: string[] }>;
  refuges: Array<{ id: string; name: string; altitude_m: number; capacity: number; is_staffed: boolean; price_per_night: number; region: string }>;
  waterPoints: Array<{ id: string; name: string; water_type: string; is_potable: boolean; region: string }>;
  summits: Array<{ id: string; name: string; altitude_m: number; difficulty: string; region: string; massif: string }>;
}

type ActivePanel = 'generator' | 'legend' | null;

export default function CarteInteractivePage() {
  const [mapData, setMapData] = useState<MapData>({ trails: [], refuges: [], waterPoints: [], summits: [] });
  const [activePanel, setActivePanel] = useState<ActivePanel>('generator');
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/map/pois')
      .then(r => r.json())
      .then(data => {
        setMapData(data);
        setDataLoaded(true);
      })
      .catch(() => setDataLoaded(true));
  }, []);

  // Inject Leaflet CSS
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  return (
    <div className="min-h-screen bg-[#1C2620] flex flex-col">
      <Header />

      {/* Hero bar */}
      <div className="bg-gradient-to-r from-[#1C2620] via-[#243028] to-[#1C2620] border-b border-white/10 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#E4501C]/20 rounded-xl flex items-center justify-center">
              <Icon name="MapIcon" className="w-5 h-5 text-[#E4501C]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Carte Interactive</h1>
              <p className="text-white/50 text-xs">Sentiers · Refuges · Sources · Sommets</p>
            </div>
          </div>

          {/* Panel toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePanel(activePanel === 'generator' ? null : 'generator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === 'generator' ?'bg-[#E4501C] text-white shadow-lg shadow-[#E4501C]/20' :'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Icon name="SparklesIcon" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aventure IA</span>
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
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

        {/* Map area */}
        <div className="flex-1 relative p-3">
          <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <InteractiveMap />
          </div>
        </div>

        {/* Side panel */}
        {activePanel && (
          <div className="w-80 xl:w-96 flex-shrink-0 border-l border-white/10 bg-[#1a2420] flex flex-col overflow-hidden">
            {activePanel === 'generator' && (
              <AdventureGenerator mapData={mapData} />
            )}
            {activePanel === 'legend' && (
              <div className="p-4 overflow-y-auto">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Icon name="InformationCircleIcon" className="w-4 h-4 text-[#E4501C]" />
                  Légende de la carte
                </h3>

                <div className="space-y-4">
                  {/* Trails */}
                  <div>
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Sentiers de randonnée</h4>
                    <div className="space-y-1.5">
                      {[
                        { color: '#22c55e', label: 'Facile', desc: 'Accessible à tous' },
                        { color: '#f59e0b', label: 'Modéré', desc: 'Bonne condition physique' },
                        { color: '#ef4444', label: 'Difficile', desc: 'Expérience requise' },
                        { color: '#7c3aed', label: 'Expert', desc: 'Alpiniste confirmé' },
                      ].map(({ color, label, desc }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className="w-8 h-1.5 rounded-full" style={{ background: color }} />
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
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Points d&apos;intérêt</h4>
                    <div className="space-y-2">
                      {[
                        { icon: '🏠', color: '#1e40af', label: 'Refuge / Gîte', desc: 'Hébergement en montagne' },
                        { icon: '💧', color: '#0891b2', label: 'Point d\u2019eau', desc: 'Source, torrent, lac' },
                        { icon: '▲', color: '#ef4444', label: 'Sommet', desc: 'Pic et altitude' },
                        { icon: '🥾', color: '#f59e0b', label: 'Départ sentier', desc: 'Point de départ' },
                      ].map(({ icon, color, label, desc }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                            style={{ background: `${color}33`, border: `1px solid ${color}66` }}>
                            {icon}
                          </div>
                          <div>
                            <div className="text-white text-xs font-medium">{label}</div>
                            <div className="text-white/40 text-xs">{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  {dataLoaded && (
                    <div>
                      <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Données disponibles</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { count: mapData.trails.length, icon: '🥾', label: 'Sentiers' },
                          { count: mapData.refuges.length, icon: '🏠', label: 'Refuges' },
                          { count: mapData.waterPoints.length, icon: '💧', label: 'Sources' },
                          { count: mapData.summits.length, icon: '▲', label: 'Sommets' },
                        ].map(({ count, icon, label }) => (
                          <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                            <div className="text-xl mb-1">{icon}</div>
                            <div className="text-white font-bold text-lg">{count}</div>
                            <div className="text-white/50 text-xs">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tips */}
                  <div className="bg-[#E4501C]/10 border border-[#E4501C]/20 rounded-xl p-3">
                    <h4 className="text-[#E4501C] text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Icon name="LightBulbIcon" className="w-3.5 h-3.5" />
                      Conseils d&apos;utilisation
                    </h4>
                    <ul className="space-y-1 text-white/60 text-xs">
                      <li>• Cliquez sur un marqueur pour les détails</li>
                      <li>• Utilisez les couches pour filtrer l&apos;affichage</li>
                      <li>• L&apos;IA génère des aventures basées sur les données réelles</li>
                      <li>• Zoomez pour explorer les détails locaux</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
