export type DocumentHealth = 'expired' | 'expiring_soon' | 'valid' | 'no_expiry';

export interface DocumentStatusSummary {
  health: DocumentHealth;
  label: string;
  daysLeft: number | null;
}

const SOON_DAYS = 30;

export function evaluateDocumentExpiry(expiration: string | null | undefined, todayIso: string): DocumentStatusSummary {
  if (!expiration) {
    return { health: 'no_expiry', label: 'Sans échéance', daysLeft: null };
  }
  const expMs = Date.parse(expiration.slice(0, 10) + 'T12:00:00Z');
  const todayMs = Date.parse(todayIso.slice(0, 10) + 'T12:00:00Z');
  if (!Number.isFinite(expMs) || !Number.isFinite(todayMs)) {
    return { health: 'no_expiry', label: 'Date invalide', daysLeft: null };
  }
  const daysLeft = Math.round((expMs - todayMs) / 86_400_000);
  if (daysLeft < 0) {
    return { health: 'expired', label: `Expiré depuis ${Math.abs(daysLeft)} j`, daysLeft };
  }
  if (daysLeft === 0) {
    return { health: 'expiring_soon', label: 'Expire aujourd’hui', daysLeft: 0 };
  }
  if (daysLeft <= SOON_DAYS) {
    return { health: 'expiring_soon', label: `Expire dans ${daysLeft} j`, daysLeft };
  }
  return { health: 'valid', label: 'Valide', daysLeft };
}
