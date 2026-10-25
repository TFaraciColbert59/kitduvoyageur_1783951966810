import type { CompasPlace } from './places';

/**
 * Régions célèbres que la carte en ligne et GeoNames rangent mal : un homonyme minuscule passe devant (« Lofoten »
 * est aussi un hameau du Telemark), ou la région est à cheval sur deux pays (« Tatras », Pologne et Slovaquie).
 * Liste FERMÉE, un point de base par pays (une ville au cœur de la région, coordonnées publiques) ; jamais un lieu
 * inventé. Le pays dit dans la phrase choisit l'entrée ; sans pays dit, seule une région à entrée unique répond.
 */
interface Base {
  name: string;
  lat: number;
  lon: number;
}
interface Region {
  /** Nom français affiché. */
  label: string;
  /** Un point de base par pays (code ISO). */
  bases: Record<string, Base>;
  countries: Record<string, string>;
}

const REGIONS: Record<string, Region> = {
  lofoten: {
    label: 'Lofoten',
    bases: { NO: { name: 'Svolvær', lat: 68.2342, lon: 14.5683 } },
    countries: { NO: 'Norvège' },
  },
  tatras: {
    label: 'Tatras',
    bases: {
      PL: { name: 'Zakopane', lat: 49.2992, lon: 19.9496 },
      SK: { name: 'Štrbské Pleso', lat: 49.1197, lon: 20.0636 },
    },
    countries: { PL: 'Pologne', SK: 'Slovaquie' },
  },
  highlands: {
    label: 'Highlands écossais',
    bases: { GB: { name: 'Fort William', lat: 56.8198, lon: -5.1052 } },
    countries: { GB: 'Royaume-Uni' },
  },
  ladakh: {
    label: 'Ladakh',
    bases: { IN: { name: 'Leh', lat: 34.1526, lon: 77.5771 } },
    countries: { IN: 'Inde' },
  },
  tatry: {
    label: 'Tatras',
    bases: {
      PL: { name: 'Zakopane', lat: 49.2992, lon: 19.9496 },
      SK: { name: 'Štrbské Pleso', lat: 49.1197, lon: 20.0636 },
    },
    countries: { PL: 'Pologne', SK: 'Slovaquie' },
  },
};

/** Écritures du même lieu dites autrement (« Highlands écossais », « Himalaya indien Ladakh »). */
const ALIASES: Record<string, string> = {
  highlandsecossais: 'highlands',
  highlandsdecosse: 'highlands',
  scottishhighlands: 'highlands',
  hautesterresdecosse: 'highlands',
  himalayaindienladakh: 'ladakh',
  ladakhinde: 'ladakh',
};

const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** La région célèbre dite (avec son pays si la phrase le dit), ou null. */
export function knownRegion(place: string, countryCode?: string | null): CompasPlace | null {
  const k = key(place);
  const region = REGIONS[ALIASES[k] ?? k];
  if (!region) return null;
  const codes = Object.keys(region.bases);
  const code = countryCode && region.bases[countryCode] ? countryCode : codes.length === 1 ? codes[0] : null;
  if (!code) return null;
  const base = region.bases[code];
  return {
    name: region.label,
    lat: base.lat,
    lon: base.lon,
    countryCode: code,
    country: region.countries[code] ?? null,
    kind: 'region',
    landmark: true,
    settlement: false,
    extent: null,
  } as CompasPlace;
}
