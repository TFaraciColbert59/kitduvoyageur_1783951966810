import 'server-only';
import { readCompasMeta } from '../../engine/meta';
import type { RoutePoi } from '../../engine/routePois';
import { coordKey } from '../../server/sharedCache';
import { compasMeta, type CompasTripRow, type Supa } from '../../server/compasServer';
import { originOf } from '../../engine/tripContext';
import { lookupStagePois, readCachedStagePois } from '../../server/stagePoiLookup';
import { dayArrivals, stayChoicesFromRows, type ArrivalSource, type DayArrival, type V5ExtrasPayload } from '../engine/dayArrivals';
import { rankStayOptions } from '../engine/stayOptions';
import {
  parseTransportChoice,
  pickCarpoolLink,
  transportOptions,
  type PlannedTransportLine,
} from '../engine/transportOptions';
import type { V5Photo, V5StayOption } from '../types';
import { lookupCommonsPhoto } from './commons';

/**
 * Extras de l'écran v5 : nuits possibles, photos et façons de venir. Lus après l'affichage, jamais bloquants.
 *
 * Aucune valeur n'est comblée : une source qui échoue entre dans `unavailable` et ses données restent
 * vides ; ce que le temps ou le quota de requêtes n'a pas permis de lire marque `partial` (relancer la
 * lecture complète depuis le cache partagé). La lecture entière ne dépasse pas 8 secondes.
 */

/** Durée maximale d'une lecture. */
export const EXTRAS_BUDGET_MS = 8000;
/** Requêtes à Wikimedia Commons au plus par lecture ; le reste vient du cache partagé. */
export const COMMONS_CALLS_MAX = 6;

/** Ce que la lecture a besoin de savoir du voyage (`CompasData` le satisfait tel quel). */
export interface V5ExtrasSource extends ArrivalSource {
  affiliateLinks: ReadonlyArray<{ label: string; partner: string | null; url: string }>;
  countryCode: string | null;
  model: { crew: { size: number } };
}

type Photo = { photo: V5Photo | null; failed?: true; skipped?: true };

const TIMED_OUT = Symbol('timeout');

function withDeadline<T>(job: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  if (ms <= 0) return Promise.resolve(TIMED_OUT);
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([job, timeout]).finally(() => clearTimeout(timer));
}

