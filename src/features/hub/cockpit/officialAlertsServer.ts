/**
 * Connecteurs réels et gratuits (sans clé API requise) pour :
 * - P03-19 : Alertes météo officielles MeteoAlarm CAP/Atom (EUMETNET / Météo-France, CC BY 4.0)
 * - P03-20 : Feux actifs officiels NASA EONET v3 (domaine public NASA)
 */

export interface OfficialWeatherAlert {
  id: string;
  title: string;
  event: string;
  severity: string;
  area: string;
  expires: string | null;
  source: 'MeteoAlarm (CAP 1.2)';
}

export interface ActiveWildfireEvent {
  id: string;
  title: string;
  lat: number;
  lon: number;
  distanceKm: number;
  date: string | null;
  source: 'NASA EONET v3';
}

export interface OfficialAlertsPayload {
  fetchedAt: string;
  weatherAlerts: {
    status: 'ok' | 'unavailable';
    country: string;
    items: OfficialWeatherAlert[];
  };
  wildfires: {
    status: 'ok' | 'unavailable';
    radiusKm: number;
    items: ActiveWildfireEvent[];
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function extractTag(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

export function parseMeteoAlarmAtom(xml: string, limit = 12): OfficialWeatherAlert[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const alerts: OfficialWeatherAlert[] = [];
  for (const entry of entries) {
    const id = extractTag(entry, 'id');
    const title = extractTag(entry, 'title');
    const event = extractTag(entry, 'cap:event') || title;
    const severity = extractTag(entry, 'cap:severity') || 'Unknown';
    const area = extractTag(entry, 'cap:areaDesc');
    const expires = extractTag(entry, 'cap:expires') || null;
    if (!title && !event) continue;
    alerts.push({
      id: id || `${event}-${area}`,
      title: title || event,
      event,
      severity,
      area,
      expires,
      source: 'MeteoAlarm (CAP 1.2)',
    });
    if (alerts.length >= limit) break;
  }
  return alerts;
}

export function filterEonetWildfires(
  json: unknown,
  lat: number,
  lon: number,
  radiusKm = 150,
): ActiveWildfireEvent[] {
  if (!json || typeof json !== 'object') return [];
  const events = (json as { events?: unknown[] }).events;
  if (!Array.isArray(events)) return [];

  const matched: ActiveWildfireEvent[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const rec = ev as {
      id?: string;
      title?: string;
      geometry?: Array<{ date?: string; coordinates?: unknown }>;
    };
    const latest = Array.isArray(rec.geometry) ? rec.geometry[rec.geometry.length - 1] : null;
    if (!latest || !Array.isArray(latest.coordinates) || latest.coordinates.length < 2) continue;
    const evLon = Number(latest.coordinates[0]);
    const evLat = Number(latest.coordinates[1]);
    if (!Number.isFinite(evLat) || !Number.isFinite(evLon)) continue;
    const dist = Math.round(haversineKm(lat, lon, evLat, evLon) * 10) / 10;
    if (dist <= radiusKm) {
      matched.push({
        id: String(rec.id ?? `${evLat},${evLon}`),
        title: String(rec.title ?? 'Incendie actif'),
        lat: evLat,
        lon: evLon,
        distanceKm: dist,
        date: latest.date ? String(latest.date) : null,
        source: 'NASA EONET v3',
      });
    }
  }
  return matched.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10);
}

const ALLOWED_COUNTRIES = new Set([
  'france', 'italy', 'spain', 'switzerland', 'germany', 'belgium', 'austria', 'portugal', 'norway', 'sweden',
]);

export async function fetchOfficialTerrainAlerts(input: {
  lat: number;
  lon: number;
  country?: string;
  radiusKm?: number;
}): Promise<OfficialAlertsPayload> {
  const country = ALLOWED_COUNTRIES.has((input.country ?? 'france').toLowerCase())
    ? (input.country ?? 'france').toLowerCase()
    : 'france';
  const radiusKm = Math.min(300, Math.max(25, input.radiusKm ?? 150));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const [meteoRes, eonetRes] = await Promise.allSettled([
      fetch(`https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${country}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'LeKitDuVoyageur/1.0 (+https://koosmoweb.fr)' },
        next: { revalidate: 900 },
      }),
      fetch('https://eonet.gsfc.nasa.gov/api/v3/categories/wildfires?status=open&limit=100', {
        signal: controller.signal,
        headers: { 'User-Agent': 'LeKitDuVoyageur/1.0 (+https://koosmoweb.fr)' },
        next: { revalidate: 900 },
      }),
    ]);

    let weatherAlerts: OfficialAlertsPayload['weatherAlerts'] = { status: 'unavailable', country, items: [] };
    if (meteoRes.status === 'fulfilled' && meteoRes.value.ok) {
      const xml = await meteoRes.value.text();
      weatherAlerts = { status: 'ok', country, items: parseMeteoAlarmAtom(xml) };
    }

    let wildfires: OfficialAlertsPayload['wildfires'] = { status: 'unavailable', radiusKm, items: [] };
    if (eonetRes.status === 'fulfilled' && eonetRes.value.ok) {
      const json = await eonetRes.value.json();
      wildfires = { status: 'ok', radiusKm, items: filterEonetWildfires(json, input.lat, input.lon, radiusKm) };
    }

    return {
      fetchedAt: new Date().toISOString(),
      weatherAlerts,
      wildfires,
    };
  } finally {
    clearTimeout(timeout);
  }
}
