// src/lib/geodata.ts — Helpers pour le référentiel géographique GeoNames
// (tables countries_geo / admin_regions_geo / places_geo / place_names_geo)

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import type {
  AdminRegionGeo,
  CountryGeo,
  CountryContent,
  PlaceGeo,
  PlaceNameGeo,
} from "./supabase/types";

/**
 * Initialise un client Supabase (côté navigateur, lecture publique).
 * Les clés sont lues depuis l'environnement (pas de secret en dur).
 */
export const supabase: SupabaseClient = createClient();

/** Retourne tous les pays du référentiel (lecture publique) triés par nom. */
export async function fetchCountries(): Promise<CountryGeo[]> {
  const { data, error } = await supabase
    .from("countries_geo")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CountryGeo[];
}

/** Retourne un pays par son code ISO‑A2, ou null s'il n'existe pas. */
export async function fetchCountryByIso(isoA2: string): Promise<CountryGeo | null> {
  const { data, error } = await supabase
    .from("countries_geo")
    .select("*")
    .eq("iso_a2", isoA2.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as CountryGeo | null) ?? null;
}

/** Retourne le contenu enrichi (7 feuilles) d'un pays par son code ISO-A2. */
export async function fetchCountryContentByIso(isoA2: string): Promise<CountryContent | null> {
  try {
    const { data, error } = await supabase
      .from("countries_content")
      .select("*")
      .eq("country_iso_a2", isoA2.toUpperCase())
      .maybeSingle();
    if (error) {
      console.warn(`[geodata] fetchCountryContentByIso(${isoA2}):`, error.message);
      return null;
    }
    return (data as CountryContent | null) ?? null;
  } catch (err) {
    console.warn(`[geodata] fetchCountryContentByIso(${isoA2}) exception:`, err);
    return null;
  }
}

/** Retourne tous les slugs (codes ISO-A2 en minuscules) pour le routing statique. */
export async function fetchAllCountrySlugs(): Promise<string[]> {
  const { data, error } = await supabase
    .from("countries_geo")
    .select("iso_a2")
    .order("iso_a2", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .map((c) => c.iso_a2?.toLowerCase())
    .filter((slug): slug is string => Boolean(slug));
}

/** Retourne les régions admin (niveau 1) d'un pays via son code ISO‑A2. */
export async function fetchAdminRegions(
  isoA2: string
): Promise<AdminRegionGeo[]> {
  const { data, error } = await supabase
    .from("admin_regions_geo")
    .select("*")
    .eq("country_iso_a2", isoA2)
    .order("name");
  if (error) throw error;
  return (data ?? []) as AdminRegionGeo[];
}

/** Retourne les lieux (villes) d'une région admin (par id UUID). */
export async function fetchPlaces(
  adminRegionId: string
): Promise<PlaceGeo[]> {
  const { data, error } = await supabase
    .from("places_geo")
    .select("*")
    .eq("admin_region_id", adminRegionId)
    .order("population", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlaceGeo[];
}

/** Retourne les noms alternatifs d'un lieu (par id UUID). */
export async function fetchPlaceNames(placeId: string): Promise<PlaceNameGeo[]> {
  const { data, error } = await supabase
    .from("place_names_geo")
    .select("*")
    .eq("place_id", placeId)
    .order("is_preferred", { ascending: false });
  if (error) throw error;
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