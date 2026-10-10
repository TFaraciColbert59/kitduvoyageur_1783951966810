/**
 * Compas — le contexte du voyageur (PLAN-100 4.1) : nationalité, pays de
 * résidence, devise, langue, fuseau, domicile. Module PUR : aucun réseau, aucune
 * base ; lu par le serveur ET par le navigateur (listes du formulaire).
 *
 * Chaque champ vaut null quand il est inconnu (sans profil, essai sans compte) :
 * alors rien d'affirmé qui en dépende. Les moteurs reçoivent ce contexte en
 * argument ; seul `server/traveller.ts` le lit en base, par la RLS de la personne.
 * Les listes viennent de `Intl` (aucune liste inventée) ; la base revérifie les
 * formats (CHECK).
 */

import { isoCurrencyCodes, knownIsoCode } from './intentWords';
import { safeTimeZone } from './zone';

export interface TravellerHome {
  /** Nom du lieu tel que la carte l'a retrouvé (« Lyon »), 80 caractères au plus. */
  name: string;
  /** Arrondis à 0,01° (~1 km) : jamais un point plus fin. */
  lat: number;
  lon: number;
  countryCode: string | null;
}

export interface TravellerContext {
  /** ISO 3166-1 alpha-2 en majuscules (« FR »). */
  nationality: string | null;
  residenceCountry: string | null;
  /** ISO 4217 en majuscules (« EUR »). */
  currency: string | null;
  /** BCP 47 canonique (« fr », « pt-BR »). */
  language: string | null;
  /** Fuseau IANA (« Europe/Paris »). */
  timeZone: string | null;
  home: TravellerHome | null;
}

export const UNKNOWN_TRAVELLER: TravellerContext = Object.freeze({
  nationality: null,
  residenceCountry: null,
  currency: null,
  language: null,
  timeZone: null,
  home: null,
});

/** Ce que la personne voit d'elle-même (/compte, Compas) : jamais de coordonnées. */
export interface TravellerView {
  nationality: string | null;
  residenceCountry: string | null;
  currency: string | null;
  language: string | null;
  timeZone: string | null;
  homeName: string | null;
}

/** Saisie nettoyée ; le domicile est encore un texte, retrouvé sur la carte par le serveur. */
export interface TravellerFields {
  nationality: string | null;
  residenceCountry: string | null;
  currency: string | null;
  language: string | null;
  timeZone: string | null;
  home: string | null;
}

export interface TravellerOption {
  value: string;
  label: string;
}

/**
 * Codes de région que `Intl` nomme mais qui ne sont pas des pays ISO 3166-1
 * (CLDR : réservés, périmés, macro-régions, pseudo-régions).
 */
const NOT_COUNTRIES = new Set(
  'AC AN BU CP CS DD DG DY EA EU EZ FX HV IC NH QO RH SU TA TP UK UN VD XA XB YD YU ZR ZZ'.split(' ')
);

const names: Partial<Record<'region' | 'language' | 'currency', Intl.DisplayNames>> = {};

/** Nom français d'un code (`Intl`), null s'il ne le connaît pas. */
function displayName(kind: 'region' | 'language' | 'currency', code: string): string | null {
  try {
    const dn = (names[kind] ??= new Intl.DisplayNames(['fr'], { type: kind, fallback: 'none' }));
    return dn.of(code) ?? null;
  } catch {
    return null;
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Code pays ISO 3166-1 alpha-2 en majuscules (Kosovo `XK` compris) ; jamais `UK`, `EU` ni `ZZ`. */
export function isCountryCode(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Z]{2}$/.test(v) && !NOT_COUNTRIES.has(v) && displayName('region', v) != null;
}

/** Code de devise ISO 4217 en majuscules, connu de `Intl` (même liste que la lecture des montants). */
export function isCurrencyCode(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v) && knownIsoCode(v);
}

/** Langue BCP 47 canonique et connue (« pt-br » → « pt-BR »), sinon null. */
export function languageTag(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const raw = v.trim();
  if (!raw || raw.length > 35) return null;
  let tag: string;
  try {
    tag = Intl.getCanonicalLocales(raw)[0] ?? '';
  } catch {
    return null;
  }
  if (!/^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/.test(tag)) return null;
  return displayName('language', tag) ? tag : null;
}

/** Un nombre (ou son texte, la base rend parfois `numeric` en texte), arrondi à 0,01°, sinon null. */
function coord(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 100) / 100 : null;
}

