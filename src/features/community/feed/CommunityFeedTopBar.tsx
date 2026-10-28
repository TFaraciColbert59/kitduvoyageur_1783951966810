'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { PourToiMenu } from '@/features/community/sections/PourToiMenu';
import type { SectionTabId } from '@/features/community/sections/sectionTabs';
import { useAccountUnreadCount } from './useAccountUnreadCount';

export interface CommunityFeedTopBarProps {
  user: any;
  onCreate: () => void;
  onOpenSection: (id: Exclude<SectionTabId, 'pour-toi'>) => void;
  onSearch: () => void;
  /** Appelé au premier appui : permet de précharger les drawers avant le clic. */
  onPrefetch?: () => void;
}

/**
 * « Pour toi » + menu sections ; +, recherche, cloche (drawer Notifications du Compte).
 */
export function CommunityFeedTopBar({ user, onCreate, onOpenSection, onSearch, onPrefetch }: CommunityFeedTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = useAccountUnreadCount(user?.id);

  return (
    <>
      <div className="lkdv-pourtoi-wrap">
        <button
          type="button"
          className="lkdv-pourtoi-pill"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span>Pour toi</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M7 10l5 5 5-5" />
          </svg>
        </button>
        <PourToiMenu open={menuOpen} onSelect={onOpenSection} onClose={() => setMenuOpen(false)} />
      </div>

      <div className="lkdv-top-actions">
        <button type="button" className="gbtn" aria-label="Créer dans l’application" onPointerDown={onPrefetch} onClick={onCreate}>
          <Icon name="plus" size={18} aria-hidden="true" />
        </button>
        <button type="button" className="gbtn" aria-label="Rechercher dans la communauté" onPointerDown={onPrefetch} onClick={onSearch}>
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
