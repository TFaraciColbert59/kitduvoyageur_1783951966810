'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PourToiMenu } from '@/features/community/sections/PourToiMenu';
import type { SectionTabId } from '@/features/community/sections/CommunityTabSelector';
import { useAccountUnreadCount } from './useAccountUnreadCount';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CommunityFeedTopBarProps {
  user: any;
  onCreate: () => void;
  onOpenSection: (id: Exclude<SectionTabId, 'pour-toi'>) => void;
  onSearch: () => void;
}

/**
 * « Pour toi » + menu sections ; +, recherche, cloche (drawer Notifications du Compte).
 */
export function CommunityFeedTopBar({ user, onCreate, onOpenSection, onSearch }: CommunityFeedTopBarProps) {
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
          <LKDVIcon name="bas" size={14} aria-hidden="true" />
        </button>
        <PourToiMenu open={menuOpen} onSelect={onOpenSection} onClose={() => setMenuOpen(false)} />
      </div>

      <div className="lkdv-top-actions">
        <button type="button" className="gbtn" aria-label="Créer dans l’application" onClick={onCreate}>
          <LKDVIcon name="plus" size={18} aria-hidden="true" />
        </button>
        <button type="button" className="gbtn" aria-label="Rechercher dans la communauté" onClick={onSearch}>
          <LKDVIcon name="recherche" size={17} aria-hidden="true" />
        </button>
        <Link
          href="/compte?tab=notifications"
          className="lkdv-notif-wrap gbtn"
          aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        >
          <LKDVIcon name="notifications" size={17} aria-hidden="true" />
          {unread > 0 ? <span className="lkdv-notif-badge">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
      </div>
    </>
  );
}

export default CommunityFeedTopBar;
