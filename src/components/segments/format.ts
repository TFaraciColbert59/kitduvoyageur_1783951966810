import type {
  EffortExclusionReason,
  EffortFlagCategory,
  SegmentCrudValidationError,
  SegmentHazardCategory,
  SegmentSport,
} from '@/features/segments';

export const SPORT_LABELS: Record<SegmentSport, string> = {
  running: 'Course',
  trail: 'Trail',
  cycling: 'Vélo',
  gravel: 'Gravel',
  mtb: 'VTT',
  hiking: 'Randonnée',
  walking: 'Marche',
  ski: 'Ski',
};

export const SPORTS: SegmentSport[] = [
  'running',
  'trail',
  'cycling',
  'gravel',
  'mtb',
  'hiking',
  'walking',
  'ski',
];

export const HAZARD_LABELS: Record<SegmentHazardCategory, string> = {
  dangerous_road_or_traffic: 'Circulation dangereuse',
  blind_intersection: 'Intersection sans visibilité',
  steep_technical_descent: 'Descente technique périlleuse',
  trail_closed_or_collapsed: 'Sentier fermé ou effondré',
  private_property: 'Propriété privée',
  other_safety_hazard: 'Autre danger',
};

export const FLAG_LABELS: Record<EffortFlagCategory, string> = {
  motorized_vehicle: 'Véhicule motorisé',
  gps_glitch_or_shortcut: 'Bug GPS ou raccourci',
  wrong_activity_type: 'Mauvais type d’activité',
  ebike_in_regular_leaderboard: 'VAE dans le classement',
};

export const EXCLUSION_LABELS: Record<EffortExclusionReason, string> = {
  wrong_direction: 'Mauvais sens',
  incomplete_coverage: 'Passage incomplet',
  corridor_deviation: 'Hors du couloir',
  uturn_detected: 'Demi-tour détecté',
  gps_jump_or_teleport: 'Saut GPS',
  interpolated_finish_gap: 'Arrivée incomplète',
  low_gps_quality: 'GPS de faible qualité',
  speed_exceeded_for_sport: 'Vitesse anormale',
  acceleration_anomaly: 'Accélération anormale',
  motorized_vehicle_suspected: 'Véhicule motorisé suspecté',
  sport_mismatch: 'Sport incompatible',
  ebike_on_non_ebike_segment: 'VAE sur segment mécanique',
  manual_or_indoor_activity: 'Activité manuelle ou intérieure',
  flagged_by_community: 'Signalé par la communauté',
  segment_hazardous: 'Segment dangereux',
};

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min ${String(rest).padStart(2, '0')} s`;
  return `${rest} s`;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatDelta(seconds: number): string {
  const rounded = Math.round(Math.abs(seconds));
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toLocaleString('fr-FR', { maximumFractionDigits: km >= 10 ? 0 : 1 })} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatElevation(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  return `${Math.round(meters).toLocaleString('fr-FR')} m`;
}

export function formatGrade(percent: number): string {
  if (!Number.isFinite(percent)) return '—';
  return `${percent > 0 ? '+' : ''}${percent.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  })} %`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function athleteLabel(userId: string, viewerUserId?: string | null): string {
  if (viewerUserId && userId === viewerUserId) return 'Vous';
  return `Athlète ${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`;
}

export const SEGMENT_ERROR_MESSAGES: Record<SegmentCrudValidationError, string> = {
  invalid_name: 'Le nom doit contenir au moins 3 caractères.',
  invalid_bounds: 'Les bornes du segment sont invalides.',
  too_few_points: 'Le segment doit contenir au moins 3 points.',
  segment_too_short: 'Le segment est trop court (minimum 120 m).',
  segment_too_long: 'Le segment est trop long (maximum 80 km).',
  manual_or_indoor_source: 'Une activité manuelle ou en intérieur ne peut pas créer de segment.',
  privacy_zone_conflict_for_public_segment:
    'Le tracé traverse une zone masquée : choisissez « Privé » ou découpez autrement.',
  gps_gap_in_source_trace: 'La trace contient un saut GPS supérieur à 350 m.',
  unauthorized_not_owner: 'Seul le créateur peut modifier ce segment.',
};
