'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui';
import { rainLabel, weatherLabel, type WeatherForecast } from '@/features/materiel/services/getWeather';
import { cn } from '@/lib/utils';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

interface DepartWeatherProps {
  weather: WeatherForecast | null;
  updatedAt?: string | null;
}

function getWeatherIcon(code: number, size = 16) {
  if (code === 0)
    return <LKDVIcon name="soleil" size={size} className="text-[var(--lkv-warning)]" aria-hidden="true" />;
  if (code <= 2)
    return <LKDVIcon name="meteo" size={size} className="text-[var(--lkv-warning)]/80" aria-hidden="true" />;
  if (code === 3)
    return <LKDVIcon name="meteo" size={size} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />;
  if (code <= 48)
    return <LKDVIcon name="meteo" size={size} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />;
  if (code <= 57)
    return <LKDVIcon name="pluie" size={size} className="text-[var(--lkv-info)]" aria-hidden="true" />;
  if (code <= 67)
    return <LKDVIcon name="pluie" size={size} className="text-[var(--lkv-info)]" aria-hidden="true" />;
  if (code <= 77)
    return <LKDVIcon name="neige" size={size} className="text-[var(--lkv-info)]" aria-hidden="true" />;
  if (code <= 86)
    return <LKDVIcon name="pluie" size={size} className="text-[var(--lkv-info)]" aria-hidden="true" />;
  return <LKDVIcon name="meteo_extreme" size={size} className="text-[var(--lkv-warning)]" aria-hidden="true" />;
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
    <Card tone="neutral" as="article" ariaLabelledBy="weather-heading">
      <div className="p-3.5 sm:p-4 space-y-2.5">
        {/* Header : Temp actuelle + lieu + fraîcheur */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h2
              id="weather-heading"
              className="text-xs sm:text-[13px] font-bold text-[color:var(--lkv-text-primary)] flex items-center gap-2"
            >
              <LKDVIcon
                name="meteo"
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
              <div className="text-sm sm:text-base font-mono font-bold text-[color:var(--lkv-text-primary)] leading-none">
                {weather.current.tempC}°C
              </div>
              <div className="text-[9px] text-[var(--lkv-text-muted)] mt-0.5">
                {rainLabel(weather.current.precipPct, weather.current.precipMm) ?? 'sec'}
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
              <p className="text-[10px] font-semibold text-[color:var(--lkv-text-primary)] truncate">
                {idx === 0 ? 'Aujourd’hui' : day.day}
              </p>
              <div className="flex justify-center py-0.5">
                {getWeatherIcon(day.weathercode, 16)}
              </div>
              <div className="text-[10.5px] font-mono font-bold text-[color:var(--lkv-text-primary)]">
                {day.tempMaxC}°{' '}
                <span className="text-[9.5px] text-[var(--lkv-text-muted)] font-normal">
                  {day.tempMinC}°
                </span>
              </div>
              {(day.precipPct ?? day.precipMm ?? 0) > 0 && (
                <div className="flex items-center justify-center gap-0.5 text-[9px] text-[var(--lkv-info)] font-medium">
                  <LKDVIcon name="eau_potable" size={8.5} />
                  <span>{rainLabel(day.precipPct, day.precipMm)}</span>
                </div>
              )}
            </div>
          ))}

          {/* Éphéméride du jour */}
          <div className="shrink-0 p-2 rounded-xl bg-white/30 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1 font-semibold">
              <LKDVIcon name="panorama" size={10} className="text-[var(--lkv-warning)]" />
              <span>Lever</span>
            </span>
            <span className="font-mono font-bold text-[color:var(--lkv-text-primary)] text-[11px] my-auto">
              {sunriseTime}
            </span>
          </div>

          <div className="shrink-0 p-2 rounded-xl bg-white/30 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1 font-semibold">
              <LKDVIcon name="panorama" size={10} className="text-[var(--lkv-warning)]" />
              <span>Coucher</span>
            </span>
            <span className="font-mono font-bold text-[color:var(--lkv-text-primary)] text-[11px] my-auto">
              {sunsetTime}
            </span>
          </div>

          <div className="shrink-0 p-2 rounded-xl bg-white/30 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[var(--lkv-text-muted)] flex items-center gap-1 font-semibold">
              <LKDVIcon name="soleil" size={10} className="text-[var(--lkv-forest-700)]" />
              <span>Jour</span>
            </span>
            <span className="font-mono font-bold text-[color:var(--lkv-text-primary)] text-[11px] my-auto">
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
                <p className="text-[10.5px] font-mono font-bold text-[color:var(--lkv-text-primary)]">
                  {cell.tempC}°
                </p>
              </div>
            ))}
        </div>
      </div>
    </Card>
  );
}
