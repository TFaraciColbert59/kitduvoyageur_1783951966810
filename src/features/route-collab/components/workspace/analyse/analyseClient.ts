/**
 * Appel de `/api/itineraire/analyse` (météo au passage, feux) : `fetch` injectable. Une panne ou une réponse
 * illisible rend `null` pour la partie concernée : l'écran dit « non lu », il ne comble rien.
 */
import type { DayPassage, PassageWeather } from '../../../analyse/passageWeather';
import type { FireAlertPayload, OfficialAlertsPayload } from '../../../analyse/alerts';
import type { WorldHazardPayload } from '../../../analyse/gdacs';

export interface AnalyseRemote {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly weather: readonly PassageWeather[] | null;
  readonly fire: FireAlertPayload | null;
  readonly official: OfficialAlertsPayload | null;
  readonly world: WorldHazardPayload | null;
  readonly horizon: string | null;
  readonly fetchedAt: string | null;
}

export const NO_REMOTE: AnalyseRemote = { status: 'idle', weather: null, fire: null, official: null, world: null, horizon: null, fetchedAt: null };

export type AnalyseFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; credentials: 'include' },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function fetchAnalyseRemote(
  passages: readonly DayPassage[],
  track: readonly { lat: number; lon: number }[],
  fetchFn: AnalyseFetch = (url, init) => fetch(url, init),
): Promise<AnalyseRemote> {
  try {
    const res = await fetchFn('/api/itineraire/analyse', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: passages.slice(0, 21).map((p) => ({ day: p.day, dateIso: p.dateIso, lat: p.lat, lon: p.lon, passageLocal: p.passageLocal, timezone: p.timezone, basis: p.basis })),
        ...(track.length >= 2 ? { track: track.slice(0, 300) } : {}),
      }),
    });
    if (!res.ok) return { ...NO_REMOTE, status: 'error' };
    const data = (await res.json()) as Partial<{ weather: PassageWeather[]; fire: FireAlertPayload | null; official: OfficialAlertsPayload | null; world: WorldHazardPayload | null; horizon: string | null; fetchedAt: string }>;
    return {
      status: 'ready',
      weather: Array.isArray(data.weather) ? data.weather : null,
      fire: data.fire ?? null,
      official: data.official ?? null,
      world: data.world ?? null,
      horizon: data.horizon ?? null,
      fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : null,
    };
  } catch {
    return { ...NO_REMOTE, status: 'error' };
  }
}
