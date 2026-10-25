import type { ContextualGearRecommendation, ShopProductReference, TripKitAnalysis } from '@/features/trips/types/kit.types';
import type { TripFull, TripItem, TripPurchaseState } from '@/features/trips/types/trip.types';
import type { TripItemImage } from '../server/getTripItemImages';

export const GEAR_CATEGORY_LABELS: Record<string, string> = {
  shelter: 'Abri',
  sleep: 'Couchage',
  clothing: 'Vêtements',
  cook: 'Cuisine',
  water: 'Eau',
  tech: 'Tech',
  safety: 'Sécurité',
  navigation: 'Navigation',
  misc: 'Divers',
  'Vivres & Eau': 'Vivres & Eau',
};

export function gearCategoryLabel(category: string | null | undefined): string {
  if (!category) return GEAR_CATEGORY_LABELS.misc;
  return GEAR_CATEGORY_LABELS[category] ?? category;
}

export interface GearCardData {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string;
  weightKg: number | null;
  quantity: number;
  isPacked: boolean;
  isConsumable: boolean;
  isWorn: boolean;
  isVital: boolean;
  imageUrl: string | null;
}

function itemWeightGrams(item: TripItem): number {
  return (Number(item.weight_grams) || 0) * (Number(item.quantity) || 1);
}

export function buildGearCards(
  trip: TripFull,
  images: TripItemImage[] = [],
): GearCardData[] {
  const urlByItemId = new Map(images.map((i) => [i.itemId, i.url] as const));
  const items = [...(trip.items ?? [])].sort(
    (a, b) =>
      Number(a.is_packed) - Number(b.is_packed) ||
      Number(Boolean(b.is_vital)) - Number(Boolean(a.is_vital)) ||
      (a.item_name || '').localeCompare(b.item_name || '', 'fr'),
  );

  return items.map((item) => {
    const grams = Number(item.weight_grams);
    return {
      id: item.id,
      name: item.item_name,
      category: item.category ?? null,
      categoryLabel: gearCategoryLabel(item.category),
      weightKg: Number.isFinite(grams) && grams > 0 ? Math.round((grams / 1000) * 100) / 100 : null,
      quantity: Number(item.quantity) || 1,
      isPacked: Boolean(item.is_packed),
      isConsumable: Boolean(item.is_consumable),
      isWorn: Boolean(item.is_worn),
      isVital: Boolean(item.is_vital),
      imageUrl: urlByItemId.get(item.id) ?? null,
    };
  });
}

export interface MemberResource {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isOwner: boolean;
  packedWeightKg: number;
  packedItems: number;
  totalWeightKg: number;
  progressPct: number;
}

export function buildMemberResources(trip: TripFull): MemberResource[] {
  const collaborators = trip.collaborators ?? [];
  const items = trip.items ?? [];
  const totalGrams = items.reduce((sum, item) => sum + itemWeightGrams(item), 0);

  const memberIds = new Set<string>();
  if (trip.user_id) memberIds.add(trip.user_id);
  for (const c of collaborators) if (c.user_id) memberIds.add(c.user_id);

  const packedByMember = new Map<string, { items: number; grams: number }>();
  for (const item of items) {
    if (!item.is_packed || !item.packed_by) continue;
    const current = packedByMember.get(item.packed_by) ?? { items: 0, grams: 0 };
    current.items += 1;
    current.grams += itemWeightGrams(item);
    packedByMember.set(item.packed_by, current);
  }

  const rows: MemberResource[] = [];
  const ownerId = trip.user_id;
  if (ownerId) {
    const stats = packedByMember.get(ownerId) ?? { items: 0, grams: 0 };
    rows.push({
      userId: ownerId,
      name: 'Vous',
      avatarUrl: null,
      isOwner: true,
      packedWeightKg: Math.round((stats.grams / 1000) * 10) / 10,
      packedItems: stats.items,
      totalWeightKg: Math.round((totalGrams / 1000) * 10) / 10,
      progressPct: totalGrams > 0 ? Math.round((stats.grams / totalGrams) * 100) : 0,
    });
  }

  for (const c of collaborators) {
    if (!c.user_id || c.user_id === ownerId) continue;
    const stats = packedByMember.get(c.user_id) ?? { items: 0, grams: 0 };
    rows.push({
      userId: c.user_id,
      name: c.profile?.full_name ?? c.profile?.username ?? 'Compagnon',
      avatarUrl: c.profile?.avatar_url ?? null,
      isOwner: false,
      packedWeightKg: Math.round((stats.grams / 1000) * 10) / 10,
      packedItems: stats.items,
      totalWeightKg: Math.round((totalGrams / 1000) * 10) / 10,
      progressPct: totalGrams > 0 ? Math.round((stats.grams / totalGrams) * 100) : 0,
    });
  }

  return rows;
}

export function isSoloTrip(trip: TripFull): boolean {
  return (trip.collaborators ?? []).length === 0;
}

export const PURCHASE_META: Record<
  TripPurchaseState,
  { label: string; action: string; next: TripPurchaseState }
> = {
  needed: { label: 'À ajouter', action: 'Ajouter', next: 'added' },
  added: { label: 'Ajouté', action: 'Au panier', next: 'in_cart' },
  in_cart: { label: 'Au panier', action: 'En livraison', next: 'shipping' },
  shipping: { label: 'En livraison', action: 'Recommencer', next: 'needed' },
};

export function nextPurchaseState(state: TripPurchaseState): TripPurchaseState {
  return (PURCHASE_META[state] ?? PURCHASE_META.needed).next;
}

