import type {
  GuestPositionView,
  SafetyContactChannel,
  ShareLinkStatus,
} from '@/features/live-tracking';

export const MIN_SHARE_MINUTES = 5;
export const MAX_SHARE_MINUTES = 72 * 60;

export const DURATION_PRESETS = [30, 60, 180, 480, 1440] as const;

export const SHARE_LINK_LABEL: Record<ShareLinkStatus, string> = {
  active: 'Actif',
  revoked: 'Révoqué',
  expired: 'Expiré',
  session_ended: 'Séance terminée',
};

export const CHANNEL_LABEL: Record<SafetyContactChannel, string> = {
  sms: 'SMS',
  email: 'E-mail',
  push: 'Notification',
  in_app: 'Dans l’app',
};

export const CHANNEL_PLACEHOLDER: Record<SafetyContactChannel, string> = {
  sms: '+33 6 12 34 56 78',
  email: 'prenom@exemple.fr',
  push: 'identifiant d’appareil',
  in_app: 'identifiant de compte',
};

export function isValidShareDuration(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= MIN_SHARE_MINUTES && minutes <= MAX_SHARE_MINUTES;
}

/** « 45 min », « 2 h », « 1 j 2 h » — jamais de secondes pour une échéance. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const total = Math.round(minutes);
  if (total < 60) return `${Math.max(0, total)} min`;
  const hours = Math.floor(total / 60);
  const restMinutes = total % 60;
  if (hours < 24) return restMinutes > 0 ? `${hours} h ${restMinutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days} j ${restHours} h` : `${days} j`;
}

export function formatRemaining(expiresAtIso: string | null, nowMs: number): string {
  if (!expiresAtIso) return 'Sans échéance';
  const target = Date.parse(expiresAtIso);
  if (!Number.isFinite(target)) return 'Échéance inconnue';
  if (target <= nowMs) return 'Terminé';
  return formatDuration((target - nowMs) / 60_000);
}

export function formatAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'Aucune position';
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 5) return 'à l’instant';
  if (safe < 60) return `il y a ${safe} s`;
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}

export const FRESHNESS_LABEL: Record<GuestPositionView['freshness'], string> = {
  live: 'En direct',
  stale: 'Position ancienne',
  offline: 'Hors ligne',
};

export function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(5) : '—';
}

export {
  isValidContactDestination,
  isValidEmail,
  isValidPhone,
} from '@/features/compte/live-tracking/validation';

/** Ne montre jamais un destinataire entier dans une liste exposée. */
export function maskDestination(channel: SafetyContactChannel, destination: string): string {
  const value = destination.trim();
  if (!value) return '—';
  if (channel === 'email') {
    const [local, domain] = value.split('@');
    if (!domain) return value.slice(0, 2) + '•••';
    return `${local.slice(0, 2)}•••@${domain}`;
  }
  if (channel === 'sms') {
    return value.length <= 4
      ? '••••'
      : `${'•'.repeat(Math.max(2, value.length - 4))}${value.slice(-4)}`;
  }
  return value.length <= 6 ? '••••••' : `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export type GuestFailReason =
  'invalid_token' | 'revoked' | 'expired' | 'session_ended' | 'privacy_denied';

export const GUEST_FAIL_COPY: Record<GuestFailReason, { title: string; description: string }> = {
  invalid_token: {
    title: 'Lien invalide',
    description:
      'Ce lien n’existe pas ou n’a pas été copié en entier. Demande un nouveau lien au voyageur.',
  },
  revoked: {
    title: 'Partage arrêté',
    description: 'Le voyageur a révoqué ce lien. Aucune position n’est plus visible.',
  },
  expired: {
    title: 'Lien expiré',
    description: 'La durée de partage est terminée. Demande un nouveau lien pour suivre la suite.',
  },
  session_ended: {
    title: 'Balade terminée',
    description: 'La séance est terminée et les positions ont été purgées.',
  },
  privacy_denied: {
    title: 'Position non partagée',
    description: 'Les règles de confidentialité du voyageur ne permettent pas ce partage.',
  },
};

export function sessionStatusLabel(status: 'active' | 'paused' | 'ended'): string {
  if (status === 'active') return 'Partage actif';
  if (status === 'paused') return 'En pause';
  return 'Terminé';
}
