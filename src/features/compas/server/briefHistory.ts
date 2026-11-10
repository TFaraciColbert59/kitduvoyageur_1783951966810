import 'server-only';
import type { Supa } from './compasServer';
import { realPace, type PaceSession, type RealPace } from '../engine/brief/pace';

/**
 * Allure réelle de la personne connectée, lue dans ses sorties (`hike_sessions`).
 *
 * NON BRANCHÉ : rien n'appelle cette fonction pour l'instant, la décision D4
 * (SPEC-V6-MOTEUR §10) est en attente.
 *
 * Lecture seule, avec le client de la personne, filtre `user_id` explicite en plus
 * de la RLS. Seules les colonnes nécessaires sont lues : jamais `positions_geojson`
 * ni aucune coordonnée. Aucun journal : les valeurs restent privées.
 */

// Pas de filtre « terminée » : `ended_at` est NOT NULL, toute ligne est une sortie finie.
// `processing_status` n'est pas filtré non plus : c'est l'état du traitement de la trace
// (pending/processing/processed/failed), pas celui de la sortie ; distance, durée et D+
// sont écrits à la fin de la sortie, avant ce traitement.
const COLUMNS ='distance_km, duration_seconds, elevation_gain_m, ended_at';
const LAST_SESSIONS = 30;

type Reader = { from: Supa['from'] } | Supa;

interface Row {
  distance_km: number | string | null;
  duration_seconds: number | string | null;
  elevation_gain_m: number | string | null;
  ended_at: string | null;
}

/** `numeric` revient parfois en chaîne : conversion défensive, null si illisible. */
function toNum(x: number | string | null | undefined): number | null {
  if (x == null) return null;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function readRealPace(supabase: Reader, userId: string): Promise<RealPace | null> {
  if (!userId) return null;
  try {
    const { data, error } = await (supabase as Supa)
      .from('hike_sessions')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('ended_at', { ascending: false })
      .limit(LAST_SESSIONS);
    if (error || !data) return null;
    const sessions: PaceSession[] = (data as unknown as Row[]).map((r) => {
      const sec = toNum(r.duration_seconds);
      return {
        distanceKm: toNum(r.distance_km),
        durationMin: sec == null ? null : sec / 60,
        elevationGainM: toNum(r.elevation_gain_m),
        endedAt: r.ended_at,
      };
    });
    return realPace(sessions);
  } catch {
    return null;
  }
}
