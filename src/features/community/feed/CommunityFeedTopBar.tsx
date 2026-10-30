'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { SectionTabId } from '@/features/community/sections/CommunityTabSelector';
import { useAccountUnreadCount } from './useAccountUnreadCount';

export interface CommunityFeedTopBarProps {
  user: any;
  onCreate: () => void;
  onOpenSection: (id: SectionTabId) => void;
  onSearch: () => void;
}

/**
 * « Explorer » (ouvre directement la recherche de l'Explorer) ; +, recherche,
 * cloche (drawer Notifications du Compte).
 */
export function CommunityFeedTopBar({ user, onCreate, onOpenSection, onSearch }: CommunityFeedTopBarProps) {
  const unread = useAccountUnreadCount(user?.id);

  return (
    <>
      <div className="lkdv-pourtoi-wrap gap-1.5">
        <button
          type="button"
          className="lkdv-pourtoi-pill"
          aria-label="Explorer et rechercher"
          onClick={() => onOpenSection('carnets')}
        >
          <span>Explorer</span>
        </button>
        <Link
          href="/communaute/reels"
          className="lkdv-pourtoi-pill text-[#17402C] hover:text-[#FF4A6E] transition-colors"
          aria-label="Ouvrir Freedom Reels plein écran"
        >
          <span className="flex items-center gap-1.5 font-bold">
            <span className="size-2 rounded-full bg-[#FF4A6E]" />
            Freedom
          </span>
        </Link>
      </div>

      <div className="lkdv-top-actions">
        <button type="button" className="gbtn" aria-label="Créer dans l’application" onClick={onCreate}>
          <Icon name="plus" size={18} aria-hidden="true" />
        </button>
        <button type="button" className="gbtn" aria-label="Rechercher dans la communauté" onClick={onSearch}>
          <Icon name="search" size={17} aria-hidden="true" />
        </button>
        <Link
          href="/compte?tab=notifications"
          className="lkdv-notif-wrap gbtn"
          aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        >
          <Icon name="bell" size={17} aria-hidden="true" />
          {unread > 0 ? <span className="lkdv-notif-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
      </div>
    </>
  );
}

export default CommunityFeedTopBar;
