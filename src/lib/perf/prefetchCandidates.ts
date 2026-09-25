/** One likely next route is enough for background prefetch at idle. */
const LIKELY_NEXT_ROUTE: Record<string, string> = {
  '/': '/explorer',
  '/explorer': '/hors-ligne',
  '/communaute': '/carnets',
  '/hub': '/hub/itineraire',
  '/compte': '/profil',
  '/carnets': '/communaute',
};

export function getLikelyPrefetchRoute(pathname: string): string | null {
  const nextRoute = LIKELY_NEXT_ROUTE[pathname];
  return nextRoute && nextRoute !== pathname ? nextRoute : null;
}
