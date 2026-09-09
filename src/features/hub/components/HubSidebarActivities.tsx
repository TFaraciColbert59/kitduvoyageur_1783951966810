'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Navigation } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import { adventureKey, resolveAdventureHref } from '../context/adventureLists';
import type { HubUserTripLite } from '../server/getHubAdventureData';

export interface HubSidebarActivitiesProps {
  trips: HubUserTripLite[];
  /** Slug de l'aventure sortie active (état coché). */
  activeSlug?: string | null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  hiking: 'Randonnée',
  trekking: 'Trek',
  bivouac: 'Bivouac',
  roadtrip: 'Roadtrip',
  cultural: 'Culture',
  bushcraft: 'Bushcraft',
  mixed: 'Mixte',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

function fmtKm(n: number): string {
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * H-D95 — Section ACTIVITÉS de la sidebar gauche : les voyages réels de
 * l'utilisateur, au style des cartes Aventures (couverture, badges glass-pill,
 * distance/D+/étapes). Clic = changement d'aventure active (cookie serveur +
 * URL de reprise de section mémorisée). Liste pleine hauteur, sans carte
 * englobante : l'aside est déjà le conteneur glass.
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
    <nav aria-label="Activités" className="flex flex-col">
      <p className="font-display text-xs font-bold text-[var(--lkv-text-primary)] pb-2">Activités</p>
      <ul className="space-y-2">
        {trips.slice(0, 5).map((t) => {
          const current = activeSlug
            ? t.slug === activeSlug
            : isCurrentAdventure(adventureKey({ nature: 'sortie', id: t.id, slug: t.slug, title: t.title }));
          const dateLabel = fmtDate(t.start_date);
          const metrics = `${t.distanceKm > 0 ? `${fmtKm(t.distanceKm)} km` : '— km'} · ${
            t.dPlusM > 0 ? `+${t.dPlusM.toLocaleString('fr-FR')} m · ` : ''
          }${t.stepsCount} étape${t.stepsCount > 1 ? 's' : ''}`;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => open(t)}
                aria-current={current ? 'true' : undefined}
                className="glass-sub-card border border-white/40 hover:border-white/70 hover:bg-white/90 transition-colors group w-full rounded-2xl p-3 flex items-center gap-3 min-h-[64px] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
              >
                <span className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white bg-[var(--lkv-surface-paper)]">
                  <AppImage
                    src={t.cover_image_url || '/assets/images/no_image.png'}
                    alt={t.title}
                    fill
                    sizes="56px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    fallbackSrc="/assets/images/no_image.png"
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-bold text-[var(--lkv-primary)] flex-1">
                      {t.title}
                    </span>
                    {current && (
                      <Check size={14} className="shrink-0 text-[var(--lkv-secondary)]" aria-label="Aventure active" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="glass-pill text-[9.5px] font-bold">
                      {ACTIVITY_LABELS[t.primary_activity] ?? t.primary_activity}
                    </span>
                    <span
                      className={`glass-pill text-[9.5px] font-bold ${t.status === 'active' ? 'pill-warn' : ''}`}
                    >
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--lkv-text-secondary)] tabular-nums">
                    <Navigation size={10} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">
                      {dateLabel ? `${dateLabel} · ` : ''}
                      {metrics}
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="w-7 h-7 rounded-full bg-white/60 border border-[var(--lkv-primary)]/10 flex items-center justify-center shrink-0 group-hover:bg-white transition-colors"
                >
                  <ChevronRight size={13} className="text-[var(--lkv-text-secondary)]" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default HubSidebarActivities;
