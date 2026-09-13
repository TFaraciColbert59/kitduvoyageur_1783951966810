import { describe, it, expect } from 'vitest';
import { resolvePoll, DEFAULT_QUORUM_THRESHOLD } from '@/lib/queries/pollResolution';

const OPTIONS = ['A', 'B', 'C'];

describe('resolvePoll', () => {
  it('simple : adopte dès qu’un gagnant unique existe', () => {
    const result = resolvePoll({
      poll: { pollType: 'simple', options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 0 }, { optionIndex: 1 }],
      activeMembers: 10,
      organizerVotes: [],
    });
    expect(result).toMatchObject({ winnerIndex: 0, adopted: true, reason: 'simple' });
    expect(result.counts).toEqual([2, 1, 0]);
  });

  it('absence de votes ou égalité : jamais adopté', () => {
    const noVotes = resolvePoll({
      poll: { pollType: 'simple', options: OPTIONS },
      votes: [],
      activeMembers: 10,
      organizerVotes: [],
    });
    expect(noVotes).toMatchObject({ winnerIndex: null, adopted: false, reason: 'no_votes' });

    const tie = resolvePoll({
      poll: { pollType: 'simple', options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 1 }],
      activeMembers: 10,
      organizerVotes: [],
    });
    expect(tie).toMatchObject({ winnerIndex: null, adopted: false, reason: 'tie' });
  });

  it('quorum_majority : seuil atteint ou non', () => {
    const reached = resolvePoll({
      poll: { pollType: 'quorum_majority', quorumThreshold: 0.5, options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 0 }, { optionIndex: 0 }, { optionIndex: 1 }],
      activeMembers: 6,
      organizerVotes: [],
    });
    expect(reached).toMatchObject({
      winnerIndex: 0,
      adopted: true,
      reason: 'quorum_reached',
      requiredVotes: 3,
    });

    const missing = resolvePoll({
      poll: { pollType: 'quorum_majority', quorumThreshold: 0.5, options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 1 }],
      activeMembers: 6,
      organizerVotes: [],
    });
    expect(missing).toMatchObject({
      winnerIndex: null,
      adopted: false,
    });

    const belowThreshold = resolvePoll({
      poll: { pollType: 'quorum_majority', quorumThreshold: 0.5, options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 1 }, { optionIndex: 1 }],
      activeMembers: 6,
      organizerVotes: [],
    });
    expect(belowThreshold).toMatchObject({
      winnerIndex: 1,
      adopted: false,
      reason: 'quorum_missing',
      requiredVotes: 3,
    });
  });

  it('quorum_majority : seuil par défaut 0.5 si absent', () => {
    const result = resolvePoll({
      poll: { pollType: 'quorum_majority', options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 0 }],
      activeMembers: 4,
      organizerVotes: [],
    });
    expect(result.requiredVotes).toBe(Math.ceil(DEFAULT_QUORUM_THRESHOLD * 4));
    expect(result.adopted).toBe(true);
  });

  it('organizer_approval : exige un vote d’organizer pour le gagnant', () => {
    const approved = resolvePoll({
      poll: { pollType: 'organizer_approval', options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 0 }, { optionIndex: 1 }],
      activeMembers: 5,
      organizerVotes: [{ optionIndex: 0 }],
    });
    expect(approved).toMatchObject({
      winnerIndex: 0,
      adopted: true,
      reason: 'organizer_approved',
    });

    const missing = resolvePoll({
      poll: { pollType: 'organizer_approval', options: OPTIONS },
      votes: [{ optionIndex: 0 }, { optionIndex: 0 }, { optionIndex: 1 }],
      activeMembers: 5,
      organizerVotes: [{ optionIndex: 1 }],
    });
    expect(missing).toMatchObject({
      winnerIndex: 0,
      adopted: false,
      reason: 'organizer_missing',
    });
  });

  it('type inconnu retombe sur simple', () => {
    const result = resolvePoll({
      poll: { pollType: 'mystere', options: OPTIONS },
      votes: [{ optionIndex: 1 }],
      activeMembers: 3,
      organizerVotes: [],
    });
    expect(result).toMatchObject({ pollType: 'simple', winnerIndex: 1, adopted: true });
  });
});
