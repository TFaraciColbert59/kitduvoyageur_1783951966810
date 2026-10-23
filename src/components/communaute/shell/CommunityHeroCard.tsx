'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button } from '@/components/ui';

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
  /** Prochaine sortie réellement chargée (aucune donnée inventée). */
  nextEvent?: CommunityHeroEvent | null;
  /** Massifs réellement présents dans les carnets chargés. */
  massifs?: string[];
  onPublish: () => void;
  onDiscover: () => void;
  onOpenContext: () => void;
}

function handleOf(user?: CommunityHeroUser | null) {
  return (
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    ''
  );
}

/**
 * Carte héro en verre de la Communauté.
 *
 * Elle reprend l'anatomie de la carte du Compte (avatar, identité, ligne de
 * contexte, actions en capsule) sans reprendre ses compteurs : la page ne
 * connaît que des **longueurs de page** (`limit(20)`, `limit(50)` —
 * `src/app/communaute/page.tsx:150,157,160`), jamais des totaux. Afficher
 * « 20 publications » comme un total serait un mensonge produit : le héro
 * n'affiche donc que des faits vérifiables (identité, prochaine sortie,
 * massifs réellement listés).
 */
export function CommunityHeroCard({
  user,
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

  return (
    <section className="lkdv-hero" aria-label="Votre communauté">
      <div className="lkdv-hero-id">
        <span className="lkdv-hero-avatar" aria-hidden="true">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" width={44} height={44} />
          ) : (
            <span className="lkdv-hero-initial">{initial}</span>
          )}
        </span>

        <div className="lkdv-hero-txt">
          <p className="lkdv-hero-name">{displayName}</p>
          <p className="lkdv-hero-context">
            {massifLine ? (
              <>
                <Icon name="map-pin" size={12} aria-hidden="true" /> Massifs des carnets récents · {massifLine}
              </>
            ) : (
              'Vos carnets, clubs et sorties, au même endroit.'
            )}
          </p>
        </div>

        <button
          type="button"
          className="lkdv-hero-context-btn"
          onClick={onOpenContext}
          aria-label="Ouvrir le contexte de la communauté"
        >
          <Icon name="layers" size={16} aria-hidden="true" />
        </button>
      </div>

      {nextEvent?.title ? (
        <div className="lkdv-hero-next">
          <Badge tone="sage" className="font-mono">
            {nextEvent.date || 'À venir'}
          </Badge>
          <p>
            <strong>Prochaine sortie</strong> · {nextEvent.title}
            {nextEvent.location ? ` · ${nextEvent.location}` : ''}
          </p>
        </div>
      ) : null}

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
          icon={<Icon name="Squares2X2Icon" size={14} aria-hidden="true" />}
        >
          Découvrir
        </Button>
      </div>
    </section>
  );
}

export default CommunityHeroCard;
