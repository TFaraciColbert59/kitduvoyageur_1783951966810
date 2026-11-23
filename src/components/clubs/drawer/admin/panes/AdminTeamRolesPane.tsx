'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Award, ChevronDown, ChevronRight, Lock, RotateCcw, Search, Users } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import {
  CLUB_DEFAULT_ROLE_CAPABILITIES,
  CLUB_ROLE_LABELS,
  CLUB_ROLE_RANK,
  type ClubCapability,
  type ClubMemberCapabilityOverride,
  type ClubRole,
  type ClubRoleCapabilityPolicy,
} from '@/features/clubs/types';
import type { ClubItemData, ClubMemberData, ClubToastPayload } from '../../ClubDrawerTypes';
import { CAPABILITY_DOMAIN_GROUPS } from '../adminConfig';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSIGNABLE_ROLES: Exclude<ClubRole, 'founder'>[] = ['admin', 'moderator', 'volunteer', 'member'];

export interface AdminTeamRolesPaneProps {
  activeClub: ClubItemData;
  members: ClubMemberData[];
  currentUserId?: string | null;
  roleFilter: 'all' | ClubRole;
  caps: UseClubCapabilitiesResult;
  onChangeMemberRole?: (userId: string, role: ClubRole) => Promise<boolean> | void;
  onToggleMemberLeaderBadge?: (userId: string, isCertifiedLeader: boolean) => Promise<boolean> | void;
  onToast?: (toast: ClubToastPayload) => void;
}

function inferMemberRole(member: ClubMemberData, clubCreatedBy?: string | null): ClubRole {
  if (clubCreatedBy && (member.userId === clubCreatedBy || member.id === clubCreatedBy)) {
    return 'founder';
  }
  if (member.rawRole) return member.rawRole;
  if (member.role === 'Fondateur') return 'founder';
  if (member.role === 'Guide & Sécurité') return 'admin';
  if (member.role === 'Encadrant') return 'moderator';
  if (member.role === 'Bénévole') return 'volunteer';
  return 'member';
}

