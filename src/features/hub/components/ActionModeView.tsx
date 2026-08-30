'use client';

import React, { useState, useEffect } from 'react';
import { ActionState } from '../types/hub.types';
import { ActionCompassWidget } from './ActionCompassWidget';
import { ActionWaterWidget } from './ActionWaterWidget';
import { ActionHydrationWidget } from './ActionHydrationWidget';
import { ActionSosWidget } from './ActionSosWidget';

interface ActionModeViewProps {
  trekName: string;
  state: ActionState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onUpdateAction: (partial: Partial<ActionState>) => void;
}

export const ActionModeView: React.FC<ActionModeViewProps> = ({
  trekName,
  state,
  onPause,
  onResume,
  onStop,
  onUpdateAction,
}) => {
  const [elapsed, setElapsed] = useState(state.elapsedSeconds);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const {
    startTime,
    isPaused,
    currentPosition,
    headingDegrees,
    altitudeMeters,
    elevationGainMeters,
    distanceTraveledKm,
    nextWater,
    hydrationLevelPercent,
    batteryLevel,
    isUltraSaveActive,
  } = state;

  // Real-time elapsed duration timer
  useEffect(() => {
    if (!startTime || isPaused) return;

    const interval = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(sec);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isPaused]);

  // Format seconds to hh:mm:ss
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAddSip = (ml: number) => {
    const nextPercent = Math.min(100, hydrationLevelPercent + Math.round((ml / 2000) * 100));
    onUpdateAction({ hydrationLevelPercent: nextPercent });
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Tactical Session Ribbon */}
      <div
        className={`p-4 rounded-3xl transition-all ${
          isUltraSaveActive
            ? 'bg-black border border-[#4ADE80]/50 text-[#4ADE80]'
            : 'bg-[#0B1A12]/90 text-white backdrop-blur-xl border border-white/15 shadow-xl shadow-black/40'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-[#A6C1A0]">
              SESSION EN COURS
            </span>
          </div>
          <span className="text-xs font-mono font-semibold opacity-80 truncate max-w-[160px]">
            {trekName}
          </span>
        </div>

        {/* Big Telemetry Numbers */}
        <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-white/10">
          <div>
            <div className="text-[10px] font-mono opacity-70 uppercase">TEMPS</div>
            <div className="text-lg font-extrabold font-mono tracking-tight">
              {formatTime(elapsed)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono opacity-70 uppercase">DISTANCE</div>
            <div className="text-lg font-extrabold font-mono tracking-tight">
              {distanceTraveledKm.toFixed(2)} km
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono opacity-70 uppercase">DÉNIVELÉ +</div>
            <div className="text-lg font-extrabold font-mono tracking-tight">
              +{Math.round(elevationGainMeters)} m
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-1">
          <button
            onClick={isPaused ? onResume : onPause}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              isUltraSaveActive
                ? 'bg-[#4ADE80]/20 text-[#4ADE80] border border-[#4ADE80]/40'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
            }`}
          >
            {isPaused ? '▶ Reprendre' : '⏸ Pause'}
          </button>

          <button
            onClick={() => setShowStopConfirm(true)}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all active:scale-95"
          >
            ⏹ Terminer
          </button>
        </div>
      </div>

      {/* 4 Quadrants Tactiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Quadrant 1 : Boussole & Altitude */}
        <ActionCompassWidget
          headingDegrees={headingDegrees}
          altitudeMeters={altitudeMeters}
          elevationGainMeters={elevationGainMeters}
          isUltraSave={isUltraSaveActive}
        />

        {/* Quadrant 2 : Point d'Eau & ETA */}
        <ActionWaterWidget
          waterPoint={nextWater}
          isUltraSave={isUltraSaveActive}
        />

        {/* Quadrant 3 : Hydratation */}
        <ActionHydrationWidget
          hydrationLevelPercent={hydrationLevelPercent}
          isUltraSave={isUltraSaveActive}
          onAddSip={handleAddSip}
        />

        {/* Quadrant 4 : SOS & Sécurité */}
        <ActionSosWidget
          latitude={currentPosition?.latitude ?? null}
          longitude={currentPosition?.longitude ?? null}
          altitude={altitudeMeters}
          batteryLevel={batteryLevel}
          isUltraSave={isUltraSaveActive}
        />
      </div>

      {/* Confirmation Modal to Stop Trek */}
      {showStopConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Arrêter le trek"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[#17402C] text-[#E7E3D6] border border-white/20 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              Terminer l'Aventure ?
            </h3>
            <p className="text-xs text-[#9AAD9E]">
              Votre trace GPS et vos métriques de session seront enregistrées dans votre carnet de voyage.
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowStopConfirm(false);
                  onStop();
                }}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs active:scale-95 transition-all"
              >
                Confirmer la fin du trek
              </button>
              <button
                onClick={() => setShowStopConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-all"
              >
                Continuer la randonnée
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
