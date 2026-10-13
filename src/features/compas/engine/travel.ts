import type { AirportPick } from './airports';
import {
  FLIGHT_THRESHOLD_KM,
  approachMode,
  estimateCarTrip,
  maxDriveMinutes,
  type TransportEstimate,
} from './autofill';
import { fuelPriceFor } from './fuel';
import { tollsBasis } from './tolls';
import { distanceKm } from './places';
import { trainOutlook, type TrainTrip } from './rail';
import { needsFormalities, type EntryRequirement } from './entry';
import type { TravellerContext } from './traveller';

/**
 * Compas — venir jusqu'au départ (« 5. Venir », PLAN-100 4.3 et 4.4).
 *
 * D'où l'on part : le lieu dit (« depuis Lyon »), sinon le domicile du profil
 * voyageur, sinon la position de l'appareil ; sinon personne ne le sait et rien
 * n'est chiffré, l'écran le dit. Jamais la France ni Paris par défaut. Le nom du
 * domicile ne quitte jamais ce module : « ton domicile » dans ce qui est rangé
 * sur le voyage (partagé), rien pour l'IA. Puis la route mesurée si elle
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
  /** « dit » (« depuis Lyon »), domicile du profil voyageur, ou position de l'appareil. */
  source: 'dit' | 'domicile' | 'gps';
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
export type CarRouteResult =
  { km: number; minutes: number; end: TravelPoint | null } | { failure: string | null };

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
  /**
   * Sans voiture (personnelle ou de location) : jamais de trajet en voiture ni de temps de route
   * estimé ; le train par règle de réseau, l'avion si le séjour est trop court pour la route,
   * sinon rien n'est chiffré et la note le dit.
   */
  carFree?: boolean;
}

export const UNKNOWN_ORIGIN_NOTE =
  'Point de départ inconnu : écris « depuis Lyon » dans ta demande ou partage ta position pour chiffrer le trajet.';
export const UNKNOWN_ORIGIN_LINE = 'Trajet non chiffré : point de départ inconnu';
export const ON_SITE_NOTE = 'Tu es déjà au départ : aucun trajet à prévoir.';
/** Début de la note « sans voiture » quand aucun moyen de venir n'est chiffré. */
export const CAR_FREE_NO_LEG_PREFIX = 'Sans voiture :';
/** `fromHome` : la distance depuis le domicile ne se range pas sur le voyage (elle en déduirait la commune). */
const carFreeNoLegNote = (straightKm: number, fromHome = false) =>
  `${CAR_FREE_NO_LEG_PREFIX} le trajet d’approche${fromHome ? '' : ` (environ ${Math.round(straightKm)} km à vol d’oiseau)`} n’est pas chiffré, aucune ligne de train ou de bus n’est évaluée sur ce trajet ; cherche-la dans Résa · Trajets.`;
/** Aucun vol possible (même aéroport aux deux bouts) et la route est longue, ou introuvable. */
export const SAME_AIRPORT_NOTE =
  'Trajet d’approche à vérifier : aéroport identique au départ et à l’arrivée, route longue ou non calculée.';
/** Le départ quand il vient de l'appareil. */
const GPS_DEPARTURE = 'ta position';
/** Le départ quand il vient du profil : jamais le nom du domicile sur le voyage, qui se partage. */
const HOME_DEPARTURE = 'ton domicile';
/** Dit une fois quand le trajet part du domicile du profil. */
export const HOME_ORIGIN_NOTE =
  'Trajet chiffré depuis ton domicile (ton profil voyageur) : écris « depuis Lyon » dans ta demande pour partir d’ailleurs.';

/**
 * Le domicile du profil ne sert au trajet que si le départ n'est pas dit et que
 * l'aventure n'est pas préparée « près de chez toi » (ancre = position partagée) :
 * sinon le trajet irait du domicile à l'endroit où la personne se trouve déjà.
 */
export function homeForLeg<T>(
  said: unknown,
  anchoredOnPosition: boolean,
  home: T | null
): T | null {
  return said || anchoredOnPosition ? null : home;
}

/**
 * D'où l'on part : le départ dit (`metadata.compas.origin`), puis le domicile du
 * profil voyageur (déjà arrondi à 0,01°), puis la position de l'appareil ; sinon aucun.
 */
