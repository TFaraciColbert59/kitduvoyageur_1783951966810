import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { clubErrorStatus, hasValidOrigin, isUuid, parseIso, respondClubResult } from '../_lib/http';
import { mapClubRow, mapEventRow, mapInviteRow, mapMemberRow, mapRegistrationRow } from '../_lib/mappers';

describe('G02 API — traductions HTTP', () => {
  it('traduit chaque code du contrat en statut stable', () => {
    expect(clubErrorStatus('UNAUTHORIZED')).toBe(401);
    expect(clubErrorStatus('FORBIDDEN')).toBe(403);
    expect(clubErrorStatus('PRIVACY_RESTRICTED')).toBe(403);
    expect(clubErrorStatus('NOT_FOUND')).toBe(404);
    expect(clubErrorStatus('CONFLICT')).toBe(409);
    expect(clubErrorStatus('CAPACITY_FULL')).toBe(409);
    expect(clubErrorStatus('INVITE_EXHAUSTED')).toBe(410);
    expect(clubErrorStatus('INVALID_INPUT')).toBe(400);
  });

  it('refuse une origine cross-origin et accepte same-origin ou absence d’origine', () => {
    const cross = new NextRequest('https://app.example/api/clubs', {
      method: 'POST',
      headers: { origin: 'https://evil.example', host: 'app.example' },
    });
    expect(hasValidOrigin(cross)).toBe(false);

    const same = new NextRequest('https://app.example/api/clubs', {
      method: 'POST',
      headers: { origin: 'https://app.example', host: 'app.example' },
    });
    expect(hasValidOrigin(same)).toBe(true);

    const server = new NextRequest('https://app.example/api/clubs', { method: 'POST' });
    expect(hasValidOrigin(server)).toBe(true);
  });

  it('valide les UUID et normalise les dates', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('pas-un-uuid')).toBe(false);
    expect(parseIso('2026-11-13T10:00:00.000Z', 'fallback')).toBe('2026-11-13T10:00:00.000Z');
    expect(parseIso('n’importe quoi', 'fallback')).toBe('fallback');
  });

  it('sérialise un ClubResult en 200 ou en statut d’erreur', async () => {
    const ok = respondClubResult({ ok: true, data: { id: 'x' } }, 201);
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ data: { id: 'x' } });

    const refused = respondClubResult({ ok: false, error: 'CAPACITY_FULL', message: 'Complet' });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'CAPACITY_FULL', message: 'Complet' });
  });
});

describe('G02 API — projections des lignes', () => {
  it('projette un club, ses sports et sa vérification', () => {
    const club = mapClubRow({
      id: 'c1',
      slug: 'trail-alpes',
      name: 'Trail Alpes',
      description: 'Sorties',
      category: 'trail',
      sports: ['trail', 'running'],
      privacy: 'private',
      is_verified: true,
      verification_badge_label: 'Club officiel',
      created_by: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(club.privacy).toBe('closed');
    expect(club.sports).toEqual(['trail', 'running']);
    expect(club.verification.status).toBe('verified');
    expect(club.verification.eligibleSports).toEqual(['trail']);
  });

  it('projette un membre avec opt-out et badge pro', () => {
    const member = mapMemberRow(
      {
        club_id: 'c1',
        user_id: 'u1',
        role: 'admin',
        status: 'active',
        joined_at: '2026-02-01T00:00:00.000Z',
        leaderboard_opt_in: false,
        is_pro_athlete: true,
        verified_sports: ['trail'],
      },
      { id: 'u1', full_name: 'Alice', avatar_url: null, trust_score: null },
    );
    expect(member.displayName).toBe('Alice');
    expect(member.role).toBe('admin');
    expect(member.leaderboardOptIn).toBe(false);
    expect(member.isProAthlete).toBe(true);
  });

  it('projette une sortie avec groupes d’allure et une inscription', () => {
    const event = mapEventRow({
      id: 'e1',
      club_id: 'c1',
      organizer_id: 'u1',
      title: 'Belledonne',
      sport: 'trail',
      format: 'race',
      starts_at: '2026-11-15T08:00:00.000Z',
      event_date: '2026-11-15T08:00:00.000Z',
      visibility: 'public',
      max_participants: 10,
      pace_groups: [{ id: 'pg', label: 'Chill', targetPaceLabel: '6:30/km' }],
      route_revision: 3,
    });
    expect(event.format).toBe('race');
    expect(event.visibility).toBe('public');
    expect(event.paceGroups[0].label).toBe('Chill');
    expect(event.routeRevision).toBe(3);

    const registration = mapRegistrationRow({ event_id: 'e1', user_id: 'u1', status: 'waitlist' });
    expect(registration.status).toBe('waitlist');
  });

  it('projette une invitation et un lien partageable', () => {
    const invite = mapInviteRow({
      id: 'i1',
      token: 'tok',
      kind: 'event',
      target_id: 'e1',
      created_by: 'u1',
      uses_count: 2,
      max_uses: 5,
      share_url: 'https://lkdv.fr/invite/tok',
      qr_payload: 'lkdv://invite/event/e1?token=tok',
    });
    expect(invite.kind).toBe('event');
    expect(invite.usesCount).toBe(2);
    expect(invite.shareUrl).toContain('/invite/tok');
  });
});
