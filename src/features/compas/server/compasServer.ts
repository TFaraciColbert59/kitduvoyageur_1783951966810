import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Briques serveur partagées par les actions du Compas (droits, métadonnées,
 * découpage du parcours). Ce module n'est PAS une action serveur : rien ici
 * n'est appelable depuis le navigateur.
 */

export type Supa = Awaited<ReturnType<typeof createClient>>;


/** Champs du voyage dont les actions du Compas ont besoin (lecture légère). */
export interface CompasTripRow {
  id: string;
  user_id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  destination_name: string | null;
  destination_country_code: string | null;
  party_size: number | null;
  budget_currency: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Droits d'écriture, en une lecture légère : la ligne du voyage et la
 * fonction RLS `can_edit_trip` (propriétaire ou éditeur). Charger le voyage
 * complet (étapes, kit, dépenses, profils) à chaque geste coûtait cher.
 */
export async function requireEditor(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Connecte-toi pour modifier le voyage.' } as const;
  const [{ data: row }, { data: canEdit }] = await Promise.all([
    supabase
      .from('trips')
      .select(
        'id, user_id, title, start_date, end_date, destination_name, destination_country_code, party_size, budget_currency, metadata'
      )
      .eq('id', tripId)
      .maybeSingle(),
    supabase.rpc('can_edit_trip', { p_trip_id: tripId }),
  ]);
  const trip = row as CompasTripRow | null;
  if (!trip) return { error: 'Voyage introuvable ou non autorisé.' } as const;
  if (trip.user_id !== user.id && canEdit !== true)
    return { error: 'Seuls les organisateurs et éditeurs peuvent modifier le kit.' } as const;
  return { supabase, userId: user.id, trip } as const;
}

/** Fusionne une clé dans trips.metadata sans écraser le reste. */
export async function patchTripMetadata(
  supabase: Supa,
  tripId: string,
  patch: (meta: Record<string, unknown>) => Record<string, unknown>
) {
  const { data } = await supabase.from('trips').select('metadata').eq('id', tripId).maybeSingle();
  const meta = ((data as { metadata?: Record<string, unknown> | null } | null)?.metadata ??
    {}) as Record<string, unknown>;
  return patch({ ...meta });
}

export function compasMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const c = meta.compas;
  return c && typeof c === 'object' && !Array.isArray(c)
    ? { ...(c as Record<string, unknown>) }
    : {};
}

/**
 * Redécoupe la géométrie réelle du parcours en `days` jours et met les étapes
 * à jour SANS rien perdre : la première étape de chaque jour reçoit le
 * tronçon (titre et hébergement conservés), les autres étapes du même jour
 * gardent leur texte mais plus de distance (pas de double compte), les jours
 * manquants sont créés, et les jours en trop ne sont supprimés que s'ils ont
 * été générés par le Compas sans hébergement.
 */
export async function resplitSteps(supabase: Supa, tripId: string, routeId: number, days: number) {
  const [{ data: stages, error }, { data: route }, { data: existing }] = await Promise.all([
    supabase.rpc('compas_route_stages', { p_route_id: routeId, p_days: days }),
    supabase.from('hiking_routes').select('name').eq('id', routeId).maybeSingle(),
    supabase
      .from('trip_steps')
      .select('id, day_number, order_index, source, accommodation_name')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true }),
  ]);
  if (error || !Array.isArray(stages) || stages.length === 0)
    throw new Error('Découpage du parcours impossible.');
  const routeName = (route as { name?: string | null } | null)?.name ?? 'Parcours';
  const rows = (existing ?? []) as Array<{
    id: string;
    day_number: number;
    order_index: number;
    source: string | null;
    accommodation_name: string | null;
  }>;
  const now = new Date().toISOString();
  let kept = 0;

  for (const st of stages as Array<{
    day: number;
    start_lat: number;
    start_lng: number;
    distance_km: number;
    elevation_gain_m: number | null;
    elevation_loss_m: number | null;
  }>) {
    const ofDay = rows.filter((r) => r.day_number === st.day);
    const geo = {
      latitude: Math.round(st.start_lat * 1e5) / 1e5,
      longitude: Math.round(st.start_lng * 1e5) / 1e5,
      distance_km: st.distance_km,
      elevation_gain_m: st.elevation_gain_m,
      elevation_loss_m: st.elevation_loss_m,
      updated_at: now,
    };
    if (ofDay.length) {
      await supabase.from('trip_steps').update(geo).eq('id', ofDay[0].id);
      for (const extra of ofDay.slice(1)) {
        await supabase
          .from('trip_steps')
          .update({
            distance_km: null,
            elevation_gain_m: null,
            elevation_loss_m: null,
            updated_at: now,
          })
          .eq('id', extra.id);
      }
    } else {
      await supabase.from('trip_steps').insert({
        trip_id: tripId,
        day_number: st.day,
        order_index: 0,
        title: `Jour ${st.day} · ${routeName}`,
        description:
          'Tronçon du parcours découpé par le Compas. Dénivelé du parcours réparti à parts égales entre les jours.',
        transport_mode: 'foot',
        source: 'compas',
        ...geo,
      });
    }
  }
  for (const r of rows.filter((r) => r.day_number > days)) {
    const generated = r.source === 'compas' || r.source === 'demo';
    if (generated && !r.accommodation_name) {
      await supabase.from('trip_steps').delete().eq('id', r.id);
    } else {
      kept += 1;
      await supabase
        .from('trip_steps')
        .update({
          distance_km: null,
          elevation_gain_m: null,
          elevation_loss_m: null,
          updated_at: now,
        })
        .eq('id', r.id);
    }
  }
  return { kept };
}

