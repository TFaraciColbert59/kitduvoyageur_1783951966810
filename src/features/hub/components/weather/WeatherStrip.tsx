import { CloudOff, Droplets } from 'lucide-react';
import { weatherLabel, type WeatherDay } from '@/features/materiel/services/getWeather';
import { getWeatherIcon } from './getWeatherIcon';

export interface WeatherStripProps {
  /** Prévisions réelles — null = météo indisponible (état honnête, jamais de fausse donnée). */
  current: { tempC: number; weathercode: number; precipPct: number } | null;
  days?: WeatherDay[];
  locationLabel?: string | null;
  /** strip = bloc pleine largeur · capsule = flottant compact (coin carte). */
  variant?: 'strip' | 'capsule';
}

/**
 * Hub V3 — Bandeau météo réelle (Open-Meteo). Server component, tokens.
 * strip : lieu + conditions actuelles + 4 prochains jours.
 * capsule : flottant compact (coin bas-droit de la carte média).
 * Météo null : coquille conservée (géométrie/reserveBottom stables) avec
 * « Météo indisponible » — aucune donnée fabriquée.
 */
export function WeatherStrip({ current, days = [], locationLabel, variant = 'strip' }: WeatherStripProps) {
  if (!current) {
    if (variant === 'capsule') {
      return (
        <div className="glass backdrop-blur-lg rounded-2xl p-2">
          <div className="flex items-center gap-2 min-h-[44px]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 border border-white/70 text-[var(--lkv-text-muted)]">
              <CloudOff size={16} aria-hidden="true" />
            </span>
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)] truncate leading-none">
              Météo indisponible
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="glass rounded-xl px-3 py-2">
        <div className="flex items-center gap-2.5 min-h-[44px]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 border border-white/70 text-[var(--lkv-text-muted)]">
            <CloudOff size={18} aria-hidden="true" />
          </span>
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">Météo indisponible</p>
        </div>
      </div>
    );
  }

  const CurrentIcon = getWeatherIcon(current.weathercode);
  const upcoming = days.filter((d) => d.day !== 'Auj.').slice(0, 4);

  if (variant === 'capsule') {
    return (
      <div className="glass backdrop-blur-lg rounded-2xl p-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 border border-white/70 text-[var(--lkv-secondary)]">
            <CurrentIcon size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-secondary)] truncate leading-none">
              {locationLabel || 'Météo'}
            </p>
            <p className="text-xs font-bold text-[var(--lkv-text-primary)] leading-tight">
              {Math.round(current.tempC)}°C
              <span className="ml-1 font-medium text-[var(--lkv-text-secondary)]">
                · {current.precipPct}%
              </span>
            </p>
          </div>
        </div>
        {upcoming.length > 0 && (
          <div className="mt-1.5 flex gap-1 border-t border-white/60 pt-1.5">
            {upcoming.map((d) => {
              const Icon = getWeatherIcon(d.weathercode);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center">
                  <p className="text-[8px] font-bold uppercase text-[var(--lkv-text-muted)] leading-none">
                    {d.day}
                  </p>
                  <Icon size={11} className="my-0.5 text-[var(--lkv-secondary)]" aria-hidden="true" />
                  <p className="text-[9px] font-bold text-[var(--lkv-text-primary)] leading-none">
                    {Math.round(d.tempMaxC)}°
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass rounded-xl px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 border border-white/70 text-[var(--lkv-secondary)]">
          <CurrentIcon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-serif-lkv italic text-[var(--lkv-text-secondary)] truncate">
            {locationLabel || 'Météo'}
          </p>
          <p className="text-sm font-bold text-[var(--lkv-text-primary)] leading-tight">
            {Math.round(current.tempC)}°C · {weatherLabel(current.weathercode)}
          </p>
        </div>
        <p className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[var(--lkv-text-secondary)]">
          <Droplets size={12} aria-hidden="true" />
          {current.precipPct}%
        </p>
      </div>

      {upcoming.length > 0 && (
        <div className="mt-2 flex gap-1.5 border-t border-white/60 pt-2">
          {upcoming.map((d) => {
            const Icon = getWeatherIcon(d.weathercode);
            return (
              <div
                key={d.date}
                className="flex-1 rounded-lg bg-white/60 border border-white/60 px-1.5 py-1.5 text-center"
              >
                <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--lkv-text-muted)]">
                  {d.day}
                </p>
                <Icon size={14} className="mx-auto my-0.5 text-[var(--lkv-secondary)]" aria-hidden="true" />
                <p className="text-[10px] font-bold text-[var(--lkv-text-primary)] leading-none">
                  {Math.round(d.tempMaxC)}°
                  <span className="ml-1 font-medium text-[var(--lkv-text-muted)]">
                    {Math.round(d.tempMinC)}°
                  </span>
                </p>
                <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] font-semibold text-[var(--lkv-text-secondary)] leading-none">
                  <Droplets size={9} aria-hidden="true" />
                  {d.precipPct}%
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WeatherStrip;
