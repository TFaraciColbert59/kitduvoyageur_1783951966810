'use client';

import { cn } from '@/lib/utils';
import { usePaysWeather } from '../hooks/usePaysWeather';

/**
 * Météo réelle du pays (Open-Meteo). Rendue uniquement si la donnée existe ;
 * sinon rien (aucune valeur inventée, aucun état d'erreur intrusif).
 */
export function PaysWeatherCard({
  countryCode,
  className,
}: {
  countryCode?: string;
  className?: string;
}) {
  const { data, isLoading, isError } = usePaysWeather(countryCode);

  if (isLoading) {
    return (
      <div
        className={cn('glass rounded-[1.5rem] p-5 border border-white/50 shadow-xs animate-pulse space-y-3', className)}
        aria-hidden="true"
      >
        <div className="h-3 w-28 rounded-full bg-[#EAE6DF]/80" />
        <div className="h-8 w-24 rounded-lg bg-[#EAE6DF]/70" />
        <div className="h-3 w-40 rounded-full bg-[#EAE6DF]/60" />
      </div>
    );
  }

  if (isError || !data || data.status !== 'ok' || !data.current) return null;
  const current = data.current;

  return (
    <section
      aria-label="Météo actuelle"
      className={cn('glass rounded-[1.5rem] p-5 border border-white/50 shadow-xs space-y-2', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
          Météo actuelle
        </span>
        <span className="text-[9.5px] font-mono text-[#5A7064]">Open-Meteo</span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="font-mono font-extrabold text-3xl text-[#17402C]">
          {current.temperatureC}°C
        </span>
        <span className="text-sm font-bold text-[#17402C]">{current.condition}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] font-mono text-[#5A7064]">
        <span>Vent {current.windKmH} km/h</span>
        {current.precipitationProbability != null ? (
          <span>Précip. {current.precipitationProbability} %</span>
        ) : null}
        {current.uvIndex != null ? <span>UV {current.uvIndex}</span> : null}
      </div>
    </section>
  );
}
