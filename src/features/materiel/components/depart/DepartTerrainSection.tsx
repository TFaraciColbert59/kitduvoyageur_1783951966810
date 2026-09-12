'use client';

import dynamic from 'next/dynamic';
import { DepartWeather } from '@/features/materiel/components/depart/DepartWeather';
import { formatDistanceKm } from '@/features/materiel/domain/departCalculations';
import type { MapTrail } from '@/components/explorer/types';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

const DepartMap = dynamic(() => import('./DepartMap').then((m) => ({ default: m.DepartMap })), {
  ssr: false,
  loading: () => <div className="glass-sub-card h-[220px] rounded-2xl" aria-hidden="true" />,
});

export interface DepartTerrainSectionProps {
  trail: MapTrail | null;
  weather: WeatherForecast | null;
  updatedAt?: string | null;
}

export function DepartTerrainSection({ trail, weather, updatedAt }: DepartTerrainSectionProps) {
  return (
    <section id="depart-terrain" className="glass flex flex-col gap-3 rounded-[1.75rem] p-4" aria-label="Terrain">
      <header className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Terrain
        </p>
        {trail?.distance_km != null && (
          <span className="glass-pill shrink-0 tabular-nums">
            {formatDistanceKm(trail.distance_km)}
          </span>
        )}
      </header>

      <DepartMap trail={trail} height="220px" />

      {weather && (
        <div role="group" aria-label="Météo">
          <DepartWeather weather={weather} updatedAt={updatedAt} />
        </div>
      )}
    </section>
  );
}
