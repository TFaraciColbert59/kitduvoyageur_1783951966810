/** One likely next route is enough for background prefetch at idle. */
const LIKELY_NEXT_ROUTE: Record<string, string> = {
  '/': '/explorer',
  '/explorer': '/hub',
  '/communaute': '/communaute',
  '/hub': '/hub/itineraire',
  '/compte': '/profil',
  '/communaute': '/communaute',
};

export function getLikelyPrefetchRoute(pathname: string): string | null {
  const nextRoute = LIKELY_NEXT_ROUTE[pathname];
  return nextRoute && nextRoute !== pathname ? nextRoute : null;
}
