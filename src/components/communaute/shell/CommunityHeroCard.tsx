'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import CommunityStoriesBar from '@/components/communaute/CommunityStoriesBar';
import type { CommunityTotals } from '@/features/community/useCommunityTotals';

export interface CommunityHeroUser {
  id?: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    username?: string;
  };
}

export interface CommunityHeroEvent {
  title?: string;
  date?: string | null;
  location?: string | null;
}

export interface CommunityHeroCardProps {
  user?: CommunityHeroUser | null;
  /** Totaux réels (`count` SQL). `null` = total indisponible, affiché « — ». */
  totals?: CommunityTotals;
  /** Prochaine sortie réellement chargée (aucune donnée inventée). */
  nextEvent?: CommunityHeroEvent | null;
  /** Massifs réellement présents dans les carnets chargés. */
  massifs?: string[];
  onPublish: () => void;
  onDiscover: () => void;
  onOpenContext: () => void;
}

function handleOf(user?: CommunityHeroUser | null) {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || '';
}

function formatTotal(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('fr-FR');
}

/**
 * Carte héro de la Communauté.
 *
 * Même anatomie que la carte du Compte (avatar 66 px, trois compteurs,
 * bio, actions, stories à la une 44 px) — mais des **totaux de communauté**
 * réels, jamais des longueurs de page.
 */
export function CommunityHeroCard({
  user,
  totals,
  nextEvent,
  massifs = [],
  onPublish,
  onDiscover,
  onOpenContext,
}: CommunityHeroCardProps) {
  const handle = handleOf(user);
  const displayName = user?.user_metadata?.full_name || (handle ? `@${handle}` : 'Voyageur');
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initial = (displayName || 'V').replace('@', '').charAt(0).toUpperCase();
  const massifLine = massifs.slice(0, 3).join(' · ');

  const stats = [
    { id: 'posts', label: 'publications', value: totals?.posts },
    { id: 'clubs', label: 'clubs', value: totals?.clubs },
    { id: 'events', label: 'sorties', value: totals?.events },
  ];

  const nextLocation =
    nextEvent?.location && nextEvent.title && !nextEvent.title.includes(nextEvent.location)
      ? ` · ${nextEvent.location}`
      : '';
  const contextLine = nextEvent?.title
    ? `Prochaine sortie · ${nextEvent.title}${nextLocation}`
    : massifLine
      ? `Destinations des carnets récents · ${massifLine}`
      : 'Les carnets, clubs et sorties de la communauté, au même endroit.';

  return (
    <section className="lkdv-hero" aria-label="La communauté">
      <div className="lkdv-hero-head">
        <span className="lkdv-hero-avatar" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar distant, même URL que le reste de l'app
            <img src={avatarUrl} alt="" width={60} height={60} />
          ) : user ? (
            <span className="lkdv-hero-initial">{initial}</span>
          ) : (
            <Icon name="mountain" size={28} aria-hidden="true" />
          )}
        </span>

        <div className="lkdv-hero-stats" role="group" aria-label="La communauté en chiffres">
          {stats.map((stat) => (
            <div className="lkdv-hero-stat" key={stat.id}>
              <b>{formatTotal(stat.value)}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lkdv-hero-meta">
        <p className="lkdv-hero-bio">{contextLine}</p>
        <button
          type="button"
          className="lkdv-hero-context"
          onClick={onOpenContext}
          aria-label="Ouvrir le contexte de la communauté"
        >
          <Icon name="layers" size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="lkdv-hero-actions">
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onPublish}
          icon={<Icon name="plus" size={14} aria-hidden="true" />}
        >
          Publier
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onDiscover}
          icon={<Icon name="arrow-right" size={14} aria-hidden="true" />}
        >
          Découvrir
        </Button>
      </div>

      <div className="lkdv-hero-highlights">
        <CommunityStoriesBar currentUser={user} variant="highlights" />
      </div>
    </section>
  );
}

export default CommunityHeroCard;
