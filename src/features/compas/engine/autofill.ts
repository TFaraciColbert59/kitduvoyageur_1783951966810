/**
 * Préremplissage du Compas : moteur PUR et déterministe. Il décide du type de
 * chaque nuit (profil + terrain), chiffre le trajet depuis la position réelle,
 * trouve chaque objet du kit dans l'ordre inventaire → prêt → location →
 * boutique, et assemble le budget complet. Chaque montant porte sa source :
 * `base` (lu en base), `mesure` (routage réel) ou `estimation` (règle ou IA,
 * toujours affichée comme telle). Aucun produit, prix ou lieu n'est inventé.
 */

import { shopTokens } from './shopMatch';

/* ---------- Nuits ---------- */

export type NightType = 'bivouac' | 'refuge' | 'hebergement';
export type NightsPref = 'bivouac' | 'refuge' | 'hebergement' | 'mixte' | null;
export type Autonomy = 'journee' | 'bivouac_1_2' | 'itinerance_longue' | null;
export type Priority = 'legerete' | 'confort' | 'budget' | 'securite' | null;

export interface NightPlan {
  /** 1 = première nuit (soir du jour 1). */
  night: number;
  type: NightType;
  reason: string;
}

export interface NightsInput {
  nights: number;
  pref: NightsPref;
  autonomy: Autonomy;
  priority: Priority;
  maxAltitudeM: number | null;
  /** Un refuge connu (base) près du lieu de chaque nuit. */
  refugeNear: boolean[];
}

export const NIGHT_LABEL: Record<NightType, string> = {
  bivouac: 'Bivouac',
  refuge: 'Refuge',
  hebergement: 'Hébergement',
};

export function planNights(input: NightsInput): NightPlan[] {
  const n = Math.max(0, Math.min(60, Math.floor(input.nights)));
  const out: NightPlan[] = [];
  const high = (input.maxAltitudeM ?? 0) >= 2000;
  for (let i = 1; i <= n; i += 1) {
    const refuge = input.refugeNear[i - 1] === true;
    const refugeOr = (why: string): NightPlan =>
      refuge
        ? { night: i, type: 'refuge', reason: why }
        : { night: i, type: 'hebergement', reason: `${why} ; aucun refuge connu à proximité` };
    let plan: NightPlan;
    if (input.pref === 'bivouac') plan = { night: i, type: 'bivouac', reason: 'ta préférence' };
    else if (input.pref === 'hebergement')
      plan = { night: i, type: 'hebergement', reason: 'ta préférence' };
    else if (input.pref === 'refuge') plan = refugeOr('ta préférence');
    else if (input.priority === 'confort') plan = refugeOr('ton profil : confort');
    else if (input.priority === 'budget')
      plan = { night: i, type: 'bivouac', reason: 'ton profil : budget' };
    else if (input.priority === 'securite' && high)
      plan = refugeOr('ton profil : sécurité, au-dessus de 2 000 m');
    else if (input.autonomy === 'journee') plan = refugeOr('ton profil : sorties à la journée');
    else if (input.autonomy === 'bivouac_1_2')
      plan =
        i <= 2
          ? { night: i, type: 'bivouac', reason: 'ton profil : bivouac sur 1 à 2 nuits' }
          : refugeOr('au-delà de 2 nuits, un toit pour récupérer');
    else if (input.autonomy === 'itinerance_longue')
      plan =
        i % 3 === 0 && refuge
          ? { night: i, type: 'refuge', reason: 'une nuit sur trois au refuge : repos et ravitaillement' }
          : { night: i, type: 'bivouac', reason: 'ton profil : itinérance en autonomie' };
    else plan = refugeOr(high ? 'terrain de haute montagne' : 'sans préférence connue');
    out.push(plan);
  }
  return out;
}

/* ---------- Trajet ---------- */

/** Voiture : consommation et carburant moyens, affichés comme hypothèses. */
export const CAR_ASSUMPTIONS = { litersPer100Km: 6.5, fuelEurPerLiter: 1.8, seats: 4 } as const;

export interface TransportEstimate {
  mode: 'voiture';
  oneWayKm: number;
  oneWayMin: number;
  cars: number;
  roundTripKm: number;
  /** Carburant aller-retour pour toutes les voitures, péages non comptés. */
  fuelEur: number;
  basis: string;
}

