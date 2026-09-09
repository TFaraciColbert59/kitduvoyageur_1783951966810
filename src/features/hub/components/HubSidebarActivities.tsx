'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Navigation } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { TripBadge } from '@/features/trips/components/TripBadge';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import { adventureKey, resolveAdventureHref } from '../context/adventureLists';
import type { HubUserTripLite } from '../server/getHubAdventureData';

export interface HubSidebarActivitiesProps {
  trips: HubUserTripLite[];
  /** Slug de l'aventure sortie active (état coché). */
  activeSlug?: string | null;
}

function fmtKm(n: number): string {
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');
}

/**
 * H-D95 — Section ACTIVITÉS du rail droit : les voyages réels de l'utilisateur,
 * au style des cartes Aventures (couverture, badge activité, distance/D+/étapes).
 * Clic = changement d'aventure active (même mécanisme que l'AdventureSwitcher :
 * cookie serveur + URL de reprise de section mémorisée).
 */
export function HubSidebarActivities({ trips, activeSlug = null }: HubSidebarActivitiesProps) {
  const router = useRouter();
  const { setActiveAdventure, isCurrentAdventure, getLastSection } = useActiveAdventure();

  if (trips.length === 0) return null;

  const open = async (t: HubUserTripLite): Promise<void> => {
    const ok = await setActiveAdventure({ nature: 'sortie', id: t.id, slug: t.slug, title: t.title });
    if (!ok) return;
    router.push(resolveAdventureHref({ nature: 'sortie', id: t.id, slug: t.slug, title: t.title }, getLastSection));
    router.refresh();
  };

  return (
    <section aria-label="Activités" className="glass shrink-0 rounded-2xl border border-white/70 shadow-xs p-3.5">
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
        Activités
      </p>
      <ul className="mt-2 space-y-1.5">
        {trips.slice(0, 5).map((t) => {
          const current = activeSlug
            ? t.slug === activeSlug
            : isCurrentAdventure(adventureKey({ nature: 'sortie', id: t.id, slug: t.slug, title: t.title }));
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => open(t)}
                aria-current={current ? 'true' : undefined}
                className="glass-sub-card border border-white/40 hover:border-white/70 hover:bg-white/90 transition-colors w-full rounded-xl p-2 flex items-center gap-2.5 min-h-[44px] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
              >
                <span className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white bg-[var(--lkv-surface-paper)]">
                  <AppImage
                    src={t.cover_image_url || '/assets/images/no_image.png'}
                    alt={t.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                    fallbackSrc="/assets/images/no_image.png"
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-bold text-[var(--lkv-text-primary)] flex-1">
                      {t.title}
                    </span>
                    {current && (
                      <Check size={13} className="shrink-0 text-[var(--lkv-secondary)]" aria-label="Aventure active" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <TripBadge type="activity" value={t.primary_activity} size="sm" />
                    <TripBadge type="status" value={t.status} size="sm" />
                  </span>
                  <span className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-[var(--lkv-text-muted)]">
                    <Navigation size={10} aria-hidden="true" />
                    <span className="whitespace-nowrap">
                      {t.distanceKm > 0 ? `${fmtKm(t.distanceKm)} km` : '— km'}
                      {t.dPlusM > 0 ? ` · +${t.dPlusM.toLocaleString('fr-FR')} m` : ''}
                      {' · '}
                      {t.stepsCount} étape{t.stepsCount > 1 ? 's' : ''}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default HubSidebarActivities;
