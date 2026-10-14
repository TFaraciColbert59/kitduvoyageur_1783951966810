import { getActiveDestinationId } from './destinationRegistry';

/**
 * The UIKit Liquid Glass tab bar is a pilot for ALL account-owned routes only.
 * Never show it for sign-in / sign-up or unrelated routes.
 */
export function shouldUseNativeAccountBar(pathname: string | null): boolean {
  if (!pathname || pathname.startsWith('/connexion') || pathname.startsWith('/inscription')) {
    return false;
  }
  return getActiveDestinationId(pathname) === 'me';
}
