'use client';

import React from 'react';
import {
  ArrowUpRight,
  Calendar,
  Flag,
  Package,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { CLUB_ROLE_LABELS } from '@/features/clubs/types';
import type {
  ClubGearVaultItem,
  ClubItemData,
  ClubMemberData,
  ClubOutingData,
} from '../../ClubDrawerTypes';
import type { AdminLensId, AdminPoleId } from '../adminConfig';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

export interface AdminOverviewPaneProps {
  activeClub: ClubItemData;
  members: ClubMemberData[];
  outings: ClubOutingData[];
  vaultGear: ClubGearVaultItem[];
  caps: UseClubCapabilitiesResult;
  onNavigateAdmin: (poleId: AdminPoleId, lensId: AdminLensId) => void;
}

export function AdminOverviewPane({
  activeClub,
  members,
  outings,
  vaultGear,
  caps,
  onNavigateAdmin,
}: AdminOverviewPaneProps) {
  const pendingRequests = activeClub.pendingRequestsCount ?? 0;
  const pendingLoans = vaultGear.filter((g) => g.loanStatus === 'requested').length;
  const upcomingOutings = outings.filter((o) => o.status === 'upcoming' || o.status === 'live');
  const nextOuting = upcomingOutings[0] ?? null;

  const allCards: Array<{
    id: string;
    visible: boolean;
    label: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    poleId: AdminPoleId;
    lensId: AdminLensId;
  }> = [
    {
      id: 'requests',
      visible: caps.has('members.review_requests'),
      label: 'Adhésions en attente',
      value: String(pendingRequests),
      sub: pendingRequests > 0 ? 'Demandes à traiter' : 'Aucune demande en attente',
      icon: <Users size={16} aria-hidden="true" />,
      poleId: 'community',
      lensId: 'members-access',
    },
    {
      id: 'loans',
      visible: caps.has('gear.approve_club_loans') || caps.has('gear.manage_club_inventory'),
      label: 'Prêts matériel',
      value: String(pendingLoans),
      sub: `${vaultGear.filter((g) => g.ownershipScope === 'club').length} équipements parc club`,
      icon: <Package size={16} aria-hidden="true" />,
      poleId: 'operations',
      lensId: 'loans-gear',
    },
    {
      id: 'events',
      visible: caps.has('volunteers.manage_shifts') || caps.has('events.manage_registrations'),
      label: 'Prochain événement',
      value: nextOuting ? `${nextOuting.participantsCount}/${nextOuting.maxParticipants}` : '—',
      sub: nextOuting ? nextOuting.title : 'Aucune sortie planifiée',
      icon: <Calendar size={16} aria-hidden="true" />,
      poleId: 'operations',
      lensId: 'events-ops',
    },
    {
      id: 'budget',
      visible: caps.has('budget.view') || caps.has('budget.approve_and_manage'),
      label: 'Budget collaboratif',
      value: 'Suivi',
      sub: caps.has('budget.approve_and_manage')
        ? 'Valider, payer & exporter CSV'
        : 'Consulter & proposer une ligne',
      icon: <Wallet size={16} aria-hidden="true" />,
      poleId: 'operations',
      lensId: 'budget',
    },
    {
      id: 'moderation',
      visible: caps.has('moderation.resolve_reports') || caps.has('salons.moderate_messages'),
      label: 'Modération',
      value: 'Veille',
      sub: 'File des signalements & sourdines',
      icon: <Flag size={16} aria-hidden="true" />,
      poleId: 'community',
      lensId: 'moderation',
    },
    {
      id: 'team',
      visible: caps.has('members.manage_roles') || caps.has('permissions.delegate'),
      label: 'Équipe & Droits',
      value: `${members.length} mbr`,
      sub: 'Grades, surcharges & matrice des rôles',
      icon: <Shield size={16} aria-hidden="true" />,
      poleId: 'team',
      lensId: 'team-roles',
    },
  ];
  const cards = allCards.filter((c) => c.visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        className="club-glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '14px 16px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#56665d',
              display: 'block',
            }}
          >
            {activeClub.name}
          </span>
          <b
            style={{
              fontSize: 22,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: '#17402c',
              display: 'block',
              marginTop: 2,
            }}
          >
            {caps.effectiveRole ? CLUB_ROLE_LABELS[caps.effectiveRole] : 'Staff'}
          </b>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
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
              gap: 6,
              padding: 12,
              border: '0.5px solid rgba(255, 255, 255, 0.78)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#17402c' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700 }}>
                {card.icon}
                <span>{card.label}</span>
              </span>
              <ArrowUpRight size={14} aria-hidden="true" style={{ opacity: 0.6 }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.02em' }}>
              {card.value}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--label2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.sub}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
