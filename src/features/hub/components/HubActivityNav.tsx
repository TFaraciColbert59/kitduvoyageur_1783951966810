'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Compass, Package, Plus, Users } from 'lucide-react';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import { adventureKey, type AdventureEntry } from '../context/adventureLists';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { HUB_HOME_HREF, HUB_NEW_HREF } from '../registry/hubSectionRegistry';

const ICONS = {
  possession: Package,
  sortie: Compass,
  collectif: Users,
} as const;

/**
 * Hub V4 — Sidebar : ACTIVITÉ ACTIVE seule + dépliage des autres.
 * L'identité de l'activité reste visible sans liste permanente (gain de
 * place). État vide : CTA « Créer ma première aventure ». Clic → activer
 * l'aventure (cookie) puis ouvrir le MENU racine /hub.
 */
export function HubActivityNav() {
  const {
    activeAdventure,
    setActiveAdventureByKey,
    groups,
    isPending,
  } = useActiveAdventure();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const [expanded, setExpanded] = useState(false);

  const entries: AdventureEntry[] = [
    ...groups.possession,
    ...groups.sorties,
    ...groups.collectifs,
  ];

  const currentKey = activeAdventure
    ? adventureKey(
        activeAdventure.nature === 'sortie'
          ? { nature: 'sortie', id: activeAdventure.id, slug: activeAdventure.slug, title: activeAdventure.title }
          : activeAdventure.nature === 'collectif'
            ? { nature: 'collectif', kind: activeAdventure.kind, id: activeAdventure.id, title: activeAdventure.title, membersCount: 0, subtitle: '', linkedTripSlug: null }
            : { nature: 'possession', itemsCount: 0, loansCount: 0, alertsCount: 0 },
      )
    : null;

  const activate = async (entry: AdventureEntry) => {
    if (isPending) return;
    triggerHaptic('selection');
    const ok = await setActiveAdventureByKey(adventureKey(entry));
    if (!ok) return;
    setExpanded(false);
    router.push(HUB_HOME_HREF);
    router.refresh();
  };

  const activeEntry = entries.find((e) => currentKey === adventureKey(e));
  const others = entries.filter((e) => currentKey !== adventureKey(e));
  const ActiveIcon = activeEntry ? ICONS[activeEntry.nature] : Package;
  const activeLabel =
    activeEntry && activeEntry.nature === 'possession' ? 'Mon matériel' : activeEntry?.title;

  if (entries.length === 0) {
    return (
      <nav aria-label="Activités du hub" className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-1">
        <p className="px-3 py-4 text-xs text-[var(--lkv-text-muted)]">Aucune activité.</p>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            router.push(HUB_NEW_HREF);
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-[var(--lkv-primary)] bg-[var(--lkv-primary)]/10 border border-[var(--lkv-primary)]/20 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Créer ma première aventure</span>
        </button>
      </nav>
    );
  }

  return (
    <nav aria-label="Activités du hub" className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-1 space-y-1">
      {/* Activité ACTIVE — toujours visible, déplie la liste des autres */}
      {activeEntry && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left cursor-pointer border bg-[var(--lkv-forest-900)] text-white border-[var(--lkv-forest-900)] shadow-sm transition-all active:scale-[0.98]"
        >
          <ActiveIcon size={15} className="shrink-0 text-sage-300" aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate text-xs font-semibold">{activeLabel}</span>
          <ChevronDown
            size={13}
            className={`shrink-0 text-sage-300/70 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}

      {/* Autres activités (dépliage) */}
      {expanded &&
        others.map((entry) => {
          const key = adventureKey(entry);
          const Icon = ICONS[entry.nature];
          const label = entry.nature === 'possession' ? 'Mon matériel' : entry.title;
          return (
            <button
              key={key}
              type="button"
              onClick={() => activate(entry)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left cursor-pointer border bg-white/80 hover:bg-white text-[var(--lkv-forest-900)] border-white/80 transition-all active:scale-[0.98]"
            >
              <Icon size={15} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-xs font-semibold">{label}</span>
            </button>
          );
        })}
    </nav>
  );
}

export default HubActivityNav;
