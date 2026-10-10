import type { AirportPick } from './airports';
import {
  FLIGHT_THRESHOLD_KM,
  approachMode,
  estimateCarTrip,
  maxDriveMinutes,
  type TransportEstimate,
} from './autofill';
import { distanceKm } from './places';
import { trainTrip, type TrainTrip } from './rail';

/**
 * Compas — venir jusqu'au départ (« 5. Venir », PLAN-100 4.3 et 4.4).
 *
 * D'où l'on part : le lieu dit (« depuis Lyon »), sinon la position de
 * l'appareil ; sinon personne ne le sait et rien n'est chiffré, l'écran le
 * dit. Jamais la France ni Paris par défaut. Puis la route mesurée si elle
 * tient dans la durée du voyage, le train si le rail s'y prête, sinon l'avion
 * d'aéroport à aéroport (OurAirports).
 *
 * Pur : la route mesurée et le choix des aéroports sont injectés (le serveur
 * passe le routeur et `server/airports.ts`) ; ce module n'importe aucune donnée.
 */

export interface TravelPoint {
  lat: number;
  lon: number;
}

export interface TravelOrigin extends TravelPoint {
  /** Commune ou lieu dit ; null quand la position n'a pas de nom connu. */
  name: string | null;
  country: string | null;
  countryCode: string | null;
  /** « dit » (« depuis Lyon ») ou position de l'appareil. */
  source: 'dit' | 'gps';
}

/** Le trajet tel que le résumé de la préparation le montre. */
export interface TravelTransport {
  mode: 'voiture' | 'avion' | 'train';
  km: number;
  minutes: number;
  walkKm: number;
  fuelEur: number;
  basis: string;
  /** Vol : « LYS → OLB », quand les deux aéroports sont connus. */
  route?: string;
  /**
   * D'où le trajet est chiffré : le lieu dit (« Lyon ») ou « ta position ». Dit
   * à l'écran pour que le départ retenu ne se confonde jamais avec un autre
   * (un lieu dit introuvable laisse la position partagée prendre le relais).
   */
  departure?: string;
}

export interface TravelFlight {
  from: AirportPick | null;
  to: AirportPick | null;
  /** Vol d'oiseau d'aéroport à aéroport, sinon du départ au lieu (km, arrondi). */
  km: number;
}

export interface TravelLeg {
  origin: TravelOrigin | null;
  /** Voyage à l'étranger ; null quand le pays de départ n'est pas connu. */
  abroad: boolean | null;
  transport: TravelTransport | null;
  /** Carburant aller-retour, quand on part en voiture. */
  carFuel: TransportEstimate | null;
  train: TrainTrip | null;
  /** Vol à prévoir ; null sans vol. */
  flight: TravelFlight | null;
  /** Aucun point de départ : rien n'est chiffré, l'écran le dit. */
  originUnknown: boolean;
  notes: string[];
}

/** Route mesurée en voiture, ou la raison pour laquelle elle ne l'a pas été. */
export type CarRouteResult = { km: number; minutes: number; end: TravelPoint | null } | { failure: string | null };

export interface TravelDeps {
  /** Itinéraire routier mesuré (km, minutes, dernier point du tracé). */
  carRoute(from: TravelPoint, to: TravelPoint): Promise<CarRouteResult>;
  /** Marche du bout de la route jusqu'au lieu (km ; 0 si la route y arrive). */
  walkKm(end: TravelPoint, to: TravelPoint): Promise<number>;
  /**
   * Aéroport retenu pour un lieu (OurAirports) ; null sans aéroport à moins de
   * 300 km. `country` : pays du lieu (ISO alpha-2) quand on le connaît, indice
   * doux (un aéroport d'un autre pays compte un peu plus loin), null sinon.
   */
  airport(p: TravelPoint, country?: string | null): AirportPick | null;
}

export interface TravelLegInput {
  origin: TravelOrigin | null;
  /** Premier lieu du voyage (première étape placée, sinon la destination). */
  target: TravelPoint;
  destination: { name: string; countryCode: string | null };
  days: number;
  party: number;
  /** Module « trajet » du projet : faux pour une sortie de quelques heures. */
  transport: boolean;
}

export const UNKNOWN_ORIGIN_NOTE =
  'Point de départ inconnu : écris « depuis Lyon » dans ta demande ou partage ta position pour chiffrer le trajet.';
