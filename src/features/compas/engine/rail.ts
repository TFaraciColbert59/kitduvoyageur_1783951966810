/**
 * Compas — le train pour venir, par règle.
 *
 * Ardennes, Vendée, Bruges depuis Annecy partaient en avion : la route était
 * trop longue pour un week-end, et l'avion était le seul autre moyen. Le train
 * est la réponse là où un réseau de voyageurs relie les deux bouts : Europe,
 * Japon, Corée, Chine, Inde, et les corridors d'Amérique du Nord. Ordres de
 * grandeur pour préparer (barème du Compas), jamais un horaire ni un prix réels :
 * Résa · Trajets les donne.
 *
 * Les règles, dans l'ordre :
 * 1. un pays absent de la table n'a pas de train compté (réseau mal connu, ou
 *    voyageurs rares) : rien n'est affirmé, ni train ni « pas de train » ;
 * 2. deux pays ne se relient que s'ils sont du même réseau continu (l'Europe
 *    sauf l'Irlande, la Finlande et les Baltes qui restent seuls ; les corridors
 *    d'Amérique du Nord entre États-Unis et Canada) ; jamais d'un pays d'Asie à
 *    l'autre ;
 * 3. 150 km à vol d'oiseau au moins, et la portée du réseau au plus ;
 * 4. la route mesurée ne trahit pas une île (plus de 1,8 fois le vol d'oiseau)
 *    et le lieu ou le départ n'est pas sur une île sans rail ;
 * 5. Amérique du Nord : seulement entre deux villes d'un même corridor, et le
 *    Compas l'annonce (pas de train ailleurs) ;
 * 6. le trajet tient dans la durée du voyage.
 *
 * Le barème est PAR PAYS, daté, et toujours une estimation : aucun tarif de
 * train n'est donné gratuitement et librement par un réseau. Les dix premiers
 * pays gardent leur barème d'origine (0,13 € du km) ; les autres pays d'Europe
 * suivent le niveau de prix du pays (`costs.ts`) ; l'Asie et l'Amérique du Nord
 * ont chacune un prix du km propre, tous du même ordre de grandeur que les
 * billets réservés à l'avance et NON vérifiés contre une source libre.
 */

import { COSTS_VERSION, priceLevel } from './costs';
import { distanceKm } from './places';

export type RailNetworkId = 'ouest-europe' | 'europe' | 'japon' | 'coree' | 'chine' | 'inde' | 'amerique-nord';

interface RailNetwork {
  id: RailNetworkId;
  label: string;
  /** Vitesse moyenne correspondances comprises (km/h), plus 30 min pour rejoindre la gare. */
  kmh: number;
  /** Distance par la voie ≈ vol d'oiseau × detour. */
  detour: number;
  /** Au-delà, un séjour ne prend plus le train (km à vol d'oiseau). */
  maxStraightKm: number;
  /**
   * Le train passe avant la voiture dès qu'il est aussi rapide : conduire soi-même
   * n'est pas l'usage sur ces réseaux (péages, trafic, grande vitesse).
   */
  preferred: boolean;
}

const NETWORKS: Record<RailNetworkId, RailNetwork> = {
  'ouest-europe': {
    id: 'ouest-europe',
    label: 'grande vitesse d’Europe de l’Ouest',
    kmh: 110,
    detour: 1.25,
    maxStraightKm: 1200,
    preferred: false,
  },
  europe: {
    id: 'europe',
    label: 'trains rapides et express d’Europe',
    kmh: 80,
    detour: 1.3,
    maxStraightKm: 1200,
    preferred: false,
  },
  japon: { id: 'japon', label: 'Shinkansen et express du Japon', kmh: 170, detour: 1.2, maxStraightKm: 1100, preferred: true },
  coree: { id: 'coree', label: 'KTX et express de Corée', kmh: 150, detour: 1.2, maxStraightKm: 600, preferred: true },
  chine: { id: 'chine', label: 'grande vitesse de Chine', kmh: 200, detour: 1.25, maxStraightKm: 1500, preferred: true },
  inde: { id: 'inde', label: 'trains express de l’Inde', kmh: 60, detour: 1.3, maxStraightKm: 1500, preferred: true },
  'amerique-nord': {
    id: 'amerique-nord',
    label: 'trains de voyageurs d’Amérique du Nord, corridors seulement',
    kmh: 90,
    detour: 1.15,
    maxStraightKm: 1000,
    preferred: false,
  },
};

