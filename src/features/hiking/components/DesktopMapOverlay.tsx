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
  headingDeg = null,
  routeBearingDeg = null,
  gpsHeadingDeg = null,
  autoFollow = true,
  onAutoFollowChange,
  onRecentre,
}: DesktopMapOverlayProps) {
  const heading = headingDeg != null && Number.isFinite(headingDeg) ? headingDeg % 360 : null;
  const routeBearing = routeBearingDeg != null && Number.isFinite(routeBearingDeg) ? ((routeBearingDeg % 360) + 360) % 360 : null;
  const arrowRotation =
    heading != null && routeBearing != null
      ? (routeBearing - heading + 360) % 360
      : null;
  const arrowHtmlStyle = arrowRotation != null
    ? { transform: `rotate(${arrowRotation}deg)` }
    : {};

  // Priorité d'affichage du guidage : virage imminent (< 150m) prioritaire sur POI
  const showTurn = nextTurn && (!nextPoi || nextTurn.distanceRemainingM < 150 || nextTurn.distanceRemainingM < nextPoi.distanceRemainingM);
  const activeGuidePoi = !showTurn ? nextPoi : null;
  const activeGuideTurn = showTurn ? nextTurn : null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden select-none">
      {/* 1. Base Rich Topo Paper Gradient Background */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isNightMode
            ? 'bg-[radial-gradient(ellipse_at_30%_25%,#1A2F24_0%,transparent_55%),radial-gradient(ellipse_at_75%_70%,#0e1f16_0%,transparent_50%),linear-gradient(160deg,#06120C_0%,#0B1F17_100%)]'
            : 'bg-[radial-gradient(ellipse_at_25%_20%,#DDE9D6_0%,transparent_55%),radial-gradient(ellipse_at_78%_65%,#C6DCBE_0%,transparent_50%),radial-gradient(ellipse_at_12%_82%,#EAF1E5_0%,transparent_40%),radial-gradient(ellipse_at_88%_88%,#DDD6C6_0%,transparent_45%),linear-gradient(160deg,#E9E4D9_0%,#DDD6C6_100%)]'
        }`}
      >
        {/* Topo Contour SVG Pattern */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            isNightMode ? 'opacity-20 invert' : 'opacity-15'
          }`}
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><g fill='none' stroke='%2317402C' stroke-width='0.7' opacity='0.16'><path d='M-40,140 Q220,90 480,130 T960,110 T1440,140 T1680,120'/><path d='M-40,210 Q220,175 480,200 T960,185 T1440,215 T1680,195'/><ellipse cx='800' cy='450' rx='420' ry='180'/><ellipse cx='800' cy='450' rx='240' ry='100'/></g></svg>")`,
            backgroundSize: 'cover',
          }}
        />

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
            autoFollow={autoFollow}
            onAutoFollowChange={onAutoFollowChange}
          />
        </div>
      </div>

      {/* Floating Center Turn / POI Instruction Card */}
      {activeGuideTurn && (
        <div className="absolute top-[96px] left-1/2 -translate-x-1/2 px-5 py-3.5 bg-[#FBFAF6]/96 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-2xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] flex items-center gap-3.5 z-20 min-w-[360px] max-w-[90vw] select-none">
          <div className="w-12 h-12 rounded-2xl bg-[#17402C] text-[#C6DCBE] flex items-center justify-center flex-shrink-0 relative shadow-md font-bold text-xl">
            {activeGuideTurn.turn.turnType.includes('droite') ? '↱' : activeGuideTurn.turn.turnType.includes('gauche') ? '↰' : '↑'}
            <span className="absolute -inset-1 rounded-2xl border-2 border-[#17402C] opacity-25 animate-ping pointer-events-none" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-widest uppercase font-semibold text-[#17402C] leading-none">
              Prochain virage · Dans {activeGuideTurn.distanceRemainingM} m
            </div>
            <div className="text-base font-bold tracking-tight text-[#0B1F17] mt-1 truncate">
              {activeGuideTurn.turn.instructionText}
            </div>
          </div>
        </div>
      )}

      {activeGuidePoi && (
        <div className="absolute top-[96px] left-1/2 -translate-x-1/2 px-5 py-3.5 bg-[#FBFAF6]/96 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-2xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] flex items-center gap-3.5 z-20 min-w-[360px] max-w-[90vw] select-none">
          <div className="w-12 h-12 rounded-2xl bg-[#17402C] text-white flex items-center justify-center flex-shrink-0 relative shadow-md">
            <svg className="w-6 h-6 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24" style={arrowHtmlStyle}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V8M12 8l-4 4M12 8l4 4" />
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
            {activeGuidePoi.category && (
              <div className="text-[10px] text-[#6B7A72] font-mono tracking-wide mt-0.5 uppercase">
                {activeGuidePoi.category}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Map Tools (Right side above Dock) */}
      <div className="absolute right-[380px] bottom-[40px] flex flex-col gap-1.5 z-30 select-none">
        <button
          onClick={onRecentre}
          className={`w-11 h-11 rounded-xl backdrop-blur-2xl border border-[#0B1F17]/07 shadow-lg flex items-center justify-center transition-all ${
            autoFollow
              ? 'bg-[#17402C] text-white shadow-emerald-950/30'
              : 'bg-[#FBFAF6]/92 text-[#0B1F17] hover:bg-[#FBFAF6] active:scale-95'
          }`}
          title={autoFollow ? 'Auto-follow actif' : 'Recentrer sur ma position'}
        >
          <svg className="w-4.5 h-4.5 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        <button
          className="w-11 h-11 rounded-xl bg-[#17402C] text-white border border-[#C6DCBE]/14 shadow-lg flex items-center justify-center hover:bg-[#06120C] active:scale-95 transition-transform"
          title="Couches cartographiques"
        >
          <svg className="w-4.5 h-4.5 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />
          </svg>
        </button>
      </div>

      {/* Map Legend (Bottom left) */}
      <div className="absolute left-[360px] bottom-[40px] px-3.5 py-2 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-xl shadow-lg flex items-center gap-4 z-30 font-mono text-[10px] text-[#6B7A72] tracking-wider uppercase select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-1 rounded bg-gradient-to-r from-[#17402C] to-[#A8C8A0]" />
          <span>PARCOURU</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-1 rounded border-t-2 border-dashed border-[#17402C]/60 bg-transparent" />
          <span>À VENIR</span>
        </div>
        <div className="w-[1px] h-3.5 bg-[#0B1F17]/10" />
        <span>ÉCHELLE · 1 : 25 000</span>
      </div>
    </div>
  );
}

