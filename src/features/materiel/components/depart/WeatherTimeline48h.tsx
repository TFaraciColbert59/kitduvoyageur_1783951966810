import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
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

/** W-D-2 WeatherTimeline48h — bandeau météo 48h (Open-Meteo). */
export function WeatherTimeline48h({ forecast }: { forecast?: WeatherForecast | null }) {
  const cells = forecast?.cells ?? [];
  return (
    <GlassCard as="article" ariaLabelledBy="weather-title" className="p-4">
      <Eyebrow>Météo 48h · {forecast?.location.label ?? ''}</Eyebrow>
      <h3 id="weather-title" className="sr-only">Timeline météo 48 heures</h3>
      <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
        {cells.map((h, i) => (
          <div key={i} className="bg-white/20 rounded-[var(--r-sm)] h-[72px] w-[56px] shrink-0 flex flex-col items-center justify-center gap-0.5 p-1" title={weatherLabel(h.weathercode)}>
            <span className="text-[11px] text-[color:var(--label-tertiary)]">{h.hour}</span>
            <span aria-hidden="true">{iconFor(h.weathercode)}</span>
            <span className="text-[13px] font-semibold text-[color:var(--label)] tabular-nums">{h.tempC}°</span>
            <span className="text-[10px] text-info">{h.precipPct}%</span>
          </div>
        ))}
        {cells.length === 0 && (
          <p className="text-sm text-[color:var(--label-secondary)]">Prévisions indisponibles.</p>
        )}
      </div>
    </GlassCard>
  );
}
