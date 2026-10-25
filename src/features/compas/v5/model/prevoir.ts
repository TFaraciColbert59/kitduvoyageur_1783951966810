/**
 * Compas v5 · tiroir « À prévoir » : modèle de vue PUR (aucune lecture réseau, aucun texte d'interface).
 *
 * Nuits : les lieux réels classés par le serveur (`extras.nights`) ; la nuit déjà notée par la personne
 * (`notedStay`) reste affichée même hors de la liste. Rien n'est comblé : un prix sans source, une photo sans
 * licence ou une distance inconnue restent absents. Le total des réservations ne mélange pas les devises et
 * dit combien de choix n'ont pas de prix.
 */
import type { CompasBookingInput, CompasDayPlan, CompasKitLine, CompasModel } from '../../engine/compasModel';
import { normalizeName } from '../../engine/kitApply';
import { formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { notedStay } from '../../engine/stayProposal';
import type { CompasData, CompasPoint, CompasShopProduct } from '../../server/getCompasData';
import { buyStage, itemState, restorablePurchaseState, shopProductFor, type BuyStage } from './sac';
import type { V5Extras, V5Photo, V5PriceHint, V5StayKind, V5StayOption, V5TransportOption } from '../types';

/* ---------- Nuits ---------- */

/** Une nuit possible, prête à afficher. `option` est ce qu'on envoie à `compasV5SetStayAction`. */
export interface StayView {
  id: string;
  name: string;
  kind: V5StayKind;
  /** Distance à l'arrivée du jour ; null quand elle n'est pas connue (nuit notée à la main). */
  distanceM: number | null;
  elevationM: number | null;
  price: V5PriceHint | null;
  photo: V5Photo | null;
  source: string | null;
  url: string | null;
  partner: string | null;
  /** Nuit notée par la personne qui n'est pas dans la liste classée. */
  manual: boolean;
  option: V5StayOption;
}

export type NightState = 'to-choose' | 'to-confirm';

export interface NightCard {
  day: number;
  date: string | null;
  /** Nom de la nuit retenue (celle qui est enregistrée sur l'étape), ou null. */
  noted: string | null;
  options: StayView[];
  chosen: StayView | null;
  /** Ce que la grande carte montre : la nuit choisie, sinon la mieux placée. */
  shown: StayView | null;
  state: NightState;
}

const sameName = (a: string, b: string) => {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x.length > 0 && x === y;
};

function toView(option: V5StayOption, manual = false): StayView {
  return {
    id: option.id,
    name: option.name,
    kind: option.kind,
    distanceM: Number.isFinite(option.distanceM) ? option.distanceM : null,
    elevationM: option.elevationM,
    price: option.price,
    photo: option.photo,
    source: option.source || null,
    url: option.url,
    partner: option.partner,
    manual,
    option,
  };
}

/** Nuit notée à la main, hors liste : l'option envoyée au serveur ne porte ni prix, ni photo, ni distance inventés. */
export function manualStay(name: string, lat: number | null, lon: number | null): StayView {
  const option: V5StayOption = {
    id: `noted:${name}`,
    name,
    kind: 'hebergement',
    lat: lat ?? 0,
    lon: lon ?? 0,
    distanceM: 0,
    elevationM: null,
    price: null,
    photo: null,
    source: '',
    url: null,
    partner: null,
  };
  return { ...toView(option, true), distanceM: null };
}

/** Les jours qui ont une nuit : tous sauf le dernier. */
export function nightDays(dayPlans: readonly CompasDayPlan[]): CompasDayPlan[] {
  return dayPlans.length > 1 ? dayPlans.slice(0, -1) : [];
}

export function nightCards(model: CompasModel, extras: V5Extras): NightCard[] {
  return nightDays(model.route.dayPlans).map((plan) => {
    const noted = notedStay(plan.stay);
    const listed = (extras.nights[plan.day] ?? []).map((o) => toView(o));
    let chosen = noted ? (listed.find((v) => sameName(v.name, noted)) ?? null) : null;
    const options = [...listed];
    if (noted && !chosen) {
      chosen = manualStay(noted, plan.lat, plan.lon);
      options.unshift(chosen);
    }
    const shown = chosen ?? options[0] ?? null;
    return { day: plan.day, date: plan.date, noted, options, chosen, shown, state: chosen ? 'to-confirm' : 'to-choose' };
  });
}

/* ---------- Trajet ---------- */

export interface TransportView {
  id: V5TransportOption['id'];
  label: string;
  detail: string | null;
  amountEur: number | null;
  perPerson: boolean;
  /** Coût pour tout le groupe, en euros ; null quand le serveur ne le chiffre pas. */
  costEur: number | null;
  source: string;
  url: string | null;
  partner: string | null;
}

export function transportCost(option: Pick<V5TransportOption, 'amountEur' | 'perPerson'>, people: number): number | null {
  if (option.amountEur == null || !Number.isFinite(option.amountEur)) return null;
  const total = option.perPerson ? option.amountEur * Math.max(1, people) : option.amountEur;
  return Math.round(total * 100) / 100;
}

export function transportViews(options: readonly V5TransportOption[], people: number): TransportView[] {
  return options.map((o) => ({
    id: o.id,
    label: o.label,
    detail: o.detail,
    amountEur: o.amountEur,
    perPerson: o.perPerson,
    costEur: transportCost(o, people),
    source: o.source,
    url: o.url,
    partner: o.partner,
  }));
}

/* ---------- Totaux ---------- */

export interface BookingTotals {
  /** Montants par devise (jamais mélangés). */
  byCurrency: Record<string, number>;
  /** Devise de l'unique total quand il n'y en a qu'une ; null sinon (ou rien à additionner). */
  currency: string | null;
  total: number | null;
  perPerson: number | null;
  chosenCount: number;
  /** Choix retenus dont le prix n'est pas renseigné. */
  unpriced: number;
  /** Au moins un montant est un repère de barème, pas le tarif de l'établissement. */
  hasHints: boolean;
  nightsTotalEur: number | null;
  transportTotalEur: number | null;
}

export function bookingTotals(cards: readonly NightCard[], transport: TransportView | null, people: number): BookingTotals {
  const by: Record<string, number> = {};
  let chosenCount = 0;
  let unpriced = 0;
  let hasHints = false;
  const add = (currency: string, amount: number) => {
    by[currency] = Math.round(((by[currency] ?? 0) + amount) * 100) / 100;
  };
  let nightsEur: number | null = null;
  for (const card of cards) {
    if (!card.chosen) continue;
    chosenCount += 1;
    const price = card.chosen.price;
    if (!price) {
      unpriced += 1;
      continue;
    }
    if (price.basis === 'bareme') hasHints = true;
    const amount = price.perPerson * Math.max(1, people);
    add(price.currency, amount);
    if (price.currency === 'EUR') nightsEur = Math.round(((nightsEur ?? 0) + amount) * 100) / 100;
  }
  let transportEur: number | null = null;
  if (transport) {
    chosenCount += 1;
    if (transport.costEur == null) unpriced += 1;
    else {
      add('EUR', transport.costEur);
      transportEur = transport.costEur;
    }
  }
  const currencies = Object.keys(by);
  const currency = currencies.length === 1 ? currencies[0] : null;
  const total = currency ? by[currency] : null;
  return {
    byCurrency: by,
    currency,
    total,
    perPerson: total != null ? Math.round((total / Math.max(1, people)) * 100) / 100 : null,
    chosenCount,
    unpriced,
    hasHints,
    nightsTotalEur: nightsEur,
    transportTotalEur: transportEur,
  };
}

/* ---------- « Tout réserver » : les liens, un par un ---------- */

export interface ReservationStep {
  key: string;
  kind: 'night' | 'transport';
  day: number | null;
  /** Nom de la nuit ou du trajet. */
  label: string;
  url: string | null;
  partner: string | null;
}

/**
 * Les réservations à ouvrir, dans l'ordre du voyage : les nuits choisies, puis le trajet choisi. Aucune n'est
 * inventée : un choix sans lien est listé sans lien (« à réserver chez l'hébergeur »). Rien ne s'ouvre seul.
 */
export function reservationSteps(cards: readonly NightCard[], transport: TransportView | null): ReservationStep[] {
  const steps: ReservationStep[] = cards
    .filter((c) => c.chosen)
    .map((c) => ({ key: `night:${c.day}`, kind: 'night' as const, day: c.day, label: (c.chosen as StayView).name, url: (c.chosen as StayView).url, partner: (c.chosen as StayView).partner }));
  if (transport) steps.push({ key: `transport:${transport.id}`, kind: 'transport', day: null, label: transport.label, url: transport.url, partner: transport.partner });
  return steps;
}

/** Le lien est-il sûr à ouvrir ? Seul le https passe. */
export const safeUrl = (url: string | null): string | null => (url && /^https:\/\//i.test(url) ? url : null);

/** Réservations réelles déjà enregistrées pour le voyage (celles qui ne sont ni annulées, ni expirées, ni échouées). */
export function liveBookings(bookings: readonly CompasBookingInput[]): CompasBookingInput[] {
  return bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'expired' && b.status !== 'failed' && b.status !== 'refunded');
}

/** Fournisseurs en mode test : l'écran le signale toujours. */
export function sandboxProviders(providers: CompasData['providers']): Array<'routestack' | 'viator'> {
  return (['routestack', 'viator'] as const).filter((p) => providers[p] === 'sandbox');
}

/* ---------- À acheter ---------- */

export interface RouteShop {
  label: string;
  /** Distance au point d'arrivée de jour le plus proche. */
  distanceM: number;
  day: number;
}

const EARTH_M = 6_371_000;
export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Le commerce repéré par la carte le plus proche d'une arrivée de jour (rien si la carte n'en a repéré aucun). */
export function nearestRouteShop(points: readonly CompasPoint[], dayPlans: readonly CompasDayPlan[]): RouteShop | null {
  const shops = points.filter((p) => p.kind === 'poi' && p.category === 'commerce' && p.label.trim());
  let best: RouteShop | null = null;
  for (const shop of shops) {
    for (const plan of dayPlans) {
      if (plan.lat == null || plan.lon == null) continue;
      const d = haversineM(plan.lat, plan.lon, shop.lat, shop.lon);
      if (!best || d < best.distanceM) best = { label: shop.label.trim(), distanceM: d, day: plan.day };
    }
  }
  return best;
}

