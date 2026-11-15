/**
 * Lot A03 — K6.01, K6.03, K6.04 : Import d'une trace (GPX, FIT ou TCX)
 * comme Parcours planifié privé avec géométrie originale + snap-to-trails et <wpt>.
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { fail, ok } from '@/lib/api/respond';
import { createClient } from '@/lib/supabase/server';
import {
  validateRouteImportInput,
  type RouteImportRequestInput,
} from '@/features/hiking/import/routeImport';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_imported_routes')
    .select(
      'id, title, sport, source, source_fingerprint, source_file_name, geometry_mode, distance_km, elevation_gain_m, waypoints, visibility, created_at'
    )
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return fail('server', error.message || 'Impossible de lister les parcours importés.');
  }

  return ok({ routes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: RouteImportRequestInput;
  try {
    body = (await request.json()) as RouteImportRequestInput;
  } catch {
    return fail('bad_request', 'Corps JSON invalide.');
  }

  let validated;
  try {
    validated = validateRouteImportInput(body);
  } catch (err) {
    return fail(
      'bad_request',
      err instanceof Error ? err.message : 'Données du parcours invalides.'
    );
  }

  const supabase = await createClient();

  const { data: existing, error: existingErr } = await supabase
    .from('user_imported_routes')
    .select('id, title, geometry_mode, distance_km, elevation_gain_m')
    .eq('user_id', auth.user.id)
    .eq('source_fingerprint', validated.sourceFingerprint)
    .maybeSingle();

  if (existingErr) {
    return fail('server', existingErr.message || 'Erreur lors de la vérification du doublon.');
  }

  if (existing) {
    return ok({
      route: existing,
      existing: true,
      waypointCount: validated.waypoints.length,
    });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('user_imported_routes')
    .insert({
      user_id: auth.user.id,
      title: validated.title,
      sport: validated.sport,
      source: validated.source,
      source_fingerprint: validated.sourceFingerprint,
      source_file_name: validated.sourceFileName,
      geometry_mode: validated.geometryMode,
      distance_km: validated.distanceKm,
      elevation_gain_m: validated.elevationGainM,
      original_points: validated.originalPoints,
      snapped_points: validated.snappedPoints,
      waypoints: validated.waypoints,
      visibility: validated.visibility,
    })
    .select('id, title, geometry_mode, distance_km, elevation_gain_m')
    .single();

  if (insertErr || !inserted) {
    return fail('server', insertErr?.message || 'Impossible d’enregistrer le parcours.');
  }

  return ok(
    {
      route: inserted,
      existing: false,
      waypointCount: validated.waypoints.length,
    },
    201
  );
}
