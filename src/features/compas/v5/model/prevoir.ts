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
import { addDaysIso, stayDeepLink, transportDeepLink } from '../../engine/deepLinks';
import { isNamedTrail } from '../../engine/intent';
import type { EngineT } from '../../engine/engineI18n';
import { RESA_RANK_NIGHT, resaPlan, resaRank, type ResaApproach, type ResaLine } from '../../engine/resaPlan';
import { notedStay } from '../../engine/stayProposal';
import type { CompasData, CompasPoint, CompasShopProduct } from '../../server/getCompasData';
import { extraKey, isResaBooked, isResaSkipped, type ResaStatus } from '../engine/resaStatus';
import { buyStage, itemState, restorablePurchaseState, shopProductFor, type BuyStage } from './sac';
import { placeOfDay } from './trip';
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
  /** Lieu de l'étape du jour (arrivée), pour les liens de recherche ; null s'il n'est pas dit. */
  place: string | null;
  /** La nuit montrée est la sélection par défaut (la mieux classée), pas un choix écrit : rien n'est écrit en base. */
  proposed: boolean;
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
    return {
      day: plan.day,
      date: plan.date,
      noted,
      options,
      chosen,
      shown,
      state: chosen ? 'to-confirm' : 'to-choose',
      place: placeOfDay(plan.title),
      proposed: !chosen && shown != null,
    };
  });
}

