'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RotateCcw, Shield } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import {
  CLUB_DEFAULT_ROLE_CAPABILITIES,
  CLUB_ROLE_LABELS,
  type ClubCapability,
  type ClubRole,
  type ClubRoleCapabilityPolicy,
} from '@/features/clubs/types';
import type { ClubItemData, ClubToastPayload } from '../../ClubDrawerTypes';
import { CAPABILITY_DOMAIN_GROUPS } from '../adminConfig';
import type { UseClubCapabilitiesResult } from '../useClubCapabilities';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminRoleMatrixPaneProps {
  activeClub: ClubItemData;
  caps: UseClubCapabilitiesResult;
  onToast?: (toast: ClubToastPayload) => void;
}

const MATRIX_ROLES: Exclude<ClubRole, 'founder'>[] = ['admin', 'moderator', 'volunteer', 'member'];

export function AdminRoleMatrixPane({ activeClub, caps, onToast }: AdminRoleMatrixPaneProps) {
  const editableRoles = useMemo(
    () => MATRIX_ROLES.filter((r) => caps.canManageRole(r)),
    [caps],
  );
  const [selectedRole, setSelectedRole] = useState<Exclude<ClubRole, 'founder'>>(
    editableRoles[0] ?? 'volunteer',
  );
  const [rolePolicies, setRolePolicies] = useState<ClubRoleCapabilityPolicy[]>([]);

  useEffect(() => {
    if (editableRoles.length > 0 && !editableRoles.includes(selectedRole)) {
      setSelectedRole(editableRoles[0]);
    }
  }, [editableRoles, selectedRole]);

  useEffect(() => {
    if (!UUID_RE.test(activeClub.id) || typeof fetch !== 'function') return;
    let active = true;
    void fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { data?: { rolePolicies?: ClubRoleCapabilityPolicy[] } } | null) => {
        if (active && payload?.data?.rolePolicies) {
          setRolePolicies(payload.data.rolePolicies);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeClub.id]);

  const resolveForRole = (cap: ClubCapability): { allowed: boolean; isCustom: boolean } => {
    const pol = rolePolicies.find((p) => p.role === selectedRole && p.capability === cap);
    if (pol) return { allowed: pol.allowed, isCustom: true };
    return {
      allowed: CLUB_DEFAULT_ROLE_CAPABILITIES[selectedRole]?.includes(cap) ?? false,
      isCustom: false,
    };
  };

  const togglePolicy = async (cap: ClubCapability, allowed: boolean) => {
    if (!caps.canDelegate(cap, selectedRole)) return;
    const prevSnapshot = rolePolicies;
    setRolePolicies((prev) => [
      ...prev.filter((p) => !(p.role === selectedRole && p.capability === cap)),
      { clubId: activeClub.id, role: selectedRole, capability: cap, allowed },
    ]);
    if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_role_policy',
          role: selectedRole,
          capability: cap,
          allowed,
        }),
      });
      if (!res.ok) {
        setRolePolicies(prevSnapshot);
        onToast?.({ title: 'Modification refusée' });
        return;
      }
    }
    onToast?.({ title: `Matrice ${CLUB_ROLE_LABELS[selectedRole]} mise à jour ✓` });
  };

  const resetRole = async () => {
    const prevSnapshot = rolePolicies;
    setRolePolicies((prev) => prev.filter((p) => p.role !== selectedRole));
    if (UUID_RE.test(activeClub.id) && typeof fetch === 'function') {
      const res = await fetch(`/api/clubs/${encodeURIComponent(activeClub.id)}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_role_policies', role: selectedRole }),
      });
      if (!res.ok) {
        setRolePolicies(prevSnapshot);
        onToast?.({ title: 'Réinitialisation refusée' });
        return;
      }
    }
    onToast?.({ title: `Défauts restaurés pour ${CLUB_ROLE_LABELS[selectedRole]} ✓` });
  };

  const customCount = rolePolicies.filter((p) => p.role === selectedRole).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#17402c' }}>
            <Shield size={14} aria-hidden="true" />
            <span>Matrice des droits par rôle</span>
          </span>
          {customCount > 0 ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 26, padding: '0 8px', fontSize: 11 }}
              onClick={() => void resetRole()}
            >
              <RotateCcw size={11} aria-hidden="true" />
              <span>Réinitialiser</span>
            </button>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {editableRoles.map((r) => {
            const active = selectedRole === r;
            return (
              <button
                key={r}
                type="button"
                className={`club-filter-pill ${active ? 'is-active' : ''}`}
                onClick={() => setSelectedRole(r)}
              >
                {active ? <span className="club-filter-pill-bg" /> : null}
                <span className="club-filter-pill-label">{CLUB_ROLE_LABELS[r]}</span>
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: 11.5, color: 'var(--label2)' }}>
          Modifie les droits par défaut de tous les membres ayant le grade <b>{CLUB_ROLE_LABELS[selectedRole]}</b> dans ce club.
        </span>
      </div>

      {CAPABILITY_DOMAIN_GROUPS.filter((g) => g.domain !== 'sovereignty').map((group) => (
        <div key={group.domain} className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: '#56665d' }}>
            {group.domainLabel.toUpperCase()}
          </div>
          {group.items.map((item) => {
            const { allowed, isCustom } = resolveForRole(item.key);
            const canToggle = caps.canDelegate(item.key, selectedRole);
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.55)',
                  opacity: canToggle ? 1 : 0.55,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--label)' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: isCustom ? '#17402c' : 'var(--label2)' }}>
                    {isCustom ? 'personnalisé club' : 'défaut système'}
                  </div>
                </div>
                {canToggle ? (
                  <Switch
                    checked={allowed}
                    onCheckedChange={(val) => void togglePolicy(item.key, val)}
                    aria-label={`${item.label} pour ${CLUB_ROLE_LABELS[selectedRole]}`}
                  />
                ) : (
                  <Lock size={13} aria-label="Droit verrouillé" style={{ opacity: 0.6 }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
