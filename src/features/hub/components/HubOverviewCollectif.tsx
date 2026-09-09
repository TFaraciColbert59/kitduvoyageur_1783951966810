import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { HubAssistantCta } from './HubAssistantCta';
import {
  hubSectionHref,
  visibleHubSections,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import type { AdventureProfile } from '../engine/hubProfileEngine';

export interface HubOverviewCollectifProps {
  profile: AdventureProfile;
  groupLabel: string;
  members: number;
  pendingInvites: number;
  linkedTripSlug: string | null;
}

/** H3.4 — Aperçu collectif : groupe + CTA entrer dans le voyage si lié. */
export function HubOverviewCollectif({
  profile,
  groupLabel,
  members,
  pendingInvites,
  linkedTripSlug,
}: HubOverviewCollectifProps) {
  const ref: HubAdventureRef = { nature: 'collectif' };
  const sections = visibleHubSections(profile);
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
          Groupe actif
        </p>
        <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)] mt-1">
          {groupLabel}
        </h1>
        <p className="text-sm text-[var(--lkv-text-secondary)] mt-1">
          {members} membre(s)
          {pendingInvites > 0 ? ` · ${pendingInvites} invitation(s)` : ''}
        </p>
      </header>
      {linkedTripSlug && (
        <Link
          href={tripSwitchHref(linkedTripSlug)}
          className="glass-capsule-btn primary inline-flex items-center gap-2 min-h-[44px] px-5"
        >
          <span>Entrer dans le voyage</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubAssistantCta contextLabel={`Coordination ${groupLabel}`} />
        {sections.map((def) => {
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

export default HubOverviewCollectif;
