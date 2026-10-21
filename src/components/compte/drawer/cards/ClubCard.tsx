'use client';

import React from 'react';
import { communityInitial, formatCommunityDate, pluralizeCommunity } from './communityFormat';

export interface ClubNextEvent {
  id?: string;
  title?: string | null;
  event_date?: string | null;
  location?: string | null;
  /** Forme normalisée par le bootstrap. */
  participants?: number | null;
  max?: number | null;
  /** Forme brute de `club_events`, également acceptée. */
  participants_count?: number | null;
  max_participants?: number | null;
}

export interface ClubTopic {
  id: string;
  title: string;
  is_pinned?: boolean | null;
}

export interface ClubRecommendedKit {
  id: string;
  name?: string | null;
  title?: string | null;
  items?: number | null;
}

export interface Club {
  id: string;
  n: string;
  role?: string | null;
  members?: number | null;
  joined?: boolean | null;
  nextEvent?: ClubNextEvent | null;
  topics?: ClubTopic[];
  recommendedKits?: ClubRecommendedKit[];
  recommended_kits?: ClubRecommendedKit[];
  /** Optionnels : la spec les mentionne, le bootstrap peut les fournir. */
  category?: string | null;
  emoji?: string | null;
}

export interface ClubCardProps {
  club: Club;
  onOpen: (club: Club) => void;
}

/**
 * Carte du rail club : 78 % de la largeur du rail, snap start, cible tactile
 * unique (bouton) de 44 px minimum. Aucune catégorie ni aucun emoji inventé.
 */
export function ClubCard({ club, onOpen }: ClubCardProps) {
  const name = club.n?.trim() || 'Club';
  const role = club.role?.trim();
  const members = Math.max(0, Number(club.members ?? 0));
  const event = club.nextEvent;
  const eventTitle = event?.title?.trim();
  const eventDate = formatCommunityDate(event?.event_date);
  const eventLocation = event?.location?.trim();

  return (
    <div
      className="lkdv-club-item"
      data-testid="club-card"
      role="listitem"
      style={{ flexBasis: '78%', flexGrow: 0, flexShrink: 0 }}
    >
      <button
        type="button"
        className="lkdv-club-card"
        onClick={() => onOpen(club)}
        aria-label={`Ouvrir le club ${name}`}
      >
        <span className="lkdv-club-top">
          <span className="lkdv-club-badge" aria-hidden="true">
            {club.emoji?.trim() || communityInitial(name)}
          </span>
          {role ? <span className="lkdv-club-role">{role}</span> : null}
        </span>

        <span className="lkdv-club-name">{name}</span>
        {club.category?.trim() ? <span className="lkdv-club-cat">{club.category.trim()}</span> : null}
        <span className="lkdv-club-members">
          {members > 0 ? pluralizeCommunity(members, 'membre') : 'Membres non communiqués'}
        </span>

        <span className="lkdv-club-next">
          <span className="lkdv-club-next-label">Prochain événement</span>
          {eventTitle ? (
            <>
              <b>{eventTitle}</b>
              <small>{[eventDate, eventLocation].filter(Boolean).join(' · ')}</small>
            </>
          ) : (
            <small>Aucun événement à venir</small>
          )}
        </span>

        <span className="lkdv-club-open">
          Ouvrir le club
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </button>
    </div>
  );
}

export default ClubCard;
