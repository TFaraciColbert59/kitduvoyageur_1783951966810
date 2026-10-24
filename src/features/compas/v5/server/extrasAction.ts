'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { reportServerError } from '@/lib/observability/appErrors';
import { getAffiliateLinks } from '@/lib/queries-affiliation';
import { relevantAffiliateLinks } from '../../engine/affiliates';
import { tripPartySize, type CompasTripRow } from '../../server/compasServer';
import { serverText } from '../../server/serverText';
import type { V5ExtrasPayload } from '../engine/dayArrivals';
import { loadV5Extras, type V5ExtrasSource } from './extras';

/**
 * Extras de l'écran v5 (nuits possibles, photos, trajets), lus après l'affichage.
 *
 * Lecture seule, au même droit que les points autour des étapes : la personne doit être connectée et le
 * voyage lisible sous RLS (un voyage qu'elle ne peut pas lire n'existe pas pour elle). Les lectures
 * coûteuses (Overpass, Wikimedia Commons) sont comptées par personne.
 */

export type CompasV5ExtrasResult =
  | { success: true; extras: V5ExtrasPayload }
  | { success: false; error: string };

const schema = z.object({ tripId: z.string().uuid() });

const TRIP_COLUMNS =
  'id, user_id, title, start_date, end_date, destination_name, destination_country_code, party_size, budget_currency, metadata';

/** Rien n'a été lu : l'écran le dit, il n'invente rien. */
const NOTHING_READ: Omit<V5ExtrasPayload, 'fetchedAt'> = {
  nights: {},
  dayPhotos: {},
  transport: [],
  unavailable: ['lodging', 'photos', 'transport'],
  choices: { transport: null, stays: {} },
  partial: false,
};

export async function compasV5ExtrasAction(input: z.input<typeof schema>): Promise<CompasV5ExtrasResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: await serverText('compas.server.common.invalidTrip') };
  const { tripId } = parsed.data;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: await serverText('compas.server.pois.signIn') };
    const limited = await enforceRateLimit(user.id, {
      scope: 'compas-v5-extras',
      limit: 20,
      windowMs: 10 * 60_000,
      failMode: 'open',
    });
    if (limited) return { success: true, extras: { ...NOTHING_READ, fetchedAt: new Date().toISOString() } };

    const { data: row } = await supabase.from('trips').select(TRIP_COLUMNS).eq('id', tripId).maybeSingle();
    const trip = row as CompasTripRow | null;
    if (!trip) return { success: false, error: await serverText('compas.server.common.tripNotFoundOrDenied') };

    const { data: stepRows } = await supabase
      .from('trip_steps')
      .select('id, day_number, order_index, latitude, longitude, accommodation_name')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true });
    const steps = (stepRows ?? []) as Array<{
      id: string;
      day_number: number;
      latitude: unknown;
      longitude: unknown;
      accommodation_name: string | null;
    }>;

    // Liens partenaires du pays du voyage : jamais une raison de faire échouer la lecture.
    const links = await getAffiliateLinks(
      trip.destination_country_code ? { countryCode: trip.destination_country_code } : undefined
    ).catch(() => []);

    const source: V5ExtrasSource = {
      itinerary: steps.map((s) => ({ id: s.id, day: Number(s.day_number), accommodation: s.accommodation_name })),
      // `Number(null)` vaut 0 : une étape sans position est écartée, jamais placée à (0, 0).
      points: steps
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ id: `s-${s.id}`, lat: Number(s.latitude), lon: Number(s.longitude), kind: 'step' as const }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
      affiliateLinks: relevantAffiliateLinks(links, trip.destination_country_code, trip.destination_name).map((l) => ({
        label: l.title,
        partner: l.partner?.name ?? null,
        url: `/go/${encodeURIComponent(l.slug)}`,
      })),
      countryCode: trip.destination_country_code,
      model: { crew: { size: await tripPartySize(supabase, trip) } },
    };

    const extras = await loadV5Extras({ supabase, trip, data: source });
    return { success: true, extras };
  } catch (err) {
    await reportServerError('compas.compasV5ExtrasAction', err);
    return { success: false, error: await serverText('compas.server.common.serverError') };
  }
}
