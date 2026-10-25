/**
 * L'axe d'echelle - coeur du domaine Trajectoire Vivante.
 *
 * Un seul objet d'aventure, du run de 1 h au tour du monde de 30 jours.
 * Echelle temporelle logarithmique, zones de grain, derivees deterministes.
 *
 * Regle absolute (ROADMAP_VOYAGE 4.2) : ce module est du DOMAINE PUR.
 * Aucun import, aucune I/O, aucun reseau, aucun LLM. Tout ce qui est affiche
 * a l'ecran et qui n'est pas narratif sort d'ici, donc il est testable et
 * reproductible au bit pres sur n'importe quelle machine.
 */

/** Bornes de l'axe temporel, en heures. 1 h -> 720 h (30 jours). */
export const H_MIN = 1;
export const H_MAX = 720;

export type TrajectoireZone = 'run' | 'journee' | 'raid' | 'expedition' | 'monde';

/** Identifiants ordonnes : l'ordre du tableau EST l'ordre de grain. */
export const ZONE_ORDER: readonly TrajectoireZone[] = [
  'run',
  'journee',
  'raid',
  'expedition',
  'monde',
] as const;

export interface ZoneDef {
  id: TrajectoireZone;
  label: string;
  /** Sous-titre de grain, affiche sous le label de zone. */
  sub: string;
  /** Borne basse inclusive de la zone, en heures. */
  minHours: number;
  /** Borne haute inclusive de la zone, en heures. */
  maxHours: number;
  radiusKm: number;
  /** Volume de sac cible, en litres. */
  packLiters: number;
  /** Danger de base (0-100) au plancher de la zone. */
  dangerBase: number;
  /** Altitude de reference, en metres. */
  altMeters: number;
  /** Exposition au vent / au relief, en pourcentage. */
  expoPct: number;
  /** Niveau d'isolation (0 = none, 3 = total). */
  isolation: number;
  /** Ecart thermique representatif du matin au soir, en degres C. */
  deltaC: number;
  /** Heures de jour utiles de reference pour la zone. */
  daylightH: number;
  /** Fenetre meteo ideale, libelle. */
  windowIdeal: string;
  /** Fenetre meteo a risque, libelle. */
  windowRisk: string;
  /** Tarifs de derivation budgetaire, en EUR par heure d'engagement. */
  rates: { transport: number; hebergement: number; activites: number };
  /** Coefficient de volume de kit manquant. */
  kitFactor: number;
  /** Sources externes qui deviennent actives a cette echelle. */
  sources: readonly TrajectoireSourceId[];
}

/** Sources autorisees. L'IA n'invente jamais : chaque donnee porte sa provenance. */
export type TrajectoireSourceId =
  | 'meteo'
  | 'traces_perso'
  | 'routestack'
  | 'refuges'
  | 'viator'
  | 'alt_meteo_7j'
  | 'vols'
  | 'esim'
  | 'assurance'
  | 'inventaire_lkdv'
  | 'traces_tribu'
  | 'osm';

