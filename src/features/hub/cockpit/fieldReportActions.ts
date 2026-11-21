'use server';

import { createClient } from '@/lib/supabase/server';

export type FieldReportCategory =
  | 'water_dry'
  | 'water_ok'
  | 'trail_closed'
  | 'hazard'
  | 'shelter_closed'
  | 'snow_ice'
  | 'mud'
  | 'other';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set<FieldReportCategory>([
  'water_dry', 'water_ok', 'trail_closed', 'hazard', 'shelter_closed', 'snow_ice', 'mud', 'other',
]);

export async function createHubFieldReport(input: {
  tripId?: string | null;
  category: FieldReportCategory;
  title: string;
  details?: string;
  lat: number;
  lon: number;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!CATEGORIES.has(input.category)) return { ok: false, message: 'Catégorie de signalement invalide.' };
  const title = input.title.trim().slice(0, 140);
  if (title.length < 2) return { ok: false, message: 'Indique un titre explicite.' };
  if (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90 || !Number.isFinite(input.lon) || Math.abs(input.lon) > 180) {
    return { ok: false, message: 'Coordonnées invalides.' };
  }
  if (input.tripId && !UUID.test(input.tripId)) return { ok: false, message: 'Voyage invalide.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { data, error } = await supabase
    .from('hub_field_reports')
    .insert({
      trip_id: input.tripId ?? null,
      author_id: user.id,
      category: input.category,
      title,
      details: input.details?.trim().slice(0, 800) || null,
      lat: input.lat,
      lon: input.lon,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, message: 'Impossible d’enregistrer le signalement.' };
  }
  return { ok: true, id: data.id };
}

export async function confirmHubFieldReport(
  reportId: string,
): Promise<{ ok: true; confirmations: number } | { ok: false; message: string }> {
  if (!UUID.test(reportId)) return { ok: false, message: 'Signalement introuvable.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Connexion requise.' };

  const { data, error } = await supabase.rpc('confirm_hub_field_report', { p_report_id: reportId });
  if (error) return { ok: false, message: 'Confirmation indisponible.' };
  return { ok: true, confirmations: Number(data ?? 0) };
}