/**
 * Jauge du tiroir « Ce qui manque » : 100% quand plus rien n'est à ajouter.
 * `needed` = éléments encore à obtenir ; les états added/in_cart/shipping comptent comme traités.
 */
export function missingProgressPct(rows: MissingRow[]): number {
  if (rows.length === 0) return 100;
  const needed = rows.filter((row) => row.state === 'needed').length;
  return Math.round(((rows.length - needed) / rows.length) * 100);
}

export interface MissingRow {
  key: string;
  name: string;
  brand: string | null;
  priceEur: number | null;
  weightGrams: number | null;
  imageUrl: string | null;
  productId: string | null;
  productSlug: string | null;
  state: TripPurchaseState;
  tripItemId: string | null;
  recommendation: ContextualGearRecommendation | null;
}

function normName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildMissingRows(
  analysis: TripKitAnalysis,
  tripItems: TripItem[],
  images: TripItemImage[] = [],
  products: ShopProductReference[] = [],
): MissingRow[] {
  const urlByItemId = new Map(images.map((i) => [i.itemId, i.url] as const));
  const productById = new Map(products.map((p) => [p.id, p] as const));
  const items = tripItems ?? [];
  const usedItemIds = new Set<string>();
  const rows: MissingRow[] = [];
  const seenGapKeys = new Set<string>();

  const gaps = [...(analysis.vitalGaps ?? []), ...(analysis.recommendedGaps ?? [])];
  for (const gap of gaps) {
    const key = gap.key || gap.id || gap.name;
    if (seenGapKeys.has(key)) continue;
    seenGapKeys.add(key);

    const productId = gap.shopProduct?.id ?? null;
    const gapName = gap.shopProduct?.name ?? gap.name;
    const matched =
      (productId ? items.find((i) => i.shop_product_id === productId) : undefined) ??
      items.find((i) => normName(i.item_name) === normName(gapName));
    if (matched) {
      if (usedItemIds.has(matched.id)) continue;
      usedItemIds.add(matched.id);
    }

    rows.push({
      key,
      name: gapName,
      brand: gap.shopProduct?.brand ?? null,
      priceEur: gap.shopProduct?.price_eur ?? null,
      weightGrams: gap.weightGrams ?? gap.shopProduct?.weight_g ?? null,
      imageUrl: gap.shopProduct?.image ?? (matched ? urlByItemId.get(matched.id) ?? null : null),
      productId: gap.shopProduct?.id ?? null,
      productSlug: gap.shopProduct?.slug ?? null,
      state: matched?.purchase_state ?? 'needed',
      tripItemId: matched?.id ?? null,
      recommendation: gap,
    });
  }

  for (const item of items) {
    const state = item.purchase_state ?? 'needed';
    if (usedItemIds.has(item.id)) continue;
    if (state === 'needed') continue;
    const product = item.shop_product_id ? productById.get(item.shop_product_id) ?? null : null;
    rows.push({
      key: `item-${item.id}`,
      name: product?.name ?? item.item_name,
      brand: product?.brand ?? null,
      priceEur: product?.price_eur ?? null,
      weightGrams: Number(item.weight_grams) || product?.weight_g || null,
      imageUrl: urlByItemId.get(item.id) ?? product?.image ?? null,
      productId: product?.id ?? null,
      productSlug: product?.slug ?? null,
      state,
      tripItemId: item.id,
      recommendation: null,
    });
  }

  const order: Record<TripPurchaseState, number> = { needed: 0, added: 1, in_cart: 2, shipping: 3 };
  return rows.sort((a, b) => order[a.state] - order[b.state]);
}

export interface GearInfoCard {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warn' | 'accent';
}

export function formatKg(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '0 kg';
  const kg = grams / 1000;
  return `${kg >= 10 ? Math.round(kg * 10) / 10 : Math.round(kg * 100) / 100}`.replace('.', ',') + ' kg';
}

export function buildGearInfoCards(analysis: TripKitAnalysis): GearInfoCard[] {
  const cards: GearInfoCard[] = [
    {
      key: 'total',
      label: 'Poids du sac',
      value: formatKg(analysis.totalWeightGrams),
      hint: `${analysis.packedItemsCount}/${analysis.totalItemsCount} objets emballés`,
      tone: 'accent',
    },
    {
      key: 'completion',
      label: 'Emballage',
      value: `${Math.min(100, Math.max(0, analysis.completionPercent))}%`,
      hint: `${analysis.packedVitalCount}/${analysis.vitalItemsCount} essentiels`,
    },
    {
      key: 'base',
      label: 'Équipement de base',
      value: formatKg(analysis.baseWeightGrams),
      hint: 'hors consommables',
    },
    {
      key: 'worn',
      label: 'Vêtements portés',
      value: formatKg(analysis.wornWeightGrams),
      hint: 'porté, pas dans le sac',
    },
    {
      key: 'consumables',
      label: 'Consommables',
      value: formatKg(analysis.consumableWeightGrams),
      hint: 'eau, repas, gaz',
    },
    {
      key: 'vital-gaps',
      label: 'Essentiels manquants',
      value: String(analysis.vitalGaps?.length ?? 0),
      hint: 'à avoir avant le départ',
      tone: (analysis.vitalGaps?.length ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      key: 'recommended-gaps',
      label: 'Suggestions',
      value: String(analysis.recommendedGaps?.length ?? 0),
      hint: 'recommandé',
    },
  ];
  return cards;
}
