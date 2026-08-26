'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PreparationResult } from '@/lib/preparation/PreparationEngine';
import { WeatherSnapshot } from '@/features/hiking/types';
import { Icon } from './PreparationIcons';
import { EquipmentUnifiedList } from './EquipmentUnifiedList';
import { getDifficultyLabel } from '@/components/explorer/types';
import ExplorerMap from '@/components/explorer/ExplorerMap';
import { savePlannedHike } from '@/lib/preparation/plannedHikes';

interface DesktopPreparationViewProps {
  route: any;
  report: PreparationResult;
  weatherData: WeatherSnapshot | null;
  weatherStatus: 'loading' | 'success' | 'error';
  gpsStatus: 'CHECKING' | 'AUTHORIZED' | 'DENIED' | 'PROMPT' | 'UNAVAILABLE';
  batteryLevel: number | null;
  isOfflineReady: boolean;
  isOnline: boolean;
   handleAddInventory: (itemName: string, itemCategory: string) => void;
   handleAddToCart: (itemName: string, itemCategory: string) => void;
  handleStart: () => void;
  toastMsg: string | null;
  dispoItems: any[];
  insufItems: any[];
  missingItems: any[];
  matchedItems: any[];
  allMissingOrPartial: any[];
  anyEssentialMissing: boolean;
  wState: any;
  gState: any;
  bState: any;
  oState: any;
  equipmentList: any[];
  canEdit: boolean;
  handleQty: (itemId: string, delta: number) => void;
  handleDeleteItem: (itemId: string) => void;
}

