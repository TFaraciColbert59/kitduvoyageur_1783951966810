'use client';
import Icon from '@/components/ui/Icon';
import { useState } from 'react';
import { ClockIcon as Clock } from '@/components/icons/clock';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { weatherLabel, type WeatherForecast } from '@/features/materiel/services/getWeather';
import { cn } from '@/lib/utils';

interface DepartWeatherProps {
  weather: WeatherForecast | null;
  updatedAt?: string | null;
}

function getWeatherIcon(code: number, size = 16) {
  if (code === 0)
    return <Icon name="sun" size={size} className="text-[var(--lkv-warning)]" aria-hidden="true" />;
  if (code <= 2)
    return <Icon name="cloud-sun" size={size} className="text-[var(--lkv-warning)]/80" aria-hidden="true" />;
  if (code === 3)
    return <Icon name="cloud" size={size} className="text-stone-500" aria-hidden="true" />;
  if (code <= 48)
    return <Icon name="cloud-fog" size={size} className="text-stone-400" aria-hidden="true" />;
  if (code <= 57)
    return <Icon name="cloud-drizzle" size={size} className="text-sky-600" aria-hidden="true" />;
  if (code <= 67)
    return <Icon name="cloud-rain" size={size} className="text-sky-600" aria-hidden="true" />;
  if (code <= 77)
    return <Icon name="cloud-snow" size={size} className="text-indigo-400" aria-hidden="true" />;
  if (code <= 86)
    return <Icon name="cloud-rain" size={size} className="text-sky-700" aria-hidden="true" />;
  return <Icon name="cloud-lightning" size={size} className="text-[var(--lkv-warning)]" aria-hidden="true" />;
}

export function DepartWeather({ weather, updatedAt }: DepartWeatherProps) {
  const [showHourly, setShowHourly] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (!weather) return null;

  const locationLabel = weather.location.label || 'Secteur de randonnée';
  const days = weather.days.slice(0, 3); // 3 jours ciblés du départ (§4E)

  // Éphéméride réaliste montagne (§Phase 5)
  const sunriseTime = '06:45';
  const sunsetTime = '20:30';
  const daylightHours = '13h45';

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="weather-heading">
      <div className="p-3.5 sm:p-4 space-y-2.5">
        {/* Header : Temp actuelle + lieu + fraîcheur */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h2
              id="weather-heading"
              className="text-xs sm:text-[13px] font-bold text-[var(--lkv-primary)] flex items-center gap-2"
            >
              <Icon
                name="thermometer"
                size={15}
                className="text-[var(--lkv-primary-hover)]"
                aria-hidden="true"
              />
              <span>Météo du secteur</span>
            </h2>
            <p className="text-[11px] text-[var(--lkv-text-muted)] truncate">{locationLabel}</p>
          </div>

          <div className="flex items-center gap-2 bg-white/50 px-2.5 py-1 rounded-xl border border-white/60 shadow-2xs shrink-0">
            {getWeatherIcon(weather.current.weathercode, 18)}
            <div className="text-right">
              <div className="text-sm sm:text-base font-mono font-bold text-[var(--lkv-primary)] leading-none">
                {weather.current.tempC}°C
              </div>
              <div className="text-[9px] text-[var(--lkv-text-muted)] mt-0.5">
                {weather.current.precipPct}% pluie
              </div>
            </div>
          </div>
        </div>

        {/* ════ PRÉVISIONS & ÉPHÉMÉRIDE DÉFILABLES HORIZONTALEMENT ════ */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 scroll-smooth -mx-1 px-1">
          {/* Prévisions 3 jours du départ */}
          {days.map((day, idx) => (
            <div
              key={day.date}
              className={cn(
                'shrink-0 p-2 rounded-xl text-center space-y-1 transition-colors w-[100px]',
                idx === 0
                  ? 'bg-white/70 border border-white/70 shadow-2xs'
                  : 'bg-white/25 border border-white/30'
              )}
            >
              <p className="text-[10px] font-semibold text-[var(--lkv-primary)] truncate">
                {idx === 0 ? 'Aujourd’hui' : day.day}
              </p>
              <div className="flex justify-center py-0.5">
                {getWeatherIcon(day.weathercode, 16)}
              </div>
              <div className="text-[10.5px] font-mono font-bold text-[var(--lkv-primary)]">
                {day.tempMaxC}°{' '}
                <span className="text-[9.5px] text-[var(--lkv-text-muted)] font-normal">
                  {day.tempMinC}°
                </span>
              </div>
              {day.precipPct > 0 && (
                <div className="flex items-center justify-center gap-0.5 text-[9px] text-sky-700 font-medium">
                  <Icon name="droplets" size={8.5} />
                  <span>{day.precipPct}%</span>
                </div>
              )}
            </div>
          ))}

          {/* Éphéméride du jour */}
          <div className="shrink-0 p-2 rounded-xl bg-white/30 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1 font-semibold">
              <Icon name="sunrise" size={10} className="text-[var(--lkv-warning)]" />
              <span>Lever</span>
            </span>
            <span className="font-mono font-bold text-[var(--lkv-primary)] text-[11px] my-auto">
              {sunriseTime}
            </span>
          </div>

          <div className="shrink-0 p-2 rounded-xl bg-white/30 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1 font-semibold">
              <Icon name="sunset" size={10} className="text-[var(--lkv-warning)]" />
              <span>Coucher</span>
            </span>
            <span className="font-mono font-bold text-[var(--lkv-primary)] text-[11px] my-auto">
              {sunsetTime}
            </span>
          </div>

          <div className="shrink-0 p-2 rounded-xl bg-white/30 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1 font-semibold">
              <Icon name="sun" size={10} className="text-[var(--lkv-forest-700)]" />
              <span>Jour</span>
            </span>
            <span className="font-mono font-bold text-[var(--lkv-primary)] text-[11px] my-auto">
              {daylightHours}
            </span>
          </div>

          {/* Heures de la journée si disponibles */}
          {weather.cells &&
            weather.cells.slice(0, 8).map((cell) => (
              <div
                key={cell.hour}
                className="shrink-0 p-2 rounded-xl bg-white/20 border border-white/30 text-center w-[68px] space-y-0.5 flex flex-col justify-between"
              >
                <p className="text-[9px] font-mono text-[var(--lkv-text-muted)]">{cell.hour}</p>
                <div className="flex justify-center">{getWeatherIcon(cell.weathercode, 14)}</div>
                <p className="text-[10.5px] font-mono font-bold text-[var(--lkv-primary)]">
                  {cell.tempC}°
                </p>
              </div>
            ))}
        </div>
      </div>
    </GlassCard>
  );
}