export function estimateCarTrip(input: {
  oneWayKm: number;
  oneWayMin: number;
  partySize: number;
}): TransportEstimate | null {
  if (!(input.oneWayKm > 0) || !Number.isFinite(input.oneWayKm)) return null;
  const cars = Math.max(1, Math.ceil(Math.max(1, input.partySize) / CAR_ASSUMPTIONS.seats));
  const roundTripKm = Math.round(input.oneWayKm * 2 * 10) / 10;
  const fuelEur =
    Math.round(
      ((roundTripKm * CAR_ASSUMPTIONS.litersPer100Km) / 100) * CAR_ASSUMPTIONS.fuelEurPerLiter * cars
    );
  return {
    mode: 'voiture',
    oneWayKm: Math.round(input.oneWayKm * 10) / 10,
    oneWayMin: Math.round(input.oneWayMin),
    cars,
    roundTripKm,
    fuelEur,
    basis: `itinéraire routier mesuré · ${CAR_ASSUMPTIONS.litersPer100Km} L/100 km à ${CAR_ASSUMPTIONS.fuelEurPerLiter.toFixed(2).replace('.', ',')} €/L · ${cars} voiture${cars > 1 ? 's' : ''} · péages non comptés`,
  };
}

/* ---------- Kit ---------- */

export interface GearNeed {
  key: string;
  name: string;
  category: string;
  vital: boolean;
  reason: string;
  /** Synonymes : un seul suffit dans le nom d'un objet pour le couvrir. */
  match: string[];
  /** Mots tous exigés (le nom de l'objet, ex. « lampe » ET « frontale »). */
  require?: string[];
}

/** Le couchage et la cuisine dépendent des nuits ; le reste vient des règles contextuelles. */
export function gearForNights(types: NightType[]): GearNeed[] {
  const bivouac = types.filter((t) => t === 'bivouac').length;
  const refuge = types.filter((t) => t === 'refuge').length;
  const out: GearNeed[] = [];
  if (bivouac) {
    const why = `${bivouac} nuit${bivouac > 1 ? 's' : ''} en bivouac`;
    out.push(
      { key: 'tent', name: 'Tente', category: 'shelter', vital: true, reason: why, match: ['tente', 'tent', 'abri', 'tarp'] },
      { key: 'sleeping-bag', name: 'Sac de couchage', category: 'sleep', vital: true, reason: why, match: ['couchage', 'duvet', 'quilt'] },
      { key: 'mattress', name: 'Matelas de sol', category: 'sleep', vital: true, reason: why, match: ['matelas', 'tapis'] },
      { key: 'stove', name: 'Réchaud', category: 'cook', vital: false, reason: why, match: ['rechaud', 'stove'] },
      { key: 'pot', name: 'Popote', category: 'cook', vital: false, reason: why, match: ['popote', 'casserole', 'gamelle'] }
    );
  }
  if (refuge)
    out.push({
      key: 'liner',
      name: 'Drap de sac (sac à viande)',
      category: 'sleep',
      vital: false,
      reason: `${refuge} nuit${refuge > 1 ? 's' : ''} en refuge : drap exigé dans la plupart des refuges`,
      match: ['drap', 'viande', 'liner'],
    });
  return out;
}

export interface SourceInventory {
  id: string;
  name: string;
  isLent: boolean;
}
export interface SourceBorrowed {
  inventoryItemId: string;
  name: string;
  lender: string | null;
}
export interface SourceShop {
  id: string;
  name: string;
  mode: 'achat' | 'location' | 'occasion' | 'enchere' | null;
  priceEur: number | null;
  pricePerDay: number | null;
}

export type GearSource = 'inventaire' | 'pret' | 'location' | 'achat' | 'a_trouver';

export interface GearPick {
  need: GearNeed;
  source: GearSource;
  inventoryItemId: string | null;
  shopProductId: string | null;
  /** Coût pour le voyage (location × jours, achat), 0 si déjà là, null si inconnu. */
  costEur: number | null;
  label: string;
}

/** Pluriel ignoré : « batons » couvre « baton ». */
const stem = (t: string) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

/**
 * `strict` (boutique) : tout le nom de l'objet est exigé. Sinon (ce qu'on
 * possède ou emprunte) : le nom principal suffit, une « Gourde 1 L » couvre la
 * « Gourde isotherme ».
 */
