/**
 * LKDV Feed V1 - Deterministic Diversity Reranker
 *
 * Guarantees:
 * 1. Author Constraint: Max 2 consecutive items per author (configurable).
 * 2. Format / Typology Constraint: Max 2 consecutive items of identical post type (configurable).
 * 3. 100% Deterministic: No stochastic shuffle; stable tie-breaking on score, createdAt, and ID.
 * 4. Graceful Fallback: When the candidate pool is exhausted of alternative authors or formats,
 *    relaxes format first, then author.
 */

import type { RerankOptions } from '../types/feed.types';

export interface RerankableItem {
  id: string;
  authorId: string;
  postType: string;
  score: number;
  createdAt: string;
}

/**
 * Deterministic tie-breaking comparator:
 * 1. Score descending (higher score first)
 * 2. CreatedAt descending (newer first)
 * 3. Id ascending (lexicographical tie-breaker)
 */
export function deterministicItemComparator<T extends RerankableItem>(a: T, b: T): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  const dateComparison = b.createdAt.localeCompare(a.createdAt);
  if (dateComparison !== 0) {
    return dateComparison;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Reranks scored candidates to enforce author and format diversity.
 * Pure functional implementation with zero stochasticity.
 */
export function rerankWithDiversity<T extends RerankableItem>(
  candidates: readonly T[],
  options: RerankOptions = {}
): T[] {
  const maxAuthor = Math.max(1, options.maxConsecutivePerAuthor ?? 2);
  const maxFormat = Math.max(1, options.maxConsecutivePerFormat ?? 2);

  if (candidates.length <= 1) {
    return [...candidates];
  }

  // Step 1: Initial deterministic sort
  const remaining: T[] = [...candidates].sort(deterministicItemComparator);
  const result: T[] = [];

  // Step 2: Greedy selection loop
  while (remaining.length > 0) {
    let selectedIndex = -1;

    // Pass 1: Try to find a candidate satisfying BOTH author and format constraints
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const recentAuthors = result.slice(-maxAuthor).map((r) => r.authorId);
      const recentFormats = result.slice(-maxFormat).map((r) => r.postType);

      const violatesAuthor =
        recentAuthors.length === maxAuthor &&
        recentAuthors.every((author) => author === candidate.authorId);

      const violatesFormat =
        recentFormats.length === maxFormat &&
        recentFormats.every((fmt) => fmt === candidate.postType);

      if (!violatesAuthor && !violatesFormat) {
        selectedIndex = i;
        break;
      }
    }

    // Pass 2: Fallback — relax format constraint if necessary, but keep author constraint
    if (selectedIndex === -1) {
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const recentAuthors = result.slice(-maxAuthor).map((r) => r.authorId);

        const violatesAuthor =
          recentAuthors.length === maxAuthor &&
          recentAuthors.every((author) => author === candidate.authorId);

        if (!violatesAuthor) {
          selectedIndex = i;
          break;
        }
      }
    }

    // Pass 3: Ultimate fallback — if all remaining candidates are from same author, pick top one
    if (selectedIndex === -1) {
      selectedIndex = 0;
    }

    const [chosen] = remaining.splice(selectedIndex, 1);
    result.push(chosen);
  }

  return result;
}
