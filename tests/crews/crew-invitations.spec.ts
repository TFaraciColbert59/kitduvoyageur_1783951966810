import { describe, it, expect } from 'vitest';
import {
  createInviteToken,
  verifyInviteToken,
  validateJoinAttempt,
} from '@/features/crews/lib/invitations';
import type { Crew } from '@/features/crews/types/crew.types';

describe('Crew Invitations & Consent System (TDD - Phase 4.2)', () => {
  const secretKey = 'lkdv-secret-test-key';
  const mockCrew: Crew = {
    id: 'crew-montagne-123',
    name: 'Alpinistes Chamonix',
    slug: 'alpinistes-chamonix',
    description: null,
    theme: 'Trek',
    cover_url: null,
    visibility: 'link',
    invite_code: 'CHAM-2026',
    max_members: 4,
    level: 1,
    xp: 0,
    created_by: 'user-organizer',
    legacy_group_id: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  it('generates and verifies a valid signed invitation token with expiration', () => {
    const token = createInviteToken({
      crewId: mockCrew.id,
      inviterId: 'user-organizer',
      expiresInHours: 48,
    }, secretKey);

    const verified = verifyInviteToken(token, secretKey);
    expect(verified).not.toBeNull();
    expect(verified?.crewId).toBe(mockCrew.id);
    expect(verified?.inviterId).toBe('user-organizer');
  });

  it('rejects an expired invitation token', () => {
    const expiredToken = createInviteToken({
      crewId: mockCrew.id,
      inviterId: 'user-organizer',
      expiresInHours: -1, // Expired 1 hour ago
    }, secretKey);

    const verified = verifyInviteToken(expiredToken, secretKey);
    expect(verified).toBeNull();
  });

  it('rejects a tampered invitation token', () => {
    const token = createInviteToken({
      crewId: mockCrew.id,
      inviterId: 'user-organizer',
      expiresInHours: 24,
    }, secretKey);

    const tampered = token.slice(0, -4) + 'abcd';
    expect(verifyInviteToken(tampered, secretKey)).toBeNull();
  });

  it('validates join attempt: succeeds when user is authenticated and crew has space', () => {
    const result = validateJoinAttempt({
      crew: mockCrew,
      currentMemberCount: 2,
      isAlreadyMember: false,
      currentUserId: 'user-invitee',
    });

    expect(result.allowed).toBe(true);
  });

  it('validates join attempt: blocks when crew is full', () => {
    const result = validateJoinAttempt({
      crew: mockCrew,
      currentMemberCount: 4, // max_members is 4
      isAlreadyMember: false,
      currentUserId: 'user-invitee',
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('CREW_FULL');
  });

  it('validates join attempt: blocks when user is already a member', () => {
    const result = validateJoinAttempt({
      crew: mockCrew,
      currentMemberCount: 2,
      isAlreadyMember: true,
      currentUserId: 'user-invitee',
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('ALREADY_MEMBER');
  });

  it('validates join attempt: requires authentication when user is anonymous', () => {
    const result = validateJoinAttempt({
      crew: mockCrew,
      currentMemberCount: 2,
      isAlreadyMember: false,
      currentUserId: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('AUTH_REQUIRED');
  });
});
