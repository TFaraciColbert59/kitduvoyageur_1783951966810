'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  ChevronLeft,
  Compass,
  Eye,
  Flag,
  Hash,
  Package,
  Shield,
  Sliders,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { SlotShell } from '@/components/compte/drawer/SlotShell';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';
import { SortMenuButton } from '@/components/ui/drawer/SortMenuButton';
import type { ClubRole } from '@/features/clubs/types';
import { LensTransition } from '../ClubDrawerMotion';
import type {
  ClubChallengeItem,
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
  ClubToastPayload,
} from '../ClubDrawerTypes';
import type { AdminLensId, AdminPoleId } from './adminConfig';
import { useClubCapabilities } from './useClubCapabilities';
import { AdminOverviewPane } from './panes/AdminOverviewPane';
import { AdminSettingsPane } from './panes/AdminSettingsPane';
import { AdminSecurityAuditPane } from './panes/AdminSecurityAuditPane';
import { AdminMembersAccessPane } from './panes/AdminMembersAccessPane';
import { AdminSalonsPane } from './panes/AdminSalonsPane';
import { AdminModerationPane } from './panes/AdminModerationPane';
import { AdminEventsOpsPane } from './panes/AdminEventsOpsPane';
import { AdminLoansGearPane } from './panes/AdminLoansGearPane';
import { AdminBudgetPane } from './panes/AdminBudgetPane';
import { AdminChallengesPane } from './panes/AdminChallengesPane';
import { AdminTeamRolesPane } from './panes/AdminTeamRolesPane';
import { AdminRoleMatrixPane } from './panes/AdminRoleMatrixPane';

export interface ClubAdminDrawerShellProps {
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings?: ClubOutingData[];
  vaultGear?: ClubGearVaultItem[];
  challenges?: ClubChallengeItem[];
  currentUserId?: string | null;
  onBack?: () => void;
  onToggleClubVisibility?: () => void;
  onTransitionGearLoan?: (payload: {
    loanId: string;
    gearItemId: string;
    status: 'approved' | 'checked_out' | 'returned' | 'issue' | 'declined' | 'cancelled';
    checkoutCondition?: 'new' | 'good' | 'worn' | 'repair';
    returnCondition?: 'new' | 'good' | 'worn' | 'repair';
    conditionNote?: string;
  }) => Promise<boolean> | void;
  onChangeMemberRole?: (userId: string, role: ClubRole) => Promise<boolean> | void;
  onToggleMemberLeaderBadge?: (
    userId: string,
    isCertifiedLeader: boolean,
  ) => Promise<boolean> | void;
  onToast?: (toast: ClubToastPayload) => void;
}

function poleIcon(poleId: AdminPoleId) {
  switch (poleId) {
    case 'pilotage':
      return <Activity size={17} aria-hidden="true" />;
    case 'community':
      return <Users size={17} aria-hidden="true" />;
    case 'operations':
      return <Compass size={17} aria-hidden="true" />;
    case 'team':
      return <Shield size={17} aria-hidden="true" />;
  }
}

function lensIcon(lensId: AdminLensId) {
  switch (lensId) {
    case 'overview':
      return <Activity size={15} aria-hidden="true" />;
    case 'settings':
      return <Eye size={15} aria-hidden="true" />;
    case 'security-audit':
      return <Shield size={15} aria-hidden="true" />;
    case 'members-access':
      return <UserCheck size={15} aria-hidden="true" />;
    case 'salons':
      return <Hash size={15} aria-hidden="true" />;
    case 'moderation':
      return <Flag size={15} aria-hidden="true" />;
    case 'events-ops':
      return <Calendar size={15} aria-hidden="true" />;
    case 'loans-gear':
      return <Package size={15} aria-hidden="true" />;
    case 'budget':
      return <Wallet size={15} aria-hidden="true" />;
    case 'challenges':
      return <Trophy size={15} aria-hidden="true" />;
    case 'team-roles':
      return <Users size={15} aria-hidden="true" />;
    case 'role-matrix':
      return <Sliders size={15} aria-hidden="true" />;
  }
}

