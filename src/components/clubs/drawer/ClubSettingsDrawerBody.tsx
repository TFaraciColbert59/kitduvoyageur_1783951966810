'use client';

import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Compass,
  Eye,
  Lock,
  Package,
  Search,
  Shield,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { ClubEmptyCard, normalizeSearchText } from './ClubSharedUi';
import type { ClubItemData, ClubMemberData, ClubToastPayload } from './ClubDrawerTypes';
import type { ClubRole } from '@/features/clubs/types';

export interface ClubSettingsDrawerBodyProps {
  activeSubTab: number;
  activeClub: ClubItemData;
  members: ClubMemberData[];
  currentUserId?: string | null;
  onToggleClubVisibility: () => void;
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

function roleLabel(raw?: ClubRole | null, fallback?: string): string {
  switch (raw) {
    case 'founder':
      return 'Fondateur';
    case 'admin':
      return 'Admin · Bureau';
    case 'moderator':
      return 'Modérateur';
    case 'member':
      return 'Membre';
    default:
      return fallback || 'Membre';
  }
}

export function ClubSettingsDrawerBody({
  activeSubTab,
  activeClub,
  members,
  currentUserId,
  onToggleClubVisibility,
  onChangeMemberRole,
  onToggleMemberStoryPermission,
  onToggleMemberGearPermission,
  onToggleMemberLeaderBadge,
  onToast,
}: ClubSettingsDrawerBodyProps) {
  const [memberSearch, setMemberSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isFounder = Boolean(
    currentUserId && (activeClub.createdBy === currentUserId || activeClub.viewerRole === 'founder'),
  );
  const canEditGovernance = Boolean(
    isFounder || activeClub.viewerRole === 'admin',
  );

  const filteredMembers = useMemo(() => {
    const q = normalizeSearchText(memberSearch.trim());
    return members.filter((m) => {
      if (!q) return true;
      return normalizeSearchText(`${m.name} ${m.handle} ${m.role}`).includes(q);
    });
  }, [members, memberSearch]);

  const mutedMembers = useMemo(
    () => members.filter((m) => Boolean(m.mutedUntil)),
    [members],
  );

  const runAction = async (key: string, fn: () => Promise<boolean | void> | void) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  // 0 — Général & Visibilité
  if (activeSubTab === 0) {
    const visLabel =
      activeClub.visibility === 'secret'
        ? 'Club secret (sur invitation)'
        : activeClub.visibility === 'prive'
          ? 'Club fermé (validation requise)'
          : 'Club ouvert (accès libre)';

    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-general-pane">
        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Visibilité & Accès</b>
            </div>
            <span className="club-badge-sage">{visLabel}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', lineHeight: 1.45 }}>
            Contrôle qui peut découvrir {activeClub.name}, consulter ses sorties et demander à rejoindre la cordée.
          </p>
          {canEditGovernance ? (
            <button
              type="button"
              className="lkdv-carnet-btn-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={onToggleClubVisibility}
            >
              Changer la visibilité
            </button>
          ) : (
            <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>
              Réservé au fondateur ou aux administrateurs du club.
            </span>
          )}
        </div>

        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass size={16} color="#17402c" aria-hidden="true" />
            <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Identité du club</b>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--label)' }}>
            <b>{activeClub.name}</b> · {activeClub.massif}
          </div>
          <div style={{ fontSize: 12, color: 'var(--label2)' }}>
            {activeClub.category} · {activeClub.membersCount} membres · {activeClub.outingsCount} sorties
          </div>
        </div>
      </div>
    );
  }

