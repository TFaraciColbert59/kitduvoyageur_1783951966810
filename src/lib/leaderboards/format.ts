import type {
  AthleteGender,
  LeaderboardPeriod,
  LeaderboardScope,
  LeaderboardSport,
  LeaderboardTitle,
} from '@/features/leaderboards';

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  all_time: 'Tous les temps',
  this_year: 'Cette année',
  this_month: 'Ce mois',
  this_week: 'Cette semaine',
  today: 'Aujourd’hui',
  rolling_90d: '90 derniers jours',
};

export const SCOPE_LABELS: Record<LeaderboardScope, string> = {
  global: 'Tous les voyageurs',
  friends: 'Mes amis',
  club: 'Mon club',
};

export const GENDER_LABELS: Record<AthleteGender | 'all', string> = {
  all: 'Toutes catégories',
  men: 'Hommes',
  women: 'Femmes',
  non_binary: 'Non binaire',
  unspecified: 'Non précisé',
};

export const SPORT_LABELS: Record<LeaderboardSport, string> = {
  cycling: 'Vélo',
  mtb: 'VTT',
  gravel: 'Gravel',
  running: 'Course à pied',
  trail: 'Trail',
  hiking: 'Randonnée',
  ski: 'Ski',
  swimming: 'Natation',
};

export const TITLE_LABELS: Record<LeaderboardTitle, string> = {
  KOM: 'King of the Mountain',
  QOM: 'Queen of the Mountain',
  CR: 'Course Record',
};

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0)
    return `${hours} h ${String(minutes).padStart(2, '0')} min ${String(rest).padStart(2, '0')} s`;
  if (minutes > 0) return `${minutes} min ${String(rest).padStart(2, '0')} s`;
  return `${rest} s`;
}

export function formatCompactDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  return `+${Math.round(meters)} m`;
}

export function formatSpeed(kmh: number | null | undefined): string {
  if (kmh == null || !Number.isFinite(kmh)) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(kmh)} km/h`;
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatEffortCount(count: number): string {
  if (count <= 1) return `${count} passage`;
  return `${count} passages`;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => part[0]?.toLocaleUpperCase('fr-FR') ?? '').join('');
}

export function periodLabel(period: LeaderboardPeriod): string {
  return PERIOD_LABELS[period];
}

export function scopeLabel(scope: LeaderboardScope): string {
  return SCOPE_LABELS[scope];
}

export function sportLabel(sport: LeaderboardSport): string {
  return SPORT_LABELS[sport];
}
