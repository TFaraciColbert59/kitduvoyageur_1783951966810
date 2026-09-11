'use client';

/**
 * A7 — Bandeau hors-ligne discret : `role="status"`, jamais bloquant.
 * Ne rend rien en ligne (exactement un indicateur réseau à l'écran).
 */
import Icon from '@/components/ui/Icon';

export interface OfflineBannerProps {
  offline: boolean;
  /** Opérations en attente de synchronisation (facultatif). */
  pendingCount?: number;
  className?: string;
}

export function OfflineBanner({ offline, pendingCount = 0, className = '' }: OfflineBannerProps) {
  if (!offline) return null;

  const pending = Math.max(0, Math.trunc(pendingCount));
  const label =
    pending > 0
      ? `Hors ligne — ${pending} action${pending > 1 ? 's' : ''} en attente de synchronisation`
      : 'Hors ligne — dernières données connues disponibles';

  return (
    <p
      role="status"
      aria-live="polite"
      className={`inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--lkv-warning-bg)] px-3 py-1.5 text-[12px] font-medium text-[var(--lkv-warning-dark)] ${className}`}
    >
      <Icon name="wifi-off" size={13} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </p>
  );
}

export default OfflineBanner;
