export type ActivityLogisticsScope = 'none' | 'access' | 'stages' | 'full';

/**
 * Volets de logistique derives du `logistics_scope` d'un format d'activite.
 *
 * Regle de produit (D-02, P2) : plus le scope est large, plus le format ouvre
 * de volets de reservation. La regle est PURE et explicite — un footing ne
 * propose jamais un vol, un bivouac ne propose jamais d'hotel, seul `full`
 * ouvre l'ensemble (vols, vehicules, hotellerie, budget).
 */
export type LogisticsVolet = 'access' | 'stages' | 'flights' | 'vehicles' | 'lodging' | 'budget';

export type LogisticsVolets = Readonly<Record<LogisticsVolet, boolean>>;

/** Ordre canonique d'affichage des volets (jamais reconstruit cote vue). */
export const LOGISTICS_VOLET_ORDER: readonly LogisticsVolet[] = [
  'access',
  'stages',
  'flights',
  'vehicles',
  'lodging',
  'budget',
] as const;

const VOLETS_BY_SCOPE: Record<ActivityLogisticsScope, LogisticsVolets> = {
  none: { access: false, stages: false, flights: false, vehicles: false, lodging: false, budget: false },
  access: { access: true, stages: false, flights: false, vehicles: false, lodging: false, budget: false },
  stages: { access: true, stages: true, flights: false, vehicles: false, lodging: false, budget: false },
  full: { access: true, stages: true, flights: true, vehicles: true, lodging: true, budget: true },
};

/**
 * Volets actifs pour un scope donne. Retourne un objet NEUF a chaque appel
 * (immuabilite) : l'appelant ne peut pas polluer la table de reference.
 */
export function logisticsVoletsFor(
  scope: ActivityLogisticsScope,
): LogisticsVolets {
  return { ...(VOLETS_BY_SCOPE[scope] ?? VOLETS_BY_SCOPE.none) };
}

/** Volets actifs dans l'ordre canonique, pour un rendu stable. */
export function activeLogisticsVolets(scope: ActivityLogisticsScope): LogisticsVolet[] {
  const volets = logisticsVoletsFor(scope);
  return LOGISTICS_VOLET_ORDER.filter((volet) => volets[volet]);
}

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
