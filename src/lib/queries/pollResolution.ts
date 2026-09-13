/**
 * TRIBU Phase 4 — resolution des sondages a la lecture (jamais stockee).
 *
 * Types :
 *  - `simple`             : informationnel, adopte des qu'un gagnant existe ;
 *  - `quorum_majority`    : adopte si voix(gagnant) >= ceil(seuil x membres actifs) ;
 *  - `organizer_approval` : adopte si un organizer/co actif a vote pour le gagnant.
 * Egalite ou absence de vote ⇒ pas de gagnant, jamais adopte.
 */

export const POLL_TYPES = ['simple', 'quorum_majority', 'organizer_approval'] as const;
export type PollType = (typeof POLL_TYPES)[number];

export const DEFAULT_QUORUM_THRESHOLD = 0.5;

export type PollResolutionReason =
  | 'simple'
  | 'no_votes'
  | 'tie'
  | 'quorum_reached'
  | 'quorum_missing'
  | 'organizer_approved'
  | 'organizer_missing';

export interface PollResolution {
  pollType: PollType;
  winnerIndex: number | null;
  counts: number[];
  requiredVotes: number | null;
  adopted: boolean;
  reason: PollResolutionReason;
}

export interface PollResolutionInput {
  poll: {
    pollType?: string | null;
    quorumThreshold?: number | null;
    options?: unknown[] | null;
  };
  votes: Array<{ optionIndex: number }>;
  activeMembers: number;
  organizerVotes: Array<{ optionIndex: number }>;
}

function normalizePollType(value: string | null | undefined): PollType {
  return (POLL_TYPES as readonly string[]).includes(value ?? '')
    ? (value as PollType)
    : 'simple';
}

export function resolvePoll(input: PollResolutionInput): PollResolution {
  const pollType = normalizePollType(input.poll.pollType);
  const optionsCount = Array.isArray(input.poll.options) ? input.poll.options.length : 0;

  const maxIndex = input.votes.reduce(
    (max, vote) => Math.max(max, vote.optionIndex),
    Math.max(0, optionsCount - 1)
  );
  const counts = new Array<number>(maxIndex + 1).fill(0);
  for (const vote of input.votes) {
    if (vote.optionIndex >= 0) counts[vote.optionIndex] += 1;
  }

  if (input.votes.length === 0) {
    return { pollType, winnerIndex: null, counts, requiredVotes: null, adopted: false, reason: 'no_votes' };
  }

  const maxCount = Math.max(...counts);
  const winners = counts
    .map((count, index) => ({ count, index }))
    .filter((entry) => entry.count === maxCount);

  if (winners.length !== 1 || maxCount === 0) {
    return { pollType, winnerIndex: null, counts, requiredVotes: null, adopted: false, reason: 'tie' };
  }

  const winnerIndex = winners[0].index;

  if (pollType === 'simple') {
    return { pollType, winnerIndex, counts, requiredVotes: null, adopted: true, reason: 'simple' };
  }

  if (pollType === 'quorum_majority') {
    const threshold =
      typeof input.poll.quorumThreshold === 'number' && input.poll.quorumThreshold > 0
        ? input.poll.quorumThreshold
        : DEFAULT_QUORUM_THRESHOLD;
    const requiredVotes = Math.ceil(threshold * Math.max(0, input.activeMembers));
    const adopted = maxCount >= requiredVotes;
    return {
      pollType,
      winnerIndex,
      counts,
      requiredVotes,
      adopted,
      reason: adopted ? 'quorum_reached' : 'quorum_missing',
    };
  }

  const approved = input.organizerVotes.some((vote) => vote.optionIndex === winnerIndex);
  return {
    pollType,
    winnerIndex,
    counts,
    requiredVotes: null,
    adopted: approved,
    reason: approved ? 'organizer_approved' : 'organizer_missing',
  };
}
