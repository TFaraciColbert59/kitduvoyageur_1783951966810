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
    <div
      className="absolute left-3 right-3 md:left-5 md:right-5 h-11 md:h-14 flex items-center gap-2 md:gap-4 z-40 select-none"
      style={{ top: 'calc(max(env(safe-area-inset-top, 0px), 14px) + 8px)' }}
    >
      {/* Brand Logo (Desktop / Tablet) */}
      <div className="hidden sm:flex items-center gap-2.5 px-3.5 md:px-4.5 py-2.5 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#17402C]/07 rounded-full shadow-[0_12px_32px_rgba(23,64,44,0.10),0_2px_8px_rgba(23,64,44,0.04)] text-[#17402C] text-sm font-medium tracking-tight h-10 md:h-11">
        <div className="w-5 md:w-6.5 h-5 md:h-6.5 rounded-full bg-gradient-to-br from-[#17402C] to-[#06120C] text-[#C6DCBE] flex items-center justify-center">
          <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21l3-9h12l3 9M6 12l6-8 6 8" />
          </svg>
        </div>
        <span>
          Le Kit du <em className="font-serif italic text-[#17402C] font-normal">Voyageur</em>
        </span>
      </div>

      {/* Breadcrumb / Active Route Title */}
      <div className="flex-1 flex items-center gap-2 md:gap-3 px-3.5 md:px-5 h-10 md:h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#17402C]/07 rounded-full shadow-[0_12px_32px_rgba(23,64,44,0.10),0_2px_8px_rgba(23,64,44,0.04)] min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <span className="text-xs font-semibold text-[#17402C] truncate">
          {routeName || 'Suivi GPS Actif'}
        </span>
        {(totalDistanceKm > 0 || elevationGainM > 0) && (
          <>
            <span className="text-[#AEB7B1] hidden sm:flex items-center">
              <svg className="w-3 h-3 stroke-current stroke-[2]" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
              </svg>
            </span>
            <span className="font-mono text-[10px] tracking-wider text-[#6B7A72] whitespace-nowrap hidden sm:inline">
              {totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} km` : ''}
              {elevationGainM > 0 ? ` · +${Math.round(elevationGainM)} m` : ''}
            </span>
          </>
        )}
      </div>

      {/* Top HUD Cells (GPS visible on mobile, rest on desktop) */}
      <div className="flex items-center gap-1.5 md:gap-2 h-10 md:h-11 flex-shrink-0">
        {/* GPS Status Cell */}
        <div className="flex items-center gap-1.5 md:gap-2.5 px-2.5 md:px-4 h-10 md:h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#17402C]/07 rounded-xl md:rounded-xl shadow-[0_12px_32px_rgba(23,64,44,0.10)]">
          <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#A8C8A0] text-[#06120C] flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 fill-none stroke-current stroke-[2.4]" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[7px] md:text-[8px] tracking-widest uppercase text-[#6B7A72]">GPS</span>
            <span className="text-[10px] md:text-xs font-medium text-[#17402C] mt-0.5 truncate max-w-[80px] md:max-w-none">{gpsStatus}</span>
          </div>
        </div>

        {/* Compass Cell (Desktop) */}
        <div className="hidden md:flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#17402C]/07 rounded-xl shadow-[0_12px_32px_rgba(23,64,44,0.10)]">
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
            <span className="text-xs font-medium text-[#17402C] mt-0.5">
              {cardinalDir} · {headingDeg}°
            </span>
          </div>
        </div>

        {/* Weather Cell (Desktop) */}
        <button
          onClick={onOpenWeather}
          className="hidden md:flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#17402C]/07 rounded-xl shadow-[0_12px_32px_rgba(23,64,44,0.10)] hover:bg-[#FBFAF6] transition-colors text-left"
        >
          <div className="text-[#17402C] flex items-center justify-center">
            <svg className="w-4.5 h-4.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72]">Météo</span>
            <span className="text-xs font-medium text-[#17402C] mt-0.5">
              {tempC != null ? `${tempC}° · ` : ''}{weatherCondition}
            </span>
          </div>
        </button>

        {/* Battery Cell (Desktop) */}
        <div className="hidden lg:flex items-center gap-2.5 px-4 h-11 bg-[#FBFAF6]/92 backdrop-blur-2xl border border-[#17402C]/07 rounded-xl shadow-[0_12px_32px_rgba(23,64,44,0.10)]">
          <div className="text-[#17402C] flex items-center justify-center">
            <svg className="w-5 h-3 fill-none stroke-current stroke-[1.8]" viewBox="0 0 24 12">
              <rect x="1" y="2" width="19" height="8" rx="2" />
              <rect x="3" y="4" width="12" height="4" fill="currentColor" />
              <rect x="21" y="4" width="2" height="4" rx="0.5" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[8px] tracking-widest uppercase text-[#6B7A72]">Batterie</span>
            <span className="text-xs font-medium text-[#17402C] mt-0.5">
              {batteryLevel != null ? `${batteryLevel}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
