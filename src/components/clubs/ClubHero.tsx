'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface ClubHeroProps {
  club: {
    id: string;
    name: string;
    type?: string;
    emoji?: string;
    description?: string;
    category?: string;
    privacy?: string;
    is_verified?: boolean;
    members_count?: number;
    active_this_month?: number;
    cover_image?: string;
    location?: string;
  };
  eventsCount?: number;
  isMember?: boolean;
  joining?: boolean;
  onToggleMember?: () => void;
  onShare?: () => void;
}

export default function ClubHero({
  club,
  eventsCount = 0,
  isMember = false,
  joining = false,
  onToggleMember,
  onShare,
}: ClubHeroProps) {
  const membersCount = club.members_count || 1;
  const isOnline = club.active_this_month || 0;

  return (
    <div className="lkc lkc-hero flex flex-col items-start justify-between gap-6 p-8 sm:p-10 md:flex-row md:items-end">
      <div className="relative z-10 max-w-2xl">
        <p className="lkc-eyebrow mb-5">
          {club.type === 'pays' ? 'Destination' : 'Activité'} · {membersCount} membres · {club.privacy === 'open' ? 'Public' : 'Privé'}
        </p>

        <h1 className="lkc-title mb-5 text-4xl sm:text-5xl">
          {club.name}
          <br />
          <em>{club.category || 'Collectif outdoor'}</em>
        </h1>

        {club.description && <p className="lkc-sub mb-8 max-w-xl">{club.description}</p>}

        <dl className="lkc-stats m-0">
          <div className="lkc-stat"><b>{membersCount}</b><span>Membres</span></div>
          <div className="lkc-stat"><b>{isOnline}</b><span>Actifs ce mois</span></div>
          <div className="lkc-stat"><b>{eventsCount}</b><span>Sorties</span></div>
          <div className="lkc-stat"><b className="max-w-[140px] truncate">{club.location || 'Monde'}</b><span>Lieu</span></div>
        </dl>
      </div>

      <div className="relative z-10 flex w-full flex-col items-end gap-4 md:w-auto">
        <div className="lkc-emblem lkc-emblem--xl" aria-hidden>
          {club.cover_image ? <img src={club.cover_image || '/assets/images/no_image.png'} alt="" /> : club.emoji || '🏕️'}
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          {onShare && (
            <button type="button" className="lkc-icon-btn" onClick={onShare} aria-label="Partager le club">
              <Icon name="ShareIcon" size={16} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={`lkc-btn w-full md:w-auto ${isMember ? 'lkc-btn--glass' : ''}`}
            onClick={onToggleMember}
            disabled={joining}
          >
            {joining ? 'Patientez…' : isMember ? '✓ Membre du club' : '＋ Rejoindre le club'}
          </button>
        </div>
      </div>
    </div>
  );
}
