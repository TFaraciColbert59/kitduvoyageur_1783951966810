'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface ClubCardItem {
  id: string;
  slug?: string;
  name: string;
  type?: string;
  emoji?: string;
  description: string;
  cover_image?: string;
  cover_color?: string;
  category?: string;
  members_count: number;
  active_this_month?: number;
  is_verified?: boolean;
  is_member?: boolean;
}

interface MobileClubCardProps {
  club: ClubCardItem;
  isMember?: boolean;
  onJoin?: (clubId: string) => Promise<void> | void;
  joining?: boolean;
}

export default function MobileClubCard({
  club,
  isMember = false,
  onJoin,
  joining = false,
}: MobileClubCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const clubHref = `/clubs/${club.slug || club.id}`;

  return (
    <article className="lkc lkc-card lkc-card--lift flex flex-col gap-3 p-4 motion-reduce:transition-none">
      <div className="flex items-start gap-3">
        <div className="lkc-emblem lkc-emblem--md" aria-hidden>
          {club.cover_image ? <img src={club.cover_image || '/assets/images/no_image.png'} alt="" /> : club.emoji || '🏕️'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="lkc-eyebrow mb-1 truncate" style={{ letterSpacing: '0.1em' }}>
            {club.type === 'pays' ? 'Destination' : 'Activité'}
            {club.category ? ` · ${club.category}` : ''}
          </p>
          <h3 className="lkc-title flex items-center gap-1 text-lg">
            <Link
              href={clubHref}
              onClick={() => triggerHaptic('light')}
              className="truncate after:absolute after:inset-0 after:content-['']"
            >
              {club.name}
            </Link>
            {club.is_verified && <span className="shrink-0 text-sm" title="Club vérifié">✓</span>}
          </h3>
        </div>
        {isMember && <span className="lkc-chip lkc-chip--sage shrink-0">Membre</span>}
      </div>

      {club.description && <p className="lkc-sub line-clamp-2 text-sm">{club.description}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--lkc-sep)] pt-3">
        <div className="lkc-stat">
          <b className="text-base">{club.members_count || 1}</b>
          <span>
            membres{club.active_this_month ? ` · ${club.active_this_month} actifs` : ''}
          </span>
        </div>

        {isMember ? (
          <Link href={clubHref} onClick={() => triggerHaptic('light')} className="lkc-btn lkc-btn--glass lkc-btn--sm relative z-10">
            <span>Ouvrir</span>
            <Icon name="ArrowRightIcon" size={12} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            className="lkc-btn lkc-btn--sm relative z-10"
            disabled={joining}
            onClick={() => {
              triggerHaptic('selection');
              if (onJoin) onJoin(club.id);
            }}
          >
            {joining ? '…' : '+ Rejoindre'}
          </button>
        )}
      </div>
    </article>
  );
}
