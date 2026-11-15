'use client';

import React from 'react';

import type { Club, ClubMember } from '@/features/clubs';
import { ClubIdentityHeader } from './ClubIdentity';
import styles from './g02.module.css';

export type ClubG02Section =
  | 'events'
  | 'salons'
  | 'challenges'
  | 'leaderboard'
  | 'members'
  | 'invites'
  | 'matching';

export interface ClubG02NavItem {
  id: ClubG02Section;
  label: string;
}

export const CLUB_G02_SECTIONS: readonly ClubG02NavItem[] = [
  { id: 'events', label: 'Sorties' },
  { id: 'salons', label: 'Salons' },
  { id: 'challenges', label: 'Défis' },
  { id: 'leaderboard', label: 'Classement' },
  { id: 'members', label: 'Membres' },
  { id: 'invites', label: 'Invitations' },
  { id: 'matching', label: 'Activités' },
];

export interface ClubG02ScreenProps {
  club: Club;
  memberCount: number;
  eventCount: number;
  challengeCount: number;
  viewerMembership?: ClubMember | null;
  activeSection: ClubG02Section;
  onSectionChange: (section: ClubG02Section) => void;
  onInvite?: () => void;
  sportContext?: string | null;
  children: React.ReactNode;
}

/**
 * Écran dédié d’un club (Lot G02) : identité, navigation par sections et
 * surface de contenu. Les sections sont des capsules accessibles (rôle tab)
 * et le contenu est fourni par les panneaux spécialisés. Aucune donnée n’est
 * chargée ici : le parent serveur applique `canViewClub` avant de monter
 * l’écran.
 */
export function ClubG02Screen({
  club,
  memberCount,
  eventCount,
  challengeCount,
  viewerMembership = null,
  activeSection,
  onSectionChange,
  onInvite,
  sportContext = null,
  children,
}: ClubG02ScreenProps) {
  return (
    <div className={styles.screen}>
      <ClubIdentityHeader
        club={club}
        memberCount={memberCount}
        eventCount={eventCount}
        challengeCount={challengeCount}
        viewerMembership={viewerMembership}
        sportContext={sportContext}
        onInvite={onInvite}
      />

      <nav className={styles.tabs} role="tablist" aria-label="Sections du club">
        {CLUB_G02_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`club-tab-${section.id}`}
            aria-selected={activeSection === section.id}
            aria-controls={`club-panel-${section.id}`}
            className={styles.tab}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        id={`club-panel-${activeSection}`}
        aria-labelledby={`club-tab-${activeSection}`}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

export default ClubG02Screen;
