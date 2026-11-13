import { describe, expect, it } from 'vitest';
import {
  readAccountPractice,
  readPracticeHistory,
} from '../client/readAccountPractice';

const NOW = Date.parse('2026-11-11T12:00:00.000Z');

function iso(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * 3_600_000).toISOString();
}

describe('lecture de la pratique Compte', () => {
  it('retourne absent sans sorties', () => {
    expect(readAccountPractice(null, NOW).status).toBe('absent');
    expect(readAccountPractice({}, NOW).status).toBe('absent');
    expect(readAccountPractice({ outings: [] }, NOW).status).toBe('absent');
  });

  it('ignore les sorties à venir', () => {
    const snapshot = readAccountPractice(
      {
        outings: [
          {
            startedAt: iso(-48),
            endedAt: iso(-47),
            status: 'upcoming',
          },
        ],
      },
      NOW
    );
    expect(snapshot.status).toBe('absent');
  });

  it('lit la dernière sortie terminée et compte les sept derniers jours', () => {
    const snapshot = readAccountPractice(
      {
        outings: [
          { startedAt: iso(2), endedAt: iso(1), status: 'done' },
          { startedAt: iso(30), endedAt: iso(29), status: 'done' },
          { startedAt: iso(24 * 9), endedAt: iso(24 * 9 - 1), status: 'done' },
        ],
      },
      NOW
    );

    expect(snapshot.status).toBe('available');
    expect(snapshot.lastPracticeAt).toBe(iso(1));
    expect(snapshot.sessionsLast7d).toBe(2);
    expect(snapshot.sport).toBeNull();
    expect(snapshot.sportStatus).toBe('unknown');
  });


  it('préfère une date de début valide quand la fin est illisible', () => {
    const snapshot = readAccountPractice(
      {
        outings: [
          {
            startedAt: iso(3),
            endedAt: 'pas-une-date',
            status: 'done',
          },
        ],
      },
      NOW
    );
    expect(snapshot.status).toBe('available');
    expect(snapshot.lastPracticeAt).toBe(iso(3));
  });

  it('signale un payload partiel quand aucune date n’est lisible', () => {
    const snapshot = readAccountPractice(
      { outings: [{ startedAt: 'nope', status: 'done' }] },
      NOW
    );
    expect(snapshot.status).toBe('partial');
    expect(snapshot.lastPracticeAt).toBeNull();
    expect(snapshot.sessionsLast7d).toBeNull();
  });

  it('expose un historique utilisable ou null', () => {
    const history = readPracticeHistory(
      { outings: [{ startedAt: iso(3), endedAt: iso(2), status: 'done' }] },
      NOW
    );
    expect(history).toEqual({
      sessionsLast7d: 1,
      lastPracticeAt: iso(2),
      sport: null,
      sportStatus: 'unknown',
    });
    expect(readPracticeHistory(null, NOW)).toBeNull();
  });
});