function covers(need: GearNeed, name: string, strict = true): boolean {
  const words = new Set(shopTokens(name).map(stem));
  if (need.require?.length)
    return (strict ? need.require : need.require.slice(0, 1)).every((t) => words.has(stem(t)));
  return need.match.some((m) => words.has(stem(m)));
}

/**
 * Priorité voulue : ce qu'on possède, puis ce qu'on nous prête, puis la
 * location (au prix réel par jour), puis l'achat en boutique. Un objet déjà
 * dans le kit du voyage n'est pas ajouté une seconde fois.
 */
export function sourceGear(
  needs: GearNeed[],
  ctx: {
    tripItemNames: string[];
    inventory: SourceInventory[];
    borrowed: SourceBorrowed[];
    shop: SourceShop[];
    days: number;
  }
): GearPick[] {
  const used = new Set<string>();
  const out: GearPick[] = [];
  const days = Math.max(1, Math.floor(ctx.days));
  for (const need of needs) {
    if (ctx.tripItemNames.some((n) => covers(need, n, false))) continue;
    const own = ctx.inventory.find((i) => !i.isLent && !used.has(i.id) && covers(need, i.name, false));
    if (own) {
      used.add(own.id);
      out.push({ need, source: 'inventaire', inventoryItemId: own.id, shopProductId: null, costEur: 0, label: own.name });
      continue;
    }
    const lent = ctx.borrowed.find((b) => !used.has(b.inventoryItemId) && covers(need, b.name, false));
    if (lent) {
      used.add(lent.inventoryItemId);
      out.push({ need, source: 'pret', inventoryItemId: lent.inventoryItemId, shopProductId: null, costEur: 0, label: lent.name });
      continue;
    }
    const rent = ctx.shop
      .filter((p) => p.mode === 'location' && p.pricePerDay != null && p.pricePerDay > 0 && covers(need, p.name))
      .sort((a, b) => (a.pricePerDay ?? 0) - (b.pricePerDay ?? 0))[0];
    if (rent) {
      out.push({
        need,
        source: 'location',
        inventoryItemId: null,
        shopProductId: rent.id,
        costEur: Math.round((rent.pricePerDay ?? 0) * days * 100) / 100,
        label: rent.name,
      });
      continue;
    }
    const buy = ctx.shop
      .filter((p) => p.mode === 'achat' && p.priceEur != null && p.priceEur > 0 && covers(need, p.name))
      .sort((a, b) => (a.priceEur ?? 0) - (b.priceEur ?? 0))[0];
    if (buy) {
      out.push({ need, source: 'achat', inventoryItemId: null, shopProductId: buy.id, costEur: buy.priceEur, label: buy.name });
      continue;
    }
    out.push({ need, source: 'a_trouver', inventoryItemId: null, shopProductId: null, costEur: null, label: need.name });
  }
  return out;
}

/* ---------- Repas ---------- */

/** Repli quand l'IA ne répond pas : par personne et par jour, selon la nuit. */
export const MEAL_EUR_PER_DAY: Record<NightType | 'jour', number> = {
  bivouac: 16,
  refuge: 22,
  hebergement: 30,
  jour: 12,
};

export function estimateMeals(input: {
  days: number;
  partySize: number;
  nights: NightType[];
  /** Montant par personne et par jour proposé par l'IA (déjà borné), sinon null. */
  aiPerPersonDay: number | null;
}): { amount: number; perPersonDay: number; basis: string } {
  const days = Math.max(1, Math.floor(input.days));
  const party = Math.max(1, Math.floor(input.partySize));
  if (input.aiPerPersonDay != null) {
    const amount = Math.round(input.aiPerPersonDay * days * party);
    return { amount, perPersonDay: input.aiPerPersonDay, basis: 'estimation de l’IA' };
  }
  let perPerson = 0;
  for (let d = 1; d <= days; d += 1) {
    const night = input.nights[d - 1];
    perPerson += night ? MEAL_EUR_PER_DAY[night] : MEAL_EUR_PER_DAY.jour;
  }
  return {
    amount: Math.round(perPerson * party),
    perPersonDay: Math.round((perPerson / days) * 10) / 10,
    basis: 'estimation selon le type de nuit',
  };
}