export const UNKNOWN_ORIGIN_LINE = 'Trajet non chiffré : point de départ inconnu';
export const ON_SITE_NOTE = 'Tu es déjà au départ : aucun trajet à prévoir.';
/** Aucun vol possible (même aéroport aux deux bouts) et la route est longue, ou introuvable. */
export const SAME_AIRPORT_NOTE =
  'Trajet d’approche à vérifier : aéroport identique au départ et à l’arrivée, route longue ou non calculée.';
/** Le départ quand il vient de l'appareil. */
const GPS_DEPARTURE = 'ta position';

/** Départ dit (`metadata.compas.origin`) d'abord, puis la position de l'appareil, sinon aucun. */
export function travelOrigin(
  said: { name: string; lat: number; lon: number; countryCode: string | null } | null,
  gps: (TravelPoint & { name: string | null; country: string | null; countryCode: string | null }) | null
): TravelOrigin | null {
  if (said)
    return { name: said.name, country: null, countryCode: said.countryCode, lat: said.lat, lon: said.lon, source: 'dit' };
  if (gps)
    return { name: gps.name, country: gps.country, countryCode: gps.countryCode, lat: gps.lat, lon: gps.lon, source: 'gps' };
  return null;
}

/** À l'étranger ? Faux sans pays de destination ; inconnu sans pays de départ. */
export function abroadOf(origin: TravelOrigin | null, destinationCountry: string | null): boolean | null {
  if (!destinationCountry) return false;
  if (!origin?.countryCode) return null;
  return origin.countryCode !== destinationCountry;
}

/**
 * Ce que « à l'étranger » change au budget : les formalités d'entrée (barème pour
 * un voyageur français) restent tant qu'on n'est pas SÛR d'être déjà dans le pays
 * (départ inconnu compris) ; l'assurance voyage n'est ajoutée que si on sait.
 */
export function abroadCosts(abroad: boolean | null): { formalities: boolean; insurance: boolean } {
  return { formalities: abroad !== false, insurance: abroad === true };
}

/** Le départ tel que dit au spécialiste (IA) : jamais un pays supposé. */
export function originFact(origin: TravelOrigin | null): string {
  if (!origin) return 'inconnu';
  if (!origin.name) return 'position partagée, commune inconnue';
  return `${origin.name}${origin.country ? `, ${origin.country}` : ''}`;
}

/** D'où le trajet est chiffré, pour l'écran : le lieu dit, sinon « ta position ». */
function departureOf(origin: TravelOrigin): string {
  return origin.source === 'dit' && origin.name ? origin.name : GPS_DEPARTURE;
}

/**
 * Le trajet en quelques mots pour l'écran (« vol LYS → OLB à prévoir (depuis
 * Lyon) »), null s'il n'y a rien à dire. Un résumé d'avant le départ nommé ne
 * dit pas d'où : la ligne reste celle d'avant.
 */
export function travelDigest(t: TravelTransport | null, originUnknown?: boolean): string | null {
  if (t) {
    const what =
      t.mode === 'avion'
        ? t.route
          ? `vol ${t.route} à prévoir`
          : 'vol à prévoir'
        : t.mode === 'train'
          ? `train, environ ${String(Math.round(t.minutes / 30) / 2).replace('.', ',')} h`
          : `${Math.round(t.km)} km de route`;
    return t.departure ? `${what} (depuis ${t.departure})` : what;
  }
  return originUnknown ? UNKNOWN_ORIGIN_LINE : null;
}

const CAR_FAILURE: Record<string, string> = {
  off_network: 'tracé qui n’arrive pas au lieu',
  provider_unavailable: 'service de calcul injoignable',
  rate_limited: 'trop de calculs d’affilée',
};

/** Au-delà de 3 h de trajet aller, une journée seule ne tient plus (PLAN-100 4.4). */
export const DAY_TRIP_MAX_MINUTES = 180;

/** Une route fait en moyenne 1,3 fois le vol d'oiseau. */
export const ROAD_DETOUR_FACTOR = 1.3;

/** Route estimée à l'aller : vol d'oiseau × 1,3 à 80 km/h (comme quand l'itinéraire n'est pas calculé). */
export function estimatedDriveMinutes(straightKm: number): number {
  return Math.round((Math.round(straightKm * ROAD_DETOUR_FACTOR) / 80) * 60);
}

