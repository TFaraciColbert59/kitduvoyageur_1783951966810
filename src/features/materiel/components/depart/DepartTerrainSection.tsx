'use client';

import dynamic from 'next/dynamic';
import { Badge, Card, Skeleton } from '@/components/ui';
import { DepartWeather } from '@/features/materiel/components/depart/DepartWeather';
import { formatDistanceKm } from '@/features/materiel/domain/departCalculations';
import type { MapTrail } from '@/components/explorer/types';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

const DepartMap = dynamic(() => import('./DepartMap').then((m) => ({ default: m.DepartMap })), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-2xl" />,
});

export interface DepartTerrainSectionProps {
  trail: MapTrail | null;
  weather: WeatherForecast | null;
  updatedAt?: string | null;
}

export function DepartTerrainSection({ trail, weather, updatedAt }: DepartTerrainSectionProps) {
  return (
    <Card as="section" id="depart-terrain" className="flex flex-col gap-3 p-4" aria-label="Terrain">
      <header className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-primary)]/70">
          Terrain
        </p>
        {trail?.distance_km != null && (
          <Badge tone="stone" className="shrink-0 tabular-nums">
            {formatDistanceKm(trail.distance_km)}
          </Badge>
        )}
      </header>

      <DepartMap trail={trail} height="220px" />

      {weather && (
        <div role="group" aria-label="Météo">
          <DepartWeather weather={weather} updatedAt={updatedAt} />
        </div>
      )}
    </Card>
  );
}
