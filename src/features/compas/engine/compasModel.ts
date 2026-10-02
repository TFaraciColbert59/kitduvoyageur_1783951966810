/**
 * Compas — modèle dérivé du préparateur.
 *
 * Fonction pure : elle reçoit uniquement des données déjà lues en base (voyage,
 * étapes, objets, dépenses, membres, inventaire, réservations, météo réelle) et
 * produit tout ce que l'écran affiche. Règle LKDV : aucune valeur n'est
 * inventée. Une donnée absente reste absente (`null`) et l'écran le dit.
 */

import { formatClock, sunTimes, tzOffsetMinutes } from './sun';
import { crewPace, settleExpenses, type CompasPace, type CompasSettlement } from './crew';
import { walkingMinutes, type Pace } from './weather';

export type CompasStepId = 'ou' | 'nous' | 'resa' | 'verdict' | 'kit';

export const COMPAS_STEPS: ReadonlyArray<{ id: CompasStepId; label: string; icon: string }> = [
  { id: 'ou', label: 'Où', icon: 'map' },
  { id: 'nous', label: 'Nous', icon: 'users' },
  { id: 'resa', label: 'Résa', icon: 'ticket' },
  { id: 'verdict', label: 'Verdict', icon: 'shield-check' },
  { id: 'kit', label: 'Kit', icon: 'backpack' },
];

/* ---------- Entrées (sous-ensembles des tables réelles) ---------- */

export interface CompasTripInput {
  id: string;
  slug: string;
  title: string;
  destinationName: string | null;
  startDate: string | null;
  endDate: string | null;
  primaryActivity: string | null;
  estimatedBudget: number | null;
  budgetCurrency: string | null;
  partySize: number | null;
  ownerId: string;
  /** Durée choisie en heures quand la sortie tient en moins d'une journée. */
  durationHours?: number | null;
  preferences?: Partial<CompasPreferences> | null;
}

export type CompasNights = 'bivouac' | 'refuge' | 'hebergement' | 'mixte';

export interface CompasPreferences {
  pace: Pace;
  nights: CompasNights | null;
  avoid: string[];
  wishes: string[];
}

export interface CompasStepInput {
  id: string;
  dayNumber: number;
  orderIndex: number;
  title: string;
  locationName: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  accommodationName: string | null;
  transportMode: string | null;
  startTime: string | null;
}

export interface CompasItemInput {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  weightGrams: number | null;
  isPacked: boolean;
  isVital: boolean;
  isWorn: boolean;
  isConsumable: boolean;
  ownership: 'personal' | 'shared' | null;
  ownerId: string | null;
  inventoryItemId: string | null;
  shopProductId: string | null;
  condition: string | null;
  reason: string | null;
  purchaseState: string | null;
}

export interface CompasMemberInput {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  /** trip_member_profiles.max_carry_kg — null si jamais renseigné. */
  maxCarryKg: number | null;
  flatSpeedKmh: number | null;
  experienceLevel: string | null;
  calibrationLevel: string | null;
}

export interface CompasExpenseInput {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  isPlanned: boolean;
  payerId: string;
  splitType: string;
}

export interface CompasInventoryInput {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  weightG: number | null;
  condition: string | null;
  isLent: boolean;
  maintenanceDueAt: string | null;
  expiryDate: string | null;
  quantity: number;
}

export interface CompasBookingInput {
  id: string;
  vertical: string;
  provider: string;
  status: string;
  amountEur: number | null;
}

export interface CompasWeatherDayInput {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipPct: number;
  weathercode: number;
}

export interface CompasInput {
  trip: CompasTripInput;
  steps: CompasStepInput[];
  items: CompasItemInput[];
  members: CompasMemberInput[];
  expenses: CompasExpenseInput[];
  inventory: CompasInventoryInput[];
  bookings: CompasBookingInput[];
  weather: CompasWeatherDayInput[];
  /** Durée estimée du parcours principal (min), si connue. */
  routeDurationMin: number | null;
  routeHasGeometry: boolean;
  waterPointsCount: number | null;
  viewerId: string | null;
  now: Date;
  timeZone: string;
}

/* ---------- Sorties ---------- */

