import { Droplets } from 'lucide-react';
import { weatherLabel, type WeatherDay } from '@/features/materiel/services/getWeather';
import { getWeatherIcon } from './getWeatherIcon';

export interface WeatherStripProps {
  current: { tempC: number; weathercode: number; precipPct: number };
  days: WeatherDay[];
  locationLabel?: string | null;
}

/**
 * Hub V5e — Bandeau météo réelle (Open-Meteo) : lieu + conditions actuelles,
 * puis les 4 prochains jours (icône, min/max, précip). Server component,
 * tokens uniquement. Placé dans la carte Itinéraire (media scrim).
 */
export function WeatherStrip({ current, days, locationLabel }: WeatherStripProps) {
  const CurrentIcon = getWeatherIcon(current.weathercode);
  const upcoming = days.filter((d) => d.day !== 'Auj.').slice(0, 4);

  return (
    <div className="rounded-xl border border-white/70 bg-white/55 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 border border-white/70 text-[var(--lkv-secondary)]">
          <CurrentIcon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] truncate">
            {locationLabel ?? 'Météo'}
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
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)]">
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
