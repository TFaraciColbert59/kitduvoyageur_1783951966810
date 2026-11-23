// Données de lecture de l'onglet « Analyser » de /compas/itineraire qui demandent un fournisseur :
//  - 7.4 la météo MET Norway (CC BY 4.0) au point et à l'heure de passage de chaque jour, lue par les vérifications
//    partagées avec le Compas (`getSharedChecks`, mêmes sources que ses tiroirs Météo et Vérifs) ; hors de
//    l'horizon de prévision la valeur reste inconnue ;
//  - 7.6 les alertes officielles Meteoalarm (même service que le tiroir Vérifs, `getOfficialAlerts`, lu avec
//    leur fin de validité) ;
//  - 7.6 les feux (NASA FIRMS, déjà intégré à l'Explorer) passés par `analyzeFireAlerts` sur le tracé.
// Session exigée, entrée validée par zod, lecture seule. Rien n'est comblé : une source muette rend « indisponible ».
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/api/requireUser';
import { ok, fail } from '@/lib/api/respond';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { getSharedChecks } from '@/features/route-collab/server/sharedChecks';
import { getOfficialAlerts } from '@/features/compas/server/officialAlerts';
import { analyzeFireAlerts, type FireIncident, type FireSource } from '@/features/routes/analysis/fire';
import { parseFirmsCsv } from '@/app/api/explorer/v2/fires/route';
import { passageWeatherOf, type DayPassage, type PassageWeather } from '@/features/route-collab/analyse/passageWeather';
import type { FireAlertPayload, OfficialAlertsPayload } from '@/features/route-collab/analyse/alerts';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = { scope: 'itineraire-analyse', limit: 20, windowMs: 60_000, failMode: 'open' as const };

const coord = {
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
};

const bodySchema = z
  .object({
    days: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(60),
            dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            ...coord,
            passageLocal: z.string().regex(/^\d{1,2}:\d{2}$/),
            timezone: z.string().min(1).max(64),
            basis: z.enum(['midday', 'departure']),
          })
          .strict(),
      )
      .max(21),
    /** Points du tracé (simplifié par la page) pour situer les feux ; absent : feux non lus. */
    track: z.array(z.object(coord).strict()).max(300).optional(),
  })
  .strict();

const FIRMS_SOURCE_NAME = 'NASA FIRMS · VIIRS NRT (48 h)';

