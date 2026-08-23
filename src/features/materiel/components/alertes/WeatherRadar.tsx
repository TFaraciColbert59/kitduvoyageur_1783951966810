import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

/** W-L-7 WeatherRadar — radar météo du prochain départ (basé sur alertes 'meteo'). */
export function WeatherRadar({ meteoCount, message }: { meteoCount: number; message: string }) {
  return (
    <GlassCard as="article" ariaLabelledBy="weather-radar-title" className="p-4">
      <Eyebrow>Météo prochain départ</Eyebrow>
      <h3 id="weather-radar-title" className="sr-only">Radar météo</h3>
      <div className="mt-2 flex items-center gap-2">
        {meteoCount > 0 ? <Badge tone="warn">{meteoCount} alerte(s) météo</Badge> : <Badge tone="sage">Conditions stables</Badge>}
      </div>
      <p className="mt-2 text-sm text-[color:var(--label-secondary)]">{message}</p>
    </GlassCard>
  );
}