/**
 * Une journée (ou moins) à plus de 3 h de trajet aller : « 3 h 20 de trajet
 * aller pour une seule journée : … ». null sinon, ou quand le temps n'est pas
 * connu. Le temps se lit à la minute : 180,4 se lit 3 h 00, donc pas de note.
 */
export function dayTripNote(days: number, minutesOneWay: number | null): string | null {
  if (days > 1 || minutesOneWay == null) return null;
  const m = Math.round(minutesOneWay);
  if (!(m > DAY_TRIP_MAX_MINUTES)) return null;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.`;
}

/**
 * Le trajet d'approche, comme la préparation l'écrit : route mesurée si elle
 * est raisonnable pour la durée, sinon le train (pays reliés, pas d'île),
 * sinon l'avion d'aéroport à aéroport. Sans point de départ : rien. Une
 * journée à plus de 3 h de trajet aller est signalée (Mercantour depuis Annecy).
 */
export async function planTravelLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
  const leg = await chooseLeg(input, deps);
  // Temps connu : route mesurée ou estimée, train ; un vol n'a pas de durée connue.
  const minutes = leg.transport && leg.transport.mode !== 'avion' ? leg.transport.minutes : null;
  const note = dayTripNote(input.days, minutes);
  if (note) leg.notes.push(note);
  return leg;
}

async function chooseLeg(input: TravelLegInput, deps: TravelDeps): Promise<TravelLeg> {
  const { origin, target, destination, days, party } = input;
  const leg: TravelLeg = {
    origin,
    abroad: abroadOf(origin, destination.countryCode),
    transport: null,
    carFuel: null,
    train: null,
    flight: null,
    originUnknown: false,
    notes: [],
  };
  // Sortie de quelques heures : rien à chiffrer. Partie de loin (départ connu),
  // le temps de route estimé est dit quand la journée ne tient pas. Au-delà de la
  // portée d'une route (même seuil que l'avion, `approachMode` : > 900 km à vol
  // d'oiseau), ce n'est pas un trajet en voiture : ni temps estimé ni note.
  if (!input.transport) {
    const straightKm = origin ? distanceKm(origin, target) : null;
    const note = straightKm != null && straightKm <= FLIGHT_THRESHOLD_KM ? dayTripNote(days, estimatedDriveMinutes(straightKm)) : null;
    if (note) leg.notes.push(note);
    return leg;
  }
  if (!origin) {
    leg.originUnknown = true;
    leg.notes.push(UNKNOWN_ORIGIN_NOTE);
    return leg;
  }
  const departure = departureOf(origin);
  const straight = distanceKm(origin, target);
  const mode = approachMode({ straightKm: straight, days });
  if (mode === 'sur_place') {
    leg.notes.push(ON_SITE_NOTE);
    return leg;
  }
  // Un trajet du résumé, toujours avec son départ (clés dans l'ordre du résumé stocké).
  const moveOf = (
    kind: TravelTransport['mode'],
    m: { km: number; minutes: number; walkKm?: number; fuelEur?: number; basis: string; route?: string }
  ): TravelTransport => ({
    mode: kind,
    km: m.km,
    minutes: m.minutes,
    walkKm: m.walkKm ?? 0,
    fuelEur: m.fuelEur ?? 0,
    basis: m.basis,
    ...(m.route ? { route: m.route } : {}),
    departure,
  });
  // La route mesurée : un routeur qui plante (promesse rejetée ou exception directe)
  // vaut « non calculée », avec une trace sans coordonnées.
  const road = async (): Promise<CarRouteResult> => {
    try {
      return await deps.carRoute(origin, target);
    } catch (err) {
      const why = (err instanceof Error ? err.message : String(err)).replace(/-?\d+[.,]\d+/g, '…').slice(0, 160);
      console.warn('[compas] trajet d’approche : routage en erreur', why);
      return { failure: null };
    }
  };
  const byTrain = (roadKm: number | null) =>
    trainTrip({ fromCountry: origin.countryCode, toCountry: destination.countryCode, straightKm: straight, roadKm, days, to: target });
  const takeTrain = (rail: TrainTrip): TravelLeg => {
    leg.train = rail;
    leg.transport = moveOf('train', { km: rail.railKm, minutes: rail.minutesOneWay, basis: rail.basis });
    return leg;
  };
  // L'avion d'aéroport à aéroport ; faux si les deux bouts ont le même aéroport.
  // Chaque aéroport est cherché avec le pays de son lieu (départ, arrivée), null si inconnu.
  let sameAirport = false;
  const fly = (why: string | null): boolean => {
    const from = deps.airport(origin, origin.countryCode);
    const to = deps.airport(target, destination.countryCode);
    if (from && to && from.iata === to.iata) {
      sameAirport = true;
      return false;
    }
    const km = Math.round(from && to ? distanceKm(from, to) : straight);
    const text =
      from && to
        ? `vol aller-retour depuis ${departure}, ${from.iata} → ${to.iata} (${from.name} → ${to.name}), environ ${km} km`
        : `vol aller-retour depuis ${departure} vers ${destination.name}, environ ${km} km`;
    leg.flight = { from, to, km };
    leg.transport = moveOf('avion', {
      km,
      minutes: 0,
      basis: why ? `${why} : ${text}` : text,
      ...(from && to ? { route: `${from.iata} → ${to.iata}` } : {}),
    });
    return true;
  };
  // Pas de vol possible (même aéroport) et une route plus longue que le voyage ne le supporte : dit.
  const noFlightLongRoad = (minutes: number) => {
    if (sameAirport && minutes > maxDriveMinutes(days)) leg.notes.push(SAME_AIRPORT_NOTE);
  };

  if (mode === 'avion') {
    // Trop loin pour la route vu la durée : le train si le rail s'y prête (route
    // mesurée pour écarter une île), sinon l'avion.
    if (byTrain(straight)) {
      const car = await road();
      const rail = 'km' in car ? byTrain(car.km) : null;
      if (rail) return takeTrain(rail);
    }
    if (fly(null)) return leg;
    // Même aéroport aux deux bouts : la route, comme pour un trajet proche.
  }

  const car = await road();
  if ('km' in car) {
    const walkKm = car.end ? await deps.walkKm(car.end, target) : 0;
    const limit = maxDriveMinutes(days);
    if (car.minutes > limit) {
      const rail = byTrain(car.km);
      if (rail) return takeTrain(rail);
      // Route trop longue pour la durée du voyage, rail hors de portée : l'avion.
      if (fly(`${Math.round(car.minutes / 60)} h de route à l’aller pour ${days} jour${days > 1 ? 's' : ''}`)) return leg;
    }
    leg.carFuel = estimateCarTrip({ oneWayKm: car.km, oneWayMin: car.minutes, partySize: party });
    if (leg.carFuel)
      leg.transport = moveOf('voiture', {
        km: leg.carFuel.oneWayKm,
        minutes: leg.carFuel.oneWayMin,
        walkKm: Math.round(walkKm * 10) / 10,
        fuelEur: leg.carFuel.fuelEur,
        basis: leg.carFuel.basis,
      });
    noFlightLongRoad(car.minutes);
    return leg;
  }
  if (straight <= FLIGHT_THRESHOLD_KM) {
    // Itinéraire non calculé (panne, débit, tracé qui n'arrive pas pile au
    // lieu) mais destination à portée de route : trajet estimé (vol
    // d'oiseau × 1,3 à 80 km/h), jamais un vol à 450 km.
    const minutes = estimatedDriveMinutes(straight);
    leg.carFuel = estimateCarTrip({ oneWayKm: Math.round(straight * ROAD_DETOUR_FACTOR), oneWayMin: minutes, partySize: party });
    if (leg.carFuel) {
      leg.transport = moveOf('voiture', {
        km: leg.carFuel.oneWayKm,
        minutes: leg.carFuel.oneWayMin,
        fuelEur: leg.carFuel.fuelEur,
        basis: leg.carFuel.basis,
      });
      leg.notes.push(
        `Trajet en voiture estimé (itinéraire routier non calculé : ${CAR_FAILURE[car.failure ?? ''] ?? 'raison inconnue'}) : à vérifier, traversée en ferry éventuelle non comptée.`
      );
      noFlightLongRoad(minutes);
    }
    return leg;
  }
  // Pas de route (île, autre continent) : l'avion ou le bateau s'imposent. Le vol ne
  // manque ici que si les deux bouts ont le même aéroport : rien n'est chiffré, on le dit.
  if (!fly('aucune route praticable')) leg.notes.push(SAME_AIRPORT_NOTE);
  return leg;
}
