import { describe, expect, it } from 'vitest';
import {
  canViewActivity,
  resolveActivityAccess,
  resolveSharedActivityAccess,
} from '../visibilityPolicy';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VIEWER = '22222222-2222-4222-8222-222222222222';
const CLUB = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';

const activity = {
  id: SESSION,
  ownerId: OWNER,
  visibility: 'collective_anonymized',
};

const activeShare = { status: 'shared', version: 1, revokedAt: null };

describe('G01 visibility — séance', () => {
  it('autorise le propriétaire à voir sa séance privée', () => {
    const access = resolveActivityAccess({
      activity: { ...activity, visibility: 'private' },
      viewer: { viewerId: OWNER, blocked: false },
    });
    expect(access.allowed).toBe(true);
    expect(access.reason).toBe('owner');
    expect(access.traceAllowed).toBe(false);
  });

  it('refuse une séance privée à un tiers, même sans blocage', () => {
    const access = resolveActivityAccess({
      activity: { ...activity, visibility: 'private' },
      viewer: { viewerId: VIEWER, blocked: false },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('activity_private');
  });

  it('refuse une visibilité absente ou inconnue', () => {
    expect(
      resolveActivityAccess({
        activity: { ...activity, visibility: undefined },
        viewer: { viewerId: VIEWER, blocked: false },
      }).reason
    ).toBe('unknown_visibility');
    expect(
      resolveActivityAccess({
        activity: { ...activity, visibility: 'peut-etre' },
        viewer: { viewerId: VIEWER, blocked: false },
      }).reason
    ).toBe('unknown_visibility');
  });

  it('refuse un blocage dans un sens ou dans l’autre', () => {
    const access = resolveActivityAccess({
      activity,
      viewer: { viewerId: VIEWER, blocked: true },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('blocked');
  });

  it('refuse un compte connecté dont le blocage est inconnu', () => {
    const access = resolveActivityAccess({
      activity,
      viewer: { viewerId: VIEWER, blocked: null },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('blocked_unknown');
  });

  it('accepte un visiteur anonyme sur une séance publique', () => {
    const access = resolveActivityAccess({
      activity: { ...activity, visibility: 'public' },
      viewer: { viewerId: null, blocked: false },
    });
    expect(access.allowed).toBe(true);
    expect(access.isAnonymous).toBe(true);
  });
});

describe('G01 visibility — carte publiée', () => {
  it('refuse un partage retiré', () => {
    const access = resolveSharedActivityAccess({
      activity,
      audience: 'public',
      share: { status: 'revoked', version: 2, revokedAt: '2026-11-13T10:00:00.000Z' },
      viewer: { viewerId: VIEWER, blocked: false },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('share_not_active');
  });

  it('refuse un partage sans version valide', () => {
    const access = resolveSharedActivityAccess({
      activity,
      audience: 'public',
      share: { status: 'shared', version: 0, revokedAt: null },
      viewer: { viewerId: VIEWER, blocked: false },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('invalid_share');
  });

  it('refuse une audience inconnue', () => {
    const access = resolveSharedActivityAccess({
      activity,
      audience: 'amis-proches',
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('unknown_audience');
  });

  it('autorise public + séance partagée sans blocage prouvé', () => {
    const access = resolveSharedActivityAccess({
      activity,
      audience: 'public',
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false },
    });
    expect(access.allowed).toBe(true);
    expect(access.reason).toBe('public');
  });

  it('autorise un anonyme sur public + séance publique', () => {
    const access = resolveSharedActivityAccess({
      activity: { ...activity, visibility: 'public' },
      audience: 'public',
      share: activeShare,
      viewer: { viewerId: null, blocked: false },
    });
    expect(access.allowed).toBe(true);
    expect(access.reason).toBe('anonymous_public');
  });

  it('n’ouvre abonnés qu’au suivi prouvé', () => {
    const denied = resolveSharedActivityAccess({
      activity,
      audience: 'abonnies',
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false, isFollower: false },
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('followers_only');

    const allowed = resolveSharedActivityAccess({
      activity,
      audience: 'abonnies',
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false, isFollower: true },
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBe('follower');
  });

  it('n’ouvre un club qu’à un membre actif', () => {
    const denied = resolveSharedActivityAccess({
      activity,
      audience: 'club',
      clubId: CLUB,
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false, activeClubIds: [] },
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('club_mismatch');

    const allowed = resolveSharedActivityAccess({
      activity,
      audience: 'club',
      clubId: CLUB,
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false, activeClubIds: [CLUB] },
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBe('club_member');
  });

  it('refuse un club sans identifiant exploitable', () => {
    const access = resolveSharedActivityAccess({
      activity,
      audience: 'club',
      clubId: null,
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false, activeClubIds: [CLUB] },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('club_missing');
  });

  it('refuse une audience publique sur une séance restée privée', () => {
    const access = resolveSharedActivityAccess({
      activity: { ...activity, visibility: 'private' },
      audience: 'public',
      share: activeShare,
      viewer: { viewerId: VIEWER, blocked: false },
    });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('activity_private');
  });

  it('garde la séance privée visible à son auteur mais pas sa carte si le partage est retiré', () => {
    const ownActivity = { ...activity, visibility: 'private' };
    expect(canViewActivity({ activity: ownActivity, viewer: { viewerId: OWNER } })).toBe(true);
    expect(
      resolveSharedActivityAccess({
        activity: ownActivity,
        audience: 'public',
        share: { status: 'revoked', version: 2, revokedAt: '2026-11-13T10:00:00.000Z' },
        viewer: { viewerId: OWNER, blocked: false },
      }).allowed
    ).toBe(false);
  });
});
