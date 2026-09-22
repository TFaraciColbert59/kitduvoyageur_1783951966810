'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { Badge, Card } from '@/components/ui';
import { Plane, Building2, Ticket, Shield, Wifi, ExternalLink } from 'lucide-react';
import type { AffiliateLink, AffiliateCategory } from '../types/affiliate.types';

export interface AffiliateLinkCardProps {
  link: AffiliateLink;
  tripId?: string;
}

export function getAffiliateCategoryIcon(category: AffiliateCategory) {
  switch (category) {
    case 'flight':
      return Plane;
    case 'hotel':
      return Building2;
    case 'activity':
      return Ticket;
    case 'insurance':
      return Shield;
    case 'esim':
      return Wifi;
    default:
      return ExternalLink;
  }
}

export function getAffiliateCategoryLabel(category: AffiliateCategory): string {
  switch (category) {
    case 'flight':
      return 'Vols & Transports';
    case 'hotel':
      return 'Hébergement';
    case 'activity':
      return 'Activité & Guide';
    case 'insurance':
      return 'Assurance Trek';
    case 'esim':
      return 'Forfait eSIM';
    default:
      return 'Partenaire';
  }
}

export function AffiliateLinkCard({ link, tripId }: AffiliateLinkCardProps) {
  const CategoryIcon = getAffiliateCategoryIcon(link.category);
  const categoryLabel = getAffiliateCategoryLabel(link.category);
  const href = tripId ? `/go/${link.slug}?trip_id=${tripId}` : `/go/${link.slug}`;

  return (
    <Card
      tone="neutral"
      variant="interactive"
      className="flex h-full flex-col justify-between p-[var(--space-4)]"
    >
      <div>
        <div className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-2)]">
          <Badge tone="sage" className="gap-[var(--space-1)]">
            <CategoryIcon className="h-3 w-3 text-[color:var(--lkv-secondary)]" aria-hidden="true" />
            {categoryLabel}
          </Badge>

          <div className="flex flex-wrap items-center justify-end gap-[var(--space-1)]">
            {link.partner && <Badge tone="stone">{link.partner.name}</Badge>}
            <Badge tone="warn">Sponsorisé</Badge>
          </div>
        </div>

        <h4 className="mb-[var(--space-1)] line-clamp-2 text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">
          {link.title}
        </h4>

        {link.destination_name && (
          <p className="mb-[var(--space-3)] truncate text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
            Destination : {link.destination_name}
          </p>
        )}
      </div>

      <div className="mt-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)]">
        <a
          href={href}
          target="_blank"
          rel="sponsored nofollow"
          className="inline-flex min-h-[var(--lkv-touch-min)] w-full items-center justify-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-[var(--space-4)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-1 transition-transform hover:brightness-[1.05] active:scale-[var(--motion-press-scale)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] motion-reduce:transition-none"
        >
          <span>Consulter l’offre</span>
          <Icon name="external-link" className="h-3.5 w-3.5" />
        </a>
      </div>
    </Card>
  );
}
