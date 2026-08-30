'use client';

import React from 'react';
import { NextWaterPoint } from '../types/hub.types';

interface ActionWaterWidgetProps {
  waterPoint: NextWaterPoint | null;
  isUltraSave: boolean;
}

export const ActionWaterWidget: React.FC<ActionWaterWidgetProps> = ({
  waterPoint,
  isUltraSave,
}) => {
  if (!waterPoint) {
    return (
      <div
        className={`p-4 rounded-3xl transition-all ${
          isUltraSave
            ? 'bg-black border border-[#4ADE80]/30 text-[#4ADE80]'
            : 'bg-[#17402C]/90 text-white backdrop-blur-xl border border-white/10 shadow-lg shadow-black/20'
        }`}
      >
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-75">
          PROCHAIN POINT D'EAU
        </span>
        <p className="text-xs font-mono mt-2 opacity-60">
          Aucune source identifiée sur le tronçon immédiat.
        </p>
      </div>
    );
  }

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  return (
    <div
      className={`p-4 rounded-3xl transition-all ${
        isUltraSave
          ? 'bg-black border border-[#4ADE80]/40 text-[#4ADE80]'
          : 'bg-[#17402C]/90 text-white backdrop-blur-xl border border-white/10 shadow-lg shadow-black/20'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-75">
          PROCHAIN POINT D'EAU
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            waterPoint.isReliable
              ? isUltraSave
                ? 'bg-[#4ADE80]/20 text-[#4ADE80]'
                : 'bg-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/20 text-amber-300'
          }`}
        >
          {waterPoint.isReliable ? 'Source active' : 'Débit incertain'}
        </span>
      </div>

      <h4 className="text-sm font-bold tracking-tight truncate mb-1">
        💧 {waterPoint.name}
      </h4>

      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-white/10">
        <div>
          <span className="text-xl font-extrabold font-mono">
            {formatDistance(waterPoint.distanceMeters)}
          </span>
          <span className="text-[10px] font-mono opacity-70 ml-1">
            ({waterPoint.elevationDeltaMeters >= 0 ? '+' : ''}
            {waterPoint.elevationDeltaMeters}m)
          </span>
        </div>

        <div className="text-right">
          <span className="text-xs font-mono font-bold">
            ETA ~{waterPoint.estimatedTimeMinutes} min
          </span>
        </div>
      </div>
    </div>
  );
};
