'use client';
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
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { weatherLabel, type WeatherForecast } from '@/features/materiel/services/getWeather';

interface DepartWeatherProps {
  weather: WeatherForecast | null;
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

export function DepartWeather({ weather }: DepartWeatherProps) {
  if (!weather) return null;

  const currentDesc = weatherLabel(weather.current.weathercode);
  const locationLabel = weather.location.label || 'Secteur de randonnée';

  return (
    <GlassCard tone="neutral" ariaLabelledBy="weather-heading">
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Header : Temp actuelle + lieu */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h2
              id="weather-heading"
              className="text-[13px] sm:text-sm font-semibold text-[#17402C] flex items-center gap-2"
            >
              <Thermometer size={15} className="text-[#5A7064]" aria-hidden="true" />
              Météo du secteur
            </h2>
            <p className="text-[11px] text-[#5A7064] truncate">{locationLabel}</p>
          </div>

          <div className="flex items-center gap-2.5 bg-white/40 px-3 py-1.5 rounded-2xl border border-white/60 shadow-2xs">
            {getWeatherIcon(weather.current.weathercode, 20)}
            <div className="text-right">
              <div className="text-base sm:text-lg font-mono font-bold text-[#17402C] leading-none">
                {weather.current.tempC}°C
              </div>
              <div className="text-[9.5px] font-medium text-[#5A7064] capitalize mt-0.5">
                {currentDesc}
              </div>
            </div>
          </div>
        </div>

        {/* Prévisions 5 jours */}
        {weather.days && weather.days.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] px-0.5">
              Prévisions 5 jours
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {weather.days.map((day, idx) => (
                <div
                  key={day.date || idx}
                  className="glass-sub-card p-2 flex flex-col items-center justify-between text-center gap-1 min-w-0"
                >
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#17402C]">
                    {day.day}
                  </span>
                  <div className="my-0.5">{getWeatherIcon(day.weathercode, 15)}</div>
                  <div className="text-[10px] sm:text-[11px] font-mono font-bold text-[#17402C]">
                    <span>{day.tempMaxC}°</span>
                    <span className="text-[9px] text-[#5A7064] ml-0.5 font-normal">
                      {day.tempMinC}°
                    </span>
                  </div>
                  {day.precipPct > 0 ? (
                    <span className="text-[8.5px] sm:text-[9px] font-mono text-blue-700 flex items-center gap-0.5">
                      <Droplets size={8} aria-hidden="true" />
                      {day.precipPct}%
                    </span>
                  ) : (
                    <span className="text-[8.5px] sm:text-[9px] text-[#5A7064]/50">0%</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Défilement 24h horaire */}
        {weather.cells && weather.cells.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5A7064] px-0.5">
              Prochaines 24h
            </p>
            <div
              className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
              role="region"
              aria-label="Prévisions météo heure par heure sur 24 heures"
            >
              {weather.cells.slice(0, 16).map((cell, idx) => (
                <div
                  key={cell.hour || idx}
                  className="glass-sub-card px-2.5 py-1.5 flex flex-col items-center gap-1 shrink-0 text-center"
                >
                  <span className="text-[9.5px] font-mono text-[#5A7064]">{cell.hour}</span>
                  {getWeatherIcon(cell.weathercode, 13)}
                  <span className="text-[10.5px] font-mono font-bold text-[#17402C]">
                    {cell.tempC}°
                  </span>
                  {cell.precipPct > 0 && (
                    <span className="text-[8.5px] font-mono text-blue-700">
                      {cell.precipPct}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
