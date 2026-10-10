import { describe, it, expect } from 'vitest';
import {
  rerankWithDiversity,
  deterministicItemComparator,
  type RerankableItem,
} from '@/features/community/feed/domain/diversityReranker';

function makeItem(
  id: string,
  authorId: string,
  postType: string,
  score: number,
  createdAt = '2026-10-03T12:00:00Z'
): RerankableItem {
  return { id, authorId, postType, score, createdAt };
}

describe('Feed V1 Deterministic Diversity Reranker', () => {
  describe('Author Consecutive Constraint', () => {
    it('guarantees max 2 consecutive posts per author when alternative authors exist', () => {
      // Setup: Author 1 has top 4 highest scoring posts
      const candidates: RerankableItem[] = [
        makeItem('post-a1-1', 'author-1', 'post', 0.95),
        makeItem('post-a1-2', 'author-1', 'tip', 0.94),
        makeItem('post-a1-3', 'author-1', 'share', 0.93),
        makeItem('post-a1-4', 'author-1', 'question', 0.92),
        makeItem('post-a2-1', 'author-2', 'post', 0.80),
        makeItem('post-a3-1', 'author-3', 'tip', 0.75),
      ];

      const reranked = rerankWithDiversity(candidates, { maxConsecutivePerAuthor: 2 });

      // Check author sequence
      const authorSeq = reranked.map((item) => item.authorId);

      // Verify no 3 consecutive author-1
      for (let i = 0; i <= authorSeq.length - 3; i++) {
        const triplet = authorSeq.slice(i, i + 3);
        const allSame = triplet.every((a) => a === triplet[0]);
        expect(allSame).toBe(false);
      }

      // Check that author-2 or author-3 was interleaved after the 2nd author-1 item
      expect(authorSeq[0]).toBe('author-1');
      expect(authorSeq[1]).toBe('author-1');
      expect(authorSeq[2]).not.toBe('author-1');
    });

    it('gracefully preserves all items when all candidates come from a single author', () => {
      const singleAuthorCandidates: RerankableItem[] = [
        makeItem('post-1', 'solo-author', 'post', 0.90),
        makeItem('post-2', 'solo-author', 'tip', 0.85),
        makeItem('post-3', 'solo-author', 'share', 0.80),
        makeItem('post-4', 'solo-author', 'question', 0.75),
      ];

      const reranked = rerankWithDiversity(singleAuthorCandidates, { maxConsecutivePerAuthor: 2 });

      expect(reranked).toHaveLength(4);
      expect(reranked.map((r) => r.id)).toEqual(['post-1', 'post-2', 'post-3', 'post-4']);
    });
  });

  describe('Format / Typology Interleaving Constraint', () => {
    it('interleaves post types so max 2 consecutive posts of the exact same type appear', () => {
      // 4 consecutive tips with high scores, followed by shares and questions
      const candidates: RerankableItem[] = [
        makeItem('tip-1', 'author-1', 'tip', 0.99),
        makeItem('tip-2', 'author-2', 'tip', 0.98),
        makeItem('tip-3', 'author-3', 'tip', 0.97),
        makeItem('tip-4', 'author-4', 'tip', 0.96),
        makeItem('share-1', 'author-5', 'share', 0.85),
        makeItem('question-1', 'author-6', 'question', 0.80),
      ];

      const reranked = rerankWithDiversity(candidates, {
        maxConsecutivePerAuthor: 2,
        maxConsecutivePerFormat: 2,
      });

      const formatSeq = reranked.map((r) => r.postType);

      // Verify no 3 consecutive 'tip'
      for (let i = 0; i <= formatSeq.length - 3; i++) {
        const triplet = formatSeq.slice(i, i + 3);
        const allSame = triplet.every((fmt) => fmt === triplet[0]);
        expect(allSame).toBe(false);
      }

      expect(formatSeq[0]).toBe('tip');
      expect(formatSeq[1]).toBe('tip');
      expect(formatSeq[2]).not.toBe('tip'); // Interleaved with share-1
    });

    it('relaxes format constraint before author constraint when pool lacks format diversity', () => {
      // Only 'tip' post type available, but across different authors
      const allTips: RerankableItem[] = [
        makeItem('tip-a1-1', 'author-1', 'tip', 0.95),
        makeItem('tip-a1-2', 'author-1', 'tip', 0.94),
        makeItem('tip-a2-1', 'author-2', 'tip', 0.90),
        makeItem('tip-a3-1', 'author-3', 'tip', 0.85),
      ];

      const reranked = rerankWithDiversity(allTips, {
        maxConsecutivePerAuthor: 2,
        maxConsecutivePerFormat: 2,
      });

      expect(reranked).toHaveLength(4);
      // Author constraint should still be respected even though format constraint relaxed
      const authors = reranked.map((r) => r.authorId);
      expect(authors[0]).toBe('author-1');
      expect(authors[1]).toBe('author-1');
      expect(authors[2]).toBe('author-2');
    });
  });

  describe('Deterministic Tie-Breaking & Stability', () => {
    it('produces 100% identical reranked sequences across repeated executions', () => {
      const candidates: RerankableItem[] = [
        makeItem('c', 'author-2', 'share', 0.80, '2026-10-02T10:00:00Z'),
        makeItem('a', 'author-1', 'post', 0.90, '2026-10-03T10:00:00Z'),
        makeItem('b', 'author-1', 'post', 0.90, '2026-10-03T11:00:00Z'),
        makeItem('d', 'author-1', 'post', 0.85, '2026-10-01T10:00:00Z'),
        makeItem('e', 'author-3', 'tip', 0.75, '2026-10-03T09:00:00Z'),
      ];

      const run1 = rerankWithDiversity(candidates);
      const run2 = rerankWithDiversity(candidates);
      const run3 = rerankWithDiversity(candidates);

      const ids1 = run1.map((r) => r.id);
      const ids2 = run2.map((r) => r.id);
      const ids3 = run3.map((r) => r.id);

      expect(ids1).toEqual(ids2);
      expect(ids2).toEqual(ids3);
    });

    it('breaks ties deterministically on (score DESC, createdAt DESC, id ASC)', () => {
      const itemTieScoreDateA = makeItem('post-alpha', 'author-1', 'post', 0.80, '2026-10-03T10:00:00Z');
      const itemTieScoreDateB = makeItem('post-beta', 'author-2', 'post', 0.80, '2026-10-03T10:00:00Z');

      // Both score 0.80 and same date: alpha comes before beta because of id ASC
      expect(deterministicItemComparator(itemTieScoreDateA, itemTieScoreDateB)).toBeLessThan(0);
      expect(deterministicItemComparator(itemTieScoreDateB, itemTieScoreDateA)).toBeGreaterThan(0);

      // Score difference takes priority over date
      const higherScore = makeItem('post-z', 'author-3', 'post', 0.85, '2026-10-01T00:00:00Z');
      expect(deterministicItemComparator(higherScore, itemTieScoreDateA)).toBeLessThan(0);

      // Date difference takes priority over ID
      const newerPost = makeItem('post-z', 'author-3', 'post', 0.80, '2026-10-03T12:00:00Z');
      expect(deterministicItemComparator(newerPost, itemTieScoreDateA)).toBeLessThan(0);
    });

    it('preserves all items without losing any candidates', () => {
      const candidates: RerankableItem[] = Array.from({ length: 25 }, (_, i) =>
        makeItem(`item-${i}`, `author-${i % 3}`, i % 2 === 0 ? 'tip' : 'share', 0.5 + (i * 0.01))
      );

      const reranked = rerankWithDiversity(candidates);
      expect(reranked).toHaveLength(25);

      const originalIds = new Set(candidates.map((c) => c.id));
      const rerankedIds = new Set(reranked.map((c) => c.id));
      expect(rerankedIds).toEqual(originalIds);
    });
  });
});
