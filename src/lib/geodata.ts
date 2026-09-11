// src/lib/geodata.ts — Helpers pour le référentiel géographique GeoNames
// (tables countries_geo / admin_regions_geo / places_geo / place_names_geo)
//
// Robustesse (Étape 0-A) :
//   • client Supabase créé PARESSEUSEMENT (jamais à l'import : le build Next.js
//     évalue les modules des pages sans configuration runtime) ;
//   • trois états distincts, jamais confondus :
//       1. BUILD sans configuration → produit vide assumé, silencieux ;
//       2. RUNTIME indisponible (réseau/API transitoire) → fallback explicite
//          + console.warn (observable), jamais une erreur fatale ;
//       3. RUNTIME contrat/dataset invalide (schéma, permissions) → erreur
//          observable (throw), jamais masquée.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import type {
  AdminRegionGeo,
  CountryGeo,
  CountryContent,
  PlaceGeo,
  PlaceNameGeo,
} from "./supabase/types";

let cachedClient: SupabaseClient | null = null;

/** Client mémoïsé, créé à la première utilisation réelle. */
function getSupabase(): SupabaseClient {
  if (!cachedClient) cachedClient = createClient();
  return cachedClient;
}

/** Vrai pendant la phase de build/prérendu Next.js. */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/** Configuration publique présente (sans rien créer). */
function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Client pour une lecture : retourne null UNIQUEMENT pendant le build sans
 * configuration (dataset vide assumé). Au runtime sans configuration, on laisse
 * `createClient()` lever son erreur explicite — aucun fallback silencieux.
 */
function getClientForRead(): SupabaseClient | null {
  if (!hasSupabaseEnv() && isBuildPhase()) return null;
  return getSupabase();
}

/**
 * Classe une erreur de lecture :
 *   • 'contract'  → schéma/permission/données : erreur observable (throw) ;
 *   • 'transient' → réseau/API transitoire : fallback + warning.
 */
export function classifyGeodataError(
  error: { message?: string; code?: string } | null | undefined
): 'transient' | 'contract' {
  const code = error?.code ?? '';
  const message = (error?.message ?? '').toLowerCase();

  if (code) {
    if (/^PGRST1/.test(code) || /^PGRST2/.test(code)) return 'contract'; // schéma, embeds, singular
    if (/^PGRST3/.test(code)) return 'transient'; // auth/API transitoire côté PostgREST
    if (/^[0-9A-Z]{5}$/.test(code)) return 'contract'; // SQLSTATE (permissions, données)
  }
  if (/(fetch failed|network|timeout|enotfound|econn|socket|aborted|503|502)/.test(message)) {
    return 'transient';
  }
  return 'transient';
}

/** Warning explicite pour l'indisponibilité transitoire. */
function warnTransient(scope: string, error: { message?: string } | null | undefined): void {
  console.warn(`[geodata] ${scope} indisponible (transitoire) :`, error?.message ?? 'inconnu');
}

/** Retourne tous les pays du référentiel (lecture publique) triés par nom. */
export async function fetchCountries(): Promise<CountryGeo[]> {
  const supabase = getClientForRead();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("countries_geo")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient('fetchCountries', error);
    return [];
  }
  return (data ?? []) as CountryGeo[];
}

/** Retourne un pays par son code ISO‑A2, ou null s'il n'existe pas. */
export async function fetchCountryByIso(isoA2: string): Promise<CountryGeo | null> {
  const supabase = getClientForRead();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("countries_geo")
    .select("*")
    .eq("iso_a2", isoA2.toUpperCase())
    .maybeSingle();
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient(`fetchCountryByIso(${isoA2})`, error);
    return null;
  }
  return (data as CountryGeo | null) ?? null;
}

/** Retourne le contenu enrichi (7 feuilles) d'un pays par son code ISO-A2. */
export async function fetchCountryContentByIso(isoA2: string): Promise<CountryContent | null> {
  const supabase = getClientForRead();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("countries_content")
      .select("*")
      .eq("country_iso_a2", isoA2.toUpperCase())
      .maybeSingle();
    if (error) {
      if (classifyGeodataError(error) === 'contract') throw error;
      warnTransient(`fetchCountryContentByIso(${isoA2})`, error);
      return null;
    }
    return (data as CountryContent | null) ?? null;
  } catch (err) {
    // Erreur déjà classifiée contractuelle : on la laisse remonter.
    if (err && typeof err === 'object' && 'code' in err &&
        classifyGeodataError(err as { code?: string; message?: string }) === 'contract') {
      throw err;
    }
    warnTransient(`fetchCountryContentByIso(${isoA2})`, err as { message?: string });
    return null;
  }
}

/** Retourne tous les slugs (codes ISO-A2 en minuscules) pour le routing statique. */
export async function fetchAllCountrySlugs(): Promise<string[]> {
  const supabase = getClientForRead();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("countries_geo")
    .select("iso_a2")
    .order("iso_a2", { ascending: true });
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient('fetchAllCountrySlugs', error);
    return [];
  }
  return (data ?? [])
    .map((c) => c.iso_a2?.toLowerCase())
    .filter((slug): slug is string => Boolean(slug));
}

/** Retourne les régions admin (niveau 1) d'un pays via son code ISO‑A2. */
export async function fetchAdminRegions(
  isoA2: string
): Promise<AdminRegionGeo[]> {
  const supabase = getClientForRead();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("admin_regions_geo")
    .select("*")
    .eq("country_iso_a2", isoA2)
    .order("name");
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient(`fetchAdminRegions(${isoA2})`, error);
    return [];
  }
  return (data ?? []) as AdminRegionGeo[];
}

/** Retourne les lieux (villes) d'une région admin (par id UUID). */
export async function fetchPlaces(
  adminRegionId: string
): Promise<PlaceGeo[]> {
  const supabase = getClientForRead();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("places_geo")
    .select("*")
    .eq("admin_region_id", adminRegionId)
    .order("population", { ascending: false });
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient(`fetchPlaces(${adminRegionId})`, error);
    return [];
  }
  return (data ?? []) as PlaceGeo[];
}

/**
 * Retourne les lieux géolocalisés d'un pays (coordonnées non nulles).
 * Utile pour dériver une emprise (bbox) quand `countries_geo.geometry` est vide.
 */
export async function fetchPlacesByCountry(
  isoA2: string,
  limit = 200
): Promise<Pick<PlaceGeo, "name" | "latitude" | "longitude" | "population">[]> {
  const supabase = getClientForRead();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("places_geo")
    .select("name, latitude, longitude, population")
    .eq("country_iso_a2", isoA2.toUpperCase())
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("population", { ascending: false })
    .limit(limit);
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient(`fetchPlacesByCountry(${isoA2})`, error);
    return [];
  }
  return data ?? [];
}

/** Retourne les noms alternatifs d'un lieu (par id UUID). */
export async function fetchPlaceNames(placeId: string): Promise<PlaceNameGeo[]> {
  const supabase = getClientForRead();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("place_names_geo")
    .select("*")
    .eq("place_id", placeId)
    .order("is_preferred", { ascending: false });
  if (error) {
    if (classifyGeodataError(error) === 'contract') throw error;
    warnTransient(`fetchPlaceNames(${placeId})`, error);
    return [];
  }
  return (data ?? []) as PlaceNameGeo[];
}

/** Exemple d'utilisation côté serveur (composition pays → régions). */
/*
export async function getCountryData(isoA2: string) {
  const country = await fetchCountryByIso(isoA2);
  if (!country) return null;
  const regions = await fetchAdminRegions(isoA2);
  return { country, regions };
}
*/
