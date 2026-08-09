'use client';

import React from 'react';

interface DesktopTopBarProps {
  gpsStatus?: string;
  headingDeg?: number | null;
  cardinalDir?: string;
  tempC?: number | null;
  weatherCondition?: string;
  batteryLevel?: number | null;
  batteryHours?: string;
  userName?: string;
  routeName?: string;
  totalDistanceKm?: number;
  elevationGainM?: number;
  onOpenSafety?: () => void;
  onOpenWeather?: () => void;
}

export default function DesktopTopBar({
  gpsStatus = 'GPS actif',
  headingDeg = 0,
  cardinalDir = 'N',
  tempC = null,
  weatherCondition = 'Chargement…',
  batteryLevel = null,
  batteryHours,
  userName = 'Tony',
  routeName,
  totalDistanceKm = 0,
  elevationGainM = 0,
  onOpenWeather,
}: DesktopTopBarProps) {
  return (
    <div className="absolute top-5 left-5 right-5 h-14 flex items-center gap-4 z-40 select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-2.5 px-4.5 py-2.5 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-full shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] text-[#0B1F17] text-bcd font-medium tracking-tight h-11">
        <div className="w-6.5 h-6.5 rounded-full bg-gradient-to-br from-[#17402C] to-[#06120C] text-[#C6DCBE] flex items-center justify-center">
          <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-9h12l3 9M6 12l6-8 6 8" />
          </svg>
        </div>
        <span>
          Le Kit du <em className="font-serif italic text-[#17402C] font-normal">Voyageur</em>
        </span>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-3 px-5 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-full shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)]">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-[#0B1F17] truncate max-w-[240px]">
          {routeName || 'Suivi GPS Actif'}
        </span>
        {(totalDistanceKm > 0 || elevationGainM > 0) && (
          <>
            <span className="text-[#AEB7B1] flex items-center">
              <svg className="w-3 h-3 stroke-current stroke-[2]" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
              </svg>
            </span>
            <span className="font-mono text-[10px] tracking-wider text-[#6B7A72]">
              {totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} km` : ''}
              {elevationGainM > 0 ? ` · +${Math.round(elevationGainM)} m` : ''}
            </span>
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Top HUD Cells */}
      <div className="flex items-center gap-2 h-11">
        {/* GPS Cell */}
        <div className="flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)]">
          <div className="w-6 h-6 rounded-full bg-[#A8C8A0] text-[#06120C] flex items-center justify-center">
            <svg className="w-3 h-3 fill-none stroke-current stroke-[2.4]" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72]">GPS</span>
            <span className="text-xs font-medium text-[#0B1F17] mt-0.5">{gpsStatus}</span>
          </div>
        </div>

        {/* Compass Cell */}
        <div className="flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)]">
          <div className="relative text-[#17402C] flex items-center justify-center">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 font-mono text-[7px] font-bold text-[#B85838]">
              N
            </span>
            <svg
              className="w-4.5 h-4.5 stroke-current stroke-[1.8] fill-none transition-transform duration-300"
              style={{ transform: `rotate(${headingDeg || 0}deg)` }}
              viewBox="0 0 24 24"
            >
              <polygon points="12,3 14.5,11 21,12 14.5,13 12,21 9.5,13 3,12 9.5,11" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72]">Cap</span>
            <span className="text-xs font-medium text-[#0B1F17] mt-0.5">
              {cardinalDir} · {headingDeg}°
            </span>
          </div>
        </div>

        {/* Weather Cell */}
        <button
          onClick={onOpenWeather}
          className="flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)] hover:bg-[#FBFAF6] transition-colors text-left"
        >
          <div className="text-[#17402C] flex items-center justify-center">
            <svg className="w-4.5 h-4.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72]">Météo</span>
            <span className="text-xs font-medium text-[#0B1F17] mt-0.5">
              {tempC}° · {weatherCondition}
            </span>
          </div>
        </button>

        {/* Battery Cell */}
        <div className="flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#0B1F17]/07 rounded-xl shadow-[0_12px_32px_rgba(11,31,23,0.10),0_2px_8px_rgba(11,31,23,0.04)]">
          <div className="text-[#17402C] flex items-center justify-center">
            <svg className="w-5 h-3 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 12">
              <rect x="1" y="2" width="19" height="8" rx="2" />
              <rect x="3" y="4" width="12" height="4" fill="currentColor" />
              <rect x="21" y="4" width="2" height="4" rx="0.5" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72]">Batterie</span>
            <span className="text-xs font-medium text-[#0B1F17] mt-0.5">
              {batteryLevel}% · {batteryHours}
            </span>
          </div>
        </div>
      </div>

      {/* User Avatar */}
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#E8B87A] to-[#C89755] text-[#4A2E0E] flex items-center justify-center font-serif italic text-sm font-semibold shadow-[0_12px_32px_rgba(11,31,23,0.10)] border border-[#0B1F17]/08 flex-shrink-0">
        {userName}
      </div>
    </div>
  );
}
