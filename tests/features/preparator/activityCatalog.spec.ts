import { describe, expect, it } from 'vitest';
import { rankActivityCatalog, type ActivityCatalogItem } from '@/features/preparator/engine/activityCatalog';

const item = (overrides: Partial<ActivityCatalogItem>): ActivityCatalogItem => ({
  id: 'id',
  slug: 'slug',
  label: 'Label',
  family: 'hiking',
  description: '',
  logisticsScope: 'access',
  sportTags: [],
  metrics: {},
  isSeed: true,
  ...overrides,
});

describe('rankActivityCatalog', () => {
  it('classe les familles pertinentes avant les autres', () => {
    const result = rankActivityCatalog(
      [
        item({ id: 'other', family: 'culture' }),
        item({ id: 'trek', family: 'trekking', logisticsScope: 'stages' }),
        item({ id: 'hike', family: 'hiking', logisticsScope: 'access' }),
      ],
      'hiking',
      2,
    );
    expect(result.map((entry) => entry.id)).toEqual(['hike', 'trek']);
  });

  it('retourne une liste bornée et ne mute pas l’entrée', () => {
    const input = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })];
    const snapshot = structuredClone(input);
    expect(rankActivityCatalog(input, 'hiking', 2)).toHaveLength(2);
    expect(input).toEqual(snapshot);
  });

  it('ignore les activités hors famille quand aucune correspondance n’existe', () => {
    const result = rankActivityCatalog([item({ family: 'culture' })], 'hiking');
    expect(result).toEqual([]);
  });
});
