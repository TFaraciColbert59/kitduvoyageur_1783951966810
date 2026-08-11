'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PreparationResult } from '@/lib/preparation/PreparationEngine';
import { WeatherSnapshot } from '@/features/hiking/types';
import { Icon } from './PreparationIcons';
import { getDifficultyLabel } from '@/components/explorer/types';
import ExplorerMap from '@/components/explorer/ExplorerMap';

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
}

export const DesktopPreparationView: React.FC<DesktopPreparationViewProps> = ({
  route,
  report,
  weatherData,
  isOnline,
  handleAddInventory,
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
}) => {
  const router = useRouter();
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
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden font-sans text-[#1C2620] bg-[#1C2620]">
      
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
        <div className="pointer-events-auto w-fit max-w-md bg-black/20 backdrop-blur-md p-3.5 px-4 rounded-2xl border border-white/25 shadow-2xl">
          <div className="flex items-center gap-2.5 mb-1.5">
            <button 
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/explorer');
                }
              }}
              className="inline-flex items-center gap-1 text-white/95 hover:text-white bg-white/15 hover:bg-white/30 backdrop-blur-xl px-2.5 py-0.5 rounded-full transition-all text-[11px] font-semibold tracking-wide border border-white/30 shadow-sm"
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
             <span className="flex items-center gap-1 text-white bg-black/45 backdrop-blur-xl px-2.5 py-1 rounded-full text-[11px] font-mono font-black border border-white/25 shadow-sm">
               <Icon name="route" className="w-3 h-3 text-[#A7D3A6]" /> {Number(route.distance_km || route.distanceKm || 0).toFixed(1)} km
             </span>
             <span className="flex items-center gap-1 text-white bg-black/45 backdrop-blur-xl px-2.5 py-1 rounded-full text-[11px] font-mono font-black border border-white/25 shadow-sm">
               <Icon name="clock" className="w-3 h-3 text-[#A7D3A6]" /> {route.duration_hours || route.durationHours ? `${route.duration_hours || route.durationHours}h` : 'N/A'}
             </span>
             <span className="flex items-center gap-1 text-white bg-black/45 backdrop-blur-xl px-2.5 py-1 rounded-full text-xs font-mono font-black border border-white/25 shadow-sm">
               <Icon name="mountain" className="w-3 h-3 text-[#A7D3A6]" /> D+{Math.round(route.elevation_gain || route.elevationGainM || 0)}m
             </span>
             <span className="flex items-center gap-1 text-[#1C2620] bg-[#A7D3A6]/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono font-black shadow-sm border border-white/40">
               <Icon name="spark" className="w-3 h-3 opacity-80" /> {diffLabel}
             </span>
          </div>
        </div>

        {/* Bottom Floating Weather Capsule (80% Transparent Glass) */}
        <div className="pointer-events-auto mb-2">
          <div className="inline-flex bg-white/20 backdrop-blur-md p-3.5 px-4 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.15)] border border-white/35 gap-4 items-center">
            <div className="flex items-center gap-2.5 border-r border-white/30 pr-4">
               <div className="w-9 h-9 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-[#1C2620] border border-white/50 shadow-sm">
                 <Icon name="temp" className="w-4 h-4 text-[#17402C]" />
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest font-mono text-[#1C2620] font-black drop-shadow-sm">Météo</p>
                 <p className="text-sm font-display font-black leading-tight text-[#1C2620] drop-shadow-sm">{weatherData ? weatherData.tempC : '--'}°C</p>
               </div>
            </div>
            <div className="flex items-center gap-2.5 border-r border-white/30 pr-4">
               <div className="w-9 h-9 bg-blue-500/20 backdrop-blur-md rounded-xl flex items-center justify-center text-[#1e40af] border border-blue-500/30 shadow-sm">
                 <Icon name="cloud-rain" className="w-4 h-4" />
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest font-mono text-[#1C2620] font-black drop-shadow-sm">Pluie</p>
                 <p className="text-sm font-display font-black leading-tight text-[#1C2620] drop-shadow-sm">{weatherData ? Math.round(weatherData.precipitationProbability * 100) : '--'}%</p>
               </div>
            </div>
            <div className="flex items-center gap-2.5">
               <div className="w-9 h-9 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-[#1C2620] border border-white/50 shadow-sm">
                 <Icon name="wind" className="w-4 h-4" />
               </div>
               <div>
                 <p className="text-[9px] uppercase tracking-widest font-mono text-[#1C2620] font-black drop-shadow-sm">Vent</p>
                 <p className="text-sm font-display font-black leading-tight text-[#1C2620] drop-shadow-sm">{weatherData?.windKmH ? Math.round(weatherData.windKmH) : '--'} km/h</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: 80% Transparent Liquid Glass Panel (Layer 20) */}
      <div className="absolute top-0 right-0 bottom-0 w-[48%] max-w-[580px] min-w-[380px] z-20 bg-white/20 backdrop-blur-md border-l border-white/35 flex flex-col overflow-hidden shadow-[-20px_0_60px_rgba(0,0,0,0.15)]">
        
        {/* Header / Score (80% Transparent Top Card) */}
        <div className="p-6 border-b border-white/30 bg-white/20 backdrop-blur-md flex-shrink-0 shadow-sm">
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
                  <span className="text-xl font-black text-[#1C2620] drop-shadow-sm">{report.score}</span>
                  <span className="text-[9px] font-mono text-[#1C2620] font-black">%</span>
                </div>
             </div>
             <div className="min-w-0">
               <h2 className="text-[10px] font-mono tracking-widest text-[#1C2620] uppercase mb-0.5 font-black drop-shadow-sm">Ton Sac</h2>
               <h3 className="text-xl font-display font-black text-[#1C2620] leading-tight mb-1 truncate drop-shadow-sm">
                 {report.score >= 95 ? 'Tu es prêt à partir.' : report.score >= 85 ? 'Presque prêt.' : report.score >= 70 ? 'Encore quelques items.' : 'Il te manque l\'essentiel.'}
               </h3>
               <p className="text-xs font-mono font-black text-[#1C2620] drop-shadow-sm">
                 {dispoItems.length} équipement{dispoItems.length > 1 ? 's' : ''} validé{dispoItems.length > 1 ? 's' : ''} sur {missingItems.length + matchedItems.length}
               </p>
             </div>
          </div>
        </div>

        {/* Scrollable Inventory Area (80% Transparent Scroll) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Section: À Ajouter */}
          {missingAndPartial.length > 0 && (
            <section>
              <h4 className="flex items-center gap-2 text-xs font-mono font-black tracking-widest text-[#9A3412] uppercase mb-3 drop-shadow-sm">
                À Ajouter <span className="bg-[#9A3412]/20 text-[#9A3412] px-2 py-0.5 rounded-full border border-[#9A3412]/30">{missingAndPartial.length}</span>
              </h4>
              <div className="grid gap-3">
                {missingAndPartial.map((item, idx) => (
                  <div key={idx} className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/40 shadow-[0_4px_20px_rgba(0,0,0,0.06)] flex items-start gap-4 transition-all hover:bg-white/30 hover:border-white/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 duration-200">
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${item.status === 'missing' ? 'bg-[#9A3412]/25 text-[#9A3412] border border-[#9A3412]/40' : 'bg-amber-500/25 text-amber-950 border border-amber-500/40'}`}>
                       <Icon name={item.status === 'missing' ? 'x' : 'info'} className="w-4 h-4" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                         <p className="font-black text-sm text-[#1C2620] truncate drop-shadow-sm">{item.label}</p>
                         {item.priority === 'vital' && (
                           <span className="text-[9px] font-black uppercase tracking-wider text-white bg-[#9A3412] px-1.5 py-0.5 rounded shadow-sm">Vital</span>
                         )}
                       </div>
                       <p className="text-[11px] font-bold text-[#1C2620]/90 mb-2 leading-relaxed drop-shadow-xs">{item.reason}</p>
                       <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/30">
                         <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                             <span className="text-[9px] font-mono text-[#1C2620]/80 font-black uppercase">Possédé</span>
                             <span className="text-xs font-black text-[#1C2620]">{item.available}</span>
                           </div>
                           <div className="w-px h-5 bg-white/30"></div>
                           <div className="flex flex-col">
                             <span className="text-[9px] font-mono text-[#1C2620]/80 font-black uppercase">Requis</span>
                             <span className="text-xs font-black text-[#1C2620]">{item.required} {item.unit}</span>
                           </div>
                         </div>
                         <button
                           onClick={() => handleAddInventory(item.label, item.categoryKeywords[0] || 'Autre')}
                           className="bg-[#1C2620] hover:bg-[#2D4034] text-white text-[11px] font-black px-3.5 py-1.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-white/20"
                         >
                           <Icon name="plus" className="w-3.5 h-3.5" /> J'ai cet équipement
                         </button>
                       </div>
                     </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Recommandations */}
          {report.warnings.length > 0 && (
            <section>
              <h4 className="flex items-center gap-2 text-xs font-mono font-black tracking-widest text-[#78350F] uppercase mb-3">
                Recommandé pour cette randonnée
              </h4>
              <div className="grid gap-2.5">
                {report.warnings.map((warn, idx) => (
                  <div key={idx} className="bg-amber-500/15 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/30 flex items-start gap-3 shadow-sm">
                     <div className="w-7 h-7 rounded-full bg-amber-500/25 text-amber-950 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/35">
                       <Icon name="info" className="w-4 h-4" />
                     </div>
                     <p className="text-xs font-black text-[#1C2620] leading-relaxed pt-0.5 drop-shadow-sm">{warn}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Déjà dans ton sac */}
          <section>
             <h4 className="flex items-center gap-2 text-xs font-mono font-black tracking-widest text-[#1C2620] uppercase mb-3">
               Déjà dans ton inventaire <span className="bg-white/20 text-[#1C2620] px-2 py-0.5 rounded-full border border-white/30 font-black">{dispoItems.length}</span>
             </h4>
             {dispoItems.length > 0 ? (
               <div className="grid grid-cols-2 gap-2.5">
                 {dispoItems.map((match, idx) => (
                   <div key={idx} className="bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/35 shadow-sm flex items-center gap-2.5 hover:bg-white/30 transition-all">
                      <div className="w-7 h-7 rounded-full bg-emerald-600/25 text-emerald-950 flex items-center justify-center shrink-0 border border-emerald-600/35">
                        <Icon name="check" className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-[#1C2620] truncate drop-shadow-sm">{match.requirement.label}</p>
                        <p className="text-[10px] font-mono text-[#1C2620] font-black">{match.available} {match.requirement.unit}</p>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="bg-white/20 backdrop-blur-md p-6 rounded-2xl border border-white/30 border-dashed text-center">
                 <p className="text-xs text-[#1C2620] font-black">Ton sac est vide.</p>
               </div>
             )}
          </section>

        </div>

        {/* Sticky Footer: 80% Transparent Safety & Action Dock */}
        <div className="bg-white/20 backdrop-blur-xl border-t border-white/35 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 flex-shrink-0">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-[#1C2620]">
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${gearOk ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 shadow-[0_0_10px_#eab308]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-shadow-sm">Équipement</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${wState.ok && !wState.warn ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : wState.warn ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-shadow-sm">Météo</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${gState.ok ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 shadow-[0_0_10px_#eab308]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-shadow-sm">GPS</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className={`w-2.5 h-2.5 rounded-full ${oState.ok ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-[#9CA89E]'}`} />
                   <span className="text-[10px] font-black uppercase tracking-wider drop-shadow-sm">Carte {oState.ok ? 'OK' : 'N/A'}</span>
                 </div>
              </div>
           </div>
           
           <button
             onClick={handleStart}
             className="w-full bg-[#1C2620] hover:bg-[#2D4034] text-white py-3.5 rounded-xl font-black tracking-widest uppercase text-xs shadow-2xl shadow-[#1C2620]/40 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.005] active:scale-[0.995] cursor-pointer border border-white/20"
           >
             <Icon name="gps" className="w-4 h-4" />
             Démarrer la randonnée
           </button>
        </div>

        {/* Toast Notification */}
        <div className={`absolute top-6 right-6 z-50 bg-[#1C2620]/90 backdrop-blur-2xl border border-white/30 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 transition-all duration-300 transform ${toastMsg ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
             <Icon name="check" className="w-3 h-3 text-emerald-400" />
          </div>
          <span className="text-xs font-bold font-mono">{toastMsg}</span>
        </div>

      </div>
    </div>
  );
};
