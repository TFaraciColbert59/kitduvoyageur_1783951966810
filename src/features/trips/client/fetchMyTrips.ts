/**
 * Cache mémoire court pour `/api/voyages/mine`.
 *
 * Le provider de voyage actif et le bootstrap du Compte demandent la même
 * liste au même moment. Une seule requête part, les autres consomment la
 * même promesse ; le résultat reste frais 15 s.
 */
export interface MyTripsPayload {
  trips?: unknown[];
  [key: string]: unknown;
}

let cachedAt = 0;
let cached: MyTripsPayload | null = null;
let inFlight: Promise<MyTripsPayload> | null = null;

export async function fetchMyTripsCached(): Promise<MyTripsPayload> {
  const now = Date.now();
  if (cached && now - cachedAt < 15_000) return cached;
  if (inFlight) return inFlight;
  inFlight = fetch('/api/voyages/mine', { headers: { accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) throw new Error('Trip list unavailable');
      const data = (await response.json()) as MyTripsPayload;
      cached = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
