'use client';

/**
 * Applique les préférences d'accessibilité persistées à chaque page (Lot O02-UI).
 *
 * Monté une seule fois dans le layout racine : il relit le stockage versionné,
 * suit les changements système (`prefers-reduced-motion`, `prefers-contrast`,
 * `forced-colors`) et pose `data-high-contrast`, `data-reduced-motion`,
 * `data-enhanced-focus`, `data-text-scale` et `--lkdv-text-scale` sur `<html>`.
 */

import { useAccessibilityPreferences } from '@/features/accessibility';

export function AccessibilityRuntime() {
  useAccessibilityPreferences();
  return null;
}

export default AccessibilityRuntime;