export function travelOrigin(
  said: { name: string; lat: number; lon: number; countryCode: string | null } | null,
  gps:
    | (TravelPoint & { name: string | null; country: string | null; countryCode: string | null })
    | null,
  home: { name: string; lat: number; lon: number; countryCode: string | null } | null = null
): TravelOrigin | null {
  if (said)
    return {
      name: said.name,
      country: null,
      countryCode: said.countryCode,
      lat: said.lat,
      lon: said.lon,
      source: 'dit',
    };
  if (home)
    return {
      name: home.name,
      country: null,
      countryCode: home.countryCode,
      lat: home.lat,
      lon: home.lon,
      source: 'domicile',
    };
  if (gps)
    return {
      name: gps.name,
      country: gps.country,
      countryCode: gps.countryCode,
      lat: gps.lat,
      lon: gps.lon,
      source: 'gps',
    };
  return null;
}

/** À l'étranger ? Faux sans pays de destination ; inconnu sans pays de départ. */
export function abroadOf(
  origin: TravelOrigin | null,
  destinationCountry: string | null
): boolean | null {
  // Codes pays comparés sans la casse ni les espaces (« it » et « IT » : le même pays).
  const to = destinationCountry?.trim().toUpperCase();
  if (!to) return false;
  const from = origin?.countryCode?.trim().toUpperCase();
  if (!from) return null;
  return from !== to;
}

/**
 * Ce que « à l'étranger » change au budget. Les formalités d'entrée sont un barème
 * pour un ressortissant français (`entryFees`) : chiffrées seulement pour une
 * nationalité française connue (sinon rien d'affirmé, PLAN-100 4.1), tant qu'on
 * n'est pas SÛR d'être déjà dans le pays (départ inconnu compris), et seulement si la
 * table passeport × destination dit qu'un visa ou une autorisation est requis
 * (`entry`, voir `entryFor` ; sans visa, libre circulation, « non confirmé » ou pas de
 * ligne : aucune ligne de frais). L'assurance voyage n'est ajoutée que si on sait que le
 * voyage passe une frontière.
 *
 * VIE PRIVÉE : `formalities` dépend de la NATIONALITÉ ; il ne s'utilise qu'à la lecture, pour le
 * profil du lecteur (`engine/formalities.ts`), jamais pour ce que la préparation range sur le voyage.
 */
export function abroadCosts(
  abroad: boolean | null,
  traveller: Pick<TravellerContext, 'nationality'>,
  entry: Pick<EntryRequirement, 'kind'> | null
): { formalities: boolean; insurance: boolean } {
  return {
    formalities:
      abroad !== false &&
      traveller.nationality === 'FR' &&
      entry != null &&
      needsFormalities(entry.kind),
    insurance: abroad === true,
  };
}

/** Le départ est le domicile du profil voyageur (et non un lieu dit ou la position de l'appareil). */
export function isHomeOrigin(origin: Pick<TravelOrigin, 'source'> | null | undefined): boolean {
  return origin?.source === 'domicile';
}

/**
 * Les faits du trajet d'approche que le spécialiste (IA, un tiers) peut lire.
 *
 * VIE PRIVÉE : quand le départ est le DOMICILE du profil, tout ce qui s'en déduit reste ici : les km, les
 * minutes, les km de voie, le moyen retenu (vol, train) et « voyage à l'étranger » (le pays du domicile
 * par rapport à la destination) diraient d'où la personne part, ce que la politique de confidentialité
 * promet de ne pas envoyer (« rien de ce profil n'est envoyé à l'IA »). L'IA reçoit alors « inconnu » et
 * « non communiqué », et la ligne « voiture de location » (déduite du vol ou du train) s'en va aussi.
 * Un départ dit (« depuis Lyon », écrit dans la demande) ou la position de l'appareil (arrondie à environ
 * 1 km, dite dans la politique) gardent leurs faits chiffrés.
 */
export function travelFactsForAi(
  leg: Pick<TravelLeg, 'origin' | 'abroad' | 'transport' | 'train' | 'flight'>
): {
  /** « Voyage à l'étranger : oui / non / inconnu. » */
  abroad: string;
  /** Vol, train, route mesurée ou rien de mesuré. */
  approach: string;
  /** La ligne « voiture de location à prévoir » peut être envoyée (elle se déduit du vol ou du train). */
  rental: boolean;
} {
  if (isHomeOrigin(leg.origin))
    return {
      abroad: 'Voyage à l’étranger : inconnu.',
      approach: 'Trajet d’approche : non communiqué.',
      rental: false,
    };
  const { abroad, transport, train, flight } = leg;
  return {
    abroad:
      abroad === true
        ? 'Voyage à l’étranger : oui.'
        : abroad === false
          ? 'Voyage à l’étranger : non.'
          : 'Voyage à l’étranger : inconnu.',
    approach: flight
      ? 'Vol à prévoir : oui (aller-retour).'
      : train
        ? `Train à prévoir : oui (aller-retour, environ ${train.railKm} km de voie).`
        : transport?.mode === 'voiture'
          ? `Trajet d’approche mesuré : ${transport.km} km en voiture (${transport.minutes} min) puis ${transport.walkKm} km à pied.`
          : 'Trajet d’approche : non mesuré.',
    rental: true,
  };
}

