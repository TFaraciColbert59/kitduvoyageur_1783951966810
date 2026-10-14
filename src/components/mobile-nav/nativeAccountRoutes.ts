import { getActiveDestinationId, type DestinationId } from './destinationRegistry';

/** Never touch the Compas experience, including any future nested routes. */
export function isProtectedCompasRoute(pathname: string | null | undefined): boolean {
  return pathname === '/compas' || Boolean(pathname?.startsWith('/compas/'));
}

/** Same full-screen exclusions as MobileNavWrapper's existing web navigation. */
const NO_NAV_PREFIXES = ['/connexion', '/inscription', '/checkout', '/communaute/publier'] as const;

export function shouldShowNativeGlass(pathname: string | null | undefined): boolean {
  if (!pathname || isProtectedCompasRoute(pathname)) return false;
  return !NO_NAV_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

/**
 * Native remains usable on pages outside the five tab families.
 * Null there means NO TAB SELECTED, not "hide the bar".
 */
export function getNativeGlassDestination(pathname: string | null): DestinationId | null {
  if (!shouldShowNativeGlass(pathname)) return null;
  return getActiveDestinationId(pathname);
}
