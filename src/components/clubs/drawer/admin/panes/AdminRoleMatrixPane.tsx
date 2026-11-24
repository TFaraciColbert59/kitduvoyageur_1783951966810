'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RotateCcw, Shield } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
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
import { AdminAccordionCard, AdminStatusPill } from '../AdminPrimitives';
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
  const domainGroups = CAPABILITY_DOMAIN_GROUPS.filter((g) => g.domain !== 'sovereignty');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="club-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--tint, #17402c)' }}>
            <Shield size={14} aria-hidden="true" />
            <span>Matrice des rôles</span>
          </span>
          {customCount > 0 ? (
            <button
              type="button"
              className="lkdv-carnet-btn-soft"
              style={{ height: 26, padding: '0 8px', fontSize: 11 }}
              onClick={() => void resetRole()}
            >
              <RotateCcw size={11} aria-hidden="true" />
              <span>Réinitialiser ({customCount})</span>
            </button>
          ) : null}
        </div>

        <SegmentedControl
          size="sm"
          showLabels
          ariaLabel="Sélectionner un rôle"
          value={selectedRole}
          onChange={(id) => setSelectedRole(id as Exclude<ClubRole, 'founder'>)}
          items={editableRoles.map((r) => ({
            id: r,
            label: CLUB_ROLE_LABELS[r],
          }))}
        />
      </div>

      {domainGroups.map((group, idx) => {
        const activeCount = group.items.filter((item) => resolveForRole(item.key).allowed).length;
        return (
          <AdminAccordionCard
            key={group.domain}
            title={group.domainLabel}
            badge={
              <AdminStatusPill tone={activeCount > 0 ? 'sage' : 'neutral'}>
                {activeCount}/{group.items.length} actifs
              </AdminStatusPill>
            }
            defaultOpen={idx === 0}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
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
                      background: 'rgba(255, 255, 255, 0.58)',
                      opacity: canToggle ? 1 : 0.55,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--label)' }}>
                        {item.label}
                      </span>
                      {isCustom ? (
                        <AdminStatusPill tone="sage">personnalisé</AdminStatusPill>
                      ) : null}
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
          </AdminAccordionCard>
        );
      })}
    </div>
  );
}
