'use client';

import React from 'react';

interface ActionCompassWidgetProps {
  headingDegrees: number | null;
  altitudeMeters: number | null;
  elevationGainMeters: number;
  isUltraSave: boolean;
}

export const ActionCompassWidget: React.FC<ActionCompassWidgetProps> = ({
  headingDegrees,
  altitudeMeters,
  elevationGainMeters,
  isUltraSave,
}) => {
  const heading = headingDegrees ?? 0;
  const cardinalDirections = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const cardinalIndex = Math.round(((heading % 360) / 45)) % 8;
  const cardinal = cardinalDirections[cardinalIndex >= 0 ? cardinalIndex : 0];

  return (
    <div
      className={`p-4 rounded-3xl transition-all ${
        isUltraSave
          ? 'bg-black border border-[#4ADE80]/40 text-[#4ADE80]'
          : 'bg-[#17402C]/90 text-white backdrop-blur-xl border border-white/10 shadow-lg shadow-black/20'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-75">
          ORIENTATION & ALTITUDE
        </span>
        <span
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
            isUltraSave ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-white/10 text-[#A6C1A0]'
          }`}
        >
          {cardinal} {Math.round(heading)}°
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Compass Dial Indicator */}
        <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
          <div
            className={`w-full h-full rounded-full border-2 flex items-center justify-center ${
              isUltraSave ? 'border-[#4ADE80]/40' : 'border-white/20'
            }`}
          >
            <div
              className="w-1 h-7 rounded-full transition-transform duration-300 origin-center"
              style={{
                transform: `rotate(${heading}deg)`,
                background: isUltraSave
                  ? 'linear-gradient(to top, #4ADE80 50%, #EF4444 50%)'
                  : 'linear-gradient(to top, rgba(255,255,255,0.4) 50%, #EF4444 50%)',
              }}
            />
          </div>
          <span className="absolute top-0.5 text-[8px] font-bold text-red-400">N</span>
        </div>

        {/* Altitude & D+ Stats */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono tracking-tight">
              {altitudeMeters !== null ? Math.round(altitudeMeters) : '--'}
            </span>
            <span className="text-xs font-medium opacity-75">m alt</span>
          </div>
          <div className="text-[11px] font-mono opacity-80 flex items-center gap-1">
            <span>↗ +{Math.round(elevationGainMeters)}m</span>
          </div>
        </div>
      </div>
    </div>
  );
};
