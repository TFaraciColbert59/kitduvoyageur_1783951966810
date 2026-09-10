'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import { adventureKey, resolveAdventureHref } from '../context/adventureLists';
import type { HubUserTripLite } from '../server/getHubAdventureData';

export interface HubSidebarActivitiesProps {
  trips: HubUserTripLite[];
  /** Slug de l'aventure sortie active (état coché). */
  activeSlug?: string | null;
}

/**
 * Section ACTIVITÉS de la sidebar gauche : rangées minimalistes (titre +
 * icône discrète). Clic = changement d'aventure active (cookie serveur + URL
 * de reprise de section mémorisée). Liste pleine hauteur, sans carte
 * englobante : l'aside est déjà le conteneur glass.
 */
export function HubSidebarActivities({ trips, activeSlug = null }: HubSidebarActivitiesProps) {
  const router = useRouter();
  const { setActiveAdventure, isCurrentAdventure, getLastSection } = useActiveAdventure();

  if (trips.length === 0) return null;

  const open = async (t: HubUserTripLite): Promise<void> => {
    const ok = await setActiveAdventure({
      nature: 'sortie',
      id: t.id,
      slug: t.slug,
      title: t.title,
    });
    if (!ok) return;
    router.push(
      resolveAdventureHref(
        { nature: 'sortie', id: t.id, slug: t.slug, title: t.title },
        getLastSection
      )
    );
    router.refresh();
  };

  return (
    <nav aria-label="Activités" className="flex flex-col">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lkv-text-muted)] pb-1">
        Activités
      </p>
      <ul className="space-y-0.5">
        {trips.slice(0, 5).map((t) => {
          const current = activeSlug
            ? t.slug === activeSlug
            : isCurrentAdventure(
                adventureKey({ nature: 'sortie', id: t.id, slug: t.slug, title: t.title })
              );
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => open(t)}
                aria-current={current ? 'true' : undefined}
                className={`group w-full min-h-[44px] flex items-center gap-2.5 rounded-lg text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] ${
                  current ? 'bg-white/70' : 'hover:bg-white/60'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`shrink-0 ${current ? 'text-[var(--lkv-primary)]' : 'text-[var(--lkv-text-muted)]'}`}
                >
                  <Icon name="compass" size={16} />
                </span>
                <span
                  className={`flex-1 min-w-0 truncate text-[13px] font-semibold ${
                    current ? 'text-[var(--lkv-primary)]' : 'text-[var(--lkv-text-primary)]'
                  }`}
                >
                  {t.title}
                </span>
                {current && (
                  <Icon
                    name="check"
                    size={12}
                    className="shrink-0 text-[var(--lkv-primary)]"
                    aria-label="Aventure active"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default HubSidebarActivities;
