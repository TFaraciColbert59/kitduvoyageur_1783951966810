import { describe, expect, it } from 'vitest';
import {
  parseLeaderboardQuery,
  parseLegendsQuery,
  parsePeersQuery,
  parsePositiveInt,
  parseReferenceDate,
} from '../query';

describe('validation des requêtes rankings', () => {
  it('applique les valeurs par défaut du classement', () => {
    const parsed = parseLeaderboardQuery(new URLSearchParams());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.query).toMatchObject({
      periodKind: 'weekly',
      metric: 'distanceMeters',
      sport: 'all',
      scope: 'public',
    });
    expect(parsed.value.limit).toBe(25);
  });

  it('accepte les filtres connus et borne la limite', () => {
    const parsed = parseLeaderboardQuery(
      new URLSearchParams({
        period: 'monthly',
        metric: 'elevationGainMeters',
        sport: 'trail',
        scope: 'club',
        limit: '100',
        referenceDate: '2026-11-13T12:00:00.000Z',
      })
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.query.metric).toBe('elevationGainMeters');
    expect(parsed.value.query.scope).toBe('club');
    expect(parsed.value.limit).toBe(100);
  });

  it('refuse une date invalide et une limite hors bornes', () => {
    expect(parseReferenceDate('pas-une-date').ok).toBe(false);
    expect(parsePositiveInt('0', 25, 1, 100).ok).toBe(false);
    expect(parsePositiveInt('101', 25, 1, 100).ok).toBe(false);
    expect(parsePositiveInt('2.5', 25, 1, 100).ok).toBe(false);
    expect(
      parseLeaderboardQuery(new URLSearchParams({ referenceDate: 'nope' })).ok
    ).toBe(false);
  });

  it('valide les cibles Local Legends et les pairs', () => {
    const legends = parseLegendsQuery(
      new URLSearchParams({
        targetType: 'segment',
        targetId: '42',
        windowDays: '30',
        minEfforts: '3',
      })
    );
    expect(legends.ok).toBe(true);
    if (!legends.ok) return;
    expect(legends.value).toMatchObject({
      targetType: 'segment',
      targetId: '42',
      windowDays: 30,
      minEffortsRequired: 3,
    });

    const peers = parsePeersQuery(
      new URLSearchParams({ period: 'monthly', sport: 'hiking' })
    );
    expect(peers.ok).toBe(true);
    if (!peers.ok) return;
    expect(peers.value.periodKind).toBe('monthly');
    expect(peers.value.sport).toBe('hiking');
  });
});
