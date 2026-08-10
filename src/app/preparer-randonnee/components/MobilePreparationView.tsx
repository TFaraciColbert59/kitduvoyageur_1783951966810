'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreparationResult } from '@/lib/preparation/PreparationEngine';
import { WeatherSnapshot } from '@/features/hiking/types';

import { PreparationHero } from './PreparationHero';
import { PreparationScore } from './PreparationScore';
import { PreparationConditions } from './PreparationConditions';
import { EquipmentTabs, TabType } from './EquipmentTabs';
import { EquipmentGearItem } from './EquipmentGearItem';
import { EquipmentOkItem } from './EquipmentOkItem';
import { PreparationSafety } from './PreparationSafety';
import { StartDock } from './StartDock';
import { Icon } from './PreparationIcons';
import { getDifficultyLabel } from '@/components/explorer/types';

interface MobilePreparationViewProps {
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

export const MobilePreparationView: React.FC<MobilePreparationViewProps> = ({
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
  const [activeTab, setActiveTab] = useState<TabType>('missing');
  const diffLabel = getDifficultyLabel(route.difficulty);

  return (
    <div className="min-h-screen bg-[#EAE6DF] font-sans pb-[230px] relative overflow-x-hidden">
      {!isOnline && (
         <div className="w-full bg-[#B85838] text-white text-[10px] uppercase tracking-widest font-mono text-center py-1 absolute top-0 z-50">
           Mode Hors-Ligne Actif
         </div>
      )}

      <PreparationHero
        hikeName={{ pre: 'Préparation ·', em: route.name }}
        location={route.location || route.network || 'France'}
        distance={String(route.distanceKm ?? route.distance_km ?? 0)}
        duration={route.durationHours ? `${route.durationHours}h` : route.duration_hours ? `${route.duration_hours}h` : 'N/A'}
        ascent={String(route.elevationGainM ?? route.elevation_gain ?? 0)}
        difficulty={diffLabel}
        onBack={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
          } else {
            router.push('/explorer');
          }
        }}
        onSave={() => {
          if (toastMsg !== null) return;
          // Trigger feedback toast
          const el = document.getElementById('prep-toast');
          if (el) {
            el.classList.add('on');
            setTimeout(() => el.classList.remove('on'), 1800);
          }
        }}
      />

      <PreparationScore
        score={report.score}
        totalOk={dispoItems.length}
        totalNeeds={missingItems.length + matchedItems.length}
        missingCount={missingItems.length}
        partialCount={insufItems.length}
      />

      <div className="content">
        <PreparationConditions
          distance={String(route.distanceKm ?? route.distance_km ?? 0)}
          ascent={String(route.elevationGainM ?? route.elevation_gain ?? 0)}
          duration={route.durationHours ? `${route.durationHours}h` : route.duration_hours ? `${route.duration_hours}h` : 'N/A'}
          difficulty={diffLabel}
          temp={weatherData ? weatherData.tempC : '--'}
          rainProb={weatherData ? Math.round(weatherData.precipitationProbability * 100) : '--'}
          windSpeed={weatherData?.windKmH ? Math.round(weatherData.windKmH) : '--'}
        />

        <EquipmentTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          missingCount={allMissingOrPartial.length}
          okCount={dispoItems.length}
          ctxCount={report.warnings.length}
        />

        {activeTab === 'missing' && (
          <div className="pane on">
             {allMissingOrPartial.length > 0 ? (
               <>
                 {insufItems.map((match, i) => (
                   <EquipmentGearItem
                     key={`p-${i}`}
                     label={match.requirement.label}
                     why={match.requirement.reason}
                     priority={match.requirement.priority}
                     status="partial"
                     available={match.available}
                     required={match.requirement.required}
                     onAdd={() => handleAddInventory(match.requirement.label, match.requirement.categoryKeywords[0] || 'Autre')}
                   />
                 ))}
                 {missingItems.map((req, i) => (
                   <EquipmentGearItem
                     key={`m-${i}`}
                     label={req.label}
                     why={req.reason}
                     priority={req.priority}
                     status="missing"
                     available={0}
                     required={req.required}
                     onAdd={() => handleAddInventory(req.label, req.categoryKeywords[0] || 'Autre')}
                   />
                 ))}
               </>
             ) : (
               <div className="empty">
                 <div className="ic"><Icon name="check" /></div>
                 <div className="t">Rien ne <em>manque.</em></div>
                 <div className="s">Tu as tout ce qu'il faut pour partir.</div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'ok' && (
          <div className="pane on">
            <div className="section-head" style={{ paddingTop: 0 }}>
              <div className="h">Ton <em>équipement</em> est suffisant<span className="badge ok">{dispoItems.length}</span></div>
            </div>
            {dispoItems.length > 0 ? (
              <div className="ok-list">
                {dispoItems.map((match, i) => (
                   <EquipmentOkItem
                     key={`o-${i}`}
                     label={match.requirement.label}
                     qty={match.available}
                   />
                ))}
              </div>
            ) : (
              <div className="empty">
                 <div className="ic"><Icon name="info" /></div>
                 <div className="t">Ton inventaire est <em>vide.</em></div>
                 <div className="s">Commence par ajouter ce qu'il te manque.</div>
              </div>
            )}
            
            <div className="section-head" style={{ marginTop: 8 }}>
              <div className="h">Sécurité <em>randonnée</em></div>
            </div>
            <PreparationSafety
              score={report.score}
              weatherState={wState}
              gpsState={gState}
              offlineState={oState}
              batteryState={bState}
              alerts={report.warnings}
            />
          </div>
        )}

        {activeTab === 'ctx' && (
          <div className="pane on">
            <div className="section-head" style={{ paddingTop: 0 }}>
              <div className="h">Recommandé <em>selon</em> les conditions</div>
            </div>
            {report.warnings.length > 0 ? (
              report.warnings.map((warn, i) => (
                <div key={i} className="gear-item" style={{ marginBottom: 8, padding: '10px 12px' }}>
                   <div className="icon"><Icon name="info" /></div>
                   <div className="body">
                     <div className="n">Alerte Météo/Terrain</div>
                     <div className="why">{warn}</div>
                   </div>
                </div>
              ))
            ) : (
               <div className="empty">
                 <div className="ic"><Icon name="check" /></div>
                 <div className="t">Rien de <em>particulier.</em></div>
                 <div className="s">Les conditions sont favorables.</div>
               </div>
            )}
          </div>
        )}
      </div>

      <StartDock
        score={report.score}
        totalOk={dispoItems.length}
        totalNeeds={missingItems.length + matchedItems.length}
        missingCount={allMissingOrPartial.length}
        anyEssentialMissing={anyEssentialMissing}
        onStart={handleStart}
      />

      <div className={`toast ${toastMsg ? 'on' : ''}`} id="prep-toast">
        <div className="ic"><Icon name="check" /></div>
        <div><span>{toastMsg}</span> · <em>persisté</em></div>
      </div>
    </div>
  );
};
