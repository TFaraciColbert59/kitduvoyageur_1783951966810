import { describe, expect, it } from 'vitest';
import { mapActivityRows } from '@/lib/heatmaps/activityRows';

const SESSION = {
  id: 'session-1',
  user_id: 'user-1',
  sport: 'rando',
  status: 'finished',
  share_level: 'none',
  started_at: '2026-06-10T09:00:00.000Z',
  ended_at: '2026-06-10T11:00:00.000Z',
};

const POINTS = [
  { session_id: 'session-1', t: '2026-06-10T09:20:00.000Z', lat: 45.832789, lng: 6.865319, ele: 1200 },
  { session_id: 'session-1', t: '2026-06-10T09:15:00.000Z', lat: 45.832621, lng: 6.865172, ele: 1195 },
];

describe('mapActivityRows', () => {
  it('trie les points et conserve une activité terminée', () => {
    const [record] = mapActivityRows([SESSION], POINTS, 'personal');
    expect(record.activityId).toBe('session-1');
    expect(record.points.map((point) => point.timestamp)).toEqual([
      '2026-06-10T09:15:00.000Z',
      '2026-06-10T09:20:00.000Z',
    ]);
    expect(record.sessionFinished).toBe(true);
  });

  it('n’expose jamais une séance non terminée', () => {
    expect(mapActivityRows([{ ...SESSION, status: 'live' }], POINTS, 'community')).toEqual([]);
  });

  it('ignore un sport hors taxonomie et les points hors bornes', () => {
    const records = mapActivityRows(
      [{ ...SESSION, sport: 'surf' }],
      POINTS,
      'community'
    );
    expect(records).toEqual([]);

    const withInvalid = mapActivityRows(
      [SESSION],
      [{ session_id: 'session-1', t: '2026-06-10T09:15:00.000Z', lat: 999, lng: 6.8 }],
      'personal'
    );
    expect(withInvalid).toEqual([]);
  });

  it('marque la visibilité personnelle réelle et la visibilité communautaire agrégée', () => {
    const [personal] = mapActivityRows([SESSION], POINTS, 'personal');
    expect(personal.visibility).toBe('private');
    expect(personal.isPrivate).toBe(true);

    const [community] = mapActivityRows([SESSION], POINTS, 'community');
    expect(community.visibility).toBe('collective_anonymized');
    expect(community.isPrivate).toBe(false);
  });

  it('mappe followers/group vers leurs niveaux de visibilité', () => {
    const [followers] = mapActivityRows(
      [{ ...SESSION, share_level: 'followers' }],
      POINTS,
      'personal'
    );
    expect(followers.visibility).toBe('followers_only');

    const [group] = mapActivityRows(
      [{ ...SESSION, share_level: 'group' }],
      POINTS,
      'personal'
    );
    expect(group.visibility).toBe('collective_anonymized');
  });

  it('ignore une date de début invalide', () => {
    expect(
      mapActivityRows([{ ...SESSION, started_at: 'pas-une-date' }], POINTS, 'personal')
    ).toEqual([]);
  });
});
