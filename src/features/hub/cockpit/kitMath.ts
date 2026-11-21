export interface KitItemSummary {
  id: string;
  title: string;
  amount: number;
  packed: boolean;
  day?: number | null;
  weightGrams?: number | null;
  worn?: boolean;
  consumable?: boolean;
  vital?: boolean;
  shared?: boolean;
  ownerId?: string | null;
}

export interface KitWeightBreakdown {
  baseWeightGrams: number;
  wornWeightGrams: number;
  consumableWeightGrams: number;
  totalWeightGrams: number;
  packedWeightGrams: number;
  vitalUnpackedCount: number;
  sharedCount: number;
}

export function computeKitWeights(items: KitItemSummary[]): KitWeightBreakdown {
  let baseWeightGrams = 0;
  let wornWeightGrams = 0;
  let consumableWeightGrams = 0;
  let packedWeightGrams = 0;
  let vitalUnpackedCount = 0;
  let sharedCount = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.round(item.amount || 1));
    const unit = item.weightGrams != null && Number.isFinite(item.weightGrams) && item.weightGrams > 0
      ? item.weightGrams
      : 0;
    const total = Math.round(unit * qty);

    if (item.worn) wornWeightGrams += total;
    else if (item.consumable) consumableWeightGrams += total;
    else baseWeightGrams += total;

    if (item.packed) packedWeightGrams += total;
    if (item.vital && !item.packed) vitalUnpackedCount += 1;
    if (item.shared) sharedCount += 1;
  }

  return {
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    totalWeightGrams: baseWeightGrams + wornWeightGrams + consumableWeightGrams,
    packedWeightGrams,
    vitalUnpackedCount,
    sharedCount,
  };
}

export function formatWeight(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '0 g';
  if (grams >= 1000) {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(grams / 1000)} kg`;
  }
  return `${Math.round(grams)} g`;
}