export const ZONES: readonly ZoneDef[] = [
  {
    id: 'run',
    label: 'Sortie',
    sub: 'Run - Marche',
    minHours: 1,
    maxHours: 3,
    radiusKm: 15,
    packLiters: 12,
    dangerBase: 14,
    altMeters: 60,
    expoPct: 8,
    isolation: 0,
    deltaC: 9,
    daylightH: 16.4,
    windowIdeal: "Toute l'annee",
    windowRisk: '-',
    rates: { transport: 3, hebergement: 1, activites: 2 },
    kitFactor: 0.35,
    sources: ['meteo', 'traces_perso', 'osm'],
  },
  {
    id: 'journee',
    label: 'Journee',
    sub: 'Randonnee - 1 jour',
    minHours: 3,
    maxHours: 12,
    radiusKm: 80,
    packLiters: 20,
    dangerBase: 30,
    altMeters: 1240,
    expoPct: 22,
    isolation: 1,
    deltaC: 15,
    daylightH: 11.33,
    windowIdeal: 'Mars - Nov.',
    windowRisk: '-',
    rates: { transport: 9, hebergement: 0, activites: 6 },
    kitFactor: 0.6,
    sources: ['meteo', 'traces_perso', 'routestack', 'osm'],
  },
  {
    id: 'raid',
    label: 'Raid',
    sub: 'Bivouac - 2 a 4 jours',
    minHours: 12,
    maxHours: 48,
    radiusKm: 300,
    packLiters: 40,
    dangerBase: 46,
    altMeters: 2050,
    expoPct: 38,
    isolation: 2,
    deltaC: 15,
    daylightH: 10.08,
    windowIdeal: 'Mai - Oct.',
    windowRisk: '12 oct. - neige',
    rates: { transport: 11, hebergement: 8, activites: 7 },
    kitFactor: 1,
    sources: ['meteo', 'traces_perso', 'routestack', 'refuges', 'traces_tribu', 'osm'],
  },
  {
    id: 'expedition',
    label: 'Expedition',
    sub: '1 a 10 jours',
    minHours: 48,
    maxHours: 240,
    radiusKm: 3000,
    packLiters: 60,
    dangerBase: 62,
    altMeters: 3400,
    expoPct: 52,
    isolation: 2,
    deltaC: 15,
    daylightH: 13.67,
    windowIdeal: 'Juin - Sept.',
    windowRisk: '25 sept. - orages',
    rates: { transport: 3.5, hebergement: 4.2, activites: 1.5 },
    kitFactor: 1,
    sources: [
      'meteo',
      'traces_perso',
      'routestack',
      'refuges',
      'viator',
      'alt_meteo_7j',
      'traces_tribu',
      'osm',
    ],
  },
  {
    id: 'monde',
    label: 'Tour du monde',
    sub: '10 a 30 jours',
    minHours: 240,
    maxHours: H_MAX,
    radiusKm: 20000,
    packLiters: 70,
    dangerBase: 74,
    altMeters: 4100,
    expoPct: 60,
    isolation: 3,
    deltaC: 29,
    daylightH: 14.17,
    windowIdeal: 'Fev. - Oct. (hemis.)',
    windowRisk: 'saisons croisees',
    rates: { transport: 8, hebergement: 5, activites: 2 },
    kitFactor: 1.15,
    sources: [
      'meteo',
      'traces_perso',
      'routestack',
      'refuges',
      'viator',
      'alt_meteo_7j',
      'vols',
      'esim',
      'assurance',
      'traces_tribu',
      'osm',
    ],
  },
] as const;

const ZONE_BY_ID: ReadonlyMap<TrajectoireZone, ZoneDef> = new Map(
  ZONES.map((zone) => [zone.id, zone])
);

