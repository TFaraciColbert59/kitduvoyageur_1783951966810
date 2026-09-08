import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HubAssistantCta } from './HubAssistantCta';
import {
  hubSectionHref,
  visibleHubSections,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import type { AdventureProfile } from '../engine/hubProfileEngine';

export interface HubOverviewPossessionProps {
  profile: AdventureProfile;
  items: number;
  loans: number;
  alerts: number;
}

/** H3.4 — Aperçu possession : compteurs d'inventaire + liens sections. */
export function HubOverviewPossession({ profile, items, loans, alerts }: HubOverviewPossessionProps) {
  const ref: HubAdventureRef = { nature: 'possession' };
  const sections = visibleHubSections(profile);
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
          Mon matériel
        </p>
        <h1 className="font-display font-bold text-2xl text-[var(--lkv-text-primary)] mt-1">
          Aperçu de l&apos;équipement
        </h1>
        <p className="text-sm text-[var(--lkv-text-secondary)] mt-1">
          {items} objet(s) · {loans} prêt(s) · {alerts} alerte(s)
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <HubAssistantCta contextLabel="Conseils matériel et préparation" />
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

export default HubOverviewPossession;
