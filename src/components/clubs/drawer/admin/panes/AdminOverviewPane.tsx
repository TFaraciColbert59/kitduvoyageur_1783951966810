'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  Flag,
  Package,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  CLUB_ROLE_LABELS,
  type ClubBudgetEntry,
  type ClubContentReport,
} from '@/features/clubs/types';
import { AnimatedNumber } from '../../ClubDrawerMotion';
import type {
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
} from '../../ClubDrawerTypes';
import type { AdminLensId, AdminPoleId } from '../adminConfig';
import { AdminStatusPill } from '../AdminPrimitives';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminOverviewPaneProps {
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  caps: UseClubCapabilitiesResult;
  onNavigateAdmin: (poleId: AdminPoleId, lensId: AdminLensId) => void;
}

interface OverviewLiveMetrics {
  balanceCents: number | null;
  pendingBudgetCount: number;
  openReportsCount: number | null;
}

export function AdminOverviewPane({
  activeClub,
  members,
  outings,
  vaultGear,
  caps,
  onNavigateAdmin,
}: AdminOverviewPaneProps) {
  const canBudget = caps.has('budget.view') || caps.has('budget.approve_and_manage');
  const canMod = caps.has('moderation.resolve_reports') || caps.has('salons.moderate_messages');

  const [live, setLive] = useState<OverviewLiveMetrics>({
    balanceCents: null,
    pendingBudgetCount: 0,
    openReportsCount: null,
  });

  useEffect(() => {
    setLive({
      balanceCents: null,
      pendingBudgetCount: 0,
      openReportsCount: null,
    });
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let active = true;
    const tasks: Promise<void>[] = [];

    if (canBudget) {
      tasks.push(
        fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/budget`, {
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((payload: { data?: { entries?: ClubBudgetEntry[] } } | null) => {
            if (!active || !payload?.data?.entries) return;
            let inc = 0;
            let exp = 0;
            let pending = 0;
            for (const e of payload.data.entries) {
              if (e.status === 'rejected') continue;
              if (e.status === 'proposed') {
                pending += 1;
                continue;
              }
              if (e.kind === 'income') inc += e.amountCents;
              else exp += e.amountCents;
            }
            setLive((prev) => ({
              ...prev,
              balanceCents: inc - exp,
              pendingBudgetCount: pending,
            }));
          })
          .catch(() => {}),
      );
    }

    if (canMod) {
      tasks.push(
        fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/moderation?status=open`, {
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((payload: { data?: { reports?: ClubContentReport[] } } | null) => {
            if (!active || !payload?.data?.reports) return;
            setLive((prev) => ({
              ...prev,
              openReportsCount: payload.data!.reports!.length,
            }));
          })
          .catch(() => {}),
      );
    }

    if (tasks.length > 0) {
      void Promise.allSettled(tasks);
    }
    return () => {
      active = false;
    };
  }, [activeClub.id, canBudget, canMod]);

  const pendingRequests = activeClub.pendingRequestsCount ?? 0;
  const pendingLoans = vaultGear.filter((g) => g.loanStatus === 'requested').length;
  const activeLoans = vaultGear.filter(
    (g) => g.loanStatus === 'checked_out' || g.loanStatus === 'overdue',
  ).length;
  const clubGearCount = vaultGear.filter((g) => g.ownershipScope === 'club').length;
  const upcomingOutings = outings.filter((o) => o.status === 'upcoming' || o.status === 'live');
  const nextOuting = upcomingOutings[0] ?? null;
  const nextOutingPct = nextOuting
    ? Math.min(100, Math.round((nextOuting.participantsCount / Math.max(1, nextOuting.maxParticipants)) * 100))
    : 0;

  interface BentoCard {
    id: string;
    visible: boolean;
    label: string;
    icon: React.ReactNode;
    poleId: AdminPoleId;
    lensId: AdminLensId;
    metric: React.ReactNode;
    alert?: { text: string; tone: 'sage' | 'warn' | 'danger' };
    progress?: { value: number; tone: 'sage' | 'warn' | 'danger'; label: string };
    foot?: string;
  }

  const rawCards: BentoCard[] = [
    {
      id: 'requests',
      visible: caps.has('members.review_requests'),
      label: 'Adhésions',
      icon: <Users size={15} aria-hidden="true" />,
      poleId: 'community',
      lensId: 'members-access',
      metric: <AnimatedNumber value={pendingRequests} />,
      alert: pendingRequests > 0 ? { text: 'À valider', tone: 'warn' } : undefined,
      foot: pendingRequests > 0 ? 'Demandes en attente' : 'À jour',
    },
    {
      id: 'loans',
      visible: caps.has('gear.approve_club_loans') || caps.has('gear.manage_club_inventory'),
      label: 'Prêts matériel',
      icon: <Package size={15} aria-hidden="true" />,
      poleId: 'operations',
      lensId: 'loans-gear',
      metric: <AnimatedNumber value={pendingLoans} />,
      alert: pendingLoans > 0 ? { text: 'En attente', tone: 'warn' } : undefined,
      foot: `${activeLoans} en cours · ${clubGearCount} parc`,
    },
    {
      id: 'events',
      visible: caps.has('volunteers.manage_shifts') || caps.has('events.manage_registrations'),
      label: 'Prochaine sortie',
      icon: <Calendar size={15} aria-hidden="true" />,
      poleId: 'operations',
      lensId: 'events-ops',
      metric: nextOuting ? (
        <span>
          <AnimatedNumber value={nextOuting.participantsCount} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--label2)' }}>
            /{nextOuting.maxParticipants}
          </span>
        </span>
      ) : (
        '—'
      ),
      progress: nextOuting
        ? {
            value: nextOutingPct,
            tone: nextOutingPct >= 90 ? 'warn' : 'sage',
            label: `Remplissage ${nextOuting.title}`,
          }
        : undefined,
      foot: nextOuting ? nextOuting.title : 'Aucune planifiée',
    },
    {
      id: 'budget',
      visible: canBudget,
      label: 'Budget',
      icon: <Wallet size={15} aria-hidden="true" />,
      poleId: 'operations',
      lensId: 'budget',
      metric:
        live.balanceCents !== null ? (
          <AnimatedNumber
            value={live.balanceCents / 100}
            suffix=" €"
            maximumFractionDigits={0}
          />
        ) : (
          '— €'
        ),
      alert:
        live.pendingBudgetCount > 0
          ? { text: `${live.pendingBudgetCount} à valider`, tone: 'warn' }
          : undefined,
      foot: live.balanceCents !== null ? 'Solde consolidé' : 'Ouvrir le suivi',
    },
    {
      id: 'moderation',
      visible: canMod,
      label: 'Modération',
      icon: <Flag size={15} aria-hidden="true" />,
      poleId: 'community',
      lensId: 'moderation',
      metric:
        live.openReportsCount !== null ? (
          <AnimatedNumber value={live.openReportsCount} />
        ) : (
          <AnimatedNumber value={0} />
        ),
      alert:
        (live.openReportsCount ?? 0) > 0
          ? { text: 'Signalement', tone: 'danger' }
          : undefined,
      foot: (live.openReportsCount ?? 0) > 0 ? 'Action requise' : 'RAS',
    },
    {
      id: 'team',
      visible: caps.has('members.manage_roles') || caps.has('permissions.delegate'),
      label: 'Équipe',
      icon: <Shield size={15} aria-hidden="true" />,
      poleId: 'team',
      lensId: 'team-roles',
      metric: <AnimatedNumber value={members.length} suffix=" mbr" />,
      foot: 'Grades & droits',
    },
  ];
  const cards = rawCards.filter((c) => c.visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="club-glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 14px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--label2, #56665d)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeClub.name}
          </span>
          <b
            style={{
              fontSize: 17,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--tint, #17402c)',
              display: 'block',
            }}
          >
            {caps.effectiveRole ? CLUB_ROLE_LABELS[caps.effectiveRole] : 'Staff'}
          </b>
        </div>
        <AdminStatusPill tone="sage">
          {cards.length} modules
        </AdminStatusPill>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
        }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onNavigateAdmin(card.poleId, card.lensId)}
            className="club-glass-card"
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 6,
              padding: '10px 11px',
              border: '0.5px solid rgba(255, 255, 255, 0.78)',
              minHeight: 88,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--tint, #17402c)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, minWidth: 0 }}>
                {card.icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.label}
                </span>
              </span>
              <ArrowUpRight size={13} aria-hidden="true" style={{ opacity: 0.55, flex: 'none' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--label, #172b24)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {card.metric}
              </div>
              {card.alert ? (
                <AdminStatusPill tone={card.alert.tone}>{card.alert.text}</AdminStatusPill>
              ) : null}
            </div>

            {card.progress ? (
              <ProgressBar
                value={card.progress.value}
                tone={card.progress.tone}
                label={card.progress.label}
              />
            ) : null}

            {card.foot ? (
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--label2, #56665d)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {card.foot}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
