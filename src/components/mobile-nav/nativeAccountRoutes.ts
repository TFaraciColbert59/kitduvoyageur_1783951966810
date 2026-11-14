import { getActiveDestinationId, type DestinationId } from './destinationRegistry';

/** Full-screen routes where TabBar should be hidden (auth, checkout, studio modal). */
const NO_NAV_PREFIXES = ['/connexion', '/inscription', '/checkout', '/kit-studio'] as const;

/** Backward-compatible helper: Compas is now fully supported natively on all platforms. */
export function isProtectedCompasRoute(_pathname: string | null | undefined): boolean {
  return false;
}

export function shouldShowNativeGlass(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-kit-studio-open') === 'true' ||
      document.body.getAttribute('data-kit-studio-open') === 'true' ||
      Boolean(document.querySelector('.ks-root, [data-studio-scene]')))
  ) {
    return false;
  }
  return !NO_NAV_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function getNativeGlassDestination(pathname: string | null): DestinationId | null {
  if (!shouldShowNativeGlass(pathname)) return null;
  return getActiveDestinationId(pathname);
}
