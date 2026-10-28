import { describe, expect, it } from 'vitest';
import { appendUnique, cursorOf, FEED_PAGE_SIZE, hasMorePages, olderThanFilter } from '../feed-cursor';

describe('cursorOf', () => {
  it('prend le dernier post de la page', () => {
    expect(cursorOf([{ id: 'a', created_at: '2026-06-02T08:00:00+00:00' }, { id: 'b', created_at: '2026-06-01T08:00:00+00:00' }])).toEqual({
      createdAt: '2026-06-01T08:00:00+00:00',
      id: 'b',
    });
  });

  it('null pour une page vide ou sans horodatage', () => {
    expect(cursorOf([])).toBeNull();
    expect(cursorOf([{ id: 'a', created_at: null }])).toBeNull();
    expect(cursorOf([{ created_at: '2026-06-01T08:00:00Z' }])).toBeNull();
  });
});

describe('olderThanFilter', () => {
  it('compare strictement, avec départage par id, valeurs entre guillemets', () => {
    expect(olderThanFilter({ createdAt: '2026-06-01T08:00:00+00:00', id: 'abc' })).toBe(
      'created_at.lt."2026-06-01T08:00:00+00:00",and(created_at.eq."2026-06-01T08:00:00+00:00",id.lt."abc")',
    );
  });

  it('ne laisse pas un guillemet fermer la valeur (injection de filtre)', () => {
    const filter = olderThanFilter({ createdAt: '2026"),id.gt.("', id: 'x"' });
    expect(filter.match(/"/g)?.length).toBe(6);
    expect(filter).not.toContain('"),id');
  });
});

describe('pages', () => {
  it('une page pleine annonce une suite, une page courte non', () => {
    expect(hasMorePages(FEED_PAGE_SIZE)).toBe(true);
    expect(hasMorePages(FEED_PAGE_SIZE - 1)).toBe(false);
    expect(hasMorePages(0)).toBe(false);
  });

  it('ne duplique jamais un post déjà affiché', () => {
    const out = appendUnique([{ id: '1' }, { id: '2' }], [{ id: '2' }, { id: '3' }]);
    expect(out.map((p) => p.id)).toEqual(['1', '2', '3']);
  });
});
