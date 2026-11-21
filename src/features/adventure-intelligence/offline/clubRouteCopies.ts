import { routeLines } from '@/features/explorer-v2/geo/track';
import { MAX_OFFLINE_PACK_BYTES } from '../domain/offlinePack';
import { getOfflineDb } from './db';

const PREFIX = 'club-event-route:';

export type ClubRouteSegments = Array<Array<[number, number]>>;

export function clubRouteSegments(value: unknown): ClubRouteSegments {
  return routeLines(value).map((line) => line.map(([lng, lat]) => [lat, lng]));
}

function copyKey(eventId: string, revision: number) {
  return `${PREFIX}${eventId}:${revision}`;
}

export async function readClubRouteCopy(userId: string, eventId: string, revision: number) {
  const copy = await getOfflineDb(userId).offline_routes.get(copyKey(eventId, revision));
  const payload = copy?.payload;
  if (!payload || typeof payload !== 'object' || !('version' in payload) || payload.version !== 1
    || !('geometry' in payload)) return [];
  return clubRouteSegments(payload.geometry);
}

export async function saveClubRouteCopy(
  userId: string,
  eventId: string,
  revision: number,
  segments: ClubRouteSegments,
  signal: AbortSignal,
) {
  const payload = {
    version: 1,
    geometry: {
      type: 'MultiLineString',
      coordinates: segments.map((line) => line.map(([lat, lng]) => [lng, lat])),
    },
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_OFFLINE_PACK_BYTES) {
    throw new Error('Club route copy exceeds offline storage limit');
  }
  const db = getOfflineDb(userId);
  await db.transaction('rw', db.offline_routes, async () => {
    signal.throwIfAborted();
    await db.offline_routes.put({
      id: copyKey(eventId, revision),
      payload,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function removeClubRouteCopy(userId: string, eventId: string, revision: number) {
  await getOfflineDb(userId).offline_routes.delete(copyKey(eventId, revision));
}

export async function purgeClubRouteCopies(userId: string) {
  await getOfflineDb(userId).offline_routes.where('id').startsWith(PREFIX).delete();
}
