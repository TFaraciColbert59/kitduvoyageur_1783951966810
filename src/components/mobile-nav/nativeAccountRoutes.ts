import { getActiveDestinationId, type DestinationId } from './destinationRegistry';

/** Never touch the Compas experience, including any future nested routes. */
export function isProtectedCompasRoute(pathname: string | null | undefined): boolean {
  return pathname === '/compas' || Boolean(pathname?.startsWith('/compas/'));
}

/** Same full-screen exclusions as MobileNavWrapper's existing web navigation. */
export const NO_NAV_PREFIXES = ['/connexion', '/inscription', '/checkout', '/communaute/publier'] as const;

export function isNoBottomNavigationRoute(pathname: string | null | undefined): boolean {
  return Boolean(pathname && NO_NAV_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/')));
}

/** Community already has a category rail near the top; never duplicate it
 * in a fixed second rail above the system bottom bar. */
export function hasCommunityInPageTabs(pathname: string | null | undefined): boolean {
  return pathname === '/communaute';
}

export function shouldShowNativeGlass(pathname: string | null | undefined): boolean {
  if (!pathname || isProtectedCompasRoute(pathname)) return false;
  return !isNoBottomNavigationRoute(pathname);
}

/**
 * Native remains usable on pages outside the five tab families.
 * Null there means NO TAB SELECTED, not "hide the bar".
 */
export function getNativeGlassDestination(pathname: string | null): DestinationId | null {
  if (!shouldShowNativeGlass(pathname)) return null;
  return getActiveDestinationId(pathname);
}
