'use client';

import React from 'react';
import type { WeatherLocationData, ExpeditionLocation } from '../../types/expeditionRooms.types';

export interface WeatherPaneProps {
  weatherData?: {
    locationName?: string;
    tempC?: number;
    windKmH?: number;
    freezingLevelM?: number;
    weatherCode?: number;
    precipitationProbability?: number;
  } | null;
  location?: ExpeditionLocation | null;
  onRefresh?: () => void;
  className?: string;
}

export const WeatherPane: React.FC<WeatherPaneProps> = ({
  weatherData,
  location,
  onRefresh,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[color:var(--lkv-text-primary)]">
          Conditions Météo en Direct
        </h3>
        {weatherData?.locationName && (
          <span className="text-[11px] text-[color:var(--lkv-text-secondary)]">
            {weatherData.locationName}
          </span>
        )}
      </div>

      {weatherData ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-2 shadow-sm">
              <span className="block opacity-70 text-[color:var(--lkv-text-secondary)]">Temp</span>
              <strong className="text-sm text-[color:var(--lkv-text-primary)]">
                {weatherData.tempC != null ? `${weatherData.tempC}°C` : '--'}
              </strong>
            </div>
            <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-2 shadow-sm">
              <span className="block opacity-70 text-[color:var(--lkv-text-secondary)]">Vent</span>
              <strong className="text-sm text-[color:var(--lkv-text-primary)]">
                {weatherData.windKmH != null ? `${weatherData.windKmH} km/h` : '--'}
              </strong>
            </div>
            <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-2 shadow-sm">
              <span className="block opacity-70 text-[color:var(--lkv-text-secondary)]">Iso-0°C</span>
              <strong className="text-sm text-[color:var(--lkv-text-primary)]">
                {weatherData.freezingLevelM != null ? `${weatherData.freezingLevelM} m` : '--'}
              </strong>
            </div>
          </div>

          {weatherData.precipitationProbability != null && (
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] px-3 py-2 text-xs">
              <span className="text-[color:var(--lkv-text-secondary)]">Précipitations prévues</span>
              <span className="font-semibold text-[color:var(--lkv-text-primary)]">
                {weatherData.precipitationProbability}%
              </span>
            </div>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex h-[44px] min-h-[44px] w-full items-center justify-center rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] px-3 text-xs font-medium text-[color:var(--lkv-primary)] hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none"
            >
              Actualiser la météo
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-4 text-center">
          <span className="text-xs text-[color:var(--lkv-text-secondary)]">
            Localisation météo non définie
          </span>
          {location && (
            <span className="text-[11px] text-[color:var(--lkv-text-secondary)] opacity-70">
              Coordonnées GPS : {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
