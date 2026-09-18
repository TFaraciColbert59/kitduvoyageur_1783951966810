export interface GlassPolicyHints {
  saveData?: boolean;
  reducedTransparency?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

/**
 * Determines whether glass optical effects should be reduced to standard or solid mode
 * based on client environment hints (hardware concurrency, device memory, user accessibility preferences).
 */
export function shouldReduceGlassEffects(hints: GlassPolicyHints): boolean {
  if (hints.saveData || hints.reducedTransparency) {
    return true;
  }

  const isConcurrencyWeak =
    hints.hardwareConcurrency !== undefined &&
    hints.hardwareConcurrency > 0 &&
    hints.hardwareConcurrency <= 4;

  const isMemoryWeak =
    hints.deviceMemory !== undefined &&
    hints.deviceMemory > 0 &&
    hints.deviceMemory <= 4;

  return isConcurrencyWeak || isMemoryWeak;
}
