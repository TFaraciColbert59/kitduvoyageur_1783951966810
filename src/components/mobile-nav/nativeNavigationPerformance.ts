import type { DestinationId } from './destinationRegistry';

/**
 * One route prewarm policy, intentionally bounded to preserve outdoor data.
 * Native iOS can identify Wi-Fi via Capacitor Network (Safari cannot).
 * Never prefetch Compas or user-specific deep links.
 */
export const NATIVE_PREFETCH_ROUTES: readonly { id: DestinationId; href: string }[] = [
  { id: 'adventures', href: '/hub' },
  { id: 'community', href: '/communaute' },
  { id: 'explorer', href: '/explorer' },
  { id: 'messages', href: '/messagerie' },
  { id: 'me', href: '/compte' },
];

export function getNativePrefetchRoutes(currentPath: string): string[] {
  const seen = new Set<string>();
  return NATIVE_PREFETCH_ROUTES
    .map(({ href }) => href)
    .filter((href) => href !== currentPath && !seen.has(href) && Boolean(seen.add(href)));
}

export interface NativeSyncState {
  visible: boolean;
  selectedId: DestinationId | null;
}

/** Avoid repeated expensive Swift calls on nested-route or plateau updates. */
export function nativeSyncKey(next: NativeSyncState, pathname: string | null): string {
  return [next.visible ? '1' : '0', next.selectedId || '-', pathname || ''].join('|');
}
