import { getActiveDestinationId, type DestinationId } from './destinationRegistry';

export type NativeGlassDestination = Extract<DestinationId, 'community' | 'me'>;

/**
 * Single eligibility contract shared by the native/web bridge and unit tests.
 * Respect existing full-screen composer, auth and checkout exclusions.
 * A native bar never appears on an unrelated page or in Safari.
 */
export function getNativeGlassDestination(pathname: string | null): NativeGlassDestination | null {
  if (!pathname) return null;
  if (
    ['/connexion', '/inscription', '/checkout', '/communaute/publier']
      .some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  ) return null;

  const destination = getActiveDestinationId(pathname);
  return destination === 'community' || destination === 'me' ? destination : null;
}