export interface CompasKitLine {
  id: string;
  name: string;
  category: string | null;
  weightGrams: number | null;
  quantity: number;
  packed: boolean;
  vital: boolean;
  kind: 'base' | 'worn' | 'consumable';
  shared: boolean;
  ownerId: string | null;
  /** Lien avec l'inventaire réel (product_ownership). */
  inventoryItemId: string | null;
  /** L'objet de l'inventaire est prêté : il n'est pas disponible. */
  lent: boolean;
  status: 'owned' | 'missing' | 'lent' | 'replace';
  reason: string | null;
  /** Produit précis de la boutique choisi pour cet objet. */
  shopProductId: string | null;
  purchaseState: string | null;
  condition: string | null;
}

export interface CompasMemberLoad {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  carriedGrams: number;
  capacityKg: number | null;
  /** Allure à plat (km/h), null si jamais renseignée ou mesurée. */
  flatSpeedKmh: number | null;
  experienceLevel: string | null;
  calibrationLevel: string | null;
  /** Rapport charge / capacité, null si la capacité est inconnue. */
  ratio: number | null;
  sharedItemIds: string[];
}

export interface CompasDayPlan {
  day: number;
  date: string | null;
  title: string;
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
  lat: number | null;
  lon: number | null;
  stay: string | null;
  walkMin: number | null;
}

export interface CompasDecision {
  step: CompasStepId;
  label: string;
  detail: string;
  /** Flux du tiroir à ouvrir pour agir. */
  flow: string;
}

export interface CompasModel {
  tripId: string;
  slug: string;
  title: string;
  /** Organisateur du voyage (trips.user_id). */
  ownerId: string;
  activity: string | null;
  destination: string | null;
  dates: {
    start: string | null;
    end: string | null;
    days: number | null;
    /** Durée en heures : choisie (moins d'un jour) ou déduite des dates. */
    hours: number | null;
    label: string;
  };
  preferences: CompasPreferences;
  route: {
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number;
    days: number;
    stepsCount: number;
    hasGeometry: boolean;
    durationMin: number | null;
    coords: Array<[number, number]>;
    /** Une entrée par jour de marche, avec le temps de marche du plus lent. */
    dayPlans: CompasDayPlan[];
    /** Nuits sans hébergement (hors dernier jour), bivouac choisi exclu. */
    nightsToFind: number;
  };
  daylight: {
    date: string;
    sunrise: string | null;
    sunset: string | null;
    source: 'calcul astronomique';
  } | null;
  weather: {
    days: CompasWeatherDayInput[];
    worstPrecipPct: number | null;
    minTempC: number | null;
    maxTempC: number | null;
  };
  kit: {
    lines: CompasKitLine[];
    baseGrams: number;
    wornGrams: number;
    consumableGrams: number;
    unknownWeightCount: number;
    packedPct: number | null;
    vitalMissing: CompasKitLine[];
    toAcquire: CompasKitLine[];
  };
  crew: {
    size: number;
    loads: CompasMemberLoad[];
    unassignedShared: CompasKitLine[];
    capacityKnown: boolean;
    /** Personnes du voyage sans compte dans le groupe (taille - membres), jamais négatif. */
    guests: number;
    pace: CompasPace;
    settlement: CompasSettlement;
  };
  budget: {
    currency: string;
    target: number | null;
    planned: number;
    spent: number;
    perPerson: number | null;
    byCategory: Array<{ category: string; amount: number }>;
    overTarget: boolean;
  };
  bookings: { total: number; confirmed: number; pending: number; amountEur: number };
  inventory: {
    total: number;
    lent: number;
    maintenanceDue: number;
    expiringSoon: number;
  };
  verdict: {
    level: 'go' | 'vigilance' | 'bloque' | 'incomplet';
    reasons: Array<{ label: string; severity: 'info' | 'warn' | 'block'; source: string }>;
  };
  nextDecision: CompasDecision | null;
}

/* ---------- Aides ---------- */

const MS_DAY = 86_400_000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sumBy<T>(list: readonly T[], pick: (value: T) => number | null | undefined): number {
  return list.reduce((total, value) => total + (Number(pick(value)) || 0), 0);
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function formatDateRange(start: string | null, end: string | null): string {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a) return 'Dates à choisir';
  if (!b || a.getTime() === b.getTime()) return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]}`;
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[a.getUTCMonth()]}`;
  }
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

