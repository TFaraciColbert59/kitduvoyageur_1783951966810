export type ActivityLogisticsScope = 'none' | 'access' | 'stages' | 'full';

export interface ActivityCatalogItem {
  id: string;
  slug: string;
  label: string;
  family: string;
  description: string;
  logisticsScope: ActivityLogisticsScope;
  sportTags: string[];
  metrics: Record<string, unknown>;
  isSeed: boolean;
}

const FAMILY_ALIASES: Record<string, string[]> = {
  hiking: ['hiking', 'trekking', 'bivouac', 'camping'],
  trekking: ['trekking', 'hiking', 'bivouac', 'camping'],
  bivouac: ['bivouac', 'camping', 'hiking'],
  roadtrip: ['roadtrip', 'van', 'motor', 'cycling'],
  cultural: ['culture', 'city', 'gastronomy'],
  bushcraft: ['camping', 'hiking', 'bivouac'],
  mixed: ['hiking', 'culture', 'roadtrip', 'cycling', 'water'],
};

const SCORE_BY_SCOPE: Record<ActivityLogisticsScope, number> = {
  none: 1,
  access: 2,
  stages: 3,
  full: 4,
};

/** Tri déterministe, sans mutation : famille pertinente d'abord, puis logistique. */
export function rankActivityCatalog(
  items: readonly ActivityCatalogItem[],
  primaryActivity: string | null | undefined,
  limit = 12,
): ActivityCatalogItem[] {
  const family = String(primaryActivity ?? '').trim().toLowerCase();
  const aliases = FAMILY_ALIASES[family] ?? [family];
  const max = Math.max(0, Math.min(48, Math.floor(limit) || 12));

  return items
    .map((item, index) => {
      const familyIndex = aliases.indexOf(item.family.toLowerCase());
      const familyScore = familyIndex === -1 ? 0 : aliases.length - familyIndex;
      const scopeScore = SCORE_BY_SCOPE[item.logisticsScope] ?? 0;
      return { item, index, familyScore, score: familyScore * 100 + scopeScore };
    })
    .filter(({ familyScore }) => familyScore > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .map(({ item }) => item);
}
