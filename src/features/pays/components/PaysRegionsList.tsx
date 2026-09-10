'use client';

import { cn } from '@/lib/utils';
import { usePaysRegions } from '../hooks/usePaysRegions';

/**
 * Régions administratives réelles (GeoNames). Rendue uniquement si des données
 * existent ; sinon rien (pas de liste inventée).
 */
export function PaysRegionsList({
  countryCode,
  className,
}: {
  countryCode?: string;
  className?: string;
}) {
  const { data, isLoading, isError } = usePaysRegions(countryCode);

  if (isLoading || isError || !data || data.status !== 'ok' || data.items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Régions et zones" className={cn('space-y-2', className)}>
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
        Régions & zones
      </span>
      <div className="flex flex-wrap gap-1.5">
        {data.items.map((region) => (
          <span
            key={region.id}
            className="glass-pill !px-2.5 !py-1 text-[10.5px] font-mono text-[#17402C]"
          >
            {region.name}
          </span>
        ))}
      </div>
    </section>
  );
}
