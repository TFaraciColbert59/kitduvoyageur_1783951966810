import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

export function currentSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'printemps';
  if (m >= 6 && m <= 8) return 'ete';
  if (m >= 9 && m <= 11) return 'automne';
  return 'hiver';
}

const SCORE: Record<string, number> = { 'toute_saison': 90, ete: 90, printemps: 75, automne: 65, hiver: 55 };

/** W-K-9 WeatherMatchScore — correspondance saison du kit vs saison actuelle. */
export function WeatherMatchScore({ season }: { season: string | null }) {
  const now = currentSeason();
  const match = season ? (SCORE[season] ?? 60) : 60;
  const label = season ? `${season} vs ${now}` : 'Saison non renseignée';
  return (
    <GlassCard as="article" ariaLabelledBy="weather-match-title" className="p-4">
      <Eyebrow>Weather Match Score</Eyebrow>
      <h3 id="weather-match-title" className="sr-only">Score de correspondance météo/saison</h3>
      <Metric value={`${match}/100`} tone={match >= 75 ? 'sage' : match >= 60 ? 'default' : 'danger'} />
      <p className="mt-1 text-xs text-[color:var(--label-tertiary)]">{label}</p>
    </GlassCard>
  );
}