/** Localité de la première étape (là où l'on arrive), ou null quand son titre n'en dit pas. */
export function firstPlace(model: CompasModel): string | null {
  const first = model.route.dayPlans[0];
  return first ? placeOfDay(first.title) : null;
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
  /** Vol : codes IATA de départ et d'arrivée (rangés avec la ligne de budget), ou null quand ils ne sont pas connus. */
  airports: { from: string; to: string } | null;
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
    airports: o.id === 'flight' ? (o.airports ?? null) : null,
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

/* ---------- « Tout réserver » : le plan complet, dans l'ordre du voyage ---------- */

/** Le trajet d'approche pris en compte : celui que la personne a choisi, sinon la sélection par défaut (annoncée). */
export interface TransportSelection {
  view: TransportView;
  /** Sélection par défaut : rien n'est écrit en base tant que la personne n'a pas agi. */
  proposed: boolean;
}

const PRICED_APPROACH = new Set<TransportView['id']>(['car', 'train', 'flight', 'bus']);

/**
 * Le choix écrit s'il existe ; sinon l'option chiffrée par la préparation (voiture, train, avion), la
 * première dans l'ordre où le serveur les rend. Sans option chiffrée : aucune sélection (covoiturage et
 * « à pied » ne sont jamais choisis à la place de la personne).
 */
export function selectedTransport(views: readonly TransportView[], chosenId: TransportView['id'] | null): TransportSelection | null {
  const chosen = chosenId ? views.find((v) => v.id === chosenId) : null;
  if (chosen) return { view: chosen, proposed: false };
  const fallback = views.find((v) => PRICED_APPROACH.has(v.id) && v.costEur != null);
  return fallback ? { view: fallback, proposed: true } : null;
}

const APPROACH_OF: Record<TransportView['id'], ResaApproach> = {
  car: 'car',
  train: 'train',
  flight: 'flight',
  bus: 'bus',
  carpool: 'carpool',
  foot: 'foot',
};

/**
 * Le reste du plan « À prévoir » (assurance, transfert, location, forfait, refuges, visa…) pour CE voyage : le moteur
 * `resaPlan` lit les réglages du modèle (jours, groupe, dates, activité : jamais recalculés ici), le trajet retenu ou
 * proposé, ce que le serveur sait de la personne qui regarde (`readerTravel`) et l'aéroport lu avec les extras.
 */
export function resaLinesFor(args: {
  data: CompasData;
  extras: V5Extras;
  /** Trajet retenu (ou proposé par défaut) ; sans lui, le moyen de venir dit dans la demande, s'il y en a un. */
  transport: TransportSelection | null;
  people: number;
  t: EngineT;
  /** Aujourd'hui (ISO), pour ne pas afficher une date limite déjà passée. */
  today: string;
}): ResaLine[] {
  const { data, extras, transport } = args;
  const { model } = data;
  const said = model.preferences.transportMode;
  const approach: ResaApproach | null = transport ? APPROACH_OF[transport.view.id] : said === 'flight' || said === 'train' || said === 'car' ? said : null;
  const namedTrail = [data.route.name, model.destination].find((n): n is string => !!n && isNamedTrail(n)) ?? null;
  return resaPlan({
    activity: model.activity,
    destinationCountry: data.countryCode,
    originCountry: data.originSaid?.countryCode ?? null,
    abroad: data.readerTravel?.abroad ?? null,
    start: model.dates.start,
    end: model.dates.end,
    days: model.dates.days,
    party: args.people,
    maxAltitudeM: data.elevation?.maxM ?? null,
    approach,
    nationality: data.readerTravel?.nationality ?? null,
    entry: data.readerTravel?.entry ?? null,
    namedTrail,
    base: model.destination,
    arrivalPlace: firstPlace(model),
    hub: extras.hub?.name ?? null,
    arrivalAirport: approach === 'flight' && transport?.view.id === 'flight' ? (transport.view.airports?.to ?? null) : null,
    nights: model.preferences.nights,
    technicalLevel: data.danger.axes.technique.level,
    carFree: model.preferences.carFree === true,
    today: args.today,
    t: args.t,
  });
}

/** Aucun lieu de départ connu : ni dit dans la demande, ni de trajet d'approche calculé (donc pas de domicile ou de position). */
export function originMissing(data: CompasData, extras: V5Extras, transport: TransportSelection | null): boolean {
  return (
    extras.fetchedAt !== '' &&
    !extras.unavailable.includes('transport') &&
    data.autofill === 'done' &&
    !data.originName &&
    !data.originSaid &&
    transport == null
  );
}

export interface ReservationContext {
  /** Nombre de voyageurs (celui du modèle, jamais recalculé ici). */
  people: number;
  /** Lieu de départ dit, ou null. */
  origin: string | null;
  /** Destination du voyage (nom du voyage : un massif, un pays), ou null. */
  destination: string | null;
  /** Localité de la première étape (là où l'on arrive), ou null : sert de destination aux liens du trajet, avant le nom du voyage. */
  arrival?: string | null;
  /** Dates du voyage (ISO) : départ et retour. */
  start: string | null;
  end: string | null;
  /** Mot de réservation de la langue, pour les recherches web. */
  keyword?: string;
  /** Le reste du plan (`engine/resaPlan.ts` : assurance, transfert, location, forfait, refuges…), déjà dans l'ordre. */
  lines?: readonly ResaLine[];
  /** Aucun lieu de départ connu : le plan s'ouvre sur « D'où pars-tu ? ». */
  askOrigin?: boolean;
}

export interface ReservationStep {
  /** `transport`, `night:<premier jour>`, `extra:<ligne>` ou `origin` : la clé du premier élément de la ligne. */
  key: string;
  /** Clés de statut de tous les éléments de la ligne (`night:<jour>` pour chaque nuit, `transport`, `extra:<ligne>` ; aucune pour `origin`). */
  keys: string[];
  /** `extra` : une ligne du plan complet ; `origin` : la question du lieu de départ (rien à réserver). */
  kind: 'night' | 'transport' | 'extra' | 'origin';
  /** La ligne du plan complet quand `kind` vaut `extra`, sinon null. */
  extra: ResaLine | null;
  /** Premier jour de la ligne (nuits) ; null pour le trajet. */
  day: number | null;
  /** Nombre de nuits de la ligne (0 pour le trajet). */
  nights: number;
  /** Arrivée = première nuit ; départ = dernière nuit + 1 (ISO, null quand les dates ne sont pas connues). */
  checkIn: string | null;
  checkOut: string | null;
  /** Nom de la nuit ou du trajet ; lieu de l'étape quand aucune nuit n'est connue ; vide sinon. */
  label: string;
  /** Lieu de l'étape. */
  place: string | null;
  /** Aucun choix écrit : c'est la sélection par défaut, annoncée « Proposé ». */
  proposed: boolean;
  /** Lien ouvert par la personne : celui de l'option (partenaire ou site du lieu), sinon une recherche prérempliée. */
  url: string | null;
  partner: string | null;
  /** Lien de recherche direct (sans affiliation). */
  direct: boolean;
  /** Nuits à écrire comme choix si la ligne est notée réservée alors qu'elle n'est que proposée. */
  pending: Array<{ day: number; option: StayView['option'] }>;
}

interface NightSlot {
  card: NightCard;
  view: StayView | null;
}

/** Même hébergement (même lieu OSM ou même nom) ; sans hébergement connu, même lieu d'étape. */
function sameLodging(a: NightSlot, b: NightSlot): boolean {
  if (a.view && b.view) return a.view.id === b.view.id || sameName(a.view.name, b.view.name);
  if (a.view || b.view) return false;
  return a.card.place != null && b.card.place != null && sameName(a.card.place, b.card.place);
}

/**
 * Tout ce qu'il y a à réserver, dans l'ordre du voyage : d'abord le trajet d'approche, puis chaque nuit par
 * ordre de jour. Une nuit sans choix écrit prend la première option proposée (la mieux classée) comme
 * sélection par défaut annoncée (`proposed`) ; une nuit sans option est listée quand même, avec une
 * recherche sur le lieu de l'étape. Les nuits consécutives au même hébergement forment une seule ligne.
 * Aucune n'est inventée et rien ne s'ouvre seul.
 */
export function reservationSteps(cards: readonly NightCard[], transport: TransportSelection | null, ctx: ReservationContext): ReservationStep[] {
  const steps: ReservationStep[] = [];

  if (transport && transport.view.id !== 'foot') {
    const { view } = transport;
    const own = safeUrl(view.url);
    // Un vol dont on connaît les aéroports : « de ORY à KRK ». Sinon ville de départ → localité d'arrivée, et le
    // nom du voyage (« Tatras ») seulement à défaut : un massif n'est pas une adresse.
    const byAirports = view.id === 'flight' ? view.airports : null;
    const url =
      own ??
      transportDeepLink({
        mode: view.id,
        origin: byAirports?.from ?? ctx.origin,
        destination: byAirports?.to ?? (ctx.arrival?.trim() || ctx.destination),
        depart: ctx.start,
        back: ctx.end,
      });
    steps.push({
      key: 'transport',
      keys: ['transport'],
      kind: 'transport',
      extra: null,
      day: null,
      nights: 0,
      checkIn: null,
      checkOut: null,
      label: view.label,
      place: ctx.destination,
      proposed: transport.proposed,
      url,
      partner: own ? view.partner : null,
      direct: !own && url != null,
      pending: [],
    });
  }

  const groups: NightSlot[][] = [];
  for (const card of cards) {
    const slot: NightSlot = { card, view: card.chosen ?? card.shown };
    const group = groups[groups.length - 1];
    const prev = group?.[group.length - 1];
    if (group && prev && card.day === prev.card.day + 1 && sameLodging(prev, slot)) group.push(slot);
    else groups.push([slot]);
  }

  for (const group of groups) {
    const first = group[0];
    const last = group[group.length - 1];
    const { view } = first;
    const checkOut = addDaysIso(last.card.date, 1);
    const dated = first.card.date != null && checkOut != null;
    const own = view ? safeUrl(view.url) : null;
    const deep = own
      ? null
      : stayDeepLink({
          kind: view?.kind ?? 'hebergement',
          name: view?.name ?? first.card.place ?? '',
          place: first.card.place,
          website: null,
          checkIn: dated ? first.card.date : null,
          checkOut: dated ? checkOut : null,
          adults: ctx.people,
          keyword: ctx.keyword,
        });
    steps.push({
      key: `night:${first.card.day}`,
      keys: group.map((s) => `night:${s.card.day}`),
      kind: 'night',
      extra: null,
      day: first.card.day,
      nights: group.length,
      checkIn: dated ? first.card.date : null,
      checkOut: dated ? checkOut : null,
      label: view?.name ?? first.card.place ?? '',
      place: first.card.place,
      proposed: group.some((s) => !s.card.chosen),
      url: own ?? deep,
      partner: own ? (view?.partner ?? null) : null,
      direct: !own && deep != null,
      pending: group.flatMap((s) => (!s.card.chosen && s.view ? [{ day: s.card.day, option: s.view.option }] : [])),
    });
  }

  for (const line of ctx.lines ?? []) {
    const url = safeUrl(line.url);
    steps.push({
      key: extraKey(line.key),
      keys: [extraKey(line.key)],
      kind: 'extra',
      extra: line,
      day: null,
      nights: 0,
      checkIn: null,
      checkOut: null,
      label: line.title,
      place: ctx.destination,
      proposed: false,
      url,
      partner: null,
      direct: url != null,
      pending: [],
    });
  }

  if (ctx.askOrigin)
    steps.push({
      key: 'origin',
      keys: [],
      kind: 'origin',
      extra: null,
      day: null,
      nights: 0,
      checkIn: null,
      checkOut: null,
      label: '',
      place: null,
      proposed: false,
      url: null,
      partner: null,
      direct: false,
      pending: [],
    });

  // Dans l'ordre où l'on s'en occupe : la question du départ, les papiers, l'assurance, le trajet, le transfert,
  // la location, les nuits, puis forfait, permis, guide et activités. Tri stable : les nuits restent par jour.
  return steps.map((s, i) => ({ s, i, r: stepRank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}

/** Rang d'une ligne dans le plan : voir `reservationSteps`. */
const RANK_ORIGIN = 0;
const RANK_TRANSPORT = 25;
const RANK_NIGHT = RESA_RANK_NIGHT;

function stepRank(step: ReservationStep): number {
  if (step.kind === 'origin') return RANK_ORIGIN;
  if (step.kind === 'transport') return RANK_TRANSPORT;
  if (step.kind === 'night') return RANK_NIGHT;
  return step.extra ? resaRank(step.extra.key) : 99;
}

export interface PlanProgress {
  /** Les lignes affichées : tout, sauf les lignes notées « pas besoin ». */
  visible: ReservationStep[];
  /** Les lignes masquées (« pas besoin »). */
  hidden: ReservationStep[];
  /** À réserver : lignes affichées pas encore faites (la question du départ n'en est pas une). */
  todo: number;
  /** Faites : lignes notées réservées. */
  done: number;
}

/** Compteur « N à réserver · M faits » et lignes masquées, d'après les statuts rangés sur le voyage. */
export function planProgress(steps: readonly ReservationStep[], resa: Readonly<Record<string, ResaStatus>>): PlanProgress {
  const visible: ReservationStep[] = [];
  const hidden: ReservationStep[] = [];
  let todo = 0;
  let done = 0;
  for (const step of steps) {
    if (step.kind === 'extra' && isResaSkipped(resa, step.key)) {
      hidden.push(step);
      continue;
    }
    visible.push(step);
    if (step.kind === 'origin') continue;
    if (step.keys.length > 0 && step.keys.every((k) => isResaBooked(resa, k))) done += 1;
    else todo += 1;
  }
  return { visible, hidden, todo, done };
}

/** Le lien est-il sûr à ouvrir ? https, ou le relais d'affiliation du site (`/go/<slug>`) ; rien d'autre de relatif. */
export const safeUrl = (url: string | null): string | null =>
  url && (/^https:\/\//i.test(url) || /^\/go\/[\w-]+(?:[?#]|$)/.test(url)) ? url : null;

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
