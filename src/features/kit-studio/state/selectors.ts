/**
 * src/features/kit-studio/state/selectors.ts
 * Pure selector computing derived totals from KitConfiguration.
 *
 * DATA HONESTY RULES:
 * 1. weightG === null represents unknown weight. NEVER coerced to 0g.
 * 2. Totals are derived, never stored in DB or writable state.
 * 3. Volume is null if bag or slots are unmodeled / unreliable.
 * 4. Zero fake "sac parfait" scores or grades.
 */

import type { DerivedTotals, KitConfiguration } from './types';

export function selectDerivedTotals(config: KitConfiguration): DerivedTotals {
  let knownWeightG = 0;
  let unknownWeightCount = 0;
  let itemCount = 0;
  let checkedCount = 0;

  for (const item of config.items) {
    const qty = Math.max(1, item.quantity ?? 1);
    itemCount += qty;

    if (item.isChecked) {
      checkedCount += qty;
    }

    if (item.weightG === null || item.weightG === undefined || Number.isNaN(item.weightG)) {
      unknownWeightCount += qty;
    } else {
      knownWeightG += Math.max(0, item.weightG) * qty;
    }
  }

  // Volume estimation: only computed if the bag has declared capacity and modeled interior slots
  let volumeEstimateL: number | null = null;
  if (
    config.bag.modelId !== null &&
    config.bag.declaredCapacityL !== null &&
    config.bag.capabilities.hasInterior
  ) {
    const totalSlotCapacity = Object.values(config.slots).reduce(
      (sum, slot) => (slot.capacityL !== null ? sum + slot.capacityL : sum),
      0
    );
    volumeEstimateL = totalSlotCapacity > 0 ? Number(totalSlotCapacity.toFixed(1)) : null;
  }

  return {
    knownWeightG,
    unknownWeightCount,
    itemCount,
    checkedCount,
    volumeEstimateL,
  };
}

/**
 * Explicit unit weight formatter (g / kg).
 * French typographic conventions, zero ambiguity.
 */
export function formatWeight(weightG: number): string {
  if (weightG < 1000) {
    return `${Math.round(weightG)} g`;
  }
  const kg = weightG / 1000;
  return `${kg.toFixed(1).replace('.', ',')} kg`;
}

/**
 * Display formatter for kit weight status:
 * - If itemCount === 0 -> "0 g"
 * - If unknownWeightCount === 0 -> "8,4 kg"
 * - If unknownWeightCount > 0 and knownWeightG === 0 -> "—" with "+ N non pesés"
 * - If unknownWeightCount > 0 and knownWeightG > 0 -> "8,4 kg + N non pesés"
 */
export function formatWeightSummary(totals: DerivedTotals): {
  primary: string;
  secondary: string | null;
  fullLabel: string;
} {
  if (totals.itemCount === 0) {
    return { primary: '0 g', secondary: null, fullLabel: '0 g' };
  }

  if (totals.unknownWeightCount === 0) {
    const formatted = formatWeight(totals.knownWeightG);
    return { primary: formatted, secondary: null, fullLabel: formatted };
  }

  const unknownText = `+ ${totals.unknownWeightCount} non pesé${totals.unknownWeightCount > 1 ? 's' : ''}`;

  if (totals.knownWeightG === 0) {
    return {
      primary: '—',
      secondary: `${totals.unknownWeightCount} objet${totals.unknownWeightCount > 1 ? 's' : ''} non pesé${totals.unknownWeightCount > 1 ? 's' : ''}`,
      fullLabel: `— (${totals.unknownWeightCount} non pesé${totals.unknownWeightCount > 1 ? 's' : ''})`,
    };
  }

  const formattedKnown = formatWeight(totals.knownWeightG);
  return {
    primary: formattedKnown,
    secondary: unknownText,
    fullLabel: `${formattedKnown} ${unknownText}`,
  };
}