export const DesktopPreparationView: React.FC<DesktopPreparationViewProps> = ({
  route,
  report,
  weatherData,
  isOnline,
  handleAddInventory,
  handleAddToCart,
  handleStart,
  toastMsg,
  dispoItems,
  insufItems,
  missingItems,
  matchedItems,
  allMissingOrPartial,
  anyEssentialMissing,
  wState,
  gState,
  bState,
  oState,
  equipmentList,
  canEdit,
  handleQty,
  handleDeleteItem,
}) => {
  const router = useRouter();
  const [showDateModal, setShowDateModal] = useState(false);
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const diffLabel = getDifficultyLabel(route.difficulty);

  const missingAndPartial = [
    ...insufItems.map(m => ({ ...m.requirement, available: m.available, status: 'partial' as const })),
    ...missingItems.map(m => ({ ...m, available: 0, status: 'missing' as const }))
  ];

  const R = 40;
  const C = 2 * Math.PI * R;
  const scoreOff = C * (1 - report.score / 100);
  const gearOk = report.score >= 85;

  const mapTrails = [
    {
      id: String(route.id),
      name: route.name || 'Randonnée',
      difficulty: route.difficulty || 'moderate',
      distance_km: route.distance_km || route.distanceKm || 0,
      duration_hours: route.duration_hours || route.durationHours || 0,
      elevation_gain: route.elevation_gain || route.elevationGainM || 0,
      lat: route.start?.lat || route.start_lat || 45.0,
      lng: route.start?.lng || route.start_lng || 6.0,
      geojson: route.geom || route.geojson || null,
      ref: route.ref,
      network: route.network,
      terrain_type: route.terrainType || route.terrain_type,
      season: route.season,
      family_friendly: route.familyFriendly || route.family_friendly,
      ai_description: route.aiDescription || route.ai_description,
    }
  ];


  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden font-sans text-[#17402C] bg-[#17402C]">
      
      {/* FULL SCREEN BACKGROUND MAP */}
      <div className="absolute inset-0 w-full h-full">
        <ExplorerMap 
          trails={mapTrails as any} 
          selectedTrailId={String(route.id)} 
          onTrailClick={() => {}} 
          controlsPosition="left"
        />
      </div>

      {/* LEFT COLUMN OVERLAY: 80% Transparent Header & Weather Capsule (Layer 10) */}
      <div className="absolute top-0 left-0 bottom-0 w-[52%] z-10 flex flex-col justify-between p-6 pointer-events-none">
        {/* Top Header Overlay (Compact Glass Capsule) */}
        <div className="pointer-events-auto w-fit max-w-md bg-black/20 backdrop-blur-md p-3.5 px-4 rounded-2xl border border-white/25 ">
          <div className="flex items-center gap-2.5 mb-1.5">
            <button 
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/explorer');
                }
              }}
              className="inline-flex items-center gap-1 text-white/95 hover:text-white bg-white/15 hover:bg-white/30 backdrop-blur-xl px-2.5 py-0.5 rounded-full transition-all text-[11px] font-semibold tracking-wide border border-white/30 "
            >
              <Icon name="back" className="w-3 h-3" /> Explorer
            </button>
            <p className="text-[#A7D3A6] text-[10px] font-mono tracking-wider uppercase font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] truncate">
              Cockpit • {route.location || route.network || 'France'}
            </p>
          </div>

          <h1 className="text-base lg:text-lg font-display font-black text-white tracking-tight leading-snug drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] mb-2">
            {route.name}
          </h1>
          
          <div className="flex items-center gap-1.5 flex-wrap">
             <span className="flex items-center gap-1 text-white bg-black/45 backdrop-blur-xl px-2.5 py-1 rounded-full text-[11px] font-mono font-black border border-white/25 ">
               <Icon name="route" className="w-3 h-3 text-[#A7D3A6]" /> {Number(route.distance_km || route.distanceKm || 0).toFixed(1)} km
             </span>
             <span className="flex items-center gap-1 text-white bg-black/45 backdrop-blur-xl px-2.5 py-1 rounded-full text-[11px] font-mono font-black border border-white/25 ">
               <Icon name="clock" className="w-3 h-3 text-[#A7D3A6]" /> {route.duration_hours || route.durationHours ? `${route.duration_hours || route.durationHours}h` : 'N/A'}
             </span>
             <span className="flex items-center gap-1 text-white bg-black/45 backdrop-blur-xl px-2.5 py-1 rounded-full text-xs font-mono font-black border border-white/25 ">
               <Icon name="mountain" className="w-3 h-3 text-[#A7D3A6]" /> D+{Math.round(route.elevation_gain || route.elevationGainM || 0)}m
             </span>
             <span className="flex items-center gap-1 text-[#17402C] bg-[#A7D3A6]/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono font-black  border border-white/40">
               <Icon name="spark" className="w-3 h-3 opacity-80" /> {diffLabel}
             </span>
          </div>

          <div className="mt-3 pt-2 border-t border-white/20">
             <button
               onClick={() => setShowDateModal(true)}
               className="w-full bg-white hover:bg-[#FBFAF6] text-[#17402C] py-2 px-3 rounded-xl font-bold text-xs  flex items-center justify-center gap-2 transition-all cursor-pointer border border-black/10 active:scale-98"
             >
               <span>📦 Continuer à préparer cette randonnée</span>
             </button>
           </div>
        </div>

        {/* Bottom Floating Weather Capsule (80% Transparent Glass) */}
        <div className="pointer-events-auto mb-2">
          <div className="inline-flex bg-white/20 backdrop-blur-md p-3.5 px-4 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.15)] border border-white/35 gap-4 items-center">
            <div className="flex items-center gap-2.5 border-r border-white/30 pr-4">
               <div className="w-9 h-9 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-[#17402C] border border-white/50 ">
                 <Icon name="temp" className="w-4 h-4 text-[#17402C]" />
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest font-mono text-[#17402C] font-black drop-">Météo</p>
                 <p className="text-sm font-display font-black leading-tight text-[#17402C] drop-">{weatherData ? weatherData.tempC : '--'}°C</p>
               </div>
            </div>
            <div className="flex items-center gap-2.5 border-r border-white/30 pr-4">
               <div className="w-9 h-9 bg-blue-500/20 backdrop-blur-md rounded-xl flex items-center justify-center text-[#1e40af] border border-blue-500/30 ">
                 <Icon name="cloud-rain" className="w-4 h-4" />
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest font-mono text-[#17402C] font-black drop-">Pluie</p>
                 <p className="text-sm font-display font-black leading-tight text-[#17402C] drop-">{weatherData ? Math.round(weatherData.precipitationProbability * 100) : '--'}%</p>
               </div>
            </div>
            <div className="flex items-center gap-2.5">
               <div className="w-9 h-9 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-[#17402C] border border-white/50 ">
                 <Icon name="wind" className="w-4 h-4" />
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest font-mono text-[#17402C] font-black drop-">Vent</p>
                 <p className="text-sm font-display font-black leading-tight text-[#17402C] drop-">{weatherData?.windKmH ? Math.round(weatherData.windKmH) : '--'} km/h</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: 80% Transparent Liquid Glass Panel (Layer 20) */}
      <div className="absolute top-0 right-0 bottom-0 w-[48%] max-w-[580px] min-w-[380px] z-20 bg-white/20 backdrop-blur-md border-l border-white/35 flex flex-col overflow-hidden shadow-[-20px_0_60px_rgba(0,0,0,0.15)]">
        
        {/* Header / Score (80% Transparent Top Card) */}
        <div className="p-6 border-b border-white/30 bg-white/20 backdrop-blur-md flex-shrink-0 ">
          <div className="flex items-center gap-5">
             <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r={R} fill="none"
                    stroke={report.score >= 80 ? '#16a34a' : report.score >= 50 ? '#ca8a04' : '#dc2626'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={scoreOff}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-black text-[#17402C] drop-">{report.score}</span>
                  <span className="text-[9px] font-mono text-[#17402C] font-black">%</span>
                </div>
             </div>
             <div className="min-w-0">
               <h2 className="text-[10px] font-mono tracking-widest text-[#17402C] uppercase mb-0.5 font-black drop-">Ton Sac</h2>
               <h3 className="text-xl font-display font-black text-[#17402C] leading-tight mb-1 truncate drop-">
                 {report.score >= 95 ? 'Tu es prêt à partir.' : report.score >= 85 ? 'Presque prêt.' : report.score >= 70 ? 'Encore quelques items.' : 'Il te manque l\'essentiel.'}
               </h3>
               <p className="text-xs font-mono font-black text-[#17402C] drop-">
                 {dispoItems.length} équipement{dispoItems.length > 1 ? 's' : ''} validé{dispoItems.length > 1 ? 's' : ''} sur {missingItems.length + matchedItems.length}
               </p>
             </div>
          </div>
        </div>

        {/* Scrollable Inventory Area (80% Transparent Scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Section: Équipement à préparer (fusion manquant + possédé, trié) */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-mono font-black tracking-widest text-[#17402C] uppercase mb-3 drop-">
              Équipement à préparer <span className="bg-white/20 text-[#17402C] px-2 py-0.5 rounded-full border border-white/30 font-black">{equipmentList.length}</span>
            </h4>
            <EquipmentUnifiedList
              items={equipmentList}
              canEdit={canEdit}
              targetDate={targetDate}
              onAdd={handleAddInventory}
              onAddToCart={handleAddToCart}
              onQty={handleQty}
              onDelete={handleDeleteItem}
            />
          </section>

          {/* Section: Recommandations */}
          {report.warnings.length > 0 && (
            <section>
              <h4 className="flex items-center gap-2 text-xs font-mono font-black tracking-widest text-[#78350F] uppercase mb-3">
                Recommandé pour cette randonnée
              </h4>
              <div className="grid gap-2.5">
                {report.warnings.map((warn, idx) => (
                  <div key={idx} className="bg-amber-500/15 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/30 flex items-start gap-3 ">
                     <div className="w-7 h-7 rounded-full bg-amber-500/25 text-amber-950 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/35">
                       <Icon name="info" className="w-4 h-4" />
                     </div>
                     <p className="text-xs font-black text-[#17402C] leading-relaxed pt-0.5 drop-">{warn}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Sticky Footer: 80% Transparent Safety & Action Dock */}
        <div className="bg-white/20 backdrop-blur-xl border-t border-white/35 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 flex-shrink-0">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-[#17402C]">
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${gearOk ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 shadow-[0_0_10px_#eab308]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-">Équipement</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${wState.ok && !wState.warn ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : wState.warn ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-">Météo</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${gState.ok ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 shadow-[0_0_10px_#eab308]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-">GPS</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${oState.ok ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-[#9CA89E]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-">Carte {oState.ok ? 'OK' : 'N/A'}</span>
                 </div>
              </div>
           </div>
           
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowDateModal(true)}
                className="flex-1 bg-[#FBFAF6] hover:bg-white text-[#17402C] py-3.5 rounded-xl font-bold text-xs  flex items-center justify-center gap-2 transition-all cursor-pointer border border-black/10"
              >
                <span>📦 Continuer à préparer cette randonnée</span>
              </button>
              <button
                onClick={handleStart}
                className="flex-1 bg-[#17402C] hover:bg-[#2D4034] text-white py-3.5 rounded-xl font-black tracking-wider uppercase text-xs  shadow-[#17402C]/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.005] active:scale-[0.995] cursor-pointer border border-white/20"
              >
                <Icon name="gps" className="w-4 h-4" />
                Démarrer
              </button>
            </div>
         </div>

        {/* Modal Date de Départ */}
        {showDateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full  border border-black/[0.08] space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#17402C]">Date de votre départ</h3>
                <p className="text-xs text-[#6B7A72] mt-0.5">
                  Planifiez cette randonnée dans votre espace Mon Matériel.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17402C] mb-1.5">
                  Quand partez-vous ?
                </label>
                <input
                  type="date"
                  value={targetDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-[#FBFAF6] border border-black/10 rounded-xl px-3.5 py-2.5 text-xs text-[#17402C] outline-none font-mono focus:border-[#17402C]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#6B7A72] hover:bg-black/[0.04]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    savePlannedHike({
                      routeId: String(route.id || route.route_id || ''),
                      name: route.name || 'Randonnée',
                      distanceKm: Number(route.distance_km || route.distanceKm || 10),
                      elevationGain: Number(route.elevation_gain || route.elevationGainM || 0),
                      terrain: route.terrain || 'Sentier',
                      season: 'Été',
                      isOvernight: Number(route.duration_hours || 0) > 8,
                      targetDate: targetDate || new Date().toISOString().split('T')[0],
                      weather: weatherData,
                    });
                    setShowDateModal(false);
                    router.push('/compte');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#17402C] text-white hover:bg-[#17402C] "
                >
                  Enregistrer & Préparer →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        <div className={`absolute top-6 right-6 z-50 bg-[#17402C]/90 backdrop-blur-2xl border border-white/30 text-white px-4 py-2.5 rounded-xl  flex items-center gap-2.5 transition-all duration-300 transform ${toastMsg ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
             <Icon name="check" className="w-3 h-3 text-emerald-400" />
          </div>
          <span className="text-xs font-bold font-mono">{toastMsg}</span>
        </div>

      </div>
    </div>
  );
};