/** Le départ tel que dit au spécialiste (IA) : jamais un pays supposé. */
export function originFact(origin: TravelOrigin | null): string {
  if (!origin) return 'inconnu';
  // Le domicile ne part jamais en clair vers l'IA (PLAN-100 4.1) : seul « à l'étranger » est dit à côté.
  if (origin.source === 'domicile') return 'domicile de la personne (ville non transmise)';
  if (!origin.name) return 'position partagée, commune inconnue';
  return `${origin.name}${origin.country ? `, ${origin.country}` : ''}`;
}

/** D'où le trajet est chiffré, pour l'écran : le lieu dit, « ton domicile », sinon « ta position ». */
function departureOf(origin: TravelOrigin): string {
  if (origin.source === 'domicile') return HOME_DEPARTURE;
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
export function dayTripNote(
  days: number,
  minutesOneWay: number | null,
  exact = true
): string | null {
  if (days > 1 || minutesOneWay == null) return null;
  const m = Math.round(minutesOneWay);
  if (!(m > DAY_TRIP_MAX_MINUTES)) return null;
  // `exact` faux (départ du domicile) : la durée exacte se rangerait sur le voyage et en déduirait la commune.
  if (!exact)
    return `Plus de ${DAY_TRIP_MAX_MINUTES / 60} h de trajet aller pour une seule journée : prévois une nuit sur place ou choisis plus près.`;
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
  // Départ pris au profil : dit une fois, sans le nom du domicile.
  if (input.origin?.source === 'domicile' && leg.transport) leg.notes.push(HOME_ORIGIN_NOTE);
  // Temps connu : route mesurée ou estimée, train ; un vol n'a pas de durée connue.
  const minutes = leg.transport && leg.transport.mode !== 'avion' ? leg.transport.minutes : null;
  const note = dayTripNote(input.days, minutes, !isHomeOrigin(input.origin));
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
    // Sans voiture, un temps de route estimé en voiture ne dit rien de la journée.
    const note =
      straightKm != null && straightKm <= FLIGHT_THRESHOLD_KM && !input.carFree
        ? dayTripNote(days, estimatedDriveMinutes(straightKm), !isHomeOrigin(origin))
        : null;
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
  // Carburant au prix du ou des pays du trajet (départ et destination), PLAN-100 4.6. Départ pris au
  // domicile : la base, rangée sur le voyage, ne nomme pas le pays du domicile.
  const fromHome = origin.source === 'domicile';
  const fuel = fuelPriceFor([origin.countryCode, destination.countryCode], {
    nameCountries: !fromHome,
  });
  // Péages : « non comptés » avec la raison, et le barème du pays de DESTINATION s'il en existe un (PLAN-100 4.6).
  // Jamais le pays de départ : la base est rangée sur le voyage, le domicile du profil ne s'y nomme pas.
  const tolls = tollsBasis(destination.countryCode);
  const mode = approachMode({ straightKm: straight, days });
  if (mode === 'sur_place') {
    leg.notes.push(ON_SITE_NOTE);
    return leg;
  }
  // Un trajet du résumé, toujours avec son départ (clés dans l'ordre du résumé stocké).
  const moveOf = (
    kind: TravelTransport['mode'],
    m: {
      km: number;
      minutes: number;
      walkKm?: number;
      fuelEur?: number;
      basis: string;
      route?: string;
    }
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
      const why = (err instanceof Error ? err.message : String(err))
        .replace(/-?\d+[.,]\d+/g, '…')
        .slice(0, 160);
      console.warn('[compas] trajet d’approche : routage en erreur', why);
      return { failure: null };
    }
  };
  // Le train, par règle de réseau (`rail.ts`). `announce` : le train était l'autre moyen
  // possible (route trop longue, avion) ; si le réseau n'a aucune ligne pour ce trajet et
  // que le dire est honnête (Amérique du Nord, hors corridor), la note l'annonce, une fois.
  let railAnnounced = false;
  const byTrain = (roadKm: number | null, announce = false): TrainTrip | null => {
    const out = trainOutlook({
      fromCountry: origin.countryCode,
      toCountry: destination.countryCode,
      straightKm: straight,
      roadKm,
      days,
      from: origin,
      to: target,
      homeDeparture: fromHome,
    });
    if (announce && !out.trip && out.notice && !railAnnounced) {
      railAnnounced = true;
      leg.notes.push(out.notice);
    }
    return out.trip;
  };
  const takeTrain = (rail: TrainTrip): TravelLeg => {
    // Départ du domicile : la base rangée ne dit pas les km de voie ni la durée (ils déduiraient la commune).
    const stored = fromHome ? { ...rail, basis: rail.basisWithoutMeasures } : rail;
    leg.train = stored;
    leg.transport = moveOf('train', {
      km: rail.railKm,
      minutes: rail.minutesOneWay,
      basis: stored.basis,
    });
    if (rail.notice) leg.notes.push(rail.notice);
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
    // Départ pris au domicile : l'aéroport le plus proche du domicile le désigne autant que son
    // nom, il n'est ni dans la base ni dans le trajet (« vol à prévoir (depuis ton domicile) »).
    // La distance non plus : depuis le domicile, « environ N km » en déduirait la commune.
    const measure = fromHome ? '' : `, environ ${km} km`;
    const text =
      from && to
        ? fromHome
          ? `vol aller-retour depuis ${departure} vers ${to.iata} (${to.name})`
          : `vol aller-retour depuis ${departure}, ${from.iata} → ${to.iata} (${from.name} → ${to.name})${measure}`
        : `vol aller-retour depuis ${departure} vers ${destination.name}${measure}`;
    leg.flight = { from, to, km };
    leg.transport = moveOf('avion', {
      km,
      minutes: 0,
      basis: why ? `${why} : ${text}` : text,
      ...(from && to && !fromHome ? { route: `${from.iata} → ${to.iata}` } : {}),
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
    if (byTrain(straight, true)) {
      const car = await road();
      const rail = 'km' in car ? byTrain(car.km) : null;
      if (rail) return takeTrain(rail);
    }
    if (fly(null)) return leg;
    // Même aéroport aux deux bouts : la route, comme pour un trajet proche.
  }

  // Sans voiture : le train si le rail s'y prête (la route mesurée écarte une île), l'avion si le
  // séjour est trop court pour la même route faite en car, sinon rien n'est chiffré et la note le dit.
  if (input.carFree) {
    const probe = byTrain(straight, true);
    const ride = straight >= 150 ? await road() : null;
    if (probe && ride && 'km' in ride) {
      const rail = byTrain(ride.km);
      if (rail) return takeTrain(rail);
    }
    if (ride && 'km' in ride && ride.minutes > maxDriveMinutes(days)) {
      if (
        fly(
          `${Math.round(ride.minutes / 60)} h de route à l’aller pour ${days} jour${days > 1 ? 's' : ''}`
        )
      )
        return leg;
      noFlightLongRoad(ride.minutes);
    }
    leg.notes.push(carFreeNoLegNote(straight, fromHome));
    return leg;
  }

  const car = await road();
  if ('km' in car) {
    const walkKm = car.end ? await deps.walkKm(car.end, target) : 0;
    const limit = maxDriveMinutes(days);
    const tooLong = car.minutes > limit;
    // Japon, Corée, Chine, Inde : le train passe avant la voiture dès qu'il est aussi rapide.
    const rail = byTrain(car.km, tooLong);
    if (rail && (tooLong || (rail.preferred && rail.minutesOneWay <= car.minutes)))
      return takeTrain(rail);
    if (tooLong) {
      // Route trop longue pour la durée du voyage, rail hors de portée : l'avion.
      if (
        fly(
          `${Math.round(car.minutes / 60)} h de route à l’aller pour ${days} jour${days > 1 ? 's' : ''}`
        )
      )
        return leg;
    }
    leg.carFuel = estimateCarTrip({
      oneWayKm: car.km,
      oneWayMin: car.minutes,
      partySize: party,
      fuel,
      tollsBasis: tolls,
    });
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
    leg.carFuel = estimateCarTrip({
      oneWayKm: Math.round(straight * ROAD_DETOUR_FACTOR),
      oneWayMin: minutes,
      partySize: party,
      fuel,
      tollsBasis: tolls,
    });
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