/** Les dix premiers pays, reliés par la grande vitesse (Royaume-Uni par l'Eurostar). */
const WEST = 'FR BE NL LU DE CH IT ES AT GB'.split(' ');
/** Autres pays d'Europe reliés au continent par le rail. */
const EUROPE = 'PT DK SE NO PL CZ SK HU SI HR RO BG RS GR ME MK BA'.split(' ');
/** Un réseau de voyageurs, mais sans liaison ferroviaire avec les voisins : seulement à l'intérieur du pays. */
const ALONE = 'IE FI EE LV LT'.split(' ');

const NETWORK_OF: Record<string, RailNetworkId> = {
  ...Object.fromEntries(WEST.map((c) => [c, 'ouest-europe' as const])),
  ...Object.fromEntries([...EUROPE, ...ALONE].map((c) => [c, 'europe' as const])),
  JP: 'japon',
  KR: 'coree',
  CN: 'chine',
  IN: 'inde',
  US: 'amerique-nord',
  CA: 'amerique-nord',
};

/** Deux pays se relient s'ils ont le même « lien » ; sinon seul le trajet à l'intérieur d'un pays. */
function linkOf(cc: string): string {
  if (ALONE.includes(cc)) return cc;
  const net = NETWORK_OF[cc];
  if (net === 'ouest-europe' || net === 'europe') return 'europe';
  if (net === 'amerique-nord') return 'amerique-nord';
  return cc;
}

/** Date du barème et provenance : une estimation, jamais un tarif relevé. */
export const RAIL_SCALE_DATE = COSTS_VERSION;
export const RAIL_SCALE_NOTE =
  'estimation (aucun tarif de train n’est donné gratuitement : ordre de grandeur, pas un prix ni un horaire)';

export interface RailScale {
  /** Prix du km de voie, billet réservé à l'avance (€, par personne et par sens). */
  eurPerKm: number;
  /** Plancher par sens (€). */
  minOneWayEur: number;
  source: 'estimation';
  date: string;
}

/** Prix du km hors d'Europe : un ordre de grandeur par pays, daté, non vérifié contre une source libre. */
const OUTSIDE_EUROPE: Record<string, { eurPerKm: number; minOneWayEur: number }> = {
  JP: { eurPerKm: 0.17, minOneWayEur: 20 },
  KR: { eurPerKm: 0.1, minOneWayEur: 12 },
  CN: { eurPerKm: 0.06, minOneWayEur: 8 },
  IN: { eurPerKm: 0.03, minOneWayEur: 4 },
  US: { eurPerKm: 0.2, minOneWayEur: 20 },
  CA: { eurPerKm: 0.2, minOneWayEur: 20 },
};

/** Le barème d'un pays, ou null quand le pays n'a pas de train compté. */
export function railScaleFor(countryCode: string | null | undefined): RailScale | null {
  const cc = (countryCode ?? '').toUpperCase();
  if (WEST.includes(cc)) return { eurPerKm: 0.13, minOneWayEur: 30, source: 'estimation', date: RAIL_SCALE_DATE };
  if (EUROPE.includes(cc) || ALONE.includes(cc)) {
    const level = priceLevel(cc).level;
    return {
      eurPerKm: 0.13 * level,
      minOneWayEur: Math.max(8, 30 * level),
      source: 'estimation',
      date: RAIL_SCALE_DATE,
    };
  }
  const out = OUTSIDE_EUROPE[cc];
  return out ? { ...out, source: 'estimation', date: RAIL_SCALE_DATE } : null;
}

