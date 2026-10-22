/**
 * Compas v5 : nuits possibles près de l'arrivée d'un jour (fonctions pures).
 *
 * Les lieux viennent d'OpenStreetMap (`RoutePoi`) ; rien n'est inventé. Le classement ne montre qu'une
 * chose : l'ordre. Ni capacité ni note ne sont affichées, puisqu'OpenStreetMap ne les donne pas ici.
 * Un prix n'existe que comme repère du barème du Compas (`basis: 'bareme'`), jamais comme le tarif de
 * l'établissement ; sans barème pour ce type de nuit (camping, bivouac), il reste `null`.
 */

import type { CompasNights } from '../../engine/compasModel';
import { COSTS_VERSION, lodgingPerNight, priceLevel, refugePerNight } from '../../engine/costs';
import { matchKey } from '../../engine/nameKey';
import { distanceKm } from '../../engine/places';
import { poiLabel, type RoutePoi, type RoutePoiCategory } from '../../engine/routePois';
import type { V5PriceHint, V5StayKind, V5StayOption } from '../types';

export interface StayRankInput {
  /** Point d'arrivée du jour ; sans lui, rien ne se classe. */
  arrival: { lat: number; lon: number } | null;
  /** Points autour des étapes ; seuls hébergements, refuges et campings sont lus. */
  pois: readonly RoutePoi[];
  /** Nuit déjà notée par la personne pour ce soir (`accommodation_name`). */
  noted: string | null;
  /** Taille du groupe. */
  party: number;
  /** Préférence de nuits du voyage (`metadata.compas.prefs.nights`). */
  nights: CompasNights | null;
  /** Pays de la destination (ISO), pour le niveau de prix du barème. */
  countryCode: string | null;
  /** Nombre d'options rendues au plus (5 par défaut). */
  limit?: number;
  /** Rayon autour de l'arrivée, en mètres (5 km par défaut). */
  radiusM?: number;
}

export const STAY_DEFAULT_LIMIT = 5;
export const STAY_DEFAULT_RADIUS_M = 5000;

/** Date du barème (ISO), tirée de sa version « AAAA-MM » : le barème se relève le premier du mois. */
export const BAREME_AS_OF = `${COSTS_VERSION}-01`;

const KIND_OF: Partial<Record<RoutePoiCategory, V5StayKind>> = {
  hebergement: 'hebergement',
  refuge: 'refuge',
  camping: 'camping',
};

/** Rang d'adéquation (0 = idéal) de chaque type de nuit selon la préférence du voyage. */
const FIT: Record<Exclude<CompasNights, 'mixte'>, Record<V5StayKind, number>> = {
  bivouac: { bivouac: 0, camping: 0, refuge: 1, hebergement: 2 },
  refuge: { refuge: 0, bivouac: 1, camping: 1, hebergement: 2 },
  hebergement: { hebergement: 0, refuge: 1, camping: 2, bivouac: 3 },
};

/** Chaque rang d'écart à la préférence pèse comme 1,5 km de plus à marcher. */
const FIT_STEP_M = 1500;
/** Un lieu d'une taille peu plausible pour le groupe pèse comme 2 km de plus. */
const CAPACITY_STEP_M = 2000;

/**
 * Un petit gîte ou un hôtel isolé loge rarement plus d'une dizaine de personnes d'un coup ; un camping
 * ou un bivouac s'étire à volonté. Ce n'est qu'un critère d'ordre : aucune capacité n'est affichée.
 */
function plausibleFor(kind: V5StayKind, party: number): boolean {
  if (kind === 'hebergement') return party <= 10;
  if (kind === 'refuge') return party <= 15;
  return true;
}

/** Type d'une nuit notée à la main, lu dans les mots de la personne (hébergement à défaut). */
export function kindOfNotedStay(name: string): V5StayKind {
  const key = matchKey(name);
  if (/\b(refuge|cabane|abri|gite d etape|hut|rifugio|hutte)\b/.test(key)) return 'refuge';
  if (/\b(camping|campsite|campground)\b/.test(key)) return 'camping';
  if (/\bbivouac|bivvy|wild camp/.test(key)) return 'bivouac';
  return 'hebergement';
}

