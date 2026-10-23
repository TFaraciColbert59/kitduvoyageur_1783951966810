'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import { AccountRoundButton } from '@/components/account/AccountRoundButton';

export interface CommunityFeedTopBarProps {
  user: any;
  onCreate: () => void;
}

/**
 * Barre supérieure du fil : notre pastille auteur (avatar + nom) à gauche,
 * le bouton rond `+` à droite (drawer de création du Compte).
 */
export function CommunityFeedTopBar({ user, onCreate }: CommunityFeedTopBarProps) {
  const handle =
    (user?.user_metadata?.username as string | undefined) ||
    (user?.email ? String(user.email).split('@')[0] : undefined);
  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    handle ||
    'Voyageur';
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) || undefined;

  return (
    <>
      <AccountAuthorPill
        name={name}
        handle={handle}
        avatarUrl={avatarUrl}
        href={user ? '/compte' : '/connexion'}
      />
      <AccountRoundButton label="Créer dans l’application" onClick={onCreate}>
        <Icon name="plus" size={18} aria-hidden="true" />
      </AccountRoundButton>
    </>
  );
}

export default CommunityFeedTopBar;