export function ClubAdminDrawerShell({
  activeClub,
  members,
  outings = [],
  vaultGear = [],
  challenges = [],
  currentUserId = null,
  onBack,
  onToggleClubVisibility,
  onTransitionGearLoan,
  onChangeMemberRole,
  onToggleMemberLeaderBadge,
  onToast,
}: ClubAdminDrawerShellProps) {
  const caps = useClubCapabilities(activeClub, currentUserId);
  const [poleIndex, setPoleIndex] = useState(0);
  const [lensByPole, setLensByPole] = useState<Record<string, number>>({});

  // Contextual bottom-right filters
  const [loanFilter, setLoanFilter] = useState<'all' | 'requested' | 'approved' | 'active'>('all');
  const [challengeFilter, setChallengeFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [budgetEventFilter, setBudgetEventFilter] = useState<string>('all');
  const [modStatusFilter, setModStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [teamRoleFilter, setTeamRoleFilter] = useState<'all' | ClubRole>('all');

  const visiblePoles = caps.visiblePoles;
  const safePoleIndex = Math.min(poleIndex, Math.max(0, visiblePoles.length - 1));
  const activePole = visiblePoles[safePoleIndex] ?? visiblePoles[0];
  const visibleLenses = useMemo(
    () => (activePole ? caps.visibleLensesForPole(activePole.id) : []),
    [activePole, caps],
  );
  const activeLensIndex = Math.min(
    lensByPole[activePole?.id ?? ''] ?? 0,
    Math.max(0, visibleLenses.length - 1),
  );
  const activeLens = visibleLenses[activeLensIndex] ?? visibleLenses[0];

  useEffect(() => {
    if (poleIndex !== safePoleIndex) setPoleIndex(safePoleIndex);
  }, [poleIndex, safePoleIndex]);

  const handleNavigateAdmin = (targetPoleId: AdminPoleId, targetLensId: AdminLensId) => {
    const pIdx = visiblePoles.findIndex((p) => p.id === targetPoleId);
    if (pIdx === -1) return;
    const targetLenses = caps.visibleLensesForPole(targetPoleId);
    const lIdx = targetLenses.findIndex((l) => l.id === targetLensId);
    setPoleIndex(pIdx);
    if (lIdx >= 0) {
      setLensByPole((prev) => ({ ...prev, [targetPoleId]: lIdx }));
    }
  };

  const bottomRightFilter = useMemo(() => {
    if (!activeLens) return null;
    if (activeLens.id === 'loans-gear') {
      return (
        <SortMenuButton
          label="Filtrer les prêts"
          value={loanFilter}
          defaultValue="all"
          onChange={(v) => setLoanFilter(v as typeof loanFilter)}
          options={[
            { value: 'all', label: 'Tous les prêts' },
            { value: 'requested', label: 'À valider' },
            { value: 'approved', label: 'Validés' },
            { value: 'active', label: 'Remis / En cours' },
          ]}
        />
      );
    }
    if (activeLens.id === 'challenges') {
      return (
        <SortMenuButton
          label="Filtrer les défis"
          value={challengeFilter}
          defaultValue="all"
          onChange={(v) => setChallengeFilter(v as typeof challengeFilter)}
          options={[
            { value: 'all', label: 'Tous les défis' },
            { value: 'active', label: 'En cours' },
            { value: 'ended', label: 'Terminés' },
          ]}
        />
      );
    }
    if (activeLens.id === 'budget') {
      return (
        <SortMenuButton
          label="Filtrer le budget"
          value={budgetEventFilter}
          defaultValue="all"
          onChange={setBudgetEventFilter}
          options={[
            { value: 'all', label: 'Tout le budget' },
            { value: 'global', label: 'Budget global club' },
            ...outings.map((o) => ({ value: o.id, label: o.title })),
          ]}
        />
      );
    }
    if (activeLens.id === 'moderation') {
      return (
        <SortMenuButton
          label="Filtrer les signalements"
          value={modStatusFilter}
          defaultValue="open"
          onChange={(v) => setModStatusFilter(v as typeof modStatusFilter)}
          options={[
            { value: 'open', label: 'Ouverts' },
            { value: 'resolved', label: 'Traités' },
            { value: 'all', label: 'Tous' },
          ]}
        />
      );
    }
    if (activeLens.id === 'team-roles') {
      return (
        <SortMenuButton
          label="Filtrer par grade"
          value={teamRoleFilter}
          defaultValue="all"
          onChange={(v) => setTeamRoleFilter(v as typeof teamRoleFilter)}
          options={[
            { value: 'all', label: 'Tous les grades' },
            { value: 'founder', label: 'Fondateur' },
            { value: 'admin', label: 'Administrateurs' },
            { value: 'moderator', label: 'Modérateurs' },
            { value: 'volunteer', label: 'Bénévoles' },
            { value: 'member', label: 'Membres' },
          ]}
        />
      );
    }
    return null;
  }, [activeLens, budgetEventFilter, challengeFilter, loanFilter, modStatusFilter, outings, teamRoleFilter]);

  if (!activePole || !activeLens) {
    return null;
  }

  return (
    <SlotShell
      slot={`admin-${activeLens.id}`}
      viewer="owner"
      title={activeLens.label}
      lenses={visibleLenses.map((l) => ({
        id: l.id,
        label: l.label,
        icon: lensIcon(l.id),
      }))}
      activeLensIndex={activeLensIndex}
      onLensChange={(idx) => {
        setLensByPole((prev) => ({ ...prev, [activePole.id]: idx }));
      }}
      selector={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
          {onBack ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 38, width: 38, padding: 0, flex: 'none', justifyContent: 'center' }}
              onClick={onBack}
              aria-label="Retour au club"
              title="Retour au club"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          ) : null}
          {visiblePoles.length > 1 ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <CapsuleTabs
                className="lkdv-slot-selector"
                items={visiblePoles.map((p) => ({
                  id: p.id,
                  label: p.label,
                  icon: poleIcon(p.id),
                }))}
                activeIndex={safePoleIndex}
                onIndexChange={setPoleIndex}
                ariaLabel="Pôles d’administration du club"
                size="default"
              />
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                height: 38,
                padding: '0 14px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.72)',
                border: '0.5px solid rgba(255, 255, 255, 0.9)',
                fontSize: 13,
                fontWeight: 700,
                color: '#17402c',
              }}
            >
              {poleIcon(activePole.id)}
              <span>{activePole.label}</span>
            </div>
          )}
        </div>
      }
      bottomRightFilter={bottomRightFilter}
      renderLens={(_lens, index) => {
        const currentLens = visibleLenses[index] ?? activeLens;
        return (
          <LensTransition transitionKey={`admin:${activePole.id}:${currentLens.id}`}>
            <div className="lkdv-carnet-drawer-pane" data-testid={`admin-pane-${currentLens.id}`}>
              {currentLens.id === 'overview' ? (
                <AdminOverviewPane
                  activeClub={activeClub}
                  members={members}
                  outings={outings}
                  vaultGear={vaultGear}
                  caps={caps}
                  onNavigateAdmin={handleNavigateAdmin}
                />
              ) : null}
              {currentLens.id === 'settings' ? (
                <AdminSettingsPane
                  activeClub={activeClub}
                  caps={caps}
                  onToggleClubVisibility={onToggleClubVisibility}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'security-audit' ? (
                <AdminSecurityAuditPane
                  activeClub={activeClub}
                  members={members}
                  currentUserId={currentUserId}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'members-access' ? (
                <AdminMembersAccessPane
                  activeClub={activeClub}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'salons' ? (
                <AdminSalonsPane
                  activeClub={activeClub}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'moderation' ? (
                <AdminModerationPane
                  activeClub={activeClub}
                  caps={caps}
                  statusFilter={modStatusFilter}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'events-ops' ? (
                <AdminEventsOpsPane
                  activeClub={activeClub}
                  outings={outings}
                  members={members}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'loans-gear' ? (
                <AdminLoansGearPane
                  vaultGear={vaultGear}
                  loanFilter={loanFilter}
                  caps={caps}
                  onTransitionGearLoan={onTransitionGearLoan}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'budget' ? (
                <AdminBudgetPane
                  activeClub={activeClub}
                  outings={outings}
                  eventFilter={budgetEventFilter}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'challenges' ? (
                <AdminChallengesPane
                  activeClub={activeClub}
                  challenges={challenges}
                  challengeFilter={challengeFilter}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'team-roles' ? (
                <AdminTeamRolesPane
                  activeClub={activeClub}
                  members={members}
                  currentUserId={currentUserId}
                  roleFilter={teamRoleFilter}
                  caps={caps}
                  onChangeMemberRole={onChangeMemberRole}
                  onToggleMemberLeaderBadge={onToggleMemberLeaderBadge}
                  onToast={onToast}
                />
              ) : null}
              {currentLens.id === 'role-matrix' ? (
                <AdminRoleMatrixPane
                  activeClub={activeClub}
                  caps={caps}
                  onToast={onToast}
                />
              ) : null}
            </div>
          </LensTransition>
        );
      }}
    />
  );
}
