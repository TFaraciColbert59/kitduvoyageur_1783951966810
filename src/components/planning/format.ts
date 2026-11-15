import type {
  MultiDayPlan,
  OfficialAlertSeverity,
  RouteTheme,
  ShareAudience,
  SportKind,
  WeatherEvaluationStatus,
  WeatherProviderStatus,
} from '@/features/planning';

const distanceFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

export function formatDistanceKm(value: number): string {
  return `${distanceFormatter.format(value)} km`;
}

export function formatElevationM(value: number): string {
  return `${integerFormatter.format(Math.round(value))} m`;
}

export function formatHours(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

export function formatDateTime(iso: string | null, timezone: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  } catch {
    return parsed.toISOString();
  }
}

export function formatDateOnly(iso: string | null, timezone: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      dateStyle: 'medium',
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
}

export function isoDatePlusDays(nowIso: string, days: number): string {
  const base = new Date(nowIso);
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(safeBase.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function endOfDayIso(date: string): string {
  return `${date}T23:59:59.000Z`;
}

export function planTotals(plan: MultiDayPlan): {
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  estimatedHours: number;
} {
  return plan.stages.reduce(
    (total, stage) => ({
      distanceKm: total.distanceKm + stage.distanceKm,
      elevationGainM: total.elevationGainM + stage.elevationGainM,
      elevationLossM: total.elevationLossM + stage.elevationLossM,
      estimatedHours: total.estimatedHours + stage.estimatedHours,
    }),
    { distanceKm: 0, elevationGainM: 0, elevationLossM: 0, estimatedHours: 0 },
  );
}

export function maxStageElevationM(plan: MultiDayPlan): number | null {
  let max: number | null = null;
  for (const stage of plan.stages) {
    for (const point of stage.points) {
      if (point.eleM !== null && (max === null || point.eleM > max)) {
        max = point.eleM;
      }
    }
  }
  return max;
}

export const SPORT_LABELS: Record<SportKind, string> = {
  hiking: 'Randonnée',
  trekking: 'Trekking',
  trail: 'Trail',
  cycling: 'Vélo',
  gravel: 'Gravel',
  bikepacking: 'Bikepacking',
  mountaineering: 'Alpinisme',
};

export const THEME_LABELS: Record<RouteTheme, string> = {
  alpine: 'Alpin',
  coastal: 'Côtier',
  forest: 'Forêt',
  ridge: 'Crête',
  heritage: 'Patrimoine',
  lake: 'Lac',
  desert: 'Désert',
  glacier: 'Glacier',
  general: 'Général',
};

export const COUNTRY_LABELS: Record<string, string> = {
  FR: 'France',
  CH: 'Suisse',
  IT: 'Italie',
  ES: 'Espagne',
  NO: 'Norvège',
  JP: 'Japon',
  GB: 'Écosse',
  IS: 'Islande',
  AR: 'Argentine',
  NP: 'Népal',
  DE: 'Allemagne',
  AT: 'Autriche',
  SI: 'Slovénie',
};

export function countryLabel(code: string | null): string {
  if (!code) return 'Tous les pays';
  return COUNTRY_LABELS[code.toUpperCase()] ?? code.toUpperCase();
}

export const AUDIENCE_LABELS: Record<ShareAudience, string> = {
  private: 'Privé',
  friends: 'Amis',
  tribu: 'Tribu',
  public: 'Public',
};

export const WEATHER_STATUS_LABELS: Record<WeatherEvaluationStatus, string> = {
  ok: 'Bulletin fiable',
  stale: 'Bulletin périmé',
  provider_unavailable: 'Fournisseur indisponible',
  no_data: 'Aucune donnée',
};

export const PROVIDER_STATUS_LABELS: Record<WeatherProviderStatus, string> = {
  available: 'Disponible',
  unavailable: 'Indisponible',
  unconfigured: 'Non configuré',
  rate_limited: 'Quota atteint',
};

export const ALERT_LABELS: Record<OfficialAlertSeverity, string> = {
  none: 'Aucune alerte',
  moderate: 'Alerte modérée',
  severe: 'Alerte sévère',
  extreme: 'Alerte extrême',
};

export function weatherTone(
  status: WeatherEvaluationStatus,
): 'sage' | 'warn' | 'danger' | 'info' | 'stone' {
  switch (status) {
    case 'ok':
      return 'sage';
    case 'stale':
      return 'warn';
    case 'provider_unavailable':
      return 'danger';
    case 'no_data':
      return 'info';
    default:
      return 'stone';
  }
}

export function alertTone(
  severity: OfficialAlertSeverity,
): 'sage' | 'warn' | 'danger' | 'info' | 'stone' {
  switch (severity) {
    case 'none':
      return 'sage';
    case 'moderate':
      return 'warn';
    case 'severe':
      return 'danger';
    case 'extreme':
      return 'danger';
    default:
      return 'stone';
  }
}

export function shareReasonLabel(reason: string): string {
  switch (reason) {
    case 'not_shared':
      return 'Aucun partage actif';
    case 'revoked':
      return 'Partage révoqué';
    case 'expired':
      return 'Partage expiré';
    case 'blocked_p01':
      return 'Visiteur bloqué par la politique P01';
    case 'private_p01':
      return 'Plan privé';
    case 'audience_mismatch':
      return "Audience du partage incompatible avec ce visiteur";
    case 'consent_missing_p01':
      return 'Consentement de partage public manquant';
    default:
      return reason;
  }
}

export function launchReasonLabel(reason: string): string {
  switch (reason) {
    case 'not_found':
      return 'Étape introuvable';
    case 'sport_mismatch':
      return 'Sport actif différent du plan';
    case 'forbidden_p01':
      return 'Plan non visible pour ce visiteur';
    case 'not_standalone':
      return "Étape non lançable seule (moins de deux points)";
    default:
      return reason;
  }
}

export function offlineLabel(key: keyof MultiDayPlan['stages'][number]['offline']): string {
  switch (key) {
    case 'mapReady':
      return 'Carte';
    case 'traceReady':
      return 'Trace';
    case 'guidanceReady':
      return 'Guidage';
    case 'searchReady':
      return 'Recherche';
    case 'rerouteReady':
      return 'Reroutage';
    default:
      return key;
  }
}
