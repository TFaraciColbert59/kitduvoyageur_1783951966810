'use client';

import React from 'react';
import ExplorerMap from '@/components/explorer/ExplorerMap';
import { MapTrail } from '@/components/explorer/types';
import { POI } from '../types';
import { RouteTurnEvent } from '../services/RouteGeom';

interface DesktopMapOverlayProps {
  userLoc: [number, number] | null;
  userPositions?: Array<{ latitude: number; longitude: number }>;
  userAccuracy?: number | null;
  trails?: MapTrail[];
  selectedTrailId?: string | null;
  isNightMode?: boolean;
  nextPoi?: (POI & { distanceRemainingM: number }) | null;
  nextTurn?: { turn: RouteTurnEvent; distanceRemainingM: number } | null;
  headingDeg?: number | null;
  routeBearingDeg?: number | null;
  gpsHeadingDeg?: number | null;
  progressFrac?: number | null;
  autoFollow?: boolean;
  onAutoFollowChange?: (enabled: boolean) => void;
  onRecentre?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export default function DesktopMapOverlay({
  userLoc,
  userPositions,
  userAccuracy = null,
  trails = [],
  selectedTrailId,
  isNightMode = false,
  nextPoi,
  nextTurn,
  gpsHeadingDeg = null,
  progressFrac = null,
  autoFollow = true,
  onAutoFollowChange,
}: DesktopMapOverlayProps) {
  const showTurn = nextTurn && (!nextPoi || nextTurn.distanceRemainingM < 150 || nextTurn.distanceRemainingM < nextPoi.distanceRemainingM);
  const activeGuidePoi = !showTurn ? nextPoi : null;
  const activeGuideTurn = showTurn ? nextTurn : null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden select-none">
      {/* Dynamic Map Container */}
      <div className={`relative w-full h-full transition-filter duration-700 ${isNightMode ? 'invert brightness-90 contrast-125' : ''}`}>
        {/* Real Interactive Leaflet ExplorerMap Layer */}
        <div className="absolute inset-0 z-10">
          <ExplorerMap
            trails={trails}
            selectedTrailId={selectedTrailId || null}
            onTrailClick={() => {}}
            userLocation={userLoc}
            userPositions={userPositions}
            userAccuracy={userAccuracy}
            headingDeg={gpsHeadingDeg}
            progressFrac={progressFrac}
            autoFollow={autoFollow}
            onAutoFollowChange={onAutoFollowChange}
          />
        </div>
      </div>

      {/* 1. Primary Priority: Imminent Turn Instruction Card */}
      {activeGuideTurn && (
        <div className="absolute top-16 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[420px] bg-[#FBFAF6]/95 backdrop-blur-2xl border border-[#0B1F17]/12 rounded-3xl p-4 shadow-[0_16px_40px_rgba(11,31,23,0.15)] flex items-center gap-3.5 z-30 select-none">
          <div className="w-11 h-11 rounded-2xl bg-[#17402C] text-[#C6DCBE] flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md">
            {activeGuideTurn.turn.turnType.includes('droite') ? '↱' : activeGuideTurn.turn.turnType.includes('gauche') ? '↰' : '↑'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-widest uppercase font-semibold text-[#17402C] leading-none">
              Prochain virage · Dans {Math.round(activeGuideTurn.distanceRemainingM)} m
            </div>
            <div className="text-base font-bold tracking-tight text-[#0B1F17] mt-1 truncate">
              {activeGuideTurn.turn.instructionText}
            </div>
          </div>
        </div>
      )}

      {/* 2. Secondary Priority: Imminent POI Card (If turn is not imminent) */}
      {!activeGuideTurn && activeGuidePoi && activeGuidePoi.distanceRemainingM < 300 && (
        <div className="absolute top-16 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:w-[420px] bg-[#FBFAF6]/95 backdrop-blur-2xl border border-[#0B1F17]/12 rounded-3xl p-4 shadow-[0_16px_40px_rgba(11,31,23,0.15)] flex items-center gap-3.5 z-30 select-none">
          <div className="w-11 h-11 rounded-2xl bg-[#A8C8A0] text-[#06120C] flex items-center justify-center flex-shrink-0 shadow-md relative">
            <svg className="w-5 h-5 fill-none stroke-current stroke-[2.2]" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-5.333-6-10a6 6 0 0112 0c0 4.667-6 10-6 10z" />
              <circle cx="12" cy="11" r="2" fill="currentColor" />
            </svg>
            <span className="absolute -inset-1 rounded-2xl border-2 border-[#17402C] opacity-25 animate-ping pointer-events-none" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-widest uppercase font-semibold text-[#17402C] leading-none">
              Prochain point · Dans {Math.round(activeGuidePoi.distanceRemainingM)} m
            </div>
            <div className="text-base font-bold tracking-tight text-[#0B1F17] mt-1 truncate">
              {activeGuidePoi.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
