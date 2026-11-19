'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Sources d'itinéraire de la Sortie (Sortie#5, maquette `IMPORT`, L3096) :
 * « Une trace » (GPX, géré par le formulaire), « Un carnet » et « Une sortie
 * enregistrée ». Lecture **seule** des données de la personne (RLS : ses
 * carnets, ses sessions), aucune nouvelle persistance. Toute erreur (RLS,
 * table absente, réseau) est rendue comme un message honnête : l'import est une
 * commodité, la distance et le dénivelé restent saisissables à la main.
 */

export type ItinerarySourceKindV2 = 'carnet' | 'sortie';

export interface ItinerarySourceV2 {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  /** Ligne secondaire : date ou « Carnet ». */
  meta: string;
}

export interface ItinerarySourcesResultV2 {
  data: ItinerarySourceV2[];
  error: string | null;
}

const MAX_KM = 500;
const MAX_GAIN_M = 20_000;

function finite(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Valeurs reprises dans le formulaire : distance au dixième (bornée 0-500 km),
 * dénivelé arrondi à 50 m (le stepper avance par 50, bornée 0-20 000 m) — comme
 * la maquette (`Math.round(it[2] / 50) * 50`).
 */
export function importedFiguresV2(source: Pick<ItinerarySourceV2, 'distanceKm' | 'elevationGainM'>): {
  distanceKm: number;
  elevationGainM: number;
} {
  return {
    distanceKm: Math.min(MAX_KM, Math.max(0, Math.round(finite(source.distanceKm) * 10) / 10)),
    elevationGainM: Math.min(MAX_GAIN_M, Math.max(0, Math.round(finite(source.elevationGainM) / 50) * 50)),
  };
}

interface CarnetRow {
  id?: string | null;
  title?: string | null;
  distance_km?: number | string | null;
  denivele_m?: number | string | null;
}

interface SessionRow {
  id?: string | null;
  title?: string | null;
  started_at?: string | null;
  distance_km?: number | string | null;
  elevation_gain_m?: number | string | null;
}

export function mapCarnetSources(rows: readonly CarnetRow[]): ItinerarySourceV2[] {
  return rows
    .filter((row) => row.id && finite(row.distance_km) > 0)
    .map((row) => ({
      id: String(row.id),
      name: (row.title ?? '').trim() || 'Carnet sans titre',
      distanceKm: finite(row.distance_km),
      elevationGainM: finite(row.denivele_m),
      meta: 'Carnet',
    }));
}

export function mapSessionSources(rows: readonly SessionRow[]): ItinerarySourceV2[] {
  return rows
    .filter((row) => row.id && finite(row.distance_km) > 0)
    .map((row) => {
      const date = row.started_at ? new Date(row.started_at) : null;
      const label =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'Sortie enregistrée';
      return {
        id: String(row.id),
        name: (row.title ?? '').trim() || 'Sortie du ' + label,
        distanceKm: finite(row.distance_km),
        elevationGainM: finite(row.elevation_gain_m),
        meta: label,
      };
    });
}

export function formatFiguresFr(source: Pick<ItinerarySourceV2, 'distanceKm' | 'elevationGainM'>): string {
  const km = (Math.round(finite(source.distanceKm) * 10) / 10).toString().replace('.', ',');
  return `${km} km · +${Math.round(finite(source.elevationGainM))} m`;
}

export async function loadItinerarySourcesV2(
  kind: ItinerarySourceKindV2,
  userId: string,
): Promise<ItinerarySourcesResultV2> {
  if (!userId) return { data: [], error: null };
  try {
    const supabase = createClient();
    if (kind === 'carnet') {
      const { data, error } = await supabase
        .from('carnets')
        .select('id, title, distance_km, denivele_m')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) return { data: [], error: 'Tes carnets sont indisponibles pour le moment.' };
      return { data: mapCarnetSources(Array.isArray(data) ? (data as CarnetRow[]) : []), error: null };
    }
    const { data, error } = await supabase
      .from('hike_sessions')
      .select('id, title, started_at, distance_km, elevation_gain_m')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(20);
    if (error) return { data: [], error: 'Tes sorties enregistrées sont indisponibles pour le moment.' };
    return { data: mapSessionSources(Array.isArray(data) ? (data as SessionRow[]) : []), error: null };
  } catch {
    return { data: [], error: 'Connexion impossible : saisis la distance et le dénivelé à la main.' };
  }
}
