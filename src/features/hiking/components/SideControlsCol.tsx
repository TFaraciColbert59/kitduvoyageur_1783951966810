'use client';

import React from 'react';

interface SideControlsColProps {
  headingDeg?: number | null;
  tempC?: number | null;
  weatherCondition?: string | null;
  batteryLevel?: number | null;
  isNightMode?: boolean;
  onOpenSafety?: () => void;
  onOpenWeather?: () => void;
}

export default function SideControlsCol({
  headingDeg = 15,
  tempC = 19,
  weatherCondition = '☀️',
  batteryLevel = 78,
  isNightMode = false,
  onOpenSafety,
  onOpenWeather,
}: SideControlsColProps) {
  return (
    <div className="absolute top-[175px] right-3 z-30 flex flex-col gap-2 select-none">
      {/* Compass Button */}
      <button
        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shadow-md backdrop-blur-xl border relative transition-transform active:scale-95 ${
          isNightMode
            ? 'bg-[#0B1F17]/70 border-[#C6DCBE]/14 text-white'
            : 'bg-[#FBFAF6]/90 border-[#0B1F17]/06 text-[#0B1F17]'
        }`}
        title="Boussole Directionnelle"
      >
        <span className="font-mono text-[7px] font-bold text-[#B85838] absolute top-1">N</span>
        <svg
          className="w-4 h-4 text-[#17402C] stroke-current stroke-[2] fill-none transition-transform"
          style={{ transform: `rotate(${headingDeg || 0}deg)` }}
          viewBox="0 0 24 24"
        >
          <polygon points="12,2 15,22 12,17 9,22" fill="currentColor" />
        </svg>
      </button>

      {/* Weather Button */}
      <button
        onClick={onOpenWeather}
        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center p-1 shadow-md backdrop-blur-xl border transition-transform active:scale-95 ${
          isNightMode
            ? 'bg-[#0B1F17]/70 border-[#C6DCBE]/14 text-white'
            : 'bg-[#FBFAF6]/90 border-[#0B1F17]/06 text-[#0B1F17]'
        }`}
        title="Station Météo"
      >
        <span className="text-xs leading-none">{weatherCondition || '☀️'}</span>
        <span className="font-mono text-[10px] font-semibold leading-none mt-0.5">
          {tempC != null ? `${tempC}°` : '19°'}
        </span>
      </button>

      {/* Battery Button */}
      <div
        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center p-1 shadow-md backdrop-blur-xl border ${
          isNightMode
            ? 'bg-[#0B1F17]/70 border-[#C6DCBE]/14 text-white'
            : 'bg-[#FBFAF6]/90 border-[#0B1F17]/06 text-[#0B1F17]'
        }`}
        title="Niveau de Batterie"
      >
        <span className="text-xs leading-none">🔋</span>
        <span
          className={`font-mono text-[9px] font-semibold leading-none mt-0.5 ${
            batteryLevel != null && batteryLevel <= 15 ? 'text-red-500 font-bold animate-pulse' : ''
          }`}
        >
          {batteryLevel != null ? `${batteryLevel}%` : '78%'}
        </span>
      </div>

      {/* Safety Center SOS Button */}
      <button
        onClick={onOpenSafety}
        className="w-11 h-11 rounded-2xl flex items-center justify-center bg-red-950/80 border border-red-500/50 backdrop-blur-xl text-white text-base shadow-xl transition-transform active:scale-95"
        title="Centre de Sécurité & Urgence"
      >
        🛡️
      </button>
    </div>
  );
}
