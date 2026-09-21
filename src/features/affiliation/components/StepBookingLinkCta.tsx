'use client';

import { BedDouble, Compass, ExternalLink, Plane, Shield, Smartphone } from 'lucide-react';
import type { AffiliateIntent } from '../engine/stepBookingLink';

export interface StepBookingLinkCtaProps {
  booking: AffiliateIntent;
  /** Slug du lien partenaire résolu côté serveur (redirection trackée /go). */
  slug: string;
  /** Nom du partenaire affiché (résolu côté serveur, optionnel). */
  partnerName?: string | null;
  tripId?: string;
  /** Sous-titre explicite (ex. `searchTerms` d'une suggestion LLM). */
  subtitle?: string | null;
  className?: string;
}

const CATEGORY_ICONS = {
  hotel: BedDouble,
  flight: Plane,
  activity: Compass,
  insurance: Shield,
  esim: Smartphone,
  transport: Plane,
  gear: Compass,
} as const;

/**
 * Lien de réservation compact affiché à côté d'une étape ou d'une suggestion
 * (itinéraire mobile et desktop). Le slug provient de la résolution serveur
 * (`bookingByStepId` / suggestions) : aucun rapprochement de lien n'est refait
 * côté client. L'URL passe par la redirection trackée `/go/<slug>` de l'engine
 * existant — jamais d'URL partenaire brute — et conserve `rel="sponsored
 * nofollow"`. Aucun nouveau vocabulaire visuel : surface canonique tokenisée.
 */
export function StepBookingLinkCta({
  booking,
  slug,
  partnerName,
  tripId,
  subtitle,
  className = '',
}: StepBookingLinkCtaProps) {
  const href = tripId ? `/go/${slug}?trip_id=${tripId}` : `/go/${slug}`;
  const CategoryIcon = CATEGORY_ICONS[booking.category] ?? Plane;

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow"
      title={`Suggestion partenaire — recherche : ${booking.searchTerms}`}
      className={`flex min-h-[var(--lkv-touch-min)] w-full items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] py-[var(--space-2)] text-left backdrop-blur-[var(--blur-md)] transition-transform active:scale-[var(--motion-press-scale)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] motion-reduce:transition-none ${className}`}
    >
      <CategoryIcon size={14} className="shrink-0 text-[var(--lkv-primary)]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-bold text-[var(--lkv-text-primary)]">
          {booking.label}
        </span>
        <span className="block truncate text-[10px] font-medium text-[var(--lkv-text-secondary)]">
          {subtitle ?? `Suggestion · Lien partenaire${partnerName ? ` · ${partnerName}` : ''}`}
        </span>
      </span>
      <ExternalLink size={13} className="shrink-0 text-[var(--lkv-text-muted)]" aria-hidden="true" />
    </a>
  );
}

export default StepBookingLinkCta;
