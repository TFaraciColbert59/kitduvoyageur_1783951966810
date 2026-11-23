'use client';

import { useMemo } from 'react';
import {
  canDelegateCapability,
  canManageTargetRole,
  CLUB_CAPABILITIES,
  isAdminCapability,
  resolveClubCapabilities,
  type ClubCapability,
  type ClubRole,
} from '@/features/clubs';
import type { ClubItemData } from '../ClubDrawerTypes';
import { ADMIN_POLES, type AdminLensDef, type AdminPoleDef, type AdminPoleId } from './adminConfig';

export interface UseClubCapabilitiesResult {
  effectiveRole: ClubRole | null;
  capabilities: readonly ClubCapability[];
  capabilitySet: ReadonlySet<ClubCapability>;
  canAccessAdmin: boolean;
  has: (cap: ClubCapability) => boolean;
  hasAny: (caps: readonly ClubCapability[]) => boolean;
  canManageRole: (targetRole: ClubRole, newRole?: ClubRole) => boolean;
  canDelegate: (cap: ClubCapability, targetRole: ClubRole) => boolean;
  visiblePoles: readonly AdminPoleDef[];
  visibleLensesForPole: (poleId: AdminPoleId) => readonly AdminLensDef[];
}

export function deriveEffectiveClubCapabilities(
  activeClub: ClubItemData,
  currentUserId?: string | null,
): { effectiveRole: ClubRole | null; capabilities: ClubCapability[] } {
  const isCreator = Boolean(currentUserId && activeClub.createdBy === currentUserId);
  const effectiveRole: ClubRole | null = isCreator
    ? 'founder'
    : activeClub.viewerRole ?? null;

  if (effectiveRole === 'founder') {
    return { effectiveRole: 'founder', capabilities: [...CLUB_CAPABILITIES] };
  }

  if (Array.isArray(activeClub.viewerCapabilities)) {
    return { effectiveRole, capabilities: [...activeClub.viewerCapabilities] };
  }

  // Graceful fallback when running in demo/offline mode without API viewerCapabilities
  const base = resolveClubCapabilities({ role: effectiveRole });
  const set = new Set<ClubCapability>(base);
  if (activeClub.viewerCanManageGear) {
    set.add('gear.manage_club_inventory');
    set.add('gear.manage_standard_kits');
    set.add('gear.approve_club_loans');
  }
  if (activeClub.viewerCanManageStories) {
    set.add('stories.publish_club');
    set.add('stories.manage_highlights');
  }
  return { effectiveRole, capabilities: Array.from(set) };
}

export function useClubCapabilities(
  activeClub: ClubItemData,
  currentUserId?: string | null,
): UseClubCapabilitiesResult {
  const { effectiveRole, capabilities } = useMemo(
    () => deriveEffectiveClubCapabilities(activeClub, currentUserId),
    [activeClub, currentUserId],
  );

  const capabilitySet = useMemo(() => new Set<ClubCapability>(capabilities), [capabilities]);

  const canAccessAdmin = useMemo(
    () => effectiveRole === 'founder' || capabilities.some(isAdminCapability),
    [capabilities, effectiveRole],
  );

  const has = useMemo(
    () => (cap: ClubCapability) => effectiveRole === 'founder' || capabilitySet.has(cap),
    [capabilitySet, effectiveRole],
  );

  const hasAny = useMemo(
    () => (caps: readonly ClubCapability[]) =>
      caps.length === 0 ? canAccessAdmin : caps.some((c) => has(c)),
    [canAccessAdmin, has],
  );

  const visibleLensesMap = useMemo(() => {
    const map = new Map<AdminPoleId, AdminLensDef[]>();
    for (const pole of ADMIN_POLES) {
      const lenses = pole.lenses.filter((lens) => hasAny(lens.requiredAny));
      map.set(pole.id, lenses);
    }
    return map;
  }, [hasAny]);

  const visiblePoles = useMemo(
    () => ADMIN_POLES.filter((pole) => (visibleLensesMap.get(pole.id)?.length ?? 0) > 0),
    [visibleLensesMap],
  );

  return useMemo(
    () => ({
      effectiveRole,
      capabilities,
      capabilitySet,
      canAccessAdmin,
      has,
      hasAny,
      canManageRole: (targetRole: ClubRole, newRole?: ClubRole) =>
        canManageTargetRole(effectiveRole, targetRole, newRole),
      canDelegate: (cap: ClubCapability, targetRole: ClubRole) =>
        canDelegateCapability({
          actorRole: effectiveRole,
          actorCapabilities: capabilitySet,
          targetRole,
          capability: cap,
        }),
      visiblePoles,
      visibleLensesForPole: (poleId: AdminPoleId) => visibleLensesMap.get(poleId) ?? [],
    }),
    [canAccessAdmin, capabilities, capabilitySet, effectiveRole, has, hasAny, visibleLensesMap, visiblePoles],
  );
}
