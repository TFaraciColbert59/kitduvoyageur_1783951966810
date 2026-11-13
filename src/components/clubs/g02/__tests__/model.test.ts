import { describe, expect, it } from 'vitest';
import {
  METRIC_LABELS,
  PRIVACY_LABELS,
  challengeProgress,
  eventCapacity,
  eventRsvpStatus,
  formatDistance,
  formatDuration,
  formatEventDate,
  formatMetricValue,
  initials,
  inviteAvailability,
  inviteUsesLabel,
  isClubAdmin,
  isClubManager,
  leaderboardPodium,
  sortEventsForDisplay,
} from '../model';
import { makeChallenge, makeEvent, makeInvite, makeLeaderboard, makeMember, makeRegistration, NOW } from './fixtures';

describe('G02 — projections d’affichage', () => {
  it('formate durée, distance, dénivelé et métriques de défi', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(42 * 60)).toBe('42 min');
    expect(formatDuration(4 * 3600 + 12 * 60)).toBe('4 h 12');
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(12_400)).toBe('12,4 km');
    expect(formatMetricValue('activities_count', 1)).toBe('1 sortie');
    expect(formatMetricValue('activities_count', 3)).toBe('3 sorties');
    expect(METRIC_LABELS.distance_m).toBe('Distance');
    expect(PRIVACY_LABELS.secret).toBe('Sur invitation');
  });

  it('calcule la capacité et le statut RSVP sans compter les annulations', () => {
    const event = makeEvent();
    const registrations = [
      makeRegistration({ status: 'registered' }),
      makeRegistration({ userId: 'other', status: 'registered' }),
      makeRegistration({ userId: 'cancel', status: 'cancelled' }),
    ];
    expect(eventCapacity(event, registrations)).toMatchObject({
      registered: 2,
      waitlist: 0,
      remaining: 0,
      isFull: true,
      waitlistOpen: true,
    });
    expect(eventRsvpStatus(event.id, '33333333-3333-4333-8333-333333333333', registrations)).toBe('registered');
    expect(eventRsvpStatus(event.id, null, registrations)).toBe('none');
    expect(eventRsvpStatus(event.id, 'unknown', registrations)).toBe('none');
  });

  it('respecte les rôles : manager = admin ou modérateur actif', () => {
    expect(isClubManager(makeMember({ role: 'admin' }))).toBe(true);
    expect(isClubManager(makeMember({ role: 'moderator' }))).toBe(true);
    expect(isClubManager(makeMember({ role: 'member' }))).toBe(false);
    expect(isClubAdmin(makeMember({ role: 'admin', status: 'banned' }))).toBe(false);
  });

  it('borne la progression d’un défi entre 0 et 100 %', () => {
    const challenge = makeChallenge();
    expect(challengeProgress(challenge, 42_000)).toMatchObject({ pct: 42, isCompleted: false });
    expect(challengeProgress(challenge, 150_000).pct).toBe(100);
    expect(challengeProgress(challenge, 0).pct).toBe(0);
  });

  it('trie les sorties de façon stable et le podium par rang', () => {
    const early = makeEvent({ id: 'early', startsAt: '2026-11-14T08:00:00.000Z' });
    const late = makeEvent({ id: 'late', startsAt: '2026-11-16T08:00:00.000Z' });
    expect(sortEventsForDisplay([late, early]).map((event) => event.id)).toEqual(['early', 'late']);

    const leaderboard = makeLeaderboard();
    expect(leaderboardPodium(leaderboard.entries).map((entry) => entry.rank)).toEqual([1, 2]);
  });

  it('qualifie un lien révoqué, expiré ou épuisé avant consommation', () => {
    expect(inviteAvailability(makeInvite(), NOW)).toBe('active');
    expect(inviteAvailability(makeInvite({ revokedAt: NOW }), NOW)).toBe('revoked');
    expect(inviteAvailability(makeInvite({ expiresAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe('expired');
    expect(inviteAvailability(makeInvite({ usesCount: 2 }), NOW)).toBe('exhausted');
    expect(inviteUsesLabel(makeInvite())).toBe('0 / 2 utilisations');
  });

  it('produit des initiales lisibles et une date de sortie localisée', () => {
    expect(initials('Alice Martin')).toBe('AM');
    expect(initials('Alice')).toBe('AL');
    expect(initials('')).toBe('?');
    expect(formatEventDate('2026-11-15T08:00:00.000Z')).toMatch(/15/);
  });
});