/** Repère de prix par personne du barème pour un type de nuit ; null quand le barème n'en a pas. */
export function stayPriceHint(kind: V5StayKind, countryCode: string | null): V5PriceHint | null {
  if (kind !== 'hebergement' && kind !== 'refuge') return null;
  const { level } = priceLevel(countryCode);
  return {
    perPerson: kind === 'refuge' ? refugePerNight(level) : lodgingPerNight(level),
    currency: 'EUR',
    basis: 'bareme',
    asOf: BAREME_AS_OF,
  };
}

const sourceOf = (price: V5PriceHint | null, noted: boolean): string => {
  const base = noted ? 'noté par toi' : 'OpenStreetMap';
  return price ? `${base} · prix : repère du barème Compas ${COSTS_VERSION}` : base;
};

interface Candidate {
  option: V5StayOption;
  named: boolean;
  score: number;
}

/**
 * Trois à cinq nuits possibles, la nuit déjà notée d'abord, puis les lieux nommés du plus plausible
 * au moins plausible (distance à l'arrivée, ajustée par la préférence du voyage et la taille du groupe),
 * puis les lieux sans nom, qui gardent leur catégorie pour nom. Moins de lieux réels : moins d'options.
 */
export function rankStayOptions(input: StayRankInput): V5StayOption[] {
  const { arrival } = input;
  if (!arrival || !Number.isFinite(arrival.lat) || !Number.isFinite(arrival.lon)) return [];
  const limit = Math.max(1, input.limit ?? STAY_DEFAULT_LIMIT);
  const radiusM = input.radiusM ?? STAY_DEFAULT_RADIUS_M;
  const party = Math.max(1, Math.floor(input.party) || 1);
  const fit = input.nights && input.nights !== 'mixte' ? FIT[input.nights] : null;

  const cands: Candidate[] = [];
  for (const poi of input.pois) {
    const kind = KIND_OF[poi.category];
    if (!kind) continue;
    const distanceM = Math.round(distanceKm(arrival, poi) * 1000);
    if (!Number.isFinite(distanceM) || distanceM > radiusM) continue;
    const price = stayPriceHint(kind, input.countryCode);
    const score =
      distanceM + (fit ? fit[kind] * FIT_STEP_M : 0) + (plausibleFor(kind, party) ? 0 : CAPACITY_STEP_M);
    cands.push({
      named: poi.name != null,
      score,
      option: {
        id: `osm:${poi.id}`,
        name: poiLabel(poi),
        kind,
        lat: poi.lat,
        lon: poi.lon,
        distanceM,
        elevationM: poi.elevationM,
        price,
        photo: null,
        source: sourceOf(price, false),
        url: null,
        partner: null,
      },
    });
  }
  cands.sort((a, b) => Number(b.named) - Number(a.named) || a.score - b.score || a.option.id.localeCompare(b.option.id));

  // Un même lieu relevé deux fois (nœud et bâtiment) : le mieux classé reste.
  const seen: V5StayOption[] = [];
  const ranked: V5StayOption[] = [];
  for (const { option, named } of cands) {
    const twin = seen.some(
      (o) => o.id === option.id || (named && matchKey(o.name) === matchKey(option.name) && distanceKm(o, option) < 0.15)
    );
    if (twin) continue;
    seen.push(option);
    ranked.push(option);
  }

  const notedName = input.noted?.trim() || null;
  if (!notedName) return ranked.slice(0, limit);

  // La nuit notée prend la place du lieu d'OpenStreetMap qui porte le même nom (sa position et son
  // altitude sont alors connues) ; sinon elle reste à l'arrivée du jour, à distance nulle, sans altitude.
  const key = matchKey(notedName);
  const match = ranked.find((o) => matchKey(o.name) === key) ?? null;
  const kind = match?.kind ?? kindOfNotedStay(notedName);
  const price = stayPriceHint(kind, input.countryCode);
  const noted: V5StayOption = {
    id: `noted:${notedName}`,
    name: notedName,
    kind,
    lat: match?.lat ?? arrival.lat,
    lon: match?.lon ?? arrival.lon,
    distanceM: match?.distanceM ?? 0,
    elevationM: match?.elevationM ?? null,
    price,
    photo: null,
    source: sourceOf(price, true),
    url: null,
    partner: null,
  };
  return [noted, ...ranked.filter((o) => o !== match)].slice(0, limit);
}
