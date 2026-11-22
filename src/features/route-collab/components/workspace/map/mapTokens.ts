/**
 * MapLibre ne lit pas `var(--lkv-*)` : les couleurs de la carte sont résolues à l'exécution depuis les
 * jetons du design système, à la même valeur que le reste de l'interface (aucune couleur écrite en dur ici).
 * Hors navigateur (tests, rendu serveur), le repli est le vert forêt primaire, jeton `--lkv-primary`.
 */

export const DAY_COLOR_TOKENS = [
  '--lkv-forest-500',
  '--lkv-info',
  '--lkv-warning',
  '--lkv-sage-500',
  '--lkv-danger',
  '--lkv-warm-700',
  '--lkv-forest-300',
  '--lkv-amber-800',
] as const;

export const SLOPE_COLOR_TOKENS: Readonly<Record<string, string>> = {
  flat: '--lkv-sage-300',
  moderate: '--lkv-warning',
  sustained: '--lkv-warm-700',
  steep: '--lkv-danger',
  unknown: '--lkv-ink-300',
};

export const SURFACE_COLOR_TOKENS: Readonly<Record<string, string>> = {
  paved: '--lkv-info',
  unpaved: '--lkv-warm-700',
  trail: '--lkv-forest-500',
  rock: '--lkv-ink-500',
  unknown: '--lkv-ink-300',
};

export function readToken(name: string): string {
  if (typeof document === 'undefined') return 'rgb(23, 64, 44)';
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || 'rgb(23, 64, 44)';
}

export function readTokens(names: readonly string[]): string[] {
  return names.map(readToken);
}