/** Ligne du profil voyageur lue défensivement : chaque champ invalide vaut null (inconnu), jamais deviné. */
export function travellerFromRow(raw: unknown): TravellerContext {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...UNKNOWN_TRAVELLER };
  const r = raw as Record<string, unknown>;
  const country = (v: unknown) => (isCountryCode(v) ? v : null);
  const name = typeof r.home_name === 'string' ? r.home_name.trim().slice(0, 80) : '';
  const lat = coord(r.home_lat, 90);
  const lon = coord(r.home_lon, 180);
  return {
    nationality: country(r.nationality),
    residenceCountry: country(r.residence_country),
    currency: isCurrencyCode(r.currency) ? r.currency : null,
    language: languageTag(r.language),
    timeZone: safeTimeZone(r.time_zone),
    home: name && lat != null && lon != null ? { name, lat, lon, countryCode: country(r.home_country) } : null,
  };
}

export function travellerView(t: TravellerContext): TravellerView {
  return {
    nationality: t.nationality,
    residenceCountry: t.residenceCountry,
    currency: t.currency,
    language: t.language,
    timeZone: t.timeZone,
    homeName: t.home?.name ?? null,
  };
}

/**
 * Saisie du formulaire nettoyée (casse, espaces, formes canoniques) ; null si un
 * seul champ est invalide : rien n'est enregistré à moitié. Vide = inconnu.
 */
export function cleanTravellerFields(input: Partial<Record<keyof TravellerFields, string | null | undefined>>): TravellerFields | null {
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const nationality = text(input.nationality)?.toUpperCase() ?? null;
  const residenceCountry = text(input.residenceCountry)?.toUpperCase() ?? null;
  const currency = text(input.currency)?.toUpperCase() ?? null;
  const languageRaw = text(input.language);
  const language = languageRaw ? languageTag(languageRaw) : null;
  const zoneRaw = text(input.timeZone);
  const timeZone = zoneRaw ? safeTimeZone(zoneRaw) : null;
  const home = text(input.home);
  if (nationality && !isCountryCode(nationality)) return null;
  if (residenceCountry && !isCountryCode(residenceCountry)) return null;
  if (currency && !isCurrencyCode(currency)) return null;
  if (languageRaw && !language) return null;
  if (zoneRaw && !timeZone) return null;
  if (home && (home.length < 2 || home.length > 80)) return null;
  return { nationality, residenceCountry, currency, language, timeZone, home };
}

/** Nationalité française connue : seul cas où le Compas garde ses règles « ressortissant français ». */
export function isFrenchNational(t: Pick<TravellerContext, 'nationality'>): boolean {
  return t.nationality === 'FR';
}

/** Pays nommés en français, triés : tous les codes que `Intl` connaît comme pays. */
export function countryOptions(): TravellerOption[] {
  const out: TravellerOption[] = [];
  for (let a = 65; a <= 90; a += 1)
    for (let b = 65; b <= 90; b += 1) {
      const code = String.fromCharCode(a, b);
      if (isCountryCode(code)) out.push({ value: code, label: displayName('region', code) as string });
    }
  return out.sort((x, y) => x.label.localeCompare(y.label, 'fr'));
}

/** Devises ISO 4217 connues, nom français et code (« Franc suisse (CHF) »). */
export function currencyOptions(): TravellerOption[] {
  return [...isoCurrencyCodes()]
    .map((code) => ({ value: code, label: `${capitalize(displayName('currency', code) ?? code)} (${code})` }))
    .sort((x, y) => x.label.localeCompare(y.label, 'fr'));
}

/** Les six langues proposées par /compte (« Langue de l'interface »), plus celle déjà rangée. */
export const LANGUAGE_CODES = ['fr', 'en', 'de', 'it', 'es', 'ca'] as const;

export function languageOptions(current: string | null): TravellerOption[] {
  const codes: string[] = [...LANGUAGE_CODES];
  if (current && !codes.includes(current)) codes.push(current);
  return codes.map((code) => ({ value: code, label: capitalize(displayName('language', code) ?? code) }));
}

/** Fuseaux que `Intl` liste, plus celui déjà rangé (un alias comme « UTC » n'y est pas toujours). */
export function timeZoneOptions(current: string | null): TravellerOption[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  const all = new Set(zones);
  if (current) all.add(current);
  return [...all].sort().map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
}
