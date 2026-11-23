import { describe, expect, it } from 'vitest';
import { changeMemberRole, createClubWithFounder } from '../membership';
import { computeNextGearStock, isLoanTransitionAllowed } from '../gear';
import type { ClubMember } from '../types';

function member(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    clubId: 'c-1',
    userId: 'u-1',
    displayName: 'Alice',
    avatarUrl: null,
    role: 'member',
    status: 'active',
    joinedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Hiérarchie des clubs', () => {
  it('crée le créateur en rôle founder avec droits stories et matériel', () => {
    const res = createClubWithFounder({
      id: 'c-1',
      slug: 'cordee-alpes',
      name: 'Cordée des Alpes',
      description: 'Club alpin',
      primarySport: 'alpinisme',
      privacy: 'open',
      creatorUserId: 'u-founder',
      creatorDisplayName: 'Jean',
      nowIso: '2026-01-01T00:00:00.000Z',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.founderMember.role).toBe('founder');
    expect(res.data.founderMember.canManageStories).toBe(true);
    expect(res.data.founderMember.canManageGear).toBe(true);
  });

  it('protège le founder et réserve la gestion des admins au founder', () => {
    const founder = member({ userId: 'u-founder', role: 'founder' });
    const admin = member({ userId: 'u-admin', role: 'admin' });
    const mod = member({ userId: 'u-mod', role: 'moderator' });
    const mem = member({ userId: 'u-mem', role: 'member' });
    const list = [founder, admin, mod, mem];

    // Un admin ne peut pas rétrograder le founder
    const demoteFounder = changeMemberRole({
      clubId: 'c-1',
      actorUserId: 'u-admin',
      targetUserId: 'u-founder',
      newRole: 'member',
      memberships: list,
    });
    expect(demoteFounder.ok).toBe(false);

    // Un admin ne peut pas nommer un autre admin
    const adminPromotesAdmin = changeMemberRole({
      clubId: 'c-1',
      actorUserId: 'u-admin',
      targetUserId: 'u-mem',
      newRole: 'admin',
      memberships: list,
    });
    expect(adminPromotesAdmin.ok).toBe(false);

    // Le founder peut nommer un admin
    const founderPromotesAdmin = changeMemberRole({
      clubId: 'c-1',
      actorUserId: 'u-founder',
      targetUserId: 'u-mem',
      newRole: 'admin',
      memberships: list,
    });
    expect(founderPromotesAdmin.ok).toBe(true);
  });
});

describe('Stock et workflow de prêt matériel (4 étapes)', () => {
  it('réserve le stock dès la validation, le conserve à la remise et le libère au retour', () => {
    // requested -> approved : décrémente le stock
    const approved = computeNextGearStock({
      quantityTotal: 5,
      quantityAvailable: 5,
      loanQuantity: 2,
      fromStatus: 'requested',
      toStatus: 'approved',
    });
    expect(approved).toEqual({ ok: true, quantityAvailable: 3, available: true });

    // approved -> checked_out : ne retire pas une seconde fois
    const checkedOut = computeNextGearStock({
      quantityTotal: 5,
      quantityAvailable: 3,
      loanQuantity: 2,
      fromStatus: 'approved',
      toStatus: 'checked_out',
    });
    expect(checkedOut).toEqual({ ok: true, quantityAvailable: 3, available: true });

    // checked_out -> returned : libère la quantité
    const returned = computeNextGearStock({
      quantityTotal: 5,
      quantityAvailable: 3,
      loanQuantity: 2,
      fromStatus: 'checked_out',
      toStatus: 'returned',
    });
    expect(returned).toEqual({ ok: true, quantityAvailable: 5, available: true });
  });

  it('refuse une validation si le stock est insuffisant ou la transition invalide', () => {
    const lowStock = computeNextGearStock({
      quantityTotal: 2,
      quantityAvailable: 1,
      loanQuantity: 2,
      fromStatus: 'requested',
      toStatus: 'approved',
    });
    expect(lowStock.ok).toBe(false);

    expect(isLoanTransitionAllowed('returned', 'approved')).toBe(false);
    expect(isLoanTransitionAllowed('requested', 'returned')).toBe(false);
  });
});