function dueBefore(value: string | null, limit: number): boolean {
  const date = parseDate(value);
  return date != null && date.getTime() <= limit;
}

function kitKind(item: CompasItemInput): CompasKitLine['kind'] {
  if (item.isWorn) return 'worn';
  if (item.isConsumable) return 'consumable';
  return 'base';
}

/* ---------- Modèle ---------- */

export function buildCompasModel(input: CompasInput): CompasModel {
  const { trip } = input;
  const steps = [...input.steps].sort(
    (a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex
  );
  const coords = steps
    .filter((s) => s.lat != null && s.lon != null)
    .map((s) => [Number(s.lat), Number(s.lon)] as [number, number]);

  /* Dates */
  const start = parseDate(trip.startDate);
  const end = parseDate(trip.endDate);
  const days =
    start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_DAY) + 1) : null;
  const shortHours =
    trip.durationHours != null &&
    trip.durationHours > 0 &&
    trip.durationHours < 24 &&
    (days == null || days === 1)
      ? trip.durationHours
      : null;
  const hours = shortHours ?? (days != null ? days * 24 : null);

  /* Préférences (valeurs par défaut explicites, jamais devinées) */
  const prefs: CompasPreferences = {
    pace: trip.preferences?.pace ?? 'normal',
    nights: trip.preferences?.nights ?? null,
    avoid: trip.preferences?.avoid ?? [],
    wishes: trip.preferences?.wishes ?? [],
  };

  /* Lumière du jour : premier jour, première étape géolocalisée */
  let daylight: CompasModel['daylight'] = null;
  if (start && coords.length > 0) {
    const [lat, lon] = coords[0];
    const sun = sunTimes(lat, lon, start);
    const offset = tzOffsetMinutes(input.timeZone, start);
    daylight = {
      date: start.toISOString().slice(0, 10),
      sunrise: sun.sunriseUtcMin == null ? null : formatClock(sun.sunriseUtcMin + offset),
      sunset: sun.sunsetUtcMin == null ? null : formatClock(sun.sunsetUtcMin + offset),
      source: 'calcul astronomique',
    };
  }

  /* Inventaire indexé */
  const inventoryById = new Map(input.inventory.map((p) => [p.id, p]));

  /* Kit */
  const lines: CompasKitLine[] = input.items.map((item) => {
    const inv = item.inventoryItemId ? inventoryById.get(item.inventoryItemId) : undefined;
    const lent = Boolean(inv?.isLent);
    const replace = item.condition === 'a_remplacer' || item.condition === 'pour_pieces';
    const owned = Boolean(inv) || item.purchaseState === 'owned' || item.isPacked;
    const status: CompasKitLine['status'] = lent
      ? 'lent'
      : replace
        ? 'replace'
        : owned
          ? 'owned'
          : 'missing';
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      weightGrams: item.weightGrams ?? inv?.weightG ?? null,
      quantity: Math.max(1, item.quantity || 1),
      packed: item.isPacked,
      vital: item.isVital,
      kind: kitKind(item),
      shared: item.ownership === 'shared',
      ownerId: item.ownerId,
      inventoryItemId: item.inventoryItemId,
      lent,
      status,
      reason: item.reason,
      shopProductId: item.shopProductId,
      purchaseState: item.purchaseState,
      condition: item.condition,
    };
  });
  const weightOf = (line: CompasKitLine) => (line.weightGrams ?? 0) * line.quantity;
  const baseGrams = sumBy(
    lines.filter((l) => l.kind === 'base'),
    weightOf
  );
  const wornGrams = sumBy(
    lines.filter((l) => l.kind === 'worn'),
    weightOf
  );
  const consumableGrams = sumBy(
    lines.filter((l) => l.kind === 'consumable'),
    weightOf
  );
  const unknownWeightCount = lines.filter((l) => l.weightGrams == null).length;
  // Préparation pondérée : un objet vital compte double.
  const weightTotal = sumBy(lines, (l) => (l.vital ? 2 : 1));
  const weightPacked = sumBy(
    lines.filter((l) => l.packed),
    (l) => (l.vital ? 2 : 1)
  );
  const packedPct = lines.length ? Math.round((weightPacked / weightTotal) * 100) : null;
  const vitalMissing = lines.filter((l) => l.vital && l.status !== 'owned');
  const toAcquire = lines.filter((l) => l.status !== 'owned');

  /* Équipage et charges */
  const members = input.members.length
    ? input.members
    : [
        {
          userId: trip.ownerId,
          name: 'Toi',
          avatarUrl: null,
          role: 'owner',
          maxCarryKg: null,
          flatSpeedKmh: null,
          experienceLevel: null,
          calibrationLevel: null,
        },
      ];
  const memberIds = new Set(members.map((m) => m.userId));
  const loads: CompasMemberLoad[] = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    avatarUrl: m.avatarUrl,
    role: m.role,
    carriedGrams: 0,
    capacityKg: m.maxCarryKg,
    flatSpeedKmh: m.flatSpeedKmh,
    experienceLevel: m.experienceLevel,
    calibrationLevel: m.calibrationLevel,
    ratio: null,
    sharedItemIds: [],
  }));
  const loadOf = (userId: string) => loads.find((l) => l.userId === userId);
  const unassignedShared: CompasKitLine[] = [];
  for (const line of lines) {
    if (line.kind === 'worn') continue; // porté sur soi, pas dans le sac
    if (line.shared) {
      const target = line.ownerId && memberIds.has(line.ownerId) ? loadOf(line.ownerId) : undefined;
      if (target) {
        target.carriedGrams += weightOf(line);
        target.sharedItemIds.push(line.id);
      } else {
        unassignedShared.push(line);
      }
      continue;
    }
    // Objet personnel : porté par son propriétaire, sinon par chaque membre.
    const owner = line.ownerId && memberIds.has(line.ownerId) ? loadOf(line.ownerId) : undefined;
    if (owner) owner.carriedGrams += weightOf(line);
    else loads.forEach((l) => (l.carriedGrams += weightOf(line)));
  }
  loads.forEach((l) => {
    l.ratio = l.capacityKg ? Math.round((l.carriedGrams / 1000 / l.capacityKg) * 100) / 100 : null;
  });

  /* Journées de marche : le rythme du groupe est celui du plus lent */
  const speeds = members.map((m) => m.flatSpeedKmh).filter((v): v is number => v != null && v > 0);
  const slowest = speeds.length ? Math.min(...speeds) : null;
  const dayNumbers = [...new Set(steps.map((s) => s.dayNumber))].sort((a, b) => a - b);
  const dayPlans: CompasDayPlan[] = dayNumbers.map((day) => {
    const ofDay = steps.filter((s) => s.dayNumber === day);
    const first = ofDay.find((s) => s.lat != null && s.lon != null) ?? ofDay[0];
    const has = (pick: (s: CompasStepInput) => number | null) => ofDay.some((s) => pick(s) != null);
    const distanceKm = has((s) => s.distanceKm) ? round1(sumBy(ofDay, (s) => s.distanceKm)) : null;
    const gainM = has((s) => s.elevationGainM)
      ? Math.round(sumBy(ofDay, (s) => s.elevationGainM))
      : null;
    const lossM = has((s) => s.elevationLossM)
      ? Math.round(sumBy(ofDay, (s) => s.elevationLossM))
      : null;
    const date = start
      ? new Date(start.getTime() + (day - 1) * MS_DAY).toISOString().slice(0, 10)
      : null;
    return {
      day,
      date,
      title: first?.title ?? `Jour ${day}`,
      distanceKm,
      gainM,
      lossM,
      lat: first?.lat ?? null,
      lon: first?.lon ?? null,
      stay: ofDay.map((s) => s.accommodationName).find(Boolean) ?? null,
      walkMin: walkingMinutes({
        distanceKm,
        gainM,
        lossM,
        flatSpeedKmh: slowest,
        pace: prefs.pace,
      }),
    };
  });
  const lastDay = dayNumbers.length ? dayNumbers[dayNumbers.length - 1] : 0;
  const nightsToFind =
    prefs.nights === 'bivouac' ? 0 : dayPlans.filter((d) => d.day < lastDay && !d.stay).length;
  const shelterInKit = lines.some((l) => /tente|tarp|abri|hamac|bivy|bivouac/i.test(l.name));

  /* Budget */
  const partySize = Math.max(1, trip.partySize ?? members.length);
  const planned = sumBy(
    input.expenses.filter((e) => e.isPlanned),
    (e) => e.amount
  );
  const spent = sumBy(
    input.expenses.filter((e) => !e.isPlanned),
    (e) => e.amount
  );
  const byCat = new Map<string, number>();
  input.expenses.forEach((e) =>
    byCat.set(e.category ?? 'Autre', (byCat.get(e.category ?? 'Autre') ?? 0) + e.amount)
  );
  const byCategory = [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const totalBudget = planned + spent;
  const target = trip.estimatedBudget;

  /* Réservations */
  const confirmed = input.bookings.filter((b) => /confirm|paid|booked/i.test(b.status)).length;
  const pending = input.bookings.filter((b) => /pending|await|hold/i.test(b.status)).length;

  /* Inventaire */
  const soon = input.now.getTime() + 60 * MS_DAY;
  const inventory = {
    total: input.inventory.length,
    lent: input.inventory.filter((p) => p.isLent).length,
    maintenanceDue: input.inventory.filter((p) => dueBefore(p.maintenanceDueAt, soon)).length,
    expiringSoon: input.inventory.filter((p) => dueBefore(p.expiryDate, soon)).length,
  };

  /* Météo réelle */
  const weatherDays = input.weather;
  const worstPrecipPct = weatherDays.length
    ? Math.max(...weatherDays.map((d) => d.precipPct))
    : null;
  const minTempC = weatherDays.length ? Math.min(...weatherDays.map((d) => d.tempMinC)) : null;
  const maxTempC = weatherDays.length ? Math.max(...weatherDays.map((d) => d.tempMaxC)) : null;

  /* Verdict : uniquement des signaux vérifiables, jamais un score inventé */
  const reasons: CompasModel['verdict']['reasons'] = [];
  if (!start) reasons.push({ label: 'Dates non choisies', severity: 'warn', source: 'voyage' });
  if (coords.length < 2 && !input.routeHasGeometry)
    reasons.push({ label: 'Parcours non tracé', severity: 'warn', source: 'étapes' });
  if (vitalMissing.length) {
    reasons.push({
      label: `${vitalMissing.length} objet${vitalMissing.length > 1 ? 's' : ''} vital${vitalMissing.length > 1 ? 's' : ''} manquant${vitalMissing.length > 1 ? 's' : ''}`,
      severity: 'block',
      source: 'kit',
    });
  }
  if (worstPrecipPct != null && worstPrecipPct >= 60) {
    reasons.push({
      label: `Pluie probable (${worstPrecipPct} %)`,
      severity: 'warn',
      source: 'Open-Meteo',
    });
  }
  if (minTempC != null && minTempC <= 0) {
    reasons.push({
      label: `Gel possible (${Math.round(minTempC)} °C)`,
      severity: 'warn',
      source: 'Open-Meteo',
    });
  }
  const overloaded = loads.filter((l) => l.ratio != null && l.ratio > 1);
  if (overloaded.length) {
    reasons.push({
      label: `Surcharge : ${overloaded.map((l) => l.name).join(', ')}`,
      severity: 'warn',
      source: 'répartition',
    });
  }
  if (target != null && totalBudget > target) {
    reasons.push({ label: 'Budget dépassé', severity: 'warn', source: 'dépenses' });
  }
  if (prefs.nights === 'bivouac' && lastDay > 1 && !shelterInKit) {
    reasons.push({
      label: 'Bivouac prévu sans abri dans le kit',
      severity: 'warn',
      source: 'préférences et kit',
    });
  }
  if (nightsToFind > 0) {
    reasons.push({
      label: `${nightsToFind} nuit${nightsToFind > 1 ? 's' : ''} sans hébergement`,
      severity: 'warn',
      source: 'étapes',
    });
  }
  const level: CompasModel['verdict']['level'] = reasons.some((r) => r.severity === 'block')
    ? 'bloque'
    : !start || (coords.length < 2 && !input.routeHasGeometry)
      ? 'incomplet'
      : reasons.length
        ? 'vigilance'
        : 'go';

  /* Prochaine décision : la plus bloquante d'abord */
  let nextDecision: CompasDecision | null = null;
  if (vitalMissing.length) {
    // Un objet déjà commandé est en route : on traite d'abord ceux qui n'ont
    // encore aucune solution.
    const inProgress = (l: CompasKitLine) =>
      l.purchaseState === 'in_cart' || l.purchaseState === 'shipping';
    const first = vitalMissing.find((l) => !inProgress(l)) ?? vitalMissing[0];
    const name = first.name.toLowerCase();
    nextDecision =
      first.status === 'lent'
        ? {
            step: 'kit',
            flow: 'manques',
            label: `Récupérer : ${name}`,
            detail: first.reason ?? 'Prêté, à récupérer avant le départ',
          }
        : first.purchaseState === 'in_cart'
          ? {
              step: 'kit',
              flow: 'manques',
              label: `Commander : ${name}`,
              detail: 'Produit choisi, dans le panier',
            }
          : first.purchaseState === 'shipping'
            ? {
                step: 'kit',
                flow: 'manques',
                label: `Réceptionner : ${name}`,
                detail: 'En livraison',
              }
            : {
                step: 'kit',
                flow: 'manques',
                label: `Trouver : ${name}`,
                detail: first.reason ?? 'Objet vital pour ce parcours',
              };
  } else if (!start) {
    nextDecision = {
      step: 'ou',
      flow: 'quand',
      label: 'Choisir les dates',
      detail: 'La météo et les réservations en dépendent',
    };
  } else if (steps.length === 0 && !input.routeHasGeometry) {
    nextDecision = {
      step: 'ou',
      flow: 'parcours',
      label: 'Choisir un parcours',
      detail: 'Autour du départ, dans tes randos ou par lieu',
    };
  } else if (unassignedShared.length && members.length > 1) {
    nextDecision = {
      step: 'kit',
      flow: 'sacs',
      label: 'Répartir le matériel commun',
      detail: `${unassignedShared.length} objet(s) sans porteur`,
    };
  } else if (pending) {
    nextDecision = {
      step: 'resa',
      flow: 'choix',
      label: 'Confirmer les réservations',
      detail: `${pending} en attente`,
    };
  } else if (target != null && totalBudget > target) {
    nextDecision = {
      step: 'nous',
      flow: 'budget',
      label: 'Ajuster le budget',
      detail: 'Dépenses au-dessus de l’enveloppe',
    };
  }

  return {
    tripId: trip.id,
    slug: trip.slug,
    title: trip.title,
    ownerId: trip.ownerId,
    activity: trip.primaryActivity,
    destination: trip.destinationName,
    dates: {
      start: trip.startDate,
      end: trip.endDate,
      days,
      hours,
      label: formatDateRange(trip.startDate, trip.endDate),
    },
    preferences: prefs,
    route: {
      distanceKm: round1(sumBy(steps, (s) => s.distanceKm)),
      elevationGainM: Math.round(sumBy(steps, (s) => s.elevationGainM)),
      elevationLossM: Math.round(sumBy(steps, (s) => s.elevationLossM)),
      days: steps.reduce((max, s) => Math.max(max, s.dayNumber || 0), 0),
      stepsCount: steps.length,
      hasGeometry: input.routeHasGeometry || coords.length >= 2,
      durationMin: input.routeDurationMin,
      coords,
      dayPlans,
      nightsToFind,
    },
    daylight,
    weather: { days: weatherDays, worstPrecipPct, minTempC, maxTempC },
    kit: {
      lines,
      baseGrams,
      wornGrams,
      consumableGrams,
      unknownWeightCount,
      packedPct,
      vitalMissing,
      toAcquire,
    },
    crew: {
      size: partySize,
      loads,
      unassignedShared,
      capacityKnown: loads.some((l) => l.capacityKg != null),
      guests: Math.max(0, partySize - loads.length),
      pace: crewPace(loads),
      settlement: settleExpenses(
        input.expenses,
        loads.map((l) => ({ userId: l.userId, name: l.name }))
      ),
    },
    budget: {
      currency: trip.budgetCurrency ?? 'EUR',
      target,
      planned: Math.round(planned * 100) / 100,
      spent: Math.round(spent * 100) / 100,
      perPerson: totalBudget ? Math.round((totalBudget / partySize) * 100) / 100 : null,
      byCategory,
      overTarget: target != null && totalBudget > target,
    },
    bookings: {
      total: input.bookings.length,
      confirmed,
      pending,
      amountEur: Math.round(sumBy(input.bookings, (b) => b.amountEur) * 100) / 100,
    },
    inventory,
    verdict: { level, reasons },
    nextDecision,
  };
}
