'use client';
import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Navigation, Mountain, MapPin } from 'lucide-react';
import type { TripFull } from '@/features/trips/types/trip.types';

interface ItinerarySidebarRightProps {
  trip: TripFull;
  stepsCount: number;
}

export default function ItinerarySidebarRight({ trip, stepsCount }: ItinerarySidebarRightProps) {
  const totalDistanceKm = trip.steps?.reduce((sum, s) => sum + (s.distance_km ?? 0), 0) ?? 0;
  const totalElevationGain = trip.steps?.reduce((sum, s) => sum + (s.elevation_gain_m ?? 0), 0) ?? 0;

  return (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      <GlassCard className="p-3.5 space-y-2.5 text-[var(--lkv-text-primary)]">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--lkv-text-secondary)] flex items-center gap-1.5">
          <Navigation size={13} />
          <span>Resume Itineraire</span>
        </span>
        <div className="space-y-2 text-xs">
          {[
            { icon: MapPin, label: 'Etapes', value: `${stepsCount}` },
            { icon: Navigation, label: 'Distance totale', value: totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(1)} km` : 'A renseigner' },
            { icon: Mountain, label: 'Denivele +', value: totalElevationGain > 0 ? `${totalElevationGain} m` : 'A renseigner' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-[var(--lkv-text-secondary)]">
                <Icon size={12} />
                {label}
              </span>
              <span className="font-mono font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="p-3.5 text-xs text-[var(--lkv-text-primary)] space-y-1.5">
        <p className="font-bold text-[var(--lkv-text-secondary)] uppercase tracking-wider text-[9px] font-mono">Conseil</p>
        <p className="text-[var(--lkv-text-primary)] leading-relaxed">
          Glissez-deposez les etapes pour reorganiser votre itineraire jour par jour.
        </p>
      </GlassCard>
    </aside>
  );
}