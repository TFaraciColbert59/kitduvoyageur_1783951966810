import type { SafetyContactChannel } from '@/features/live-tracking';

/**
 * Validation partagée entre l'écran et l'API : une adresse refusée par l'UI
 * doit l'être aussi par la route, et inversement.
 */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 254;
}

/** E.164 tolérant aux espaces, points et tirets de saisie. */
export function isValidPhone(value: string): boolean {
  const compact = value.replace(/[\s.()-]/g, '');
  return /^\+?[1-9]\d{6,14}$/.test(compact);
}

export function isValidContactDestination(channel: SafetyContactChannel, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (channel === 'email') return isValidEmail(trimmed);
  if (channel === 'sms') return isValidPhone(trimmed);
  return trimmed.length >= 3 && trimmed.length <= 320;
}