  // 1 — Accès & Adhésions
  if (activeSubTab === 1) {
    const pendingCount = activeClub.pendingRequestsCount ?? 0;
    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-access-pane">
        <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={16} color="#17402c" aria-hidden="true" />
              <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Demandes d’adhésion</b>
            </div>
            <span className="club-badge-soft">{pendingCount} en attente</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', lineHeight: 1.45 }}>
            Les demandes d’adhésion et liens d’invitation permettent d’accueillir de nouveaux membres tout en filtrant le niveau de pratique.
          </p>
          {pendingCount === 0 ? (
            <ClubEmptyCard
              icon={<Check size={20} />}
              title="Aucune demande en attente"
              description="Toutes les demandes d’adhésion ont été traitées."
            />
          ) : null}
        </div>
      </div>
    );
  }

  // 2 — Équipe, Rôles & Pôles (Permissions)
  if (activeSubTab === 2) {
    return (
      <div className="club-drawer-pane-content" data-testid="club-settings-team-pane">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
          <input
            type="text"
            className="club-glass-input"
            style={{ paddingLeft: 30, paddingRight: memberSearch ? 28 : 10, width: '100%' }}
            placeholder="Rechercher un membre, rôle ou pôle…"
            aria-label="Rechercher un membre pour gérer ses permissions"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />
          {memberSearch ? (
            <button
              type="button"
              onClick={() => setMemberSearch('')}
              aria-label="Effacer la recherche"
              style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredMembers.slice(0, 40).map((m) => {
            const targetUid = m.userId || m.id;
            const rawRole: ClubRole =
              m.rawRole ??
              (m.role === 'Fondateur'
                ? 'founder'
                : m.role === 'Guide & Sécurité'
                  ? 'admin'
                  : m.role === 'Encadrant'
                    ? 'moderator'
                    : 'member');
            const isTargetFounder = rawRole === 'founder';
            const isSelf = Boolean(currentUserId && targetUid === currentUserId);
            const canEditThisRole = canEditGovernance && !isTargetFounder && !isSelf && (rawRole !== 'admin' || isFounder);

            return (
              <div
                key={m.id}
                className="club-glass-card"
                style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13, color: 'var(--label)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </b>
                    <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>
                      @{m.handle} · {roleLabel(rawRole, m.role)}
                    </span>
                  </div>
                  {canEditThisRole && onChangeMemberRole ? (
                    <select
                      aria-label={`Grade de ${m.name}`}
                      value={rawRole}
                      disabled={busyKey === `role:${targetUid}`}
                      onChange={(e) => {
                        const nextRole = e.target.value as ClubRole;
                        void runAction(`role:${targetUid}`, () => onChangeMemberRole(targetUid, nextRole));
                      }}
                      className="club-glass-input"
                      style={{ width: 'auto', fontSize: 11.5, padding: '4px 8px' }}
                    >
                      {isFounder ? <option value="admin">Admin · Bureau</option> : null}
                      <option value="moderator">Modérateur</option>
                      <option value="member">Membre</option>
                    </select>
                  ) : (
                    <span className={isTargetFounder ? 'club-badge-sage' : 'club-badge-soft'}>
                      {isTargetFounder ? 'Fondateur (protégé)' : roleLabel(rawRole, m.role)}
                    </span>
                  )}
                </div>

                {canEditGovernance ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(23, 64, 44, 0.08)' }}>
                    <Switch
                      checked={Boolean(m.isCertifiedLeader)}
                      disabled={busyKey === `leader:${targetUid}`}
                      onCheckedChange={(checked) => {
                        if (onToggleMemberLeaderBadge) {
                          void runAction(`leader:${targetUid}`, () => onToggleMemberLeaderBadge(targetUid, checked));
                        } else {
                          onToast?.({ title: 'Badge Encadrant mis à jour', subtitle: m.name });
                        }
                      }}
                      label="Encadrant / Guide sorties"
                      aria-label={`Nommer ${m.name} Encadrant sorties`}
                    />
                    <Switch
                      checked={Boolean(m.canManageGear || rawRole === 'founder' || rawRole === 'admin')}
                      disabled={rawRole === 'founder' || rawRole === 'admin' || busyKey === `gear:${targetUid}`}
                      onCheckedChange={(checked) => {
                        if (onToggleMemberGearPermission) {
                          void runAction(`gear:${targetUid}`, () => onToggleMemberGearPermission(targetUid, checked));
                        } else {
                          onToast?.({ title: 'Pôle Matériel mis à jour', subtitle: m.name });
                        }
                      }}
                      label="Référent Matériel & Prêts"
                      aria-label={`Autoriser ${m.name} à gérer l’inventaire matériel`}
                    />
                    <Switch
                      checked={Boolean(m.canManageStories || rawRole === 'founder' || rawRole === 'admin')}
                      disabled={rawRole === 'founder' || rawRole === 'admin' || busyKey === `stories:${targetUid}`}
                      onCheckedChange={(checked) => {
                        if (onToggleMemberStoryPermission) {
                          void runAction(`stories:${targetUid}`, () => onToggleMemberStoryPermission(targetUid, checked));
                        } else {
                          onToast?.({ title: 'Pôle Stories mis à jour', subtitle: m.name });
                        }
                      }}
                      label="Référent Com & Stories à la une"
                      aria-label={`Autoriser ${m.name} à gérer les stories`}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {m.isCertifiedLeader ? (
                      <span className="club-badge-sage">
                        <Award size={11} style={{ marginRight: 3 }} aria-hidden="true" />
                        Encadrant
                      </span>
                    ) : null}
                    {m.canManageGear ? (
                      <span className="club-badge-soft">
                        <Package size={11} style={{ marginRight: 3 }} aria-hidden="true" />
                        Matériel
                      </span>
                    ) : null}
                    {m.canManageStories ? (
                      <span className="club-badge-soft">
                        <Sparkles size={11} style={{ marginRight: 3 }} aria-hidden="true" />
                        Stories
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3 — Modération & Sécurité
  return (
    <div className="club-drawer-pane-content" data-testid="club-settings-moderation-pane">
      <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} color="#17402c" aria-hidden="true" />
          <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Règles de sécurité & hiérarchie</b>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', lineHeight: 1.45 }}>
          Le rôle <b>Fondateur</b> est protégé contre toute rétrogradation. Seul le fondateur peut nommer ou rétrograder des administrateurs, et les modérateurs ne peuvent pas modifier les grades.
        </p>
      </div>

      <div className="club-glass-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} color="#17402c" aria-hidden="true" />
            <b style={{ fontSize: 13.5, color: 'var(--label)' }}>Membres en sourdine</b>
          </div>
          <span className="club-badge-soft">{mutedMembers.length}</span>
        </div>
        {mutedMembers.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--label2)' }}>
            Aucun membre actuellement restreint dans les salons.
          </div>
        ) : (
          mutedMembers.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{m.name} (@{m.handle})</span>
              <span className="club-badge-soft">Muté</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
