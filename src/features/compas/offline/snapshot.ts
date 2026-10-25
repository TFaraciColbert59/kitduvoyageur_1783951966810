/**
 * Instantané hors ligne d'une aventure du Compas.
 *
 * Construit côté appareil à partir des données déjà affichées, enregistré dans
 * IndexedDB et relu par `/hors-ligne` sans réseau. Le service worker ne met
 * jamais en cache une page ni une API privée (règle SEC-1) : l'instantané est
 * la seule copie, il reste sur l'appareil et s'efface au changement de compte.
 *
 * Rien n'est inventé : un champ absent reste absent, la météo garde la date à
 * laquelle elle a été lue, les numéros d'urgence ne sont donnés que pour les
 * pays où ils sont certains.
 */
import type { CompasModel } from '../engine/compasModel';

export const SNAPSHOT_VERSION = 1;

export interface CompasSnapshotDay {
  day: number;
  date: string | null;
  title: string;
  distanceKm: number | null;
  gainM: number | null;
  walkMin: number | null;
  stay: string | null;
  lat: number | null;
  lon: number | null;
}

export interface CompasSnapshotWeather {
  date: string;
  minC: number;
  maxC: number;
  precipPct: number | null;
  precipMm: number | null;
  code: number;
}

export interface CompasSnapshotKitLine {
  name: string;
  quantity: number;
  packed: boolean;
  vital: boolean;
  kind: 'base' | 'worn' | 'consumable';
  status: 'owned' | 'missing' | 'lent' | 'replace';
}

export interface CompasSnapshot {
  version: typeof SNAPSHOT_VERSION;
  /** Clé de stockage : `${userId}:${tripId}`. */
  key: string;
  userId: string;
  tripId: string;
  slug: string;
  title: string;
  activity: string | null;
  destination: string | null;
  countryCode: string | null;
  dates: { start: string | null; end: string | null; label: string };
  partySize: number;
  route: { distanceKm: number; gainM: number; days: number };
  days: CompasSnapshotDay[];
  weather: { readAt: string; source: string; days: CompasSnapshotWeather[] };
  kit: {
    packedPct: number | null;
    baseGrams: number;
    lines: CompasSnapshotKitLine[];
  };
  budget: { currency: string; planned: number; spent: number; perPerson: number | null };
  verdict: { level: CompasModel['verdict']['level']; reasons: string[] };
  emergency: EmergencyNumbers | null;
  savedAt: string;
}

export interface EmergencyNumbers {
  label: string;
  numbers: Array<{ number: string; use: string }>;
}

/**
 * Numéros d'urgence sûrs. 112 : numéro européen (UE, EEE, Suisse, Royaume-Uni).
 * Ailleurs, seulement les pays dont le numéro est établi ; sinon aucun numéro.
 */
const EU_112 = new Set(
  (
    'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE ' +
    'IS LI NO CH GB AD MC SM VA'
  ).split(' ')
);
const OTHERS: Record<string, EmergencyNumbers> = {
  US: { label: 'États-Unis', numbers: [{ number: '911', use: 'police, pompiers, secours' }] },
  CA: { label: 'Canada', numbers: [{ number: '911', use: 'police, pompiers, secours' }] },
  MX: { label: 'Mexique', numbers: [{ number: '911', use: 'urgences' }] },
  AU: { label: 'Australie', numbers: [{ number: '000', use: 'police, pompiers, secours' }] },
  NZ: { label: 'Nouvelle-Zélande', numbers: [{ number: '111', use: 'police, pompiers, secours' }] },
  JP: {
    label: 'Japon',
    numbers: [
      { number: '110', use: 'police' },
      { number: '119', use: 'pompiers et secours' },
    ],
  },
};

export function emergencyFor(countryCode: string | null): EmergencyNumbers | null {
  const cc = countryCode?.toUpperCase() ?? null;
  if (!cc) return null;
  if (EU_112.has(cc)) {
    return { label: 'Numéro d’urgence européen', numbers: [{ number: '112', use: 'secours, police, pompiers' }] };
  }
  return OTHERS[cc] ?? null;
}

export function snapshotKey(userId: string, tripId: string): string {
  return `${userId}:${tripId}`;
}

export function buildCompasSnapshot(input: {
  userId: string;
  model: CompasModel;
  countryCode: string | null;
  itinerary: Array<{ day: number; accommodation: string | null }>;
  weatherSource: string | null;
  now?: Date;
}): CompasSnapshot {
  const { model } = input;
  const now = (input.now ?? new Date()).toISOString();
  const stays = new Map(input.itinerary.map((s) => [s.day, s.accommodation]));
  return {
    version: SNAPSHOT_VERSION,
    key: snapshotKey(input.userId, model.tripId),
    userId: input.userId,
    tripId: model.tripId,
    slug: model.slug,
    title: model.title,
    activity: model.activity,
    destination: model.destination,
    countryCode: input.countryCode,
    dates: { start: model.dates.start, end: model.dates.end, label: model.dates.label },
    partySize: model.crew.size,
    route: {
      distanceKm: model.route.distanceKm,
      gainM: model.route.elevationGainM,
      days: model.route.days,
    },
    days: model.route.dayPlans.map((d) => ({
      day: d.day,
      date: d.date,
      title: d.title,
      distanceKm: d.distanceKm,
      gainM: d.gainM,
      walkMin: d.walkMin,
      stay: d.stay ?? stays.get(d.day) ?? null,
      lat: d.lat,
      lon: d.lon,
    })),
    weather: {
      readAt: now,
      source: input.weatherSource ?? 'MET Norway',
      days: model.weather.days.map((w) => ({
        date: w.date,
        minC: w.tempMinC,
        maxC: w.tempMaxC,
        precipPct: w.precipPct,
        precipMm: w.precipMm,
        code: w.weathercode,
      })),
    },
    kit: {
      packedPct: model.kit.packedPct,
      baseGrams: model.kit.baseGrams,
      lines: model.kit.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        packed: l.packed,
        vital: l.vital,
        kind: l.kind,
        status: l.status,
      })),
    },
    budget: {
      currency: model.budget.currency,
      planned: model.budget.planned,
      spent: model.budget.spent,
      perPerson: model.budget.perPerson,
    },
    verdict: { level: model.verdict.level, reasons: model.verdict.reasons.map((r) => r.label) },
    emergency: emergencyFor(input.countryCode),
    savedAt: now,
  };
}

/** Empreinte stable du contenu (sans les horodatages) : évite d'écrire pour rien. */
export function snapshotFingerprint(s: CompasSnapshot): string {
  const { savedAt: _s, weather, ...rest } = s;
  return JSON.stringify({ ...rest, weather: weather.days });
}

/**
 * Prépare `/hors-ligne` pour une ouverture sans réseau : la page (publique,
 * mise en cache par le service worker) et ses scripts et styles Next.js
 * (cache-first). Une fois par session ; tout échec est sans effet.
 */
export async function warmOfflinePage(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    if (sessionStorage.getItem('lkdv.horsligne.prete') === '1') return;
    const res = await fetch('/hors-ligne', { credentials: 'same-origin' });
    if (!res.ok) return;
    const html = await res.text();
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+\.(?:js|css)/g) ?? [])];
    await Promise.all(assets.map((a) => fetch(a).catch(() => undefined)));
    sessionStorage.setItem('lkdv.horsligne.prete', '1');
  } catch {
    /* préchauffage au mieux */
  }
}
