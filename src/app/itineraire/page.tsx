import { redirect } from 'next/navigation';

interface ItineraireRedirectProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/itineraire` est fusionné avec `/explorer` : ouvre Explorer directement dans le
 * HUD de création d'itinéraire (`mode=plan`) sur la même carte 3D interactive.
 */
export default async function ItinerairePage({ searchParams }: ItineraireRedirectProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const qs = new URLSearchParams();
  if (resolved) {
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        qs.set(key, value);
      } else if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
        qs.set(key, value[0]);
      }
    }
  }
  if (!qs.has('mode')) {
    qs.set('mode', 'plan');
  }
  redirect(`/explorer?${qs.toString()}`);
}