/**
 * Îles sans train depuis le continent, ou dont le rail n'est pas relié au reste du
 * pays : la route mesurée y passe par un ferry sans toujours paraître plus longue
 * (Annecy → Cagliari : 1,6 fois le vol d'oiseau), d'où ces emprises [sud, ouest, nord, est].
 * Les plus visitées seulement : l'écart de route mesurée (plus de 1,8 fois) couvre le reste quand
 * le ferry est long. Le routeur ne dit pas s'il prend un ferry : une île absente d'ici (golfe
 * Saronique, Eubée, Quarnero, archipel de Zadar, Hébrides...) reste comptée comme joignable en train
 * si la route mesurée ne la trahit pas. Ajouter l'emprise d'une île à mesure que le réseau d'un pays
 * entre dans la table.
 */
const ISLANDS: Array<[number, number, number, number]> = [
  [41.3, 8.5, 43.1, 9.6], // Corse
  [38.8, 8.1, 41.35, 9.9], // Sardaigne
  [36.6, 12.4, 38.35, 15.7], // Sicile
  [38.6, 1.15, 40.1, 4.35], // Baléares
  [27.6, -18.2, 29.5, -13.3], // Canaries
  [42.7, 10.0, 42.9, 10.45], // Elbe
  [32.3, -17.4, 33.2, -16.2], // Madère
  [36.9, -31.4, 39.8, -24.9], // Açores
  [55.0, 14.6, 55.35, 15.2], // Bornholm
  [56.9, 18.1, 58.0, 19.2], // Gotland
  [34.8, 23.4, 35.7, 26.4], // Crète
  [39.3, 19.6, 39.9, 20.1], // Corfou
  [36.3, 24.3, 37.5, 25.6], // Cyclades
  [35.8, 27.7, 36.5, 28.3], // Rhodes
  [24.0, 122.8, 27.2, 128.6], // Okinawa
  [33.1, 126.1, 33.6, 127.0], // Jeju
  [18.1, 108.5, 20.2, 111.2], // Hainan (le train y passe par un ferry)
  [6.5, 92.1, 13.8, 94.0], // Andaman et Nicobar
  [8.0, 71.5, 12.5, 74.0], // Laquedives
  // Grèce : le réseau grec compte depuis que la Grèce est dans la table, et le routeur ne dit pas s'il
  // prend un ferry (Athènes → Lesbos : 358 km « de train » avec une route mesurée à 1,3 fois le vol d'oiseau).
  [37.6, 20.6, 37.95, 21.05], // Zante
  [38.0, 20.25, 38.55, 20.85], // Céphalonie et Ithaque
  [38.55, 20.5, 38.92, 20.76], // Leucade (pont routier, pas de rail)
  [39.1, 20.1, 39.3, 20.25], // Paxos
  [36.1, 22.9, 36.4, 23.15], // Cythère
  [38.95, 25.8, 39.4, 26.65], // Lesbos
  [39.7, 25.0, 40.0, 25.5], // Lemnos
  [38.1, 25.85, 38.7, 26.2], // Chios
  [37.5, 25.9, 37.85, 27.1], // Ikaria, Fournoi et Samos
  [40.5, 24.5, 40.8, 24.85], // Thasos
  [40.4, 25.4, 40.55, 25.7], // Samothrace
  [39.0, 23.38, 39.45, 24.2], // Sporades du Nord : Skiathos, Skopelos, Alonissos
  [38.75, 24.4, 38.98, 24.7], // Skyros
  [35.3, 26.2, 37.5, 29.7], // Dodécanèse : de Patmos et Kos à Rhodes voisine, Karpathos, Symi, Kastellorizo
  // Croatie : îles dalmates (le rail s'arrête à Split, Šibenik, Zadar).
  [43.33, 16.17, 43.43, 16.4], // Šolta
  [43.2, 16.3, 43.42, 17.0], // Brač
  [43.03, 16.37, 43.21, 17.2], // Hvar
  [42.9, 15.7, 43.1, 16.3], // Vis et Biševo
  [42.88, 16.6, 43.0, 17.2], // Korčula
  [42.7, 16.75, 42.8, 17.05], // Lastovo
  [42.69, 17.28, 42.81, 17.72], // Mljet
  // Estonie : le pont-digue relie Muhu à Saaremaa, rien ne relie les deux au continent par le rail.
  [57.9, 21.7, 58.7, 23.45], // Saaremaa et Muhu
  [58.5, 22.0, 59.15, 23.1], // Hiiumaa
  // Royaume-Uni et Espagne : la mer sépare l'Irlande du Nord de la Grande-Bretagne ; Ceuta et
  // Melilla n'ont aucune voie ferrée reliée au réseau espagnol.
  [54.05, -8.2, 55.35, -5.4], // Irlande du Nord
  [35.85, -5.4, 35.93, -5.28], // Ceuta
  [35.26, -3.0, 35.34, -2.91], // Melilla
];

