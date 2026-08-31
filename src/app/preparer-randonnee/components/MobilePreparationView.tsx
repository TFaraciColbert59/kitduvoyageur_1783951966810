'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PreparationResult } from '@/lib/preparation/PreparationEngine';
import { WeatherSnapshot } from '@/features/hiking/types';
import { savePlannedHike } from '@/lib/preparation/plannedHikes';

import { PreparationHero } from './PreparationHero';
import { PreparationScore } from './PreparationScore';
import { PreparationConditions } from './PreparationConditions';
import { EquipmentUnifiedList } from './EquipmentUnifiedList';
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

import ExplorerMap from '@/components/explorer/ExplorerMap';

export const MobilePreparationView: React.FC<MobilePreparationViewProps> = ({
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
    <div className="min-h-screen bg-[#F5F2EC] font-sans pb-[190px] relative overflow-x-hidden">
      {!isOnline && (
         <div className="w-full bg-[#B85838] text-white text-[10px] uppercase tracking-widest font-mono text-center py-1 absolute top-0 z-50">
           Mode Hors-Ligne Actif
         </div>
      )}

      {/* ── LARGE REAL INTERACTIVE MAP (62vh) ── */}
      <div className="relative w-full h-[62vh] min-h-[430px] z-0  border-b border-[#17402C]/10 overflow-hidden">
        <ExplorerMap
          trails={mapTrails as any}
          selectedTrailId={String(route.id)}
          onTrailClick={() => {}}
          controlsPosition="right"
          compact
        />

        {/* Floating Glass Header Bar — boutons réduits, déplacés en hauteur avec safe-area */}
        <div
          className="absolute left-3 right-3 z-[400] flex items-center justify-between pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
        >
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push('/explorer');
              }
            }}
            className="w-8 h-8 rounded-full bg-[#17402C]/80 backdrop-blur-md text-white border border-white/20  flex items-center justify-center pointer-events-auto active:scale-95 transition-all text-sm font-bold cursor-pointer"
            aria-label="Retour"
          >
            ←
          </button>

          <div className="bg-[#17402C]/80 backdrop-blur-md text-white border border-white/20 rounded-full px-3 py-1  flex items-center gap-2 pointer-events-auto max-w-[72%]">
            <span className="text-[11px] font-bold font-display truncate">{route.name}</span>
            <span className="text-[9px] font-mono text-white/70 uppercase tracking-wider shrink-0">{diffLabel}</span>
          </div>
        </div>
      </div>

      {/* ── 2. SCROLLABLE PREPARATION BODY SHEET ── */}
      <div className="w-full flex flex-col gap-4 p-4 pb-40">
        <PreparationScore
          score={report.score}
          totalOk={dispoItems.length}
          totalNeeds={missingItems.length + matchedItems.length}
          missingCount={missingItems.length}
          partialCount={insufItems.length}
        />

        <PreparationConditions
          distance={String(route.distanceKm ?? route.distance_km ?? 0)}
          ascent={String(route.elevationGainM ?? route.elevation_gain ?? 0)}
          duration={route.durationHours ? `${route.durationHours}h` : route.duration_hours ? `${route.duration_hours}h` : 'N/A'}
          difficulty={diffLabel}
          temp={weatherData ? weatherData.tempC : '--'}
          rainProb={weatherData ? Math.round(weatherData.precipitationProbability * 100) : '--'}
          windSpeed={weatherData?.windKmH ? Math.round(weatherData.windKmH) : '--'}
        />

        {/* Équipement — liste unique, manquant en haut / possédé en bas */}
        <div className="section-head" style={{ paddingTop: 0 }}>
          <div className="h">Équipement à <em>préparer</em><span className="badge ok">{equipmentList.length}</span></div>
          <div className="s">Coche ce que tu possèdes : +/− pour ajuster, 🗑 pour retirer.</div>
        </div>

        <EquipmentUnifiedList
          items={equipmentList}
          canEdit={canEdit}
          targetDate={targetDate}
          onAdd={handleAddInventory}
          onAddToCart={handleAddToCart}
          onQty={handleQty}
          onDelete={handleDeleteItem}
        />

        {/* Sécurité randonnée */}
        <div className="section-head" style={{ marginTop: 12 }}>
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

        {/* Recommandations selon les conditions */}
        {report.warnings.length > 0 && (
          <div className="pane on">
            <div className="section-head" style={{ paddingTop: 0 }}>
              <div className="h">Recommandé <em>selon</em> les conditions</div>
            </div>
            {report.warnings.map((warn, i) => (
              <div key={i} className="gear-item" style={{ marginBottom: 8, padding: '10px 12px' }}>
                <div className="icon"><Icon name="info" /></div>
                <div className="body">
                  <div className="n">Alerte Météo/Terrain</div>
                  <div className="why">{warn}</div>
                </div>
              </div>
            ))}
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
        onContinuePreparation={() => setShowDateModal(true)}
      />

      {/* Modal Date de Départ Mobile */}
      {showDateModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full  border border-black/[0.08] space-y-4 animate-slide-up">
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
                Enregistrer →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toastMsg ? 'on' : ''}`} id="prep-toast">
        <div className="ic"><Icon name="check" /></div>
        <div><span>{toastMsg}</span> · <em>persisté</em></div>
      </div>
    </div>
  );
};
