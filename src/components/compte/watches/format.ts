/**
 * Lot D03-UI — libellés et formatage de la surface montres.
 *
 * Aucun libellé ne prétend qu'une donnée existe : les états `indeterminate`,
 * `native_target_unavailable` et les valeurs absentes gardent un texte propre.
 */

import type {
  WatchCapabilityKey,
  WatchCapabilityState,
  WatchNativeAvailabilityStatus,
  WatchNavigationFieldKey,
  WatchOfflinePackErrorReason,
  WatchOfflinePackStatus,
  WatchPlatform,
  WatchSessionStatus,
  WatchSyncState,
} from '@/features/watches';
import type {
  WatchCapabilityDescriptor,
  WatchPlatformDescriptor,
} from './types';

export const PLATFORM_LABELS: Record<WatchPlatform, string> = {
  apple_watch: 'Apple Watch',
  wear_os: 'Wear OS',
  galaxy_watch: 'Galaxy Watch',
};

export const PLATFORMS: readonly WatchPlatformDescriptor[] = [
  { platform: 'apple_watch', label: 'Apple Watch' },
  { platform: 'wear_os', label: 'Wear OS' },
  { platform: 'galaxy_watch', label: 'Galaxy Watch' },
];

export const NATIVE_STATUS_LABELS: Record<WatchNativeAvailabilityStatus, string> = {
  available: 'Compagnon disponible',
  native_target_unavailable: 'Cible native absente',
  companion_app_not_installed: 'App compagnon non installée',
  watch_not_paired: 'Montre non appairée',
  companion_disconnected: 'Compagnon déconnecté',
  unsupported_os_version: 'Version watchOS / Wear OS non prise en charge',
  permission_required: 'Autorisation requise',
};

export const CAPABILITY_STATE_LABELS: Record<WatchCapabilityState, string> = {
  available: 'Disponible',
  native_target_unavailable: 'Cible native absente',
  unsupported: 'Non pris en charge',
  consent_required: 'Accord requis',
  indeterminate: 'Indéterminé',
  degraded: 'Dégradé',
  error: 'Erreur',
};

export const SESSION_STATUS_LABELS: Record<WatchSessionStatus, string> = {
  prepared: 'Préparée',
  recording: 'Enregistrement',
  paused: 'En pause',
  finalizing: 'Finalisation',
  finished: 'Terminée',
};

export const SYNC_STATE_LABELS: Record<WatchSyncState, string> = {
  pending_local: 'En attente locale',
  transferring: 'Transfert',
  partially_acked: 'Partiellement acquittée',
  synced: 'Synchronisée',
  conflict: 'Conflit',
  failed_retryable: 'Échec réessayable',
};

export const PACK_STATUS_LABELS: Record<WatchOfflinePackStatus, string> = {
  estimated: 'Estimé',
  queued: 'En file',
  transferring: 'Transfert',
  verifying: 'Vérification',
  available: 'Disponible',
  degraded: 'Dégradé',
  suspended: 'Suspendu',
  obsolete: 'Obsolète',
  error: 'Erreur',
};

export const PACK_ERROR_LABELS: Record<WatchOfflinePackErrorReason, string> = {
  insufficient_storage: 'Espace insuffisant sur la montre',
  checksum_mismatch: 'Somme de contrôle incorrecte',
  missing_required_resource: 'Ressource cartographique manquante',
  transfer_interrupted: 'Transfert interrompu',
  provider_rights_denied: 'Droits du fournisseur de cartes refusés',
  native_target_unavailable: 'Cible native absente',
};

export const CAPABILITIES: readonly WatchCapabilityDescriptor[] = [
  {
    key: 'autonomous_gps_recording',
    label: 'GPS autonome',
    description: 'Enregistrement sans téléphone, capteur GPS de la montre.',
  },
  {
    key: 'offline_map_pack',
    label: 'Cartes hors ligne',
    description: 'Fond de carte et trace disponibles sans réseau.',
  },
  {
    key: 'turn_by_turn_guidance',
    label: 'Guidage virage par virage',
    description: 'Instructions de navigation calculées sur la montre.',
  },
  {
    key: 'live_sync_fields',
    label: 'Champs Live Sync',
    description: 'Métriques poussées du téléphone vers la montre.',
  },
  {
    key: 'upcoming_pois',
    label: 'Repères à venir',
    description: 'POI et virages triés par distance restante.',
  },
  {
    key: 'offline_session_queue',
    label: 'File hors ligne',
    description: 'Sorties conservées puis renvoyées à la reconnexion.',
  },
  {
    key: 'workout_session_recovery',
    label: 'Reprise de séance',
    description: 'Reprise après redémarrage sans perdre les points acquis.',
  },
  {
    key: 'heart_rate_sensor',
    label: 'Cardio',
    description: 'Fréquence cardiaque lue sur la montre, jamais inventée.',
  },
];

export const FIELD_LABELS: Record<WatchNavigationFieldKey, string> = {
  distance_total_m: 'Distance totale',
  distance_remaining_m: 'Distance restante',
  elevation_gain_m: 'D+ cumulé',
  elevation_remaining_m: 'D+ restant',
  moving_time_s: 'Temps en mouvement',
  elapsed_time_s: 'Temps écoulé',
  current_speed_mps: 'Vitesse instantanée',
  average_speed_mps: 'Vitesse moyenne',
  pace_s_per_km: 'Allure',
  heart_rate_bpm: 'Fréquence cardiaque',
  eta_utc_ms: 'Heure d’arrivée estimée',
  off_route_distance_m: 'Écart à la trace',
  next_turn_distance_m: 'Distance au prochain virage',
  battery_percent: 'Batterie de la montre',
};

export const FIELD_KEYS: readonly WatchNavigationFieldKey[] = [
  'distance_total_m',
  'distance_remaining_m',
  'elevation_gain_m',
  'elevation_remaining_m',
  'moving_time_s',
  'elapsed_time_s',
  'current_speed_mps',
  'average_speed_mps',
  'pace_s_per_km',
  'heart_rate_bpm',
  'eta_utc_ms',
  'off_route_distance_m',
  'next_turn_distance_m',
  'battery_percent',
];

export function platformLabel(platform: WatchPlatform): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function nativeStatusLabel(status: WatchNativeAvailabilityStatus): string {
  return NATIVE_STATUS_LABELS[status] ?? status;
}

export function capabilityStateLabel(state: WatchCapabilityState): string {
  return CAPABILITY_STATE_LABELS[state] ?? state;
}

export function packStatusLabel(status: WatchOfflinePackStatus): string {
  return PACK_STATUS_LABELS[status] ?? status;
}

export function packErrorLabel(reason: WatchOfflinePackErrorReason | null): string | null {
  if (!reason) return null;
  return PACK_ERROR_LABELS[reason] ?? reason;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

export function formatDistanceMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDateTime(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0 %';
  return `${Math.max(0, Math.min(100, Math.round(value)))} %`;
}
