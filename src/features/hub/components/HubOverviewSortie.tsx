import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { HubAssistantCta } from './HubAssistantCta';
import {
  hubSectionHref,
  visibleHubSections,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import type { AdventureProfile } from '../engine/hubProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

export interface HubOverviewSortieProps {
  profile: AdventureProfile;
  trip: TripFull;
  countdown: number | null;
}

/** H3.4 — Aperçu sortie : countdown + liens profonds (composition, pas de re-rendu). */
export function HubOverviewSortie({ profile, trip, countdown }: HubOverviewSortieProps) {
  const ref: HubAdventureRef = { nature: 'sortie', slug: trip.slug };
  const sections = visibleHubSections(profile);
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
          Voyage actif{countdown !== null && countdown >= 0 ? ` · J-${countdown}` : ''}
        </p>
        <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)] mt-1">
          {trip.title}
        </h1>
        <p className="text-sm text-[var(--lkv-text-secondary)] mt-1">
          {trip.destination_name ?? trip.destination_country_code ?? 'Destination à définir'}
          {trip.status ? ` · ${trip.status}` : ''}
        </p>
      </header>
      <Link
        href={tripSectionHref(trip.slug, 'overview')}
        className="glass-capsule-btn primary inline-flex items-center gap-2 min-h-[44px] px-5"
      >
        <span>Ouvrir le voyage</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubAssistantCta contextLabel={`Conseils pour ${trip.title}`} />
        {sections
          .filter((d) => d.id !== 'overview')
          .map((def) => {
            const Icon = def.icon;
            return (
              <Link
                key={def.id}
                href={hubSectionHref(ref, def.id)}
                className="glass p-4 rounded-[var(--lkv-radius-card)] flex items-center gap-3 min-h-[44px]"
              >
                <Icon size={18} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
                <span className="flex-1 text-sm font-semibold text-[var(--lkv-text-primary)]">{def.label}</span>
                <ArrowRight size={14} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
              </Link>
            );
          })}
      </div>
    </div>
  );
}

export default HubOverviewSortie;
