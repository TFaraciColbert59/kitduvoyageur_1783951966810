'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { reportServerError } from '@/lib/observability/appErrors';
import type { RoutePoi } from '../engine/routePois';
import { lookupStagePois } from './stagePoiLookup';
import { serverText } from './serverText';

/**
 * Points utiles autour des étapes du voyage (restos, commerces, santé, eau,
 * hébergements, transports…), chargés après l'affichage de l'écran pour ne
 * pas le ralentir. Lecture seule ; les étapes sont lues sous RLS (un voyage
 * que la personne ne peut pas lire ne renvoie rien).
 */

export type CompasStagePoisResult =
  | { success: true; pois: RoutePoi[]; partial?: boolean }
  | { success: false; error: string };

const schema = z.object({ tripId: z.string().uuid() });

export async function compasStagePoisAction(
  input: z.input<typeof schema>
): Promise<CompasStagePoisResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: await serverText('compas.server.common.invalidTrip') };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: await serverText('compas.server.pois.signIn') };
    const limited = await enforceRateLimit(user.id, {
      scope: 'compas-pois',
      limit: 30,
      windowMs: 10 * 60_000,
      failMode: 'open',
    });
    if (limited) return { success: true, pois: [] };
    const { data } = await supabase
      .from('trip_steps')
      .select('latitude, longitude, day_number')
      .eq('trip_id', parsed.data.tripId)
      .order('day_number', { ascending: true });
    // `Number(null)` vaut 0 : une étape sans position est écartée, jamais placée à (0, 0).
    const points = ((data ?? []) as Array<{ latitude: unknown; longitude: unknown }>)
      .filter((st) => st.latitude != null && st.longitude != null)
      .map((st) => ({ lat: Number(st.latitude), lon: Number(st.longitude) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    // L'activité du voyage (lue sous RLS) : un voyage d'escalade reçoit aussi les via ferrata (plan 3.5).
    const { data: tripRow } = await supabase.from('trips').select('primary_activity').eq('id', parsed.data.tripId).maybeSingle();
    const activity = (tripRow as { primary_activity?: string | null } | null)?.primary_activity ?? null;
    const found = await lookupStagePois(points, { activity });
    return { success: true, pois: found.pois, partial: found.partial };
  } catch (err) {
    await reportServerError('compas.compasStagePoisAction', err);
    return { success: false, error: await serverText('compas.server.common.serverError') };
  }
}
