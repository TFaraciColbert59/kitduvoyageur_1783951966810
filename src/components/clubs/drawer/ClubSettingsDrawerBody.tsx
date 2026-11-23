'use client';

import React from 'react';
import type { ClubRole } from '@/features/clubs/types';
import type {
  ClubChallengeItem,
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
} from './ClubDrawerTypes';
import { ClubAdminDrawerShell } from './admin/ClubAdminDrawerShell';

export interface ClubSettingsDrawerBodyProps {
  activeSubTab?: number;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings?: ClubOutingData[];
  vaultGear?: ClubGearVaultItem[];
  challenges?: ClubChallengeItem[];
  currentUserId?: string | null;
  loanFilter?: 'all' | 'requested' | 'approved' | 'active';
  challengeFilter?: 'all' | 'active' | 'ended';
  onBack?: () => void;
  onToggleClubVisibility: () => void;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
  onChangeMemberRole?: (userId: string, role: ClubRole) => Promise<boolean> | void;
  onToggleMemberStoryPermission?: (
    userId: string,
    canManageStories: boolean,
  ) => Promise<boolean> | void;
  onToggleMemberGearPermission?: (
    userId: string,
    canManageGear: boolean,
  ) => Promise<boolean> | void;
  onToggleMemberLeaderBadge?: (
    userId: string,
    isCertifiedLeader: boolean,
  ) => Promise<boolean> | void;
  onToast?: (toast: ClubToastPayload) => void;
}

/**
 * Wrapper de compatibilité vers le nouvel espace Administration modulaire (`ClubAdminDrawerShell`).
 */
export function ClubSettingsDrawerBody({
  activeClub,
  members,
  outings,
  vaultGear,
  challenges,
  currentUserId,
  onBack,
  onToggleClubVisibility,
  onTransitionGearLoan,
  onChangeMemberRole,
  onToggleMemberLeaderBadge,
  onToast,
}: ClubSettingsDrawerBodyProps) {
  return (
    <ClubAdminDrawerShell
      activeClub={activeClub}
      members={members}
      outings={outings}
      vaultGear={vaultGear}
      challenges={challenges}
      currentUserId={currentUserId}
      onBack={onBack}
      onToggleClubVisibility={onToggleClubVisibility}
      onTransitionGearLoan={onTransitionGearLoan}
      onChangeMemberRole={onChangeMemberRole}
      onToggleMemberLeaderBadge={onToggleMemberLeaderBadge}
      onToast={onToast}
    />
  );
}

export default ClubSettingsDrawerBody;