/* ---------- Budget ---------- */

export type BudgetCategory = 'hébergement' | 'transport' | 'nourriture' | 'matériel' | 'activités' | 'divers';
export type AmountSource = 'base' | 'mesure' | 'estimation';

export interface BudgetLine {
  category: BudgetCategory;
  title: string;
  amount: number;
  source: AmountSource;
  basis: string;
}

/** Arrondi à l'euro ; une ligne à 0 € n'est pas écrite. */
export function budgetLines(lines: Array<BudgetLine | null>): BudgetLine[] {
  return lines
    .filter((l): l is BudgetLine => l != null && Number.isFinite(l.amount) && l.amount > 0)
    .map((l) => ({ ...l, amount: Math.round(l.amount) }));
}

export function budgetTotal(lines: BudgetLine[]): number {
  return lines.reduce((t, l) => t + l.amount, 0);
}

/* ---------- Avis de l'IA (borné) ---------- */

export interface AutofillAiAdvice {
  mealsPerPersonDay: number | null;
  lodgingPerPersonNight: number | null;
  /** Vol aller-retour par personne depuis le départ (voyage lointain). */
  flightPerPerson: number | null;
  /** Déplacements sur place entre les étapes (bus, jeep, train, taxi…), par personne. */
  localTransportPerPerson: number | null;
  /** Location d'une voiture, par voiture et par jour (road trip après un vol). */
  carRentalPerDay: number | null;
  /** Visa, permis, taxes d'entrée, par personne. */
  entryFeesPerPerson: number | null;
  entryFeesDetail: string | null;
  /** Assurance voyage / rapatriement conseillée, par personne. */
  insurancePerPerson: number | null;
  notes: string[];
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  if (t.length < 3) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Ce que l'IA renvoie est borné : un chiffre hors des limites réalistes est ignoré. */
export function sanitizeAdvice(raw: unknown): AutofillAiAdvice {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, min: number, max: number) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
  };
  const notes = Array.isArray(r.notes)
    ? r.notes
        .map((n) => cleanText(n, 180))
        .filter((n): n is string => n != null && n.length >= 8)
        .slice(0, 3)
    : [];
  return {
    mealsPerPersonDay: num(r.meals_eur_per_person_day, 5, 80),
    lodgingPerPersonNight: num(r.lodging_eur_per_person_night, 5, 250),
    flightPerPerson: num(r.flight_eur_per_person, 40, 5000),
    localTransportPerPerson: num(r.local_transport_eur_per_person, 1, 3000),
    carRentalPerDay: num(r.car_rental_eur_per_day, 15, 500),
    entryFeesPerPerson: num(r.entry_fees_eur_per_person, 1, 1500),
    entryFeesDetail: cleanText(r.entry_fees_detail, 140),
    insurancePerPerson: num(r.insurance_eur_per_person, 5, 800),
    notes,
  };
}

/* ---------- Itinéraire proposé par l'IA ---------- */

export type StageMove = 'vol' | 'voiture' | 'bus' | 'train' | 'bateau' | 'marche' | 'velo' | 'aucun';
const MOVES = new Set<StageMove>(['vol', 'voiture', 'bus', 'train', 'bateau', 'marche', 'velo', 'aucun']);

export interface ProposedStage {
  day: number;
  place: string;
  /** Comment on rejoint ce lieu depuis celui de la veille. */
  move: StageMove;
  note: string | null;
}

/**
 * Une étape par jour, de 1 à `days`, chacune avec un lieu. Un jour manquant
 * reprend le lieu de la veille (repos, acclimatation). Rien n'est inventé ici :
 * le lieu sera ensuite retrouvé sur la carte, ou écarté.
 */
