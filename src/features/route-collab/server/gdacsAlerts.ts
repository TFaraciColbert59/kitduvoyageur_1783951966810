import 'server-only';
import { appUserAgent } from '@/lib/userAgent';
import { readBodyBounded } from '@/features/compas/server/officialAlerts';
import { GDACS_EVENT_TYPES, parseGdacs, worldHazardPayload, type GdacsEvent, type WorldHazardPayload } from '../analyse/gdacs';

/**
 * Lecture du flux public GDACS (sans clé, sans donnée personnelle : User-Agent de l'application). Le flux est mondial
 * et indépendant du tracé : une lecture, gardée 5 minutes en mémoire de l'instance, sert tous les tracés. Délai de 8 s,
 * corps borné à 4 Mo, un échec n'est pas rappelé avant 1 minute. Toute panne = « indisponible », jamais « rien ».
 */
const TTL_MS = 5 * 60_000;
const MAX_STALE_MS = 10 * 60_000;
const RETRY_AFTER_FAILURE_MS = 60_000;
const MAX_BYTES = 4 * 1024 * 1024;

let kept: { at: number; events: GdacsEvent[] } | null = null;
let failedAt = 0;
let inFlight: Promise<GdacsEvent[] | null> | null = null;

export function resetGdacsCacheForTests(): void {
  kept = null;
  failedAt = 0;
  inFlight = null;
}

function feedUrl(now: Date): string {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 24 * 3600_000);
  return `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=${GDACS_EVENT_TYPES.join(';')}&alertlevel=Orange;Red&fromdate=${day(from)}&todate=${day(now)}`;
}

async function download(now: Date): Promise<GdacsEvent[] | null> {
  try {
    const res = await fetch(feedUrl(now), {
      headers: { Accept: 'application/json', 'User-Agent': appUserAgent('Itinéraire, alertes') },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const text = await readBodyBounded(res, MAX_BYTES);
    return text == null ? null : parseGdacs(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function readWorldHazards(track: readonly { lat: number; lon: number }[], now: Date = new Date()): Promise<WorldHazardPayload> {
  if (track.length < 1) {
    return { status: 'unavailable', source: null, retrievedAt: null, reason: 'Tracé absent : les catastrophes mondiales ne peuvent pas être situées.', impacts: [] };
  }
  let events: GdacsEvent[] | null = null;
  let at = Date.now();
  if (kept && Date.now() - kept.at < TTL_MS) {
    events = kept.events;
    at = kept.at;
  } else if (Date.now() - failedAt >= RETRY_AFTER_FAILURE_MS) {
    inFlight ??= download(now).finally(() => {
      inFlight = null;
    });
    const fresh = await inFlight;
    if (fresh) {
      kept = { at: Date.now(), events: fresh };
      failedAt = 0;
      events = fresh;
      at = kept.at;
    } else {
      failedAt = Date.now();
    }
  }
  if (!events && kept && Date.now() - kept.at < MAX_STALE_MS) {
    events = kept.events;
    at = kept.at;
  }
  return worldHazardPayload(events, track, new Date(at).toISOString(), now);
}
