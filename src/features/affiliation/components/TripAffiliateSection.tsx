'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { Badge, Card } from '@/components/ui';
import { AffiliateDisclosure } from './AffiliateDisclosure';
import { AffiliateLinkCard } from './AffiliateLinkCard';
import type { AffiliateLink } from '../types/affiliate.types';

export interface TripAffiliateSectionProps {
  links: AffiliateLink[];
  tripId?: string;
  countryNames?: string[];
}

export function TripAffiliateSection({
  links,
  tripId,
  countryNames = [],
}: TripAffiliateSectionProps) {
  if (!links || links.length === 0) {
    return null;
  }

  const destinationLabel = countryNames.length > 0 ? countryNames.join(', ') : 'votre voyage';

  return (
    <section
      className="my-[var(--space-8)] animate-fade-in space-y-[var(--space-4)]"
      aria-label="Réservations et services partenaires"
    >
      {/* Disclosure légal obligatoire en amont */}
      <AffiliateDisclosure />

      <Card
        tone="neutral"
        className="space-y-[var(--space-6)] p-[var(--space-6)]"
      >
        <div className="flex flex-col justify-between gap-[var(--space-2)] border-b border-[color:var(--lkv-border-subtle)] pb-[var(--space-4)] sm:flex-row sm:items-center">
          <div>
            <span className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption)] font-bold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-secondary)]">
              <Icon name="compass" className="h-3.5 w-3.5" />
              Réservations & Préparation Logistique
            </span>
            <h3 className="mt-[var(--space-1)] text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">
              Services et partenaires pour {destinationLabel}
            </h3>
          </div>

          <Badge tone="stone" className="self-start sm:self-auto">
            {links.length} offres disponibles
          </Badge>
        </div>

        {/* Grille des offres partenaires */}
        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <AffiliateLinkCard key={link.id} link={link} tripId={tripId} />
          ))}
        </div>
      </Card>
    </section>
  );
}
