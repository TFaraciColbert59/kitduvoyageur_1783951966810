'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
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
  const Icon = getAffiliateCategoryIcon(link.category);
  const categoryLabel = getAffiliateCategoryLabel(link.category);
  const href = tripId ? `/go/${link.slug}?trip_id=${tripId}` : `/go/${link.slug}`;

  return (
    <GlassCard
      tone="neutral"
      blur="sm"
      interactive
      className="p-4 rounded-[22px] border border-stone-200/80 hover:border-[#5B7F55]/40 transition-all flex flex-col justify-between h-full bg-white/80"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#17402C]/10 text-[#17402C]">
            <Icon className="w-3 h-3 text-[#5B7F55]" />
            {categoryLabel}
          </span>

          {link.partner && (
            <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
              {link.partner.name}
            </span>
          )}
        </div>

        <h4 className="text-sm font-bold text-stone-900 line-clamp-2 mb-1">
          {link.title}
        </h4>

        {link.destination_name && (
          <p className="text-xs text-stone-500 mb-3 truncate">
            Destination : {link.destination_name}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-stone-100 mt-2">
        <a
          href={href}
          target="_blank"
          rel="sponsored nofollow"
          className="w-full min-h-[44px] px-4 rounded-xl bg-[#17402C] hover:bg-[#123323] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <span>Consulter l’offre</span>
          <ExternalLink className="w-3.5 h-3.5 text-stone-300" />
        </a>
      </div>
    </GlassCard>
  );
}
