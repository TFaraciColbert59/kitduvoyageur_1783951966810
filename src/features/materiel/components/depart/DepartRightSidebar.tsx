'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { DepartWeightBreakdown } from './DepartWeightBreakdown';
import { DepartWeather } from './DepartWeather';
import { DepartParticipants } from './DepartParticipants';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DepartDetail } from '@/features/materiel/services/getDepartDetail';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

const DepartMap = dynamic(
  () => import('./DepartMap').then((m) => ({ default: m.DepartMap })),
  {
    ssr: false,
    loading: () => (
      <div className="glass rounded-[24px] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/20">
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-[200px] rounded-none" />
      </div>
    ),
  }
);

interface DepartRightSidebarProps {
  depart: DepartDetail;
  weather: WeatherForecast | null;
}

export function DepartRightSidebar({ depart, weather }: DepartRightSidebarProps) {
  return (
    <aside className="w-full space-y-3.5" aria-label="Informations complémentaires du départ">
      {/* 1. Analyse du Poids */}
      <DepartWeightBreakdown
        breakdown={depart.weightBreakdown}
        totalWeightG={depart.baseWeightG}
      />

      {/* 2. Météo du secteur */}
      <DepartWeather weather={weather} />

      {/* 3. Équipe & Sécurité */}
      <DepartParticipants
        participants={depart.participants}
        emergencyContact={depart.emergencyContact}
      />

      {/* 4. Carte du tracé */}
      <DepartMap trail={depart.trail} height="200px" />
    </aside>
  );
}
