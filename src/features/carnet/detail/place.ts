import { extractCoords } from '@/components/carnet/profile/traceGeometry';
import type { CarnetPlace, CarnetRow } from './types';

/**
 * Lieu réel de la fiche carnet — aucune valeur inventée.
 *
 * Sources, dans cet ordre de préférence :
 *   1. colonnes de `public.carnets` : `country_iso`, `lieu_depart`,
 *      `lieu_arrivee`, `destination` (schéma inspecté le 2026-10-25 : la table
 *      ne porte aucune colonne `lat`/`lng` ni `region`) ;
 *   2. premier point réel de la trace (`hike_sessions.positions_geojson`).
 *
 * Tout champ sans source reste `null` : pas de région devinée, pas de
 * coordonnée estimée à partir d'un nom de lieu.
 */

/** Nom français d'un code ISO 3166-1 alpha-2, sans table de correspondance locale. */
export function countryNameFromIso(iso: string | null | undefined): string | null {
  const code = iso?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return null;
  try {
    const names = new Intl.DisplayNames(['fr'], { type: 'region' });
    const name = names.of(code);
    /* `Intl` rend le code lui-même ou « région inconnue » pour un code hors
       liste : dans les deux cas il n'y a pas de pays à afficher. */
    if (!name || name.toUpperCase() === code) return null;
    if (/inconnu|unknown/i.test(name)) return null;
    return name;
  } catch {
    return null;
  }
}

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

export function buildCarnetPlace(carnet: CarnetRow, trace: unknown | null): CarnetPlace {
  const firstPoint = extractCoords(trace)[0] ?? null;

  /* Le pays vient d'abord du code ISO réel ; à défaut, `destination` est le
     texte de lieu saisi par l'auteur — jamais une déduction depuis la carte. */
  const country = countryNameFromIso(carnet.country_iso) ?? trimmed(carnet.destination);

  /* `region` n'a aucune colonne source aujourd'hui : null assumé.
     `locality` est le lieu de départ, à défaut le lieu d'arrivée. */
  const locality = trimmed(carnet.lieu_depart) ?? trimmed(carnet.lieu_arrivee);

  return {
    country,
    region: null,
    locality,
    lat: firstPoint ? firstPoint[0] : null,
    lng: firstPoint ? firstPoint[1] : null,
  };
}

export interface CarnetPlaceSegment {
  key: 'country' | 'region' | 'locality';
  label: string;
}

/**
 * Segments affichables, dans l'ordre « pays · région · lieu ».
 * `fallback` (destination) n'est utilisé que si le lieu réel est vide, pour ne
 * pas perdre la ligne de lieu des carnets anciens.
 */
export function placeSegments(place: CarnetPlace | null | undefined, fallback?: string | null): CarnetPlaceSegment[] {
  const segments: CarnetPlaceSegment[] = [];
  const push = (key: CarnetPlaceSegment['key'], value: string | null | undefined) => {
    const label = trimmed(value);
    if (!label) return;
    if (segments.some((segment) => segment.label.toLowerCase() === label.toLowerCase())) return;
    if (segments.length >= 3) return;
    segments.push({ key, label });
  };
  push('country', place?.country);
  push('region', place?.region);
  push('locality', place?.locality);
  if (segments.length === 0) push('locality', fallback);
  return segments;
}
