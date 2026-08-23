import { GlassCard } from '@/components/ui/GlassCard';
import { weatherLabel, type WeatherForecast } from '@/features/materiel/services/getWeather';

function iconFor(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 86) return '🌦️';
  return '⛈️';
}

/** W-D-2 Météo — sans icône titre, typo vert foncé forêt (#17402C / #223B23). */
export function WeatherTimeline48h({ forecast }: { forecast?: WeatherForecast | null }) {
  const days = forecast?.days ?? [];
  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="weather-title" className="p-3 max-[359px]:p-2.5 md:p-4 flex flex-col">
      <div className="flex items-center gap-1.5 md:gap-2 pr-14 md:pr-20">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">
          Météo<span className="hidden sm:inline"> · 5 jours</span>
          <span className="hidden md:inline text-[#365233]"> · {forecast?.location.label ?? ''}</span>
        </p>
      </div>
      <h3 id="weather-title" className="sr-only">Prévisions météo des 5 prochains jours</h3>
      <ul className="mt-1 md:mt-2 flex-1 min-h-0 flex flex-col gap-0.5 md:grid md:grid-cols-5 md:gap-1.5 overflow-y-auto no-scrollbar">
        {days.map((d, i) => (
          <li
            key={d.date}
            className="glass-sub-card flex items-center justify-between gap-1 px-2 py-0 min-h-0 md:flex-col md:justify-evenly md:gap-0.5 md:px-0 md:py-1.5 md:min-w-0"
            title={weatherLabel(d.weathercode)}
          >
            <span className={`shrink-0 text-[9px] md:text-[10px] font-semibold uppercase tracking-wide max-[359px]:text-[8px] ${i === 0 ? 'text-sage-600 font-bold' : 'text-[#2D4A3A]'} ${i !== 0 ? 'max-[359px]:hidden' : ''}`}>
              {i === 0 ? 'Auj.' : d.day}
            </span>
            <span aria-hidden="true" className="text-[12px] md:text-[18px] leading-none">{iconFor(d.weathercode)}</span>
            <span className="shrink-0 text-[9px] md:text-[11px] font-mono font-semibold tabular-nums text-[#17402C] leading-none whitespace-nowrap max-[359px]:text-[8px]">
              {d.tempMinC}° {d.tempMaxC}°
            </span>
            <span className="hidden md:block text-[9px] font-medium text-sage-600">{d.precipPct}%</span>
          </li>
        ))}
        {days.length === 0 && (
          <p className="text-xs text-[#486944]">Prévisions indisponibles.</p>
        )}
      </ul>
    </GlassCard>
  );
}