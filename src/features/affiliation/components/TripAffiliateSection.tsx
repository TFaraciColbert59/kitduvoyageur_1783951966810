'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AffiliateDisclosure } from './AffiliateDisclosure';
import { AffiliateLinkCard } from './AffiliateLinkCard';
import { Compass, Sparkles } from 'lucide-react';
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
    <section className="space-y-4 my-8 animate-fade-in" aria-label="Réservations et services partenaires">
      {/* Disclosure légal obligatoire en amont */}
      <AffiliateDisclosure />

      <GlassCard
        tone="neutral"
        blur="md"
        className="p-6 sm:p-7 rounded-[28px] border border-white/70 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-200/60">
          <div>
            <span className="text-xs font-bold text-[#5B7F55] uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Réservations & Préparation Logistique
            </span>
            <h3 className="text-lg sm:text-xl font-black text-stone-900 mt-1">
              Partenaires vérifiés pour {destinationLabel}
            </h3>
          </div>

          <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {links.length} offres disponibles
          </span>
        </div>

        {/* Grille des offres partenaires */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <AffiliateLinkCard key={link.id} link={link} tripId={tripId} />
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
