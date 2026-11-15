import { describe, expect, it } from 'vitest';
import { recommendInspiration } from '../engine/recommendations';
import type { InspirationCandidate, InspirationHistory } from '../types';
import { FOLLOWER, OTHER, OWNER } from './fixtures';

const history: InspirationHistory = {
  sportCounts: { hike: 8, mtb: 2 },
  regionCounts: { Chamonix: 3 },
  followedAuthorIds: ['author-followed'],
  savedCollectionIds: ['saved-collection'],
  savedHighlightIds: [],
};

const candidate = (overrides: Partial<InspirationCandidate> = {}): InspirationCandidate => ({
  id: 'candidate-1',
  type: 'route',
  title: 'Tour du lac',
  sport: 'hike',
  region: 'Chamonix',
  authorId: 'author-a',
  audience: 'public',
  updatedAt: '2026-11-10T10:00:00.000Z',
  ...overrides,
});

describe('K1.10 — fil d’inspiration personnalisé', () => {
  it('remonte le sport principal et la région suivie, avec une raison lisible', () => {
    const result = recommendInspiration(history, [candidate()], OTHER, '2026-11-11T10:00:00.000Z');
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('Dans une région que tu suis');
    expect(result[0].score).toBeGreaterThan(6);
  });

  it('explique un auteur suivi et une collection déjà enregistrée', () => {
    const followed = recommendInspiration(
      history,
      [candidate({ sport: 'road', region: null, authorId: 'author-followed' })],
      OTHER,
      '2026-11-11T10:00:00.000Z'
    )[0];
    expect(followed.reason).toBe('Un auteur que tu suis');
    const saved = recommendInspiration(
      history,
      [
        candidate({
          id: 'saved-collection',
          type: 'collection',
          sport: 'road',
          region: null,
          authorId: null,
        }),
      ],
      OTHER,
      '2026-11-11T10:00:00.000Z'
    )[0];
    expect(saved.reason).toBe('Déjà enregistré');
  });

  it('exclut un contenu privé ou abonnés non autorisé', () => {
    expect(
      recommendInspiration(
        history,
        [candidate({ audience: 'private' })],
        OTHER,
        '2026-11-11T10:00:00.000Z'
      )
    ).toHaveLength(0);
    expect(
      recommendInspiration(
        history,
        [candidate({ audience: 'followers' })],
        OTHER,
        '2026-11-11T10:00:00.000Z'
      )
    ).toHaveLength(0);
    expect(
      recommendInspiration(
        history,
        [candidate({ audience: 'followers', authorId: 'author-followed' })],
        FOLLOWER,
        '2026-11-11T10:00:00.000Z'
      )
    ).toHaveLength(1);
    expect(
      recommendInspiration(
        history,
        [candidate({ audience: 'private' })],
        OWNER,
        '2026-11-11T10:00:00.000Z'
      )
    ).toHaveLength(0);
  });

  it('trie par score décroissant et respecte la limite', () => {
    const result = recommendInspiration(
      history,
      [
        candidate({
          id: 'low',
          sport: 'road',
          region: 'Ailleurs',
          updatedAt: '2020-01-01T00:00:00.000Z',
        }),
        candidate({ id: 'high' }),
      ],
      OTHER,
      '2026-11-11T10:00:00.000Z',
      1
    );
    expect(result).toHaveLength(1);
    expect(result[0].candidate.id).toBe('high');
  });
});