export function getZone(id: TrajectoireZone): ZoneDef {
  const zone = ZONE_BY_ID.get(id);
  if (!zone) {
    throw new Error(`[trajectoire] zone inconnue: ${id}`);
  }
  return zone;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const LOG_SPAN = Math.log(H_MAX) - Math.log(H_MIN);

/** Position t dans [0,1] -> duree en heures (echelle log 1 h -> 720 h). */
export function hoursFromT(t: number): number {
  const c = clamp(t, 0, 1);
  return Math.round(Math.exp(Math.log(H_MIN) + c * LOG_SPAN));
}

/** Duree en heures -> position t dans [0,1] (inverse exacte de hoursFromT). */
export function tFromHours(hours: number): number {
  const h = clamp(hours, H_MIN, H_MAX);
  return (Math.log(h) - Math.log(H_MIN)) / LOG_SPAN;
}

/** Zone d'appartenance d'une duree. Bornes inclusives des deux cotes. */
export function zoneForHours(hours: number): ZoneDef {
  const h = clamp(hours, H_MIN, H_MAX);
  const found = ZONES.find((zone) => h <= zone.maxHours);
  return found ?? ZONES[ZONES.length - 1];
}

/** Zone correspondant a une position du curseur. */
export function zoneForT(t: number): ZoneDef {
  return zoneForHours(hoursFromT(t));
}

export function zoneIndex(zone: TrajectoireZone): number {
  return ZONE_ORDER.indexOf(zone);
}

/**
 * Premiere duree ENTIERE qui resout vers cette zone.
 *
 * Les bornes du dossier sont inclusives des deux cotes et `zoneForHours`
 * tranche en faveur de la zone la plus fine. Consequence assumee : passer a
 * la journee fait sauter la dangerousite de 16 (plafond sortie) a 30
 * (plancher journee). Ce saut est SEMANTIQUE - une journee est reellement
 * plus exposee qu'une sortie - et non un defaut de continuity. Cette
 * fonction donne la borne entiere a laquelle l'invariant
 * "danger === dangerBase" est vrai.
 */
export function firstResolvableHour(zone: TrajectoireZone): number {
  const def = getZone(zone);
  for (let hours = def.minHours; hours <= def.maxHours; hours += 1) {
    if (zoneForHours(hours).id === zone) return hours;
  }
  return def.maxHours;
}

/** Derniere duree entiere qui resout vers cette zone. */
export function lastResolvableHour(zone: TrajectoireZone): number {
  const def = getZone(zone);
  for (let hours = def.maxHours; hours >= def.minHours; hours -= 1) {
    if (zoneForHours(hours).id === zone) return hours;
  }
  return def.minHours;
}

/**
 * Grain : comment une zone decoupe le plan en etapes.
 * Le grain change quand on change de zone, jamais la generation.
 */
export type StepGrain = 'boucle' | 'demi-journee' | 'jour' | 'journee' | 'pays';

/** Heures couvertes par une etape, selon la zone. */
export function stepGrainHours(zone: TrajectoireZone): number {
  switch (zone) {
    case 'run':
      return 1.5;
    case 'journee':
      return 4;
    case 'raid':
      return 12;
    case 'expedition':
      return 24;
    case 'monde':
      return 24 * 7;
    default:
      return 12;
  }
}

export function stepGrain(zone: TrajectoireZone): StepGrain {
  switch (zone) {
    case 'run':
      return 'boucle';
    case 'journee':
      return 'demi-journee';
    case 'raid':
      return 'jour';
    case 'expedition':
      return 'journee';
    case 'monde':
      return 'pays';
    default:
      return 'jour';
  }
}

/** Progression interne a la zone, dans [0,1]. 0 = plancher, 1 = plafond. */
export function progressInZone(hours: number, zone: ZoneDef): number {
  const span = Math.max(1, zone.maxHours - zone.minHours);
  return clamp((hours - zone.minHours) / span, 0, 1);
}

/**
 * Position mathematique du plancher d'une zone.
 *
 * ATTENTION : les bornes du dossier sont inclusives des deux cotes (la
 * journee commence a 3 h, la sortie finit a 3 h). `zoneForHours` tranche
 * en faveur de la zone la plus fine, donc cette valeur peut retomber sur la
 * zone precedente. Pour naviguer vers une zone, utiliser `tForZone`.
 */
export function tAtZoneStart(zone: TrajectoireZone): number {
  return tFromHours(getZone(zone).minHours);
}

/**
 * Position du curseur a l'interieur d'une zone, pour les puces de zone.
 *
 * On s'ecarte du plancher partage d'une marge de 1 h (ou 1 % du gabarit de
 * la zone si elle est plus large). La marge est indispensable : l'aller-retour
 * t -> heures -> t passe par un arrondi entier et par des flottants, donc
 * 30 minutes suffisaient a retomber sur la zone precedente.
 */
export function tForZone(zone: TrajectoireZone): number {
  const def = getZone(zone);
  const span = def.maxHours - def.minHours;
  const margin = Math.max(1, span * 0.01);
  return tFromHours(def.minHours + margin);
}

/** Position du curseur au milieu d'une zone (representation la plus typique). */
export function tAtZoneMiddle(zone: TrajectoireZone): number {
  const def = getZone(zone);
  return tFromHours((def.minHours + def.maxHours) / 2);
}

/** Amplitude de la dangerousite a l'interieur d'une zone (ratio plafond/plancher). */
export const DANGER_SPAN = 1.15;

export interface DangerRange {
  /** Valeur au plancher continu de la zone. */
  floor: number;
  /** Valeur au plafond continu de la zone. */
  ceiling: number;
}

/**
 * Bornes exactes de la dangerousite pour une zone.
 * La jauge a besoin de ces deux valeurs pour se dimensionner ; on les expose
 * plutot que de les recalculer cote UI.
 */
export function dangerRange(zone: ZoneDef): DangerRange {
  return {
    floor: zone.dangerBase,
    ceiling: Math.min(96, Math.round(zone.dangerBase * DANGER_SPAN)),
  };
}

/**
 * Dangerousite derivee : base de zone + montee progressive dans la zone.
 * Deterministe, sans LLM - le modele ne fait qu'expliquer ce chiffre.
 */
export function dangerForHours(hours: number): number {
  const zone = zoneForHours(hours);
  const range = dangerRange(zone);
  const progress = progressInZone(hours, zone);
  return clamp(Math.round(range.floor + (range.ceiling - range.floor) * progress), 5, 96);
}

export type DangerLevel = 'tranquille' | 'modere' | 'exigeant' | 'engage';

export function dangerLevel(score: number): DangerLevel {
  if (score < 30) return 'tranquille';
  if (score < 55) return 'modere';
  if (score < 75) return 'exigeant';
  return 'engage';
}