function onIsland(p: { lat: number; lon: number }): boolean {
  return ISLANDS.some(([s, w, n, e]) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e);
}

/* ---------- Amérique du Nord : les corridors ---------- */

interface Corridor {
  id: string;
  name: string;
  operator: string;
  /** Villes desservies [nom, lat, lon] (centre-ville). */
  stops: Array<[string, number, number]>;
}

/** Une ville est « sur » un corridor si une de ses gares est à moins de 40 km. */
const CORRIDOR_RADIUS_KM = 40;

const CORRIDORS: Corridor[] = [
  {
    id: 'nord-est',
    name: 'Nord-Est',
    operator: 'Amtrak',
    stops: [
      ['Boston', 42.36, -71.06],
      ['Providence', 41.82, -71.41],
      ['New Haven', 41.31, -72.93],
      ['New York', 40.71, -74.0],
      ['Philadelphie', 39.95, -75.17],
      ['Baltimore', 39.29, -76.61],
      ['Washington', 38.9, -77.04],
      ['Richmond', 37.54, -77.43],
    ],
  },
  {
    id: 'downeaster',
    name: 'Downeaster',
    operator: 'Amtrak',
    stops: [
      ['Boston', 42.36, -71.06],
      ['Portland (Maine)', 43.66, -70.26],
    ],
  },
  {
    id: 'keystone',
    name: 'Keystone',
    operator: 'Amtrak',
    stops: [
      ['New York', 40.71, -74.0],
      ['Philadelphie', 39.95, -75.17],
      ['Harrisburg', 40.27, -76.88],
    ],
  },
  {
    id: 'empire',
    name: 'Empire et Maple Leaf',
    operator: 'Amtrak',
    stops: [
      ['New York', 40.71, -74.0],
      ['Albany', 42.65, -73.75],
      ['Syracuse', 43.05, -76.15],
      ['Rochester', 43.16, -77.61],
      ['Buffalo', 42.89, -78.88],
      ['Toronto', 43.65, -79.38],
    ],
  },
  {
    id: 'cascades',
    name: 'Cascades',
    operator: 'Amtrak',
    stops: [
      ['Vancouver', 49.28, -123.12],
      ['Seattle', 47.61, -122.33],
      ['Tacoma', 47.25, -122.44],
      ['Portland (Oregon)', 45.52, -122.68],
      ['Salem', 44.94, -123.03],
      ['Eugene', 44.05, -123.09],
    ],
  },
  {
    id: 'pacific-surfliner',
    name: 'Pacific Surfliner',
    operator: 'Amtrak',
    stops: [
      ['San Diego', 32.72, -117.16],
      ['Los Angeles', 34.05, -118.24],
      ['Santa Barbara', 34.42, -119.7],
      ['San Luis Obispo', 35.28, -120.66],
    ],
  },
  {
    id: 'capitol',
    name: 'Capitol Corridor',
    operator: 'Amtrak',
    stops: [
      ['Auburn', 38.9, -121.07],
      ['Sacramento', 38.58, -121.49],
      ['Oakland', 37.8, -122.27],
      ['San José', 37.34, -121.89],
    ],
  },
  {
    id: 'hiawatha',
    name: 'Hiawatha',
    operator: 'Amtrak',
    stops: [
      ['Chicago', 41.88, -87.63],
      ['Milwaukee', 43.04, -87.91],
    ],
  },
  {
    id: 'wolverine',
    name: 'Wolverine',
    operator: 'Amtrak',
    stops: [
      ['Chicago', 41.88, -87.63],
      ['Kalamazoo', 42.29, -85.58],
      ['Ann Arbor', 42.28, -83.74],
      ['Détroit', 42.33, -83.05],
    ],
  },
  {
    id: 'lincoln',
    name: 'Lincoln',
    operator: 'Amtrak',
    stops: [
      ['Chicago', 41.88, -87.63],
      ['Springfield (Illinois)', 39.8, -89.65],
      ['Saint-Louis', 38.63, -90.2],
    ],
  },
  {
    id: 'brightline',
    name: 'Brightline',
    operator: 'Brightline',
    stops: [
      ['Miami', 25.77, -80.19],
      ['Fort Lauderdale', 26.12, -80.14],
      ['West Palm Beach', 26.71, -80.06],
      ['Orlando', 28.43, -81.31],
    ],
  },
  {
    id: 'quebec-windsor',
    name: 'Québec–Windsor',
    operator: 'VIA Rail',
    stops: [
      ['Windsor', 42.31, -83.04],
      ['London (Ontario)', 42.98, -81.25],
      ['Toronto', 43.65, -79.38],
      ['Kingston', 44.23, -76.48],
      ['Ottawa', 45.42, -75.65],
      ['Montréal', 45.5, -73.57],
      ['Québec', 46.82, -71.21],
    ],
  },
];

