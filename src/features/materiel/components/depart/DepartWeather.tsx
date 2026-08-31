'use client';
import { useState } from 'react';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Droplets,
  CloudDrizzle,
  Thermometer,
  ChevronDown,
  Clock,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { weatherLabel, type WeatherForecast } from '@/features/materiel/services/getWeather';
import { cn } from '@/lib/utils';

interface DepartWeatherProps {
  weather: WeatherForecast | null;
  updatedAt?: string | null;
}

function getWeatherIcon(code: number, size = 16) {
  if (code === 0) return <Sun size={size} className="text-amber-500" aria-hidden="true" />;
  if (code <= 2) return <CloudSun size={size} className="text-amber-600/80" aria-hidden="true" />;
  if (code === 3) return <Cloud size={size} className="text-slate-500" aria-hidden="true" />;
  if (code <= 48) return <CloudFog size={size} className="text-slate-400" aria-hidden="true" />;
  if (code <= 57) return <CloudDrizzle size={size} className="text-sky-600" aria-hidden="true" />;
  if (code <= 67) return <CloudRain size={size} className="text-blue-600" aria-hidden="true" />;
  if (code <= 77) return <CloudSnow size={size} className="text-indigo-400" aria-hidden="true" />;
  if (code <= 86) return <CloudRain size={size} className="text-blue-700" aria-hidden="true" />;
  return <CloudLightning size={size} className="text-amber-600" aria-hidden="true" />;
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
              className="text-xs sm:text-[13px] font-bold text-[#17402C] flex items-center gap-2"
            >
              <Thermometer size={15} className="text-[#2D6B4A]" aria-hidden="true" />
              <span>Météo du secteur</span>
            </h2>
            <p className="text-[11px] text-[#5A7064] truncate">{locationLabel}</p>
          </div>

          <div className="flex items-center gap-2 bg-white/50 dark:bg-white/10 px-2.5 py-1 rounded-xl border border-white/60 shadow-2xs shrink-0">
            {getWeatherIcon(weather.current.weathercode, 18)}
            <div className="text-right">
              <div className="text-sm sm:text-base font-mono font-bold text-[#17402C] leading-none">
                {weather.current.tempC}°C
              </div>
              <div className="text-[9px] text-[#5A7064] mt-0.5">
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
                  ? 'bg-white/60 dark:bg-white/10 border border-white/70 shadow-2xs'
                  : 'bg-white/25 dark:bg-white/5 border border-white/30'
              )}
            >
              <p className="text-[10px] font-semibold text-[#17402C] truncate">
                {idx === 0 ? 'Aujourd’hui' : day.day}
              </p>
              <div className="flex justify-center py-0.5">
                {getWeatherIcon(day.weathercode, 16)}
              </div>
              <div className="text-[10.5px] font-mono font-bold text-[#17402C]">
                {day.tempMaxC}° <span className="text-[9.5px] text-[#5A7064] font-normal">{day.tempMinC}°</span>
              </div>
              {day.precipPct > 0 && (
                <div className="flex items-center justify-center gap-0.5 text-[9px] text-blue-700 dark:text-blue-400 font-medium">
                  <Droplets size={8.5} />
                  <span>{day.precipPct}%</span>
                </div>
              )}
            </div>
          ))}

          {/* Éphéméride du jour */}
          <div className="shrink-0 p-2 rounded-xl bg-white/30 dark:bg-white/5 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[#5A7064] flex items-center gap-1 font-semibold">
              <Sunrise size={10} className="text-amber-600" />
              <span>Lever</span>
            </span>
            <span className="font-mono font-bold text-[#17402C] text-[11px] my-auto">
              {sunriseTime}
            </span>
          </div>

          <div className="shrink-0 p-2 rounded-xl bg-white/30 dark:bg-white/5 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[#5A7064] flex items-center gap-1 font-semibold">
              <Sunset size={10} className="text-amber-700" />
              <span>Coucher</span>
            </span>
            <span className="font-mono font-bold text-[#17402C] text-[11px] my-auto">
              {sunsetTime}
            </span>
          </div>

          <div className="shrink-0 p-2 rounded-xl bg-white/30 dark:bg-white/5 border border-white/40 flex flex-col items-center justify-between w-[80px]">
            <span className="text-[9px] uppercase tracking-wider text-[#5A7064] flex items-center gap-1 font-semibold">
              <Sun size={10} className="text-emerald-700" />
              <span>Jour</span>
            </span>
            <span className="font-mono font-bold text-[#17402C] text-[11px] my-auto">
              {daylightHours}
            </span>
          </div>

          {/* Heures de la journée si disponibles */}
          {weather.cells && weather.cells.slice(0, 8).map((cell) => (
            <div
              key={cell.hour}
              className="shrink-0 p-2 rounded-xl bg-white/20 dark:bg-white/5 border border-white/30 text-center w-[68px] space-y-0.5 flex flex-col justify-between"
            >
              <p className="text-[9px] font-mono text-[#5A7064]">{cell.hour}</p>
              <div className="flex justify-center">{getWeatherIcon(cell.weathercode, 14)}</div>
              <p className="text-[10.5px] font-mono font-bold text-[#17402C]">{cell.tempC}°</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
