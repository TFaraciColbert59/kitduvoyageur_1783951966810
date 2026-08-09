'use client';

import React from 'react';

interface WaypointItem {
  id: string;
  name: string;
  italicPart?: string;
  meta: string;
  status: 'done' | 'current' | 'future';
  iconType?: 'check' | 'dot' | 'photo' | 'summit';
}

interface DesktopLeftPanelProps {
  distanceKm?: number;
  totalDistanceKm?: number;
  progressPercent?: number;
  startTime?: string;
  etaTime?: string;
  elapsedTimeStr?: string;
  maxAltitudeM?: number;
  waypoints?: WaypointItem[];
}

export default function DesktopLeftPanel({
  distanceKm = 0,
  totalDistanceKm = 0,
  progressPercent = 0,
  startTime = '--:--',
  etaTime,
  elapsedTimeStr = '00m',
  waypoints = [],
}: DesktopLeftPanelProps) {
  const pct = totalDistanceKm > 0
    ? Math.min(100, Math.max(0, progressPercent ?? (distanceKm / totalDistanceKm) * 100))
    : 0;

  return (
    <div className="absolute top-[96px] left-5 w-[320px] max-h-[calc(100%-180px)] flex flex-col gap-3.5 z-30 select-none overflow-y-auto custom-scrollbar">
      {/* 1. Progression Panel */}
      <div className="bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-2xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] overflow-hidden p-4">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[11px] uppercase tracking-widest text-[#6B7A72] font-semibold">
            Progression
          </span>
          <span className="font-mono text-[10px] text-[#8B978F] tracking-wide">
            <em className="font-serif italic font-normal text-[#17402C] text-xs">{elapsedTimeStr}</em> écoulées
          </span>
        </div>

        <div className="flex justify-between items-baseline mb-2">
          <div className="text-2xl font-medium tracking-tight text-[#0B1F17]">
            {distanceKm.toFixed(1)}
            <em className="font-serif italic font-normal text-sm text-[#17402C] ml-0.5">
              / {totalDistanceKm.toFixed(1)} km
            </em>
          </div>
          <div className="font-mono text-[11px] font-semibold text-[#17402C] tracking-wide px-2 py-0.5 bg-[#C6DCBE]/40 rounded">
            {Math.round(pct)} %
          </div>
        </div>

        {/* Progress Bar with End Glow Dot */}
        <div className="h-1 bg-[#0B1F17]/08 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-[#17402C] rounded-full relative transition-all duration-500"
            style={{ width: `${pct}%` }}
          >
            <div className="absolute -right-1.5 -top-0.5 w-2 h-2 rounded-full bg-[#17402C] shadow-[0_0_0_3px_rgba(23,64,44,0.15)]" />
          </div>
        </div>

        <div className="mt-2.5 flex justify-between font-mono text-[10px] text-[#6B7A72] tracking-wide">
          <span>DÉPART · {startTime}</span>
          <span>ETA · {etaTime}</span>
        </div>
      </div>

      {/* 2. Waypoints List Panel */}
      <div className="bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-2xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] overflow-hidden p-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] uppercase tracking-widest text-[#6B7A72] font-semibold">
            Itinéraire · {waypoints.length} étapes
          </span>
        </div>

        {/* Waypoints Timeline */}
        <div className="relative pl-1 space-y-2">
          {/* Connecting Vertical Line */}
          <div className="absolute left-[19px] top-3 bottom-5 w-[2px] bg-gradient-to-b from-[#17402C] via-[#17402C] to-[#0B1F17]/15" />

          {waypoints.map((wp) => (
            <div
              key={wp.id}
              className={`flex items-start gap-3 p-2 rounded-xl relative z-10 transition-colors ${
                wp.status === 'current' ? 'bg-[#A8C8A0]/20' : ''
              }`}
            >
              {/* Dot Icon */}
              <div
                className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs z-10 ${
                  wp.status === 'done'
                    ? 'bg-[#17402C] border-[#17402C] text-[#C6DCBE]'
                    : wp.status === 'current'
                    ? 'bg-[#A8C8A0] border-[#17402C] text-[#06120C] shadow-[0_0_0_4px_rgba(168,200,160,0.35)]'
                    : 'bg-[#FBFAF6] border-[#0B1F17]/20 text-[#8B978F]'
                }`}
              >
                {wp.status === 'done' ? (
                  <svg className="w-3 h-3 stroke-current stroke-[2.6] fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                  </svg>
                ) : wp.status === 'current' ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#06120C]" />
                ) : wp.iconType === 'photo' ? (
                  <svg className="w-2.5 h-2.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-9h12l3 9M6 12l6-8 6 8" />
                  </svg>
                )}
              </div>

              {/* Waypoint Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div
                  className={`text-xs font-medium leading-tight ${
                    wp.status === 'future' ? 'text-[#6B7A72]' : 'text-[#0B1F17]'
                  }`}
                >
                  {wp.name}{' '}
                  {wp.italicPart && (
                    <em className="font-serif italic font-normal text-[#17402C]">{wp.italicPart}</em>
                  )}
                </div>
                <div
                  className={`font-mono text-[10px] tracking-wide mt-0.5 ${
                    wp.status === 'current' ? 'text-[#17402C] font-semibold' : 'text-[#6B7A72]'
                  }`}
                >
                  {wp.meta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
