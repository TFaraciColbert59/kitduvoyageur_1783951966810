'use client';

import Link from 'next/link';
import { ArrowRight, BellRing, CalendarCheck, Package, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { HUB_POSSESSION_HREFS } from '../registry/hubSectionRegistry';
import { HubActivityHero } from './HubActivityHero';

export interface HubOverviewPossessionProps {
  items: number;
  loans: number;
  alerts: number;
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

/**
 * UX Hub — Aperçu matériel : hero d'identité + 3 cartes vitales lisant les
 * compteurs réels. La navigation complète vit dans la sidebar.
 */
export function HubOverviewPossession({ items, loans, alerts }: HubOverviewPossessionProps) {
  const stats: Array<{
    href: string;
    label: string;
    value: number;
    unit: string;
    Icon: typeof Package;
    tone: string;
  }> = [
    { href: HUB_POSSESSION_HREFS.inventaire, label: 'Inventaire', value: items, unit: 'objet(s)', Icon: Package, tone: 'text-[var(--lkv-text-secondary)]' },
    { href: HUB_POSSESSION_HREFS.disponibilite, label: 'Disponibilité', value: loans, unit: 'prêt(s)', Icon: CalendarCheck, tone: 'text-[var(--lkv-text-secondary)]' },
    { href: HUB_POSSESSION_HREFS.alertes, label: 'Alertes', value: alerts, unit: 'à traiter', Icon: BellRing, tone: alerts > 0 ? 'text-[rgba(168,68,58,0.9)]' : 'text-[var(--lkv-text-secondary)]' },
  ];

  return (
    <div className="space-y-4">
      <HubActivityHero
        title="Mon matériel"
        subtitle="Inventaire, kits, prêts et préparation"
        coverUrl={null}
        badgeLabel="Matériel"
        assistantContextLabel="Conseils matériel et préparation"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s) => {
          const Icon = s.Icon;
          return (
            <motion.div key={s.label} {...fade}>
              <Link
                href={s.href}
                className="glass p-4 rounded-2xl flex items-center gap-3 min-h-[44px] cursor-pointer active:scale-[0.98] transition-transform"
              >
                <span className={`w-10 h-10 rounded-full bg-white/70 border border-white/80 flex items-center justify-center shrink-0 ${s.tone}`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xl font-extrabold font-mono text-[var(--lkv-text-primary)] leading-none">
                    {s.value}
                  </span>
                  <span className="block text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)] mt-1">
                    {s.label} · {s.unit}
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
          aria-label="Assistant IA — conseils matériel"
        >
          <Sparkles size={18} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[var(--lkv-text-primary)]">Assistant IA</span>
            <span className="block text-[11px] text-[var(--lkv-text-secondary)] truncate">Conseils matériel et préparation</span>
          </span>
          <ArrowRight size={14} className="text-[var(--lkv-text-muted)] shrink-0" aria-hidden="true" />
        </Link>
      </motion.div>
    </div>
  );
}

export default HubOverviewPossession;
