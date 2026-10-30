/** Short-lived trip requests belong to one authenticated session generation. */
export interface MyTripsPayload {
  trips?: unknown[];
  [key: string]: unknown;
}

let authUserId: string | null = null;
let generation = 0;
let cachedAt = 0;
let cached: MyTripsPayload | null = null;
let inFlight: Promise<MyTripsPayload> | null = null;

export function invalidateMyTripsSession(): void {
  generation += 1;
  cachedAt = 0;
  cached = null;
  inFlight = null;
}

/** Called synchronously by auth, before React publishes the new identity. */
export function setMyTripsAuthUser(userId: string | null, newSession = false): void {
  if (authUserId === userId && !newSession) return;
  authUserId = userId;
  invalidateMyTripsSession();
}

export function getMyTripsSessionGeneration(): number { return generation; }

export function isMyTripsSessionCurrent(userId: string, expectedGeneration: number): boolean {
  return Boolean(userId) && authUserId === userId && generation === expectedGeneration;
}

export async function fetchMyTripsCached(userId: string): Promise<MyTripsPayload> {
  const requestGeneration = generation;
  if (!isMyTripsSessionCurrent(userId, requestGeneration)) throw new Error('Authenticated trip owner required');
  if (cached && Date.now() - cachedAt < 15_000) return cached;
  if (inFlight) return inFlight;
  const request = fetch('/api/voyages/mine', { headers: { accept: 'application/json' }, cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Trip list unavailable');
      const data = (await response.json()) as MyTripsPayload;
      if (!isMyTripsSessionCurrent(userId, requestGeneration)) throw new Error('Trip session changed');
      cached = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}
