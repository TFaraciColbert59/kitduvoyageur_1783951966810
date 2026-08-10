'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreparationResult } from '@/lib/preparation/PreparationEngine';
import { WeatherSnapshot } from '@/features/hiking/types';
import CarnetMap from '@/components/carnet/CarnetMap';
import { Icon } from './PreparationIcons';
import { getDifficultyLabel } from '@/components/explorer/types';

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

  return (
    <div className="flex h-screen w-full bg-[#EAE6DF] font-sans overflow-hidden text-[#1C2620]">
      
      {/* LEFT COLUMN: Map & Route Info */}
      <div className="w-3/5 h-full relative flex flex-col">
        {/* Absolute Header overlay */}
        <div className="absolute top-0 left-0 right-0 p-8 z-10 flex items-start justify-between bg-gradient-to-b from-[#1C2620]/80 to-transparent pb-16 pointer-events-none">
          <div className="pointer-events-auto">
            <button 
              onClick={() => router.back()}
              className="mb-4 flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-semibold tracking-wide"
            >
              <Icon name="back" className="w-4 h-4" /> Retour
            </button>
            <p className="text-[#A7D3A6] text-[11px] font-mono tracking-widest uppercase mb-1">Préparation • {route.location || 'France'}</p>
            <h1 className="text-4xl font-display font-800 text-white tracking-tight">{route.name}</h1>
            
            <div className="flex items-center gap-4 mt-4">
               <span className="flex items-center gap-1.5 text-white bg-white/10 px-3 py-1.5 rounded-full text-xs font-mono font-bold backdrop-blur-md">
                 <Icon name="route" className="w-3.5 h-3.5 opacity-70" /> {route.distance_km || 0} km
               </span>
               <span className="flex items-center gap-1.5 text-white bg-white/10 px-3 py-1.5 rounded-full text-xs font-mono font-bold backdrop-blur-md">
                 <Icon name="clock" className="w-3.5 h-3.5 opacity-70" /> {route.duration_hours || 'N/A'}h
               </span>
               <span className="flex items-center gap-1.5 text-white bg-white/10 px-3 py-1.5 rounded-full text-xs font-mono font-bold backdrop-blur-md">
                 <Icon name="mountain" className="w-3.5 h-3.5 opacity-70" /> D+{route.elevation_gain || 0}m
               </span>
               <span className="flex items-center gap-1.5 text-[#1C2620] bg-[#A7D3A6] px-3 py-1.5 rounded-full text-xs font-mono font-bold">
                 <Icon name="spark" className="w-3.5 h-3.5 opacity-70" /> {diffLabel}
               </span>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 bg-[#d4dad0] relative overflow-hidden">
          <CarnetMap 
            traceGeojson={route.geom} 
            distanceKm={route.distance_km} 
            elevationM={route.elevation_gain} 
            onDownloadGPX={() => {}} 
          />
        </div>

        {/* Weather Overlay Card */}
        <div className="absolute bottom-8 left-8 z-10 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl shadow-xl border border-white flex gap-6 pointer-events-auto">
            <div className="flex items-center gap-4 border-r border-[#1C2620]/10 pr-6">
               <div className="w-12 h-12 bg-[#F5F3ED] rounded-full flex items-center justify-center text-[#1C2620]">
                 <Icon name="temp" className="w-6 h-6" />
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-widest font-mono text-[#5C6B5E] mb-0.5">Température</p>
                 <p className="text-xl font-display font-800 leading-none">{weatherData ? weatherData.tempC : '--'}°C</p>
               </div>
            </div>
            <div className="flex items-center gap-4 border-r border-[#1C2620]/10 pr-6">
               <div className="w-12 h-12 bg-[#F5F3ED] rounded-full flex items-center justify-center text-[#2563EB]">
                 <Icon name="cloud-rain" className="w-6 h-6" />
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-widest font-mono text-[#5C6B5E] mb-0.5">Précipitations</p>
                 <p className="text-xl font-display font-800 leading-none">{weatherData ? Math.round(weatherData.precipitationProbability * 100) : '--'}%</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-[#F5F3ED] rounded-full flex items-center justify-center text-[#5C6B5E]">
                 <Icon name="wind" className="w-6 h-6" />
               </div>
               <div>
                 <p className="text-[10px] uppercase tracking-widest font-mono text-[#5C6B5E] mb-0.5">Vent</p>
                 <p className="text-xl font-display font-800 leading-none">{weatherData?.windKmH ? Math.round(weatherData.windKmH) : '--'} km/h</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Preparation & Control */}
      <div className="w-2/5 h-full bg-[#FBFAF6] border-l border-[#1C2620]/10 flex flex-col relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.03)]">
        
        {/* Header / Score */}
        <div className="p-8 border-b border-[#1C2620]/5 bg-white">
          <div className="flex items-center gap-6">
             <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="#F5F3ED" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r={R} fill="none"
                    stroke={report.score >= 80 ? '#22c55e' : report.score >= 50 ? '#eab308' : '#ef4444'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={scoreOff}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black">{report.score}</span>
                  <span className="text-[9px] font-mono text-[#5C6B5E]">%</span>
                </div>
             </div>
             <div>
               <h2 className="text-[11px] font-mono tracking-widest text-[#5C6B5E] uppercase mb-1">Ton Sac</h2>
               <h3 className="text-2xl font-display font-800 leading-tight mb-2">
                 {report.score >= 95 ? 'Tu es prêt à partir.' : report.score >= 85 ? 'Presque prêt.' : report.score >= 70 ? 'Encore quelques items.' : 'Il te manque l\'essentiel.'}
               </h3>
               <p className="text-xs font-mono text-[#5C6B5E]">
                 {dispoItems.length} équipement{dispoItems.length > 1 ? 's' : ''} validé{dispoItems.length > 1 ? 's' : ''} sur {missingItems.length + matchedItems.length}
               </p>
             </div>
          </div>
        </div>

        {/* Scrollable Inventory Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Section: À Ajouter */}
          {missingAndPartial.length > 0 && (
            <section>
              <h4 className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-[#B85838] uppercase mb-4">
                À Ajouter <span className="bg-[#B85838]/10 text-[#B85838] px-2 py-0.5 rounded-full">{missingAndPartial.length}</span>
              </h4>
              <div className="grid gap-3">
                {missingAndPartial.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-[#B85838]/20 flex items-start gap-4 transition-transform hover:-translate-y-0.5 hover:shadow-lg duration-300">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.status === 'missing' ? 'bg-[#B85838]/10 text-[#B85838]' : 'bg-yellow-500/10 text-yellow-600'}`}>
                       <Icon name={item.status === 'missing' ? 'x' : 'info'} className="w-5 h-5" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                         <p className="font-bold text-sm truncate">{item.label}</p>
                         {item.priority === 'vital' && (
                           <span className="text-[9px] font-black uppercase tracking-wider text-white bg-[#B85838] px-1.5 py-0.5 rounded">Vital</span>
                         )}
                       </div>
                       <p className="text-[11px] text-[#5C6B5E] mb-2 leading-relaxed">{item.reason}</p>
                       <div className="flex items-center justify-between mt-3">
                         <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                             <span className="text-[9px] font-mono text-[#9CA89E] uppercase">Possédé</span>
                             <span className="text-xs font-bold text-[#1C2620]">{item.available}</span>
                           </div>
                           <div className="w-px h-6 bg-[#E8E4D8]"></div>
                           <div className="flex flex-col">
                             <span className="text-[9px] font-mono text-[#9CA89E] uppercase">Requis</span>
                             <span className="text-xs font-bold text-[#1C2620]">{item.required} {item.unit}</span>
                           </div>
                         </div>
                         <button
                           onClick={() => handleAddInventory(item.label, item.categoryKeywords[0] || 'Autre')}
                           className="bg-[#1C2620] hover:bg-[#2A3B32] text-white text-[11px] font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
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
              <h4 className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-yellow-600 uppercase mb-4">
                Recommandé pour cette randonnée
              </h4>
              <div className="grid gap-3">
                {report.warnings.map((warn, idx) => (
                  <div key={idx} className="bg-yellow-500/5 p-4 rounded-2xl border border-yellow-500/20 flex items-start gap-4">
                     <div className="w-10 h-10 rounded-full bg-yellow-500/20 text-yellow-700 flex items-center justify-center shrink-0">
                       <Icon name="info" className="w-5 h-5" />
                     </div>
                     <p className="text-sm font-medium text-[#1C2620] leading-relaxed pt-2.5">{warn}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Déjà dans ton sac */}
          <section>
             <h4 className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-[#5C6B5E] uppercase mb-4">
               Déjà dans ton inventaire <span className="bg-[#1C2620]/5 text-[#1C2620] px-2 py-0.5 rounded-full">{dispoItems.length}</span>
             </h4>
             {dispoItems.length > 0 ? (
               <div className="grid grid-cols-2 gap-3">
                 {dispoItems.map((match, idx) => (
                   <div key={idx} className="bg-white p-3 rounded-2xl border border-[#1C2620]/10 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <Icon name="check" className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{match.requirement.label}</p>
                        <p className="text-[10px] font-mono text-[#9CA89E]">{match.available} {match.requirement.unit}</p>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="bg-white/50 p-8 rounded-3xl border border-[#1C2620]/5 border-dashed text-center">
                 <p className="text-sm text-[#9CA89E] font-medium">Ton sac est vide.</p>
               </div>
             )}
          </section>

        </div>

        {/* Sticky Footer: Validation & Security */}
        <div className="bg-white border-t border-[#1C2620]/5 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] z-30">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-6 text-[#5C6B5E]">
                 <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${gearOk ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                   <span className="text-[11px] font-bold uppercase tracking-wider">Équipement</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${wState.ok && !wState.warn ? 'bg-emerald-500' : wState.warn ? 'bg-yellow-500' : 'bg-red-500'}`} />
                   <span className="text-[11px] font-bold uppercase tracking-wider">Météo</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${gState.ok ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                   <span className="text-[11px] font-bold uppercase tracking-wider">GPS</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${oState.ok ? 'bg-emerald-500' : 'bg-[#9CA89E]'}`} />
                   <span className="text-[11px] font-bold uppercase tracking-wider">Carte {oState.ok ? 'OK' : 'N/A'}</span>
                 </div>
              </div>
           </div>
           
           <button
             onClick={handleStart}
             className="w-full bg-[#1C2620] hover:bg-[#2A3B32] text-white py-4 rounded-2xl font-black tracking-widest uppercase text-sm shadow-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] active:scale-[0.99]"
           >
             <Icon name="gps" className="w-5 h-5" />
             Démarrer la randonnée
           </button>
        </div>

        {/* Toast */}
        <div className={`absolute top-8 right-8 z-50 bg-[#1C2620] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform ${toastMsg ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
             <Icon name="check" className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-xs font-bold font-mono">{toastMsg}</span>
        </div>

      </div>
    </div>
  );
};
