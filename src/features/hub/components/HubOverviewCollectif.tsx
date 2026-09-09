'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, MailPlus, Map as MapIcon, Sparkles, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { HUB_COLLECTIF_HREFS, hubSectionHref } from '../registry/hubSectionRegistry';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import { HubActivityHero } from './HubActivityHero';

export interface HubOverviewCollectifProps {
  groupLabel: string;
  members: number;
  pendingInvites: number;
  linkedTripSlug: string | null;
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * UX Hub — Aperçu collectif : hero du groupe + accès direct aux sections
 * (groupe, invitations, voyages liés) et CTA d'entrée dans le voyage lié.
 */
export function HubOverviewCollectif({
  groupLabel,
  members,
  pendingInvites,
  linkedTripSlug,
}: HubOverviewCollectifProps) {
  const cards: Array<{ href: string; label: string; Icon: typeof Users; count?: number }> = [
    { href: hubSectionHref({ nature: 'collectif' }, 'groupe'), label: 'Groupe', Icon: Users, count: members },
    { href: hubSectionHref({ nature: 'collectif' }, 'invitations'), label: 'Invitations', Icon: MailPlus, count: pendingInvites },
    { href: HUB_COLLECTIF_HREFS.voyagesLies, label: 'Voyages liés', Icon: MapIcon },
  ];

  return (
    <div className="space-y-4">
      <HubActivityHero
        title={groupLabel}
        subtitle={`${members} membre(s)${pendingInvites > 0 ? ` · ${pendingInvites} invitation(s) en attente` : ''}`}
        coverUrl={null}
        badgeLabel="Groupe"
        assistantContextLabel={`Coordination ${groupLabel}`}
      />

      {linkedTripSlug && (
        <motion.div {...fade}>
          <Link
            href={tripSwitchHref(linkedTripSlug)}
            className="glass-capsule-btn primary inline-flex items-center gap-2 min-h-[44px] px-5 active:scale-[0.98] transition-transform"
          >
            <span>Entrer dans le voyage</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.Icon;
          return (
            <motion.div key={c.label} {...fade}>
              <Link
                href={c.href}
                className="glass p-4 rounded-2xl flex items-center gap-3 min-h-[44px] cursor-pointer active:scale-[0.98] transition-transform"
              >
                <span className="w-10 h-10 rounded-full bg-white/70 border border-white/80 flex items-center justify-center shrink-0 text-[var(--lkv-text-secondary)]">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-[var(--lkv-text-primary)] truncate">
                    {c.label}
                    {c.count !== undefined && c.count > 0 ? ` · ${c.count}` : ''}
                  </span>
                </span>
                <ArrowRight size={14} className="text-[var(--lkv-text-muted)] shrink-0" aria-hidden="true" />
              </Link>
            </motion.div>
          );
        })}
      </div>

      <motion.div {...fade}>
        <Link
          href="/copilote"
          className="glass p-4 rounded-2xl flex items-center gap-3 min-h-[44px] cursor-pointer active:scale-[0.98] transition-transform"
          aria-label={`Assistant IA — coordination ${groupLabel}`}
        >
          <Sparkles size={18} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[var(--lkv-text-primary)]">Assistant IA</span>
          </span>
          <ArrowRight size={14} className="text-[var(--lkv-text-muted)] shrink-0" aria-hidden="true" />
        </Link>
      </motion.div>
    </div>
  );
}

export default HubOverviewCollectif;