export interface BuyEntry {
  line: CompasKitLine;
  stage: BuyStage;
  product: CompasShopProduct | null;
  /** Le produit est déjà celui choisi pour l'objet. */
  linked: boolean;
  priceEur: number | null;
  /** État à rétablir si on annule « Déjà acheté ». */
  restore: 'needed' | 'added' | 'in_cart' | 'shipping';
}

export function buyEntries(
  lines: readonly CompasKitLine[],
  shop: readonly CompasShopProduct[],
  viewerId: string | null
): BuyEntry[] {
  return lines
    .filter((l) => {
      const s = itemState(l, viewerId);
      return s === 'buy' || s === 'replace';
    })
    .map((line) => {
      const hit = shopProductFor(line, shop);
      return {
        line,
        stage: buyStage(line),
        product: hit?.product ?? null,
        linked: hit?.linked ?? false,
        priceEur: hit?.product.priceEur ?? null,
        restore: restorablePurchaseState(line),
      };
    })
    .sort((a, b) => Number(b.line.vital) - Number(a.line.vital));
}

export interface BuyTotals {
  count: number;
  /** Somme des prix de la boutique LKDV des objets qui en ont un. */
  boutiqueEur: number;
  pricedCount: number;
  unpricedCount: number;
  inCart: number;
}

export function buyTotals(entries: readonly BuyEntry[]): BuyTotals {
  let eur = 0;
  let priced = 0;
  let inCart = 0;
  for (const e of entries) {
    if (e.priceEur != null) {
      eur += e.priceEur;
      priced += 1;
    }
    if (e.stage !== 'needed') inCart += 1;
  }
  return { count: entries.length, boutiqueEur: Math.round(eur * 100) / 100, pricedCount: priced, unpricedCount: entries.length - priced, inCart };
}

/** « 300 m » sous le kilomètre, « 2,5 km » au-delà (séparateurs de la langue). */
export function formatDistance(locale: Locale, meters: number): string {
  if (meters < 1000) return `${formatNumber(Math.round(meters), { maximumFractionDigits: 0 }, locale)} m`;
  return `${formatNumber(meters / 1000, { maximumFractionDigits: 1 }, locale)} km`;
}
