/**
 * Lot A02 — formatage d'affichage de la fiche de séance.
 *
 * Règle : une valeur absente ou non mesurée s'affiche « — », jamais 0.
 * `0` reste une mesure explicite (altitude au niveau de la mer, vitesse nulle).
 */

import type {
  ActivityTag,
  ElevationCorrectionMethod,
  DistanceCorrectionMethod,
  SensorChannelSummary,
  Sport,
} from '@/features/activity/lifecycle';

const NUMBER_FR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const INTEGER_FR = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const SPORT_LABELS: Readonly<Record<Sport, string>> = {
  course: 'Course',
  rando: 'Randonnée',
  velo: 'Vélo',
  kayak: 'Kayak',
  trail: 'Trail',
  ski: 'Ski',
  escalade: 'Escalade',
  famille: 'Famille',
  bivouac: 'Bivouac',
};

export const TAG_LABELS: Readonly<Record<ActivityTag, string>> = {
  course: 'Course',
  sortie_longue: 'Sortie longue',
  trajet: 'Trajet',
  cause: 'Cause',
};

export function sportLabel(sport: Sport | null | undefined): string {
  if (!sport) return '—';
  return SPORT_LABELS[sport] ?? sport;
}

export function tagLabel(tag: ActivityTag | string): string {
  return TAG_LABELS[tag as ActivityTag] ?? String(tag);
}

export function visibilityLabel(value: string | null | undefined): string {
  return value === 'collective_anonymized' ? 'Partagée, anonymisée' : 'Privée';
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return NUMBER_FR.format(value);
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return INTEGER_FR.format(Math.round(value));
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${formatInteger(km * 1000)} m`;
  return `${NUMBER_FR.format(km)} km`;
}

export function formatElevation(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  return `${formatInteger(meters)} m`;
}

/** Durée lisible : « 2 h 04 », « 48 min », « 32 s ». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')}`;
}

/** Allure en min:sec par kilomètre. */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (
    secondsPerKm === null ||
    secondsPerKm === undefined ||
    !Number.isFinite(secondsPerKm) ||
    secondsPerKm <= 0
  ) {
    return '—';
  }
  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function formatSpeed(kmh: number | null | undefined): string {
  if (kmh === null || kmh === undefined || !Number.isFinite(kmh) || kmh < 0) return '—';
  return `${NUMBER_FR.format(kmh)} km/h`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Date non renseignée';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date non renseignée';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Jours restants avant purge, jamais négatif. */
export function formatRemainingDays(remainingMs: number | null | undefined): string {
  if (remainingMs === null || remainingMs === undefined || !Number.isFinite(remainingMs)) {
    return '—';
  }
  const days = Math.max(0, Math.ceil(remainingMs / 86_400_000));
  if (days === 0) return 'moins d’un jour';
  return `${days} jour${days > 1 ? 's' : ''}`;
}

export function formatChannel(channel: SensorChannelSummary, unit = ''): string {
  if (channel.status === 'unavailable' || channel.avg === null) return 'Non mesuré';
  const suffix = unit ? ` ${unit}` : '';
  const parts = [`moy. ${formatNumber(channel.avg)}${suffix}`];
  if (channel.max !== null) parts.push(`max ${formatNumber(channel.max)}${suffix}`);
  if (channel.gapCount > 0)
    parts.push(`${channel.gapCount} lacune${channel.gapCount > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export function channelStatusLabel(channel: SensorChannelSummary): string {
  if (channel.status === 'measured') return 'Mesuré';
  if (channel.status === 'partial') return 'Partiel';
  return 'Non mesuré';
}

export const DISTANCE_METHOD_LABELS: Readonly<Record<DistanceCorrectionMethod, string>> = {
  raw: 'Distance GPS brute',
  recompute_from_trace: 'Recalculée depuis la trace',
  manual_override: 'Saisie manuelle',
};

export const ELEVATION_METHOD_LABELS: Readonly<Record<ElevationCorrectionMethod, string>> = {
  raw: 'Dénivelé brut',
  dem_projection: 'Projection sur modèle d’altitude',
  threshold_smoothing: 'Lissage par seuil',
  manual_override: 'Saisie manuelle',
};

export function correctionMethodLabel(
  distance: DistanceCorrectionMethod,
  elevation: ElevationCorrectionMethod
): string {
  return `${DISTANCE_METHOD_LABELS[distance]} · ${ELEVATION_METHOD_LABELS[elevation]}`;
}

export function formatSplitPace(distanceM: number, movingS: number): string {
  if (!Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(movingS)) return '—';
  return formatPace(movingS / (distanceM / 1000));
}

/** Libellé des raisons d'invalidation des records, sans jargon. */
export function recordReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    cropped_trace: 'Trace recadrée : les records sur la portion retirée sont invalidés.',
    split_into_parts: 'Séance fractionnée : les records du parent sont recalculés.',
    gps_spike_removed: 'Pics GPS corrigés : les records de vitesse sont invalidés.',
    manual_metric_override:
      'Distance ou D+ saisi manuellement : classements automatiques désactivés.',
    distance_or_elevation_corrected: 'Distance ou D+ corrigé après coup.',
    split_child_recalculated: 'Tronçon recalculé depuis la séance parente.',
    soft_deleted: 'Séance supprimée : retirée des totaux et classements.',
  };
  return labels[reason] ?? reason;
}
