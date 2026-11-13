import type {
  ChallengeKind,
  LeaderboardMetric,
  LeaderboardPeriodKind,
  SportCategory,
  TrophyCategory,
} from '@/features/rankings/types';

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return numberFormat.format(Math.round(value));
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  if (meters >= 1000) return `${decimalFormat.format(meters / 1000)} km`;
  return `${numberFormat.format(Math.round(meters))} m`;
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  return `${numberFormat.format(Math.round(meters))} m`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatMetric(
  value: number | null | undefined,
  metric: LeaderboardMetric
): string {
  switch (metric) {
    case 'distanceMeters':
      return formatDistance(value);
    case 'elevationGainMeters':
      return formatElevation(value);
    case 'durationSec':
      return formatDuration(value);
    case 'activityCount':
      return `${formatInteger(value)} sortie${(value ?? 0) > 1 ? 's' : ''}`;
  }
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${decimalFormat.format(Math.max(0, Math.min(100, value)))} %`;
}

export function initials(name: string | null | undefined): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return '?';
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function sportLabel(sport: SportCategory): string {
  const labels: Record<SportCategory, string> = {
    all: 'Tous les sports',
    running: 'Course',
    trail: 'Trail',
    cycling: 'Vélo',
    gravel: 'Gravel',
    mtb: 'VTT',
    hiking: 'Randonnée',
    walking: 'Marche',
    swimming: 'Natation',
    skiing: 'Ski',
    other: 'Autre',
  };
  return labels[sport];
}

export function metricLabel(metric: LeaderboardMetric): string {
  const labels: Record<LeaderboardMetric, string> = {
    distanceMeters: 'Distance',
    elevationGainMeters: 'Dénivelé',
    durationSec: 'Durée',
    activityCount: 'Sorties',
  };
  return labels[metric];
}

export function periodLabel(period: LeaderboardPeriodKind): string {
  return period === 'weekly' ? 'Cette semaine' : 'Ce mois';
}

export function challengeKindLabel(kind: ChallengeKind): string {
  const labels: Record<ChallengeKind, string> = {
    public: 'Défi public',
    sponsored: 'Défi sponsorisé',
    private_invite: 'Sur invitation',
    best_effort: 'Meilleur effort',
    virtual_race: 'Course virtuelle',
    campaign: 'Campagne',
  };
  return labels[kind];
}

export function trophyCategoryLabel(category: TrophyCategory): string {
  const labels: Record<TrophyCategory, string> = {
    challenge_finisher: 'Défi terminé',
    local_legend_crown: 'Couronne locale',
    period_podium: 'Podium',
    peak_milestone: 'Sommet',
  };
  return labels[category];
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count > 1 ? pluralForm : singular;
}