export function AdminTeamRolesPane({
  activeClub,
  members,
  currentUserId,
  roleFilter,
  caps,
  onChangeMemberRole,
  onToggleMemberLeaderBadge,
  onToast,
}: AdminTeamRolesPaneProps) {
  const [query, setQuery] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [rolePolicies, setRolePolicies] = useState<ClubRoleCapabilityPolicy[]>([]);
  const [overrides, setOverrides] = useState<ClubMemberCapabilityOverride[]>([]);
  const [localRoles, setLocalRoles] = useState<Record<string, ClubRole>>({});
  const [localLeader, setLocalLeader] = useState<Record<string, boolean>>({});

  const canManageRoles = caps.has('members.manage_roles');
  const canDelegate = caps.has('permissions.delegate') || caps.effectiveRole === 'founder';

  useEffect(() => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let active = true;
    void fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          payload: {
            data?: {
              rolePolicies?: ClubRoleCapabilityPolicy[];
              memberOverrides?: ClubMemberCapabilityOverride[];
            };
          } | null,
        ) => {
          if (!active || !payload?.data) return;
          if (payload.data.rolePolicies) setRolePolicies(payload.data.rolePolicies);
          if (payload.data.memberOverrides) setOverrides(payload.data.memberOverrides);
        },
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeClub.id]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .map((m) => {
        const uid = m.userId || m.id;
        const role = localRoles[uid] ?? inferMemberRole(m, activeClub.createdBy);
        return { member: m, uid, role };
      })
      .filter(({ member, role }) => {
        if (roleFilter !== 'all' && role !== roleFilter) return false;
        if (!q) return true;
        return (
          member.name.toLowerCase().includes(q) ||
          member.handle.toLowerCase().includes(q) ||
          CLUB_ROLE_LABELS[role].toLowerCase().includes(q)
        );
      })
      .sort((a, b) => CLUB_ROLE_RANK[b.role] - CLUB_ROLE_RANK[a.role]);
  }, [activeClub.createdBy, localRoles, members, query, roleFilter]);

  const handleRoleChange = async (uid: string, targetRole: ClubRole, nextRole: ClubRole) => {
    if (!canManageRoles || !caps.canManageRole(targetRole, nextRole)) return;
    setLocalRoles((prev) => ({ ...prev, [uid]: nextRole }));
    if (onChangeMemberRole) {
      const result = await onChangeMemberRole(uid, nextRole);
      if (result === false) {
        setLocalRoles((prev) => ({ ...prev, [uid]: targetRole }));
        onToast?.({ title: 'Changement de grade refusé' });
        return;
      }
    } else if (UUID_RE.test(activeClub.id) && UUID_RE.test(uid) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/members`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'role', userId: uid, role: nextRole }),
      });
      if (!res.ok) {
        setLocalRoles((prev) => ({ ...prev, [uid]: targetRole }));
        onToast?.({ title: 'Changement de grade refusé' });
        return;
      }
    }
    onToast?.({ title: `Grade mis à jour : ${CLUB_ROLE_LABELS[nextRole]}` });
  };

  const handleToggleOverride = async (
    uid: string,
    targetRole: ClubRole,
    cap: ClubCapability,
    allowed: boolean,
  ) => {
    if (!caps.canDelegate(cap, targetRole)) return;
    const prevSnapshot = overrides;
    setOverrides((prev) => [
      ...prev.filter((o) => !(o.userId === uid && o.capability === cap)),
      { clubId: activeClub.id, userId: uid, capability: cap, allowed },
    ]);
    if (UUID_RE.test(activeClub.id) && UUID_RE.test(uid) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_member_override',
          userId: uid,
          capability: cap,
          allowed,
        }),
      });
      if (!res.ok) {
        setOverrides(prevSnapshot);
        onToast?.({ title: 'Surcharge refusée' });
        return;
      }
    }
    onToast?.({ title: 'Droit individuel mis à jour ✓' });
  };

  const handleResetMember = async (uid: string) => {
    const prevSnapshot = overrides;
    setOverrides((prev) => prev.filter((o) => o.userId !== uid));
    if (UUID_RE.test(activeClub.id) && UUID_RE.test(uid) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_member_overrides', userId: uid }),
      });
      if (!res.ok) {
        setOverrides(prevSnapshot);
        onToast?.({ title: 'Réinitialisation refusée' });
        return;
      }
    }
    onToast?.({ title: 'Droits réinitialisés au rôle ✓' });
  };

  const resolveEffectiveForMember = (
    uid: string,
    role: ClubRole,
    cap: ClubCapability,
  ): { allowed: boolean; isOverridden: boolean } => {
    if (role === 'founder') return { allowed: true, isOverridden: false };
    const ov = overrides.find((o) => o.userId === uid && o.capability === cap);
    if (ov) return { allowed: ov.allowed, isOverridden: true };
    const pol = rolePolicies.find((p) => p.role === role && p.capability === cap);
    if (pol) return { allowed: pol.allowed, isOverridden: false };
    const def = CLUB_DEFAULT_ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
    return { allowed: def, isOverridden: false };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, opacity: 0.55 }} aria-hidden="true" />
        <input
          type="text"
          className="club-glass-input"
          style={{ width: '100%', paddingLeft: 30 }}
          placeholder="Rechercher un membre ou un grade…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredMembers.map(({ member, uid, role }) => {
          const isSelf = Boolean(currentUserId && uid === currentUserId);
          const isExpanded = expandedMemberId === uid;
          const canEditThisMember = !isSelf && caps.canManageRole(role);
          const memberOverridesCount = overrides.filter((o) => o.userId === uid).length;
          const isCertified = localLeader[uid] ?? Boolean(member.isCertifiedLeader);

          return (
            <div
              key={uid}
              className="club-glass-card"
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <b style={{ fontSize: 13 }}>{member.name}</b>
                    {isSelf ? (
                      <span style={{ fontSize: 10, color: 'var(--label2)' }}>(Vous)</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--label2)' }}>
                    {CLUB_ROLE_LABELS[role]}
                    {memberOverridesCount > 0 ? ` · ${memberOverridesCount} surcharge(s)` : ''}
                  </div>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                  {canManageRoles && canEditThisMember ? (
                    <select
                      className="club-glass-input"
                      style={{ height: 28, fontSize: 11, padding: '0 8px', width: 'auto' }}
                      value={role}
                      onChange={(e) => void handleRoleChange(uid, role, e.target.value as ClubRole)}
                      aria-label={`Grade de ${member.name}`}
                    >
                      {ASSIGNABLE_ROLES.filter((r) => caps.canManageRole(role, r) || r === role).map(
                        (r) => (
                          <option key={r} value={r}>
                            {CLUB_ROLE_LABELS[r]}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <span className="club-badge-sage" style={{ fontSize: 10.5 }}>
                      {CLUB_ROLE_LABELS[role]}
                    </span>
                  )}

                  {canDelegate && canEditThisMember ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                      onClick={() => setExpandedMemberId(isExpanded ? null : uid)}
                      aria-expanded={isExpanded}
                      aria-label={`Personnaliser les droits de ${member.name}`}
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span>Droits</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {isExpanded && canDelegate && canEditThisMember ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    paddingTop: 8,
                    borderTop: '1px solid rgba(23, 64, 44, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                      <Award size={13} color="#17402c" aria-hidden="true" />
                      <span>Encadrant / Guide certifié</span>
                    </span>
                    <Switch
                      checked={isCertified}
                      onCheckedChange={(val) => {
                        setLocalLeader((prev) => ({ ...prev, [uid]: val }));
                        void onToggleMemberLeaderBadge?.(uid, val);
                      }}
                      aria-label={`Badge encadrant pour ${member.name}`}
                    />
                  </div>

                  {memberOverridesCount > 0 ? (
                    <button
                      type="button"
                      className="lkdv-carnet-btn-soft"
                      style={{ height: 28, fontSize: 11, justifyContent: 'center' }}
                      onClick={() => void handleResetMember(uid)}
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      <span>Réinitialiser au rôle ({CLUB_ROLE_LABELS[role]})</span>
                    </button>
                  ) : null}

                  {CAPABILITY_DOMAIN_GROUPS.filter((g) => g.domain !== 'sovereignty').map((group) => (
                    <div key={group.domain} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', color: '#56665d' }}>
                        {group.domainLabel.toUpperCase()}
                      </div>
                      {group.items.map((item) => {
                        const { allowed, isOverridden } = resolveEffectiveForMember(uid, role, item.key);
                        const canToggle = caps.canDelegate(item.key, role);
                        return (
                          <div
                            key={item.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '5px 8px',
                              borderRadius: 9,
                              background: 'rgba(255, 255, 255, 0.55)',
                              opacity: canToggle ? 1 : 0.6,
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--label)' }}>
                                {item.label}
                              </div>
                              <div style={{ fontSize: 10, color: isOverridden ? '#17402c' : 'var(--label2)' }}>
                                {isOverridden ? 'surchargé' : 'hérité'}
                              </div>
                            </div>
                            {canToggle ? (
                              <Switch
                                checked={allowed}
                                onCheckedChange={(val) => void handleToggleOverride(uid, role, item.key, val)}
                                aria-label={`${item.label} pour ${member.name}`}
                              />
                            ) : (
                              <Lock size={13} aria-label="Verrouillé" style={{ opacity: 0.6 }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {filteredMembers.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--label2)', padding: 12 }}>
            <Users size={14} aria-hidden="true" />
            <span>Aucun membre ne correspond à ce filtre.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
