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
        // État de chargement : même zone que la carte météo (masquée aussi,
        // sinon un fetch lent produit un squelette non masqué dans la capture).
        data-visual-mask
        className={cn('glass rounded-[var(--lkv-radius-lg)] p-5 border border-white/50 shadow-xs animate-pulse space-y-3', className)}
        aria-hidden="true"
      >
        <div className="h-3 w-28 rounded-full bg-[color:var(--stone-200)]/80" />
        <div className="h-8 w-24 rounded-lg bg-[color:var(--stone-200)]/70" />
        <div className="h-3 w-40 rounded-full bg-[color:var(--stone-200)]/60" />
      </div>
    );
  }

  if (isError || !data || data.status !== 'ok' || !data.current) return null;
  const current = data.current;

  return (
    <section
      aria-label="Météo actuelle"
      // Donnée live Open-Meteo (temp, condition, vent) : jamais identique
      // entre deux captures → masque visuel canonique (protocole Y0.5).
      data-visual-mask
      className={cn('glass rounded-[var(--lkv-radius-lg)] p-5 border border-white/50 shadow-xs space-y-2', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)]">
          Météo actuelle
        </span>
        <span className="text-[9.5px] font-mono text-[color:var(--lkv-text-secondary)]">Open-Meteo</span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="font-mono font-extrabold text-3xl text-[color:var(--lkv-primary)]">
          {current.temperatureC}°C
        </span>
        <span className="text-sm font-bold text-[color:var(--lkv-primary)]">{current.condition}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] font-mono text-[color:var(--lkv-text-secondary)]">
        <span>Vent {current.windKmH} km/h</span>
        {current.precipitationProbability != null ? (
          <span>Précip. {current.precipitationProbability} %</span>
        ) : null}
        {current.uvIndex != null ? <span>UV {current.uvIndex}</span> : null}
      </div>
    </section>
  );
}