const NA_NOTICE_NONE =
  'Amérique du Nord : les trains de voyageurs (Amtrak, VIA Rail) ne roulent que sur quelques corridors, quelques fois par jour, et ce trajet n’en suit aucun : aucun train n’est compté (voiture ou avion).';

function stopNear(c: Corridor, p: { lat: number; lon: number }): [string, number, number] | null {
  let best: [string, number, number] | null = null;
  let bestKm = CORRIDOR_RADIUS_KM;
  for (const s of c.stops) {
    const d = distanceKm(p, { lat: s[1], lon: s[2] });
    if (d <= bestKm) {
      best = s;
      bestKm = d;
    }
  }
  return best;
}

/** Le corridor qui dessert les deux villes (deux gares différentes), sinon null. */
function sharedCorridor(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Corridor | null {
  for (const c of CORRIDORS) {
    const from = stopNear(c, a);
    const to = stopNear(c, b);
    if (from && to && from[0] !== to[0]) return c;
  }
  return null;
}

/* ---------- Le trajet ---------- */

export interface TrainTrip {
  railKm: number;
  minutesOneWay: number;
  /** Aller-retour, par personne. */
  eurRoundTrip: number;
  basis: string;
  /** Réseau retenu : le moins rapide des deux pays. */
  network: RailNetworkId;
  /** Le prix est toujours une estimation du barème Compas, jamais un tarif relevé. */
  priceSource: 'estimation';
  /** Le train passe avant la voiture quand il est aussi rapide (Japon, Corée, Chine, Inde). */
  preferred: boolean;
  /** Annonce honnête à dire à l'écran (corridor d'Amérique du Nord), sinon null. */
  notice: string | null;
}

export interface TrainInput {
  fromCountry: string | null | undefined;
  toCountry: string | null | undefined;
  straightKm: number;
  /** Route mesurée (km), si elle l'a été. */
  roadKm?: number | null;
  /** Durée du voyage (jours), pour le temps de train admissible. */
  days?: number | null;
  /** Lieu d'arrivée : une grande île n'a pas de train depuis le continent. */
  to?: { lat: number; lon: number } | null;
  /** Lieu de départ : une île au départ, et les corridors d'Amérique du Nord. */
  from?: { lat: number; lon: number } | null;
}

export interface TrainOutlook {
  trip: TrainTrip | null;
  /**
   * Sans train : pourquoi, quand le dire est honnête (Amérique du Nord, hors corridor).
   * Jamais un « pas de train » pour un pays dont le réseau n'est pas connu.
   */
  notice: string | null;
}

/**
 * Temps de train à l'aller qu'un voyage supporte : un week-end à Barcelone ne
 * passe pas 6 h 30 dans le train à l'aller (l'avion reste plus sensé).
 */
export function maxTrainMinutes(days: number | null | undefined): number {
  const d = days ?? 99;
  if (d <= 2) return 330;
  if (d === 3) return 420;
  return 600;
}

/** Le moins rapide des deux réseaux (celui qui limite le trajet). */
function slower(a: RailNetwork, b: RailNetwork): RailNetwork {
  return b.kmh < a.kmh ? b : a;
}

export function trainOutlook(input: TrainInput): TrainOutlook {
  const none: TrainOutlook = { trip: null, notice: null };
  const from = (input.fromCountry ?? '').toUpperCase();
  const to = (input.toCountry ?? '').toUpperCase();
  const netFrom = NETWORK_OF[from];
  const netTo = NETWORK_OF[to];
  if (!netFrom || !netTo) return none;
  if (linkOf(from) !== linkOf(to)) return none;
  if (!(input.straightKm >= 150)) return none;
  const net = slower(NETWORKS[netFrom], NETWORKS[netTo]);
  // Amérique du Nord : un train n'existe que sur un corridor, dit dans les deux cas.
  let corridor: Corridor | null = null;
  if (net.id === 'amerique-nord') {
    corridor = input.from && input.to ? sharedCorridor(input.from, input.to) : null;
    if (!corridor) return { trip: null, notice: NA_NOTICE_NONE };
  }
  if (input.straightKm > net.maxStraightKm) return none;
  if (input.roadKm == null || input.roadKm > input.straightKm * 1.8) return none;
  if ((input.to && onIsland(input.to)) || (input.from && onIsland(input.from))) return none;
  const railKm = Math.round(input.straightKm * net.detour);
  const minutesOneWay = Math.round((railKm / net.kmh) * 60 + 30);
  if (minutesOneWay > maxTrainMinutes(input.days)) return none;
  // Barème des deux pays : leur moyenne (un seul pays : le sien).
  const a = railScaleFor(from)!;
  const b = railScaleFor(to)!;
  const eurPerKm = (a.eurPerKm + b.eurPerKm) / 2;
  const minOneWayEur = Math.round((a.minOneWayEur + b.minOneWayEur) / 2);
  const eurRoundTrip = 2 * Math.max(minOneWayEur, Math.round(railKm * eurPerKm));
  const h = Math.round(minutesOneWay / 30) / 2;
  const notice = corridor
    ? `Amérique du Nord : les trains de voyageurs ne roulent que sur quelques corridors. Celui-ci (corridor ${corridor.name}, ${corridor.operator}) dessert les deux villes à moins de ${CORRIDOR_RADIUS_KM} km d’une gare ; fréquences et prix dans Résa · Trajets.`
    : null;
  return {
    trip: {
      railKm,
      minutesOneWay,
      eurRoundTrip,
      basis: `barème Compas ${RAIL_SCALE_DATE} · train aller-retour, environ ${railKm} km de voie et ${String(h).replace('.', ',')} h · ${net.label} · ${RAIL_SCALE_NOTE} · vrais horaires et prix dans Résa · Trajets`,
      network: net.id,
      priceSource: 'estimation',
      preferred: net.preferred,
      notice,
    },
    notice: null,
  };
}

/**
 * Le train remplace l'avion quand les deux pays sont reliés, que la distance s'y
 * prête, que la route mesurée ne trahit pas une île ou un détour, et que le
 * trajet tient dans la durée du voyage (voir l'en-tête pour les règles).
 */
export function trainTrip(input: TrainInput): TrainTrip | null {
  return trainOutlook(input).trip;
}
