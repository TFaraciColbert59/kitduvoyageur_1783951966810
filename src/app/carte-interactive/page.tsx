'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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

type ActivePanel = 'generator' | 'legend' | 'sync' | null;

const WORLD_STATS = [
  { icon: '🥾', label: 'Sentiers', value: '15M+', desc: 'dans le monde' },
  { icon: '🏔', label: 'Sommets', value: '500K+', desc: 'répertoriés' },
  { icon: '🏠', label: 'Refuges', value: '50K+', desc: 'en montagne' },
  { icon: '💧', label: 'Sources', value: '2M+', desc: 'points d\'eau' },
];

const SYNC_ZONES = [
  { key: 'chamonix', label: '🏔 Chamonix / Mont-Blanc', desc: 'Zone test recommandée' },
  { key: 'alpes_nord', label: '⛰ Alpes du Nord', desc: 'Savoie, Isère' },
  { key: 'alpes_sud', label: '🌄 Alpes du Sud', desc: 'Hautes-Alpes' },
  { key: 'mercantour', label: '🦅 Mercantour', desc: 'Alpes-Maritimes' },
  { key: 'pyrenees', label: '🏕 Pyrénées', desc: 'Pyrénées centrales' },
  { key: 'vercors', label: '🌲 Vercors', desc: 'Drôme, Isère' },
  { key: 'belledonne', label: '🗻 Belledonne', desc: 'Isère' },
];

interface SyncResult {
  success: boolean;
  label?: string;
  trails_inserted?: number;
  stats?: {
    ways_fetched: number;
    relations_fetched: number;
    valid_gps_trails: number;
    rejected_insufficient_gps: number;
  };
  message?: string;
  error?: string;
  sample?: Array<{ name: string; gps_points: number; distance_km: number }>;
}

export default function CarteInteractivePage() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('generator');
  const [lastAdventure, setLastAdventure] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncingZone, setSyncingZone] = useState('');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [dbTrailsCount, setDbTrailsCount] = useState<number | null>(null);

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

  // Load DB trails count when sync panel opens
  useEffect(() => {
    if (activePanel === 'sync') {
      fetch('/api/map/sync-trails')
        .then(r => r.json())
        .then(d => setDbTrailsCount(d.trails_in_db ?? 0))
        .catch(() => {});
    }
  }, [activePanel]);

  const syncZone = async (zoneKey: string, zoneLabel: string) => {
    setSyncing(true);
    setSyncingZone(zoneLabel);
    setSyncResult(null);
    try {
      const res = await fetch('/api/map/sync-trails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: zoneKey }),
      });
      const data: SyncResult = await res.json();
      setSyncResult(data);
      if (data.success) {
        setDbTrailsCount(prev => (prev ?? 0) + (data.trails_inserted ?? 0));
      }
    } catch (err) {
      setSyncResult({ success: false, error: String(err) });
    } finally {
      setSyncing(false);
      setSyncingZone('');
    }
  };

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
            <Link
              href="/mes-aventures"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            >
              <span>⭐</span>
              <span className="hidden sm:inline">Mes aventures</span>
            </Link>
            <button
              onClick={() => setActivePanel(activePanel === 'sync' ? null : 'sync')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === 'sync' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Importer OSM</span>
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'generator' ? null : 'generator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === 'generator' ? 'bg-[#E4501C] text-white shadow-lg shadow-[#E4501C]/20' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Icon name="SparklesIcon" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Créer une aventure</span>
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'legend' ? null : 'legend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePanel === 'legend' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Icon name="InformationCircleIcon" className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Légende</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100dvh - 118px)' }}>

        {/* Map area */}
        <div className="flex-1 relative p-1 sm:p-2 min-w-0">
          <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <InteractiveMap />
          </div>
        </div>

        {/* Side panel — slides over map on mobile */}
        {activePanel && (
          <div className="absolute inset-0 z-20 lg:relative lg:inset-auto lg:z-auto w-full lg:w-80 xl:w-96 flex-shrink-0 border-l border-white/10 bg-[#1a2420] flex flex-col overflow-hidden">

            {/* ── OSM Import Panel ── */}
            {activePanel === 'sync' && (
              <div className="p-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Importer les randonnées OSM
                  </h3>
                  {dbTrailsCount !== null && (
                    <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {dbTrailsCount} en base
                    </span>
                  )}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
                  <p className="text-blue-300 text-xs leading-relaxed">
                    <strong>Pipeline :</strong> Overpass API → Ways+Nodes → Coordonnées GPS → GeoJSON LineString → Supabase<br/>
                    <span className="text-blue-300/70 mt-1 block">Minimum 20 points GPS par sentier. Les lignes droites sont rejetées.</span>
                  </p>
                </div>

                {/* Sync result */}
                {syncResult && (
                  <div className={`rounded-xl p-3 mb-4 border ${syncResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    {syncResult.success ? (
                      <div>
                        <p className="text-emerald-400 text-xs font-semibold mb-2">✅ {syncResult.message}</p>
                        {syncResult.stats && (
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-white font-bold">{syncResult.stats.ways_fetched}</div>
                              <div className="text-white/40">Ways OSM</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-white font-bold">{syncResult.stats.relations_fetched}</div>
                              <div className="text-white/40">Relations OSM</div>
                            </div>
                            <div className="bg-emerald-500/10 rounded-lg p-2">
                              <div className="text-emerald-400 font-bold">{syncResult.stats.valid_gps_trails}</div>
                              <div className="text-white/40">GPS valides</div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                              <div className="text-white/60 font-bold">{syncResult.stats.rejected_insufficient_gps}</div>
                              <div className="text-white/40">Rejetés</div>
                            </div>
                          </div>
                        )}
                        {syncResult.sample && syncResult.sample.length > 0 && (
                          <div className="mt-2">
                            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Exemples importés</p>
                            {syncResult.sample.map((s, i) => (
                              <div key={i} className="text-xs text-white/60 py-0.5 flex justify-between">
                                <span className="truncate flex-1">{s.name}</span>
                                <span className="text-emerald-400 ml-2 flex-shrink-0">{s.gps_points} pts</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-red-400 text-xs font-semibold mb-1">❌ Erreur</p>
                        <p className="text-red-300/70 text-xs">{syncResult.error || 'Overpass API indisponible'}</p>
                        <p className="text-white/40 text-[10px] mt-1">Réessayez dans quelques minutes.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Zone buttons */}
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Zones disponibles</p>
                <div className="space-y-2">
                  {SYNC_ZONES.map(zone => (
                    <button
                      key={zone.key}
                      onClick={() => syncZone(zone.key, zone.label)}
                      disabled={syncing}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                        syncing && syncingZone === zone.label
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-white' :'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-emerald-500/30 disabled:opacity-40'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-medium">{zone.label}</div>
                        <div className="text-[10px] text-white/40">{zone.desc}</div>
                      </div>
                      {syncing && syncingZone === zone.label ? (
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-4 bg-white/5 rounded-xl p-3">
                  <p className="text-white/40 text-[10px] leading-relaxed">
                    💡 <strong className="text-white/60">Commencez par Chamonix</strong> — zone petite, garantie de fonctionner.<br/>
                    Après import, zoomez sur la zone pour voir les vrais sentiers GPS.
                  </p>
                </div>
              </div>
            )}

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
                      Cliquez sur &ldquo;Importer OSM&rdquo; pour importer les vraies randonnées
                      d&apos;OpenStreetMap. Chaque sentier possède une trace GPS complète (≥20 points).
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
