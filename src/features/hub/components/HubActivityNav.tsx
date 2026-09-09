'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Package, Users } from 'lucide-react';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import { adventureKey, type AdventureEntry } from '../context/adventureLists';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { HUB_HOME_HREF } from '../registry/hubSectionRegistry';

const ICONS = {
  possession: Package,
  sortie: Compass,
  collectif: Users,
} as const;

/**
 * Hub V4 — Sidebar : la liste des ACTIVITÉS (remplace la nav de sections).
 * Chaque ligne = icône de nature + nom. Clic → active l'aventure (cookie) puis
 * ouvre le MENU racine /hub de cette activité. L'activité active est en vert.
 */
export function HubActivityNav() {
  const {
    activeAdventure,
    setActiveAdventureByKey,
    isCurrentAdventure,
    groups,
    isPending,
  } = useActiveAdventure();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

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
    router.push(HUB_HOME_HREF);
    router.refresh();
  };

  return (
    <nav aria-label="Activités du hub" className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-1 space-y-1">
      {entries.map((entry) => {
        const key = adventureKey(entry);
        const isCurrent = isCurrentAdventure(key) || currentKey === key;
        const Icon = ICONS[entry.nature];
        const label =
          entry.nature === 'possession'
            ? 'Mon matériel'
            : entry.title;
        return (
          <button
            key={key}
            type="button"
            onClick={() => activate(entry)}
            aria-current={isCurrent ? 'true' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left cursor-pointer border transition-all active:scale-[0.98] ${
              isCurrent
                ? 'bg-[var(--lkv-forest-900)] text-white border-[var(--lkv-forest-900)] shadow-sm'
                : 'bg-white/80 hover:bg-white text-[var(--lkv-forest-900)] border-white/80 shadow-2xs'
            }`}
          >
            <Icon
              size={15}
              className={`shrink-0 ${isCurrent ? 'text-sage-300' : 'text-[var(--lkv-secondary)]'}`}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0 truncate text-xs font-semibold">{label}</span>
          </button>
        );
      })}
      {entries.length === 0 && (
        <p className="px-3 py-4 text-xs text-[var(--lkv-text-muted)]">Aucune activité.</p>
      )}
    </nav>
  );
}

export default HubActivityNav;