export function sanitizeStages(raw: unknown, days: number): ProposedStage[] {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  // Format compact [jour, lieu, move, note] ou objet {day, place, move, note}.
  const list = (Array.isArray(r.stages) ? (r.stages as unknown[]) : []).map((x) =>
    Array.isArray(x) ? { day: x[0], place: x[1], move: x[2], note: x[3] } : (x as Record<string, unknown>)
  );
  const byDay = new Map<number, ProposedStage>();
  for (const st of list) {
    const day = Number(st?.day);
    const place = cleanText(st?.place, 80);
    if (!Number.isInteger(day) || day < 1 || day > days || !place || byDay.has(day)) continue;
    const move = String(st?.move ?? '').toLowerCase() as StageMove;
    byDay.set(day, {
      day,
      place,
      move: MOVES.has(move) ? move : 'aucun',
      note: cleanText(st?.note, 140),
    });
  }
  if (!byDay.size) return [];
  const out: ProposedStage[] = [];
  let last: ProposedStage | null = null;
  for (let d = 1; d <= days; d += 1) {
    const st: ProposedStage | null =
      byDay.get(d) ?? (last ? { day: d, place: last.place, move: 'aucun', note: null } : null);
    if (st) {
      out.push(st);
      last = st;
    }
  }
  return out;
}

export const STEP_TRANSPORT: Record<StageMove, 'foot' | 'car' | 'bus' | 'train' | 'plane' | 'boat' | 'bike' | 'other'> = {
  vol: 'plane',
  voiture: 'car',
  bus: 'bus',
  train: 'train',
  bateau: 'boat',
  marche: 'foot',
  velo: 'bike',
  aucun: 'foot',
};

/* ---------- Venir jusqu'au départ ---------- */

/** Au-delà, la route n'est plus un trajet raisonnable : on part en avion. */
export const FLIGHT_THRESHOLD_KM = 900;

export function approachMode(input: { straightKm: number }): 'sur_place' | 'route' | 'avion' {
  if (input.straightKm < 0.5) return 'sur_place';
  if (input.straightKm > FLIGHT_THRESHOLD_KM) return 'avion';
  return 'route';
}

/**
 * Une recommandation des règles contextuelles devient un besoin : son nom
 * (deux premiers mots porteurs) doit se retrouver dans l'objet proposé.
 */
export function needFromRule(rec: {
  key: string;
  name: string;
  category: string;
  priority: string;
  reason: string;
}): GearNeed {
  const head = shopTokens(rec.name.split(/[/(]/)[0]).slice(0, 2);
  return {
    key: rec.key,
    name: rec.name,
    category: rec.category,
    vital: rec.priority === 'vital',
    reason: rec.reason,
    match: head,
    require: head,
  };
}

/** Sans nuit en bivouac, ni tente, ni couchage, ni cuisine des règles générales. */
export function keepRuleForNights(category: string, types: NightType[]): boolean {
  if (types.includes('bivouac')) return true;
  return !['shelter', 'sleep', 'cook'].includes(category);
}

/** Deux besoins désignent le même objet (la tente du bivouac et celle des règles). */
export function sameNeed(a: GearNeed, b: GearNeed): boolean {
  return a.key === b.key || covers(a, b.name) || covers(b, a.name);
}

/** Carburant pour des kilomètres mesurés sur place (mêmes hypothèses que le trajet). */
export function fuelForKm(km: number, partySize: number): { fuelEur: number; cars: number } {
  const cars = Math.max(1, Math.ceil(Math.max(1, partySize) / CAR_ASSUMPTIONS.seats));
  return {
    cars,
    fuelEur: Math.round(((km * CAR_ASSUMPTIONS.litersPer100Km) / 100) * CAR_ASSUMPTIONS.fuelEurPerLiter * cars),
  };
}

/**
 * Les règles de matériel sont pensées pour la montagne : pour un séjour
 * culturel ou un road trip, seules celles qui servent vraiment restent.
 */
const CITY_KEYS = new Set(['first-aid', 'powerbank', 'sunscreen', 'sunglasses', 'rain-poncho', 'water-bottle']);
const ROAD_EXCLUDED = new Set([
  'tent-2p',
  'sleeping-mat',
  'stove',
  'fire-starter',
  'trekking-poles',
  'crampons',
  'whistle',
  'water-filter',
  'backpack',
]);

export function keepRuleForActivity(key: string, activity: string): boolean {
  if (activity === 'cultural') return CITY_KEYS.has(key);
  if (activity === 'roadtrip') return !ROAD_EXCLUDED.has(key);
  return true;
}

/** Un séjour culturel ou un road trip dort sous un toit, sauf préférence dite. */
export function nightsPrefFor(activity: string, pref: NightsPref): NightsPref {
  if ((activity === 'cultural' || activity === 'roadtrip') && (pref == null || pref === 'mixte'))
    return 'hebergement';
  return pref;
}