/** Lignes de budget prévu de catégorie transport (`trip_expenses`). null : lecture impossible. */
async function plannedTransportLines(supabase: Supa, tripId: string): Promise<PlannedTransportLine[] | null> {
  const { data, error } = await supabase
    .from('trip_expenses')
    .select('title, amount, metadata')
    .eq('trip_id', tripId)
    .eq('category', 'transport')
    .eq('is_planned', true);
  if (error) return null;
  return ((data ?? []) as Array<{ title: unknown; amount: unknown; metadata: unknown }>).map((r) => {
    const meta = (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>;
    return {
      title: typeof r.title === 'string' ? r.title : '',
      amount: Number(r.amount),
      basis: typeof meta.basis === 'string' ? meta.basis : null,
      choice: typeof meta.choice === 'string' ? meta.choice : null,
    };
  });
}

export async function loadV5Extras(args: {
  supabase: Supa;
  trip: CompasTripRow;
  data: V5ExtrasSource;
  /** Durée maximale de la lecture, en ms (8 s par défaut ; réduite par les tests). */
  budgetMs?: number;
}): Promise<V5ExtrasPayload> {
  const { supabase, trip, data } = args;
  const deadline = Date.now() + (args.budgetMs ?? EXTRAS_BUDGET_MS);
  const unavailable = new Set<'lodging' | 'photos' | 'transport'>();
  let partial = false;
  const meta = (trip.metadata ?? {}) as Record<string, unknown>;
  const prefs = readCompasMeta(meta).preferences;
  const party = Math.max(1, Math.floor(data.model.crew.size) || 1);
  const countryCode = data.countryCode ?? trip.destination_country_code ?? null;
  const arrivals = dayArrivals(data);

  /* ---------- Photos : un seul appel réseau par lieu et par lecture, six au plus ---------- */
  let commonsLeft = COMMONS_CALLS_MAX;
  const seen = new Map<string, Promise<Photo>>();
  const photoAt = (p: { lat: number; lon: number }): Promise<Photo> => {
    const key = coordKey(p.lat, p.lon, 3);
    const known = seen.get(key);
    if (known) return known;
    const job = (async (): Promise<Photo> => {
      try {
        const cached = await lookupCommonsPhoto(p, { allowNetwork: false });
        if (cached.state === 'cached') return { photo: cached.photo };
        if (commonsLeft <= 0 || Date.now() > deadline - 800) return { photo: null, skipped: true };
        commonsLeft -= 1;
        const fetched = await lookupCommonsPhoto(p, { allowNetwork: true, deadline });
        return fetched.state === 'failed' ? { photo: null, failed: true } : { photo: fetched.photo };
      } catch {
        return { photo: null, failed: true };
      }
    })();
    seen.set(key, job);
    return job;
  };

  /** Photos d'arrivée des jours, l'une après l'autre (Commons demande des requêtes en série). */
  const dayPhotos: Record<number, V5Photo | null> = {};
  const arrivalPhotos = (async () => {
    for (const a of arrivals) {
      const r = await photoAt(a);
      dayPhotos[a.day] = r.photo;
      if (r.failed) unavailable.add('photos');
      if (r.skipped) partial = true;
    }
  })();

  /* ---------- Nuits : les points autour des arrivées, puis le classement ---------- */
  const nightDays = arrivals.filter((a) => !a.isLast);
  const nights: Record<number, V5StayOption[]> = {};
  const lodging = (async () => {
    if (!nightDays.length) return;
    const points = nightDays.map((a) => ({ lat: a.lat, lon: a.lon }));
    let pois: RoutePoi[] = [];
    let incomplete = false;
    try {
      const found = await withDeadline(lookupStagePois(points), deadline - Date.now() - 1500);
      if (found === TIMED_OUT) {
        // Le service n'a pas fini : on garde ce que le cache partagé sait déjà, sans rien attendre de plus.
        pois = (await readCachedStagePois(points)).pois;
        incomplete = true;
      } else {
        pois = found.pois;
        incomplete = found.partial;
      }
    } catch {
      unavailable.add('lodging');
      return;
    }
    if (incomplete) {
      partial = true;
      if (!pois.length) unavailable.add('lodging');
    }
    for (const a of nightDays)
      nights[a.day] = rankStayOptions({
        arrival: a,
        pois,
        noted: a.noted,
        party,
        nights: prefs?.nights ?? null,
        countryCode,
      });
  })();

  /* ---------- Façons de venir : budget prévu et choix déjà fait ---------- */
  const transport = (async () => {
    try {
      const lines = await plannedTransportLines(supabase, trip.id);
      if (!lines) {
        unavailable.add('transport');
        return [];
      }
      const origin = originOf(compasMeta(meta).origin);
      return transportOptions({
        lines,
        chosen: parseTransportChoice(compasMeta(meta).transport),
        party,
        originName: origin?.name ?? null,
        carFree: prefs?.carFree === true,
        carpoolLink: pickCarpoolLink(data.affiliateLinks),
      });
    } catch {
      unavailable.add('transport');
      return [];
    }
  })();

  /* ---------- Nuit retenue de chaque jour ---------- */
  const stays = (async () => {
    try {
      const { data: rows, error } = await supabase
        .from('trip_steps')
        .select('day_number, order_index, metadata')
        .eq('trip_id', trip.id);
      if (error) return {};
      return stayChoicesFromRows((rows ?? []) as Array<{ day_number: unknown; order_index: unknown; metadata: unknown }>);
    } catch {
      return {};
    }
  })();

  const [transportList, staysChosen] = await Promise.all([transport, stays, lodging, arrivalPhotos]);

  /* ---------- Photos des nuits : après le classement, avec ce qui reste de requêtes ---------- */
  const byArrival = new Map<number, DayArrival>(arrivals.map((a) => [a.day, a]));
  for (const [dayKey, options] of Object.entries(nights)) {
    const day = Number(dayKey);
    const arrival = byArrival.get(day);
    // Une photo n'est montrée qu'une fois par jour : la même vue du village sur cinq options ferait croire à cinq photos.
    const used = new Set<string>();
    const arrivalUrl = dayPhotos[day]?.url;
    if (arrivalUrl) used.add(arrivalUrl);
    const withPhotos: V5StayOption[] = [];
    for (const option of options) {
      // La nuit notée sans lieu retrouvé sur la carte n'a pas de position à elle : pas de photo.
      const unplaced =
        option.id.startsWith('noted:') && option.distanceM === 0 && arrival != null && option.lat === arrival.lat && option.lon === arrival.lon;
      if (unplaced) {
        withPhotos.push(option);
        continue;
      }
      const r = await photoAt(option);
      if (r.failed) unavailable.add('photos');
      if (r.skipped) partial = true;
      if (r.photo && !used.has(r.photo.url)) {
        used.add(r.photo.url);
        withPhotos.push({ ...option, photo: r.photo });
      } else withPhotos.push(option);
    }
    nights[day] = withPhotos;
  }

  return {
    nights,
    dayPhotos,
    transport: transportList,
    fetchedAt: new Date().toISOString(),
    unavailable: [...unavailable],
    choices: { transport: parseTransportChoice(compasMeta(meta).transport), stays: staysChosen },
    partial,
  };
}
