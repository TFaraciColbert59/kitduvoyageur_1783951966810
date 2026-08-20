import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

interface HourCell {
  hour: string;
  tempC: number;
  precipPct: number;
  icon: string;
}

function generateForecast(): HourCell[] {
  const hours: HourCell[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() + i * 3600000);
    const temp = 14 + Math.round(4 * Math.sin((i / 24) * Math.PI));
    const precip = Math.round(((i * 37) % 100) * (i % 3 === 0 ? 0.4 : 1));
    hours.push({
      hour: `${String(t.getHours()).padStart(2, '0')}h`,
      tempC: temp,
      precipPct: Math.min(100, precip),
      icon: precip > 50 ? '🌧️' : i % 4 === 0 ? '☀️' : '🌤️',
    });
  }
  return hours;
}

/** W-D-2 WeatherTimeline48h — bandeau météo 48h scrollable (24 cellules). */
export function WeatherTimeline48h() {
  const hours = generateForecast();
  return (
    <GlassCard as="article" ariaLabelledBy="weather-title" className="p-4">
      <Eyebrow>Météo 48h</Eyebrow>
      <h3 id="weather-title" className="sr-only">Timeline météo 48 heures</h3>
      <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
        {hours.map((h) => (
          <div key={h.hour + h.tempC + h.precipPct} className="glass size-sm h-[72px] w-[56px] shrink-0 flex flex-col items-center justify-center gap-0.5 p-1">
            <span className="text-[11px] text-[color:var(--label-tertiary)]">{h.hour}</span>
            <span aria-hidden="true">{h.icon}</span>
            <span className="text-[13px] font-semibold text-[color:var(--label)] tabular-nums">{h.tempC}°</span>
            <span className="text-[10px] text-info">{h.precipPct}%</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