async function readFire(track: readonly { lat: number; lon: number }[], signal: AbortSignal): Promise<FireAlertPayload> {
  const unavailable = (reason: string): FireAlertPayload => ({ status: 'unavailable', source: null, retrievedAt: null, reason, impacts: [] });
  if (track.length < 2) return unavailable('Tracé absent : les feux ne peuvent pas être situés.');
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim() ?? '';
  if (!key) return unavailable('Source feux actifs non configurée (NASA_FIRMS_MAP_KEY requise) : aucun « aucun feu » affiché.');
  const lats = track.map((p) => p.lat);
  const lons = track.map((p) => p.lon);
  // Marge d'environ 2 km autour du tracé, et la zone interrogée reste bornée (FIRMS limite la surface).
  const pad = 0.02;
  const minLat = Math.max(-90, Math.min(...lats) - pad);
  const maxLat = Math.min(90, Math.max(...lats) + pad);
  const minLon = Math.max(-180, Math.min(...lons) - pad);
  const maxLon = Math.min(180, Math.max(...lons) + pad);
  if (maxLat - minLat > 10 || maxLon - minLon > 10) return unavailable('Tracé trop étendu pour interroger les feux d’un seul tenant.');
  const area = `${minLon.toFixed(3)},${minLat.toFixed(3)},${maxLon.toFixed(3)},${maxLat.toFixed(3)}`;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/${area}/2`;
  let incidents: FireIncident[];
  try {
    const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]), cache: 'no-store' });
    if (!res.ok) return unavailable(`NASA FIRMS indisponible (${res.status}).`);
    incidents = parseFirmsCsv(await res.text());
  } catch {
    return unavailable('NASA FIRMS n’a pas répondu.');
  }
  const retrievedAt = new Date().toISOString();
  const source: FireSource = { name: FIRMS_SOURCE_NAME, retrievedAt, license: 'NASA EOSDIS Open Data' };
  const analysis = analyzeFireAlerts({ incidents, source, points: track, now: retrievedAt });
  const byId = new Map(incidents.map((i) => [i.id, i]));
  return {
    status: analysis.status,
    source: FIRMS_SOURCE_NAME,
    retrievedAt,
    reason: analysis.status === 'unavailable' ? (analysis.missing[0]?.message ?? null) : null,
    impacts: analysis.impacts.map((i) => {
      const inc = byId.get(i.incidentId);
      return {
        incidentId: i.incidentId,
        kind: i.kind,
        severity: i.severity,
        label: i.label,
        message: i.message,
        fromKm: Math.round(i.fromM / 100) / 10,
        toKm: Math.round(i.toM / 100) / 10,
        observedAt: inc?.observedAt ?? null,
        validUntil: inc?.validUntil ?? null,
        source: inc?.source ?? FIRMS_SOURCE_NAME,
      };
    }),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const limited = await enforceRateLimit(`${auth.user.id}:${clientIpFromHeaders(request.headers)}`, RATE_LIMIT);
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail('bad_request', 'json_invalide');
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail('bad_request', 'entree_invalide');
  const { days, track } = parsed.data;

  const fetchedAt = new Date().toISOString();
  const passageOf = (d: (typeof days)[number]): DayPassage => ({ day: d.day, dateIso: d.dateIso, lat: d.lat, lon: d.lon, passageLocal: d.passageLocal, timezone: d.timezone, basis: d.basis });
  let weather: PassageWeather[];
  let horizon: string | null = null;
  let official: OfficialAlertsPayload | null = null;
  try {
    const checks = days.length > 0
      ? await getSharedChecks({
          // Le point de référence de chaque jour est ici le point de passage (milieu de journée).
          days: days.map((d) => ({ day: d.day, dateIso: d.dateIso, title: `Jour ${d.day}`, lat: d.lat, lon: d.lon, distanceKm: null, gainM: null, lossM: null, walkMin: null, stay: null })),
          timeZone: days[0].timezone,
        })
      : null;
    const res = checks?.weather ?? null;
    horizon = res?.horizon ?? null;
    weather = days.map((d) => {
      const forecast = res?.tripDays.find((t) => t.day === d.day)?.forecast ?? null;
      return passageWeatherOf(passageOf(d), forecast, { horizon, fetchedAt: res ? fetchedAt : null });
    });
    if (checks) {
      official = { status: checks.alertsStatus, service: checks.alertsService, readAt: checks.alertsReadAt, alerts: [] };
      if (checks.alertsStatus === 'lues' || checks.alertsStatus === 'partielles') {
        // Même service que le tiroir Vérifs (cache de 5 minutes) : relu pour garder la fin de validité de chaque alerte.
        const dated = days.slice().sort((a, b) => a.dateIso.localeCompare(b.dateIso));
        const got = await getOfficialAlerts({ point: { lat: dated[0].lat, lon: dated[0].lon }, from: dated[0].dateIso, to: dated[dated.length - 1].dateIso, timeZone: dated[0].timezone }).catch(() => null);
        if (got) {
          official = {
            status: got.status,
            service: checks.alertsService,
            readAt: got.readAt ?? checks.alertsReadAt,
            alerts: got.alerts.map((a) => ({ id: a.id, source: a.source, hazard: a.hazard, level: a.level, area: a.area, onset: a.onset, expires: a.expires, sent: a.sent ?? null, fetchedAt: a.fetchedAt, headline: a.headline ?? null })),
          };
        }
      }
    }
  } catch {
    // La source n'a pas répondu : chaque jour reste « inconnu », jamais une valeur comblée.
    weather = days.map((d) => passageWeatherOf(passageOf(d), null, { horizon: null, fetchedAt: null }));
  }

  const fire = track ? await readFire(track, request.signal) : null;
  return ok({ status: 'ok', fetchedAt, horizon, weather, fire, official });
}
