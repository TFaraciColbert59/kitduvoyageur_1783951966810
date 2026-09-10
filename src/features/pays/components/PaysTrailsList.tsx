'use client';

import { cn } from '@/lib/utils';
import { usePaysTrails } from '../hooks/usePaysTrails';

function formatDistance(km: number | null): string | null {
  if (km == null || km <= 0) return null;
  return `${km.toFixed(1).replace('.0', '')} km`;
}

/**
 * Sentiers réels du pays (bbox PostGIS). Rendue uniquement si des sentiers
 * existent ; sinon rien (aucune donnée inventée).
 */
export function PaysTrailsList({
  countryCode,
  className,
}: {
  countryCode?: string;
  className?: string;
}) {
  const { data, isLoading, isError } = usePaysTrails(countryCode);

  if (isLoading || isError || !data || data.status !== 'ok' || data.items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Sentiers et treks à proximité" className={cn('space-y-3', className)}>
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
        Sentiers & treks à proximité
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.items.map((trail) => (
          <div key={trail.id} className="rounded-2xl border border-white/60 bg-white/70 p-4 space-y-1.5">
            <h4 className="font-display font-bold text-sm text-[#17402C] line-clamp-1">{trail.name}</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] font-mono text-[#5A7064]">
              {formatDistance(trail.distanceKm) ? (
                <span className="font-bold text-[#2D4536]">{formatDistance(trail.distanceKm)}</span>
              ) : null}
              {trail.durationHours != null ? <span>{trail.durationHours} h</span> : null}
              {trail.elevationGain != null ? <span>+{Math.round(trail.elevationGain)} m</span> : null}
              {trail.difficulty ? (
                <span className="text-[#5B7F55] font-bold">{trail.difficulty}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
