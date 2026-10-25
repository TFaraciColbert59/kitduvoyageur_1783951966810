/**
 * Le moteur de derivation - la source unique de verite des 8 cartes.
 *
 * Budget, dangerousite, kit, fenetre meteo et etapes sont des DERIVEES de
 * (t, intention, profil). Elles sont calculees ici, en domaine pur, jamais par
 * le LLM. Le modele ne fait qu'expliquer la sortie de ce module.
 *
 * Budget de performance : < 2 ms par instantiation. Voir `perf.spec.ts`.
 */

import {
  ZONES,
  clamp,
  dangerForHours,
  dangerLevel,
  getZone,
  hoursFromT,
  progressInZone,
  stepGrain,
  tFromHours,
  zoneForHours,
  type TrajectoireSourceId,
  type TrajectoireZone,
  type ZoneDef,
} from './scaleAxis';
import { CONSTRAINTS } from './types';
import type {
  BudgetBreakdown,
  DangerFactor,
  DangerReport,
  IntentionProfile,
  KitItem,
  PlanStep,
  TrajectoireSnapshot,
  VeilleRule,
  WindowReport,
} from './types';
import { matchTraces, type TraceSeed } from './traces';

export const ENGINE_VERSION = 'trajectoire-engine/1.0.0';

export interface DeriveInput {
  /** Position du curseur sur l'axe d'echelle, 0-1. */
  t: number;
  intention: IntentionProfile;
  /** Identifiants d'objets deja possedes dans l'inventaire LKDV. */
  ownedKit?: readonly string[];
  /** Traces disponibles (tribu + randonnees perso). */
  traces?: readonly TraceSeed[];
  /** Horodatage de reference. Injecte par le narration, jamais lu par le deriveur. */
  now?: Date;
}

const KIT_BASE_EUR = 140;

/** Gravite -> libelle francais + suffixe de jauge. */
function formatHoursHuman(hours: number): string {
  if (hours < 24) return `${formatNumber(hours)} h`;
  const days = hours / 24;
  const rounded = days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
  return `${formatNumber(rounded)} j`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}

function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatClock(hoursFloat: number): string {
  const total = Math.round(hoursFloat * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/* Budget                                                                      */
/* -------------------------------------------------------------------------- */

function deriveBudget(zone: ZoneDef, hours: number, missingKitEur: number): BudgetBreakdown {
  const transportEur = Math.round(zone.rates.transport * hours);
  const hebergementEur = Math.round(zone.rates.hebergement * hours);
  const activitesEur = Math.round(zone.rates.activites * hours);
  const kitManquantEur = Math.round(missingKitEur);
  const totalEur = transportEur + hebergementEur + activitesEur + kitManquantEur;

  type AffiliationLine = BudgetBreakdown['affiliation'][number];
  const affiliation: AffiliationLine[] = [];
  if (zone.sources.includes('routestack') && transportEur > 0) {
    affiliation.push({ label: 'Transports Routestack', sourceId: 'routestack', eur: transportEur });
  }
  if (zone.sources.includes('viator') && activitesEur > 0) {
    affiliation.push({ label: 'Activites Viator', sourceId: 'viator', eur: activitesEur });
  }
  if (zone.sources.includes('refuges') && hebergementEur > 0) {
    affiliation.push({ label: 'Hebergement refuges', sourceId: 'refuges', eur: hebergementEur });
  }
  if (zone.sources.includes('assurance') && transportEur > 0) {
    affiliation.push({ label: 'Assurance monde', sourceId: 'assurance', eur: transportEur });
  }

  return {
    transportEur,
    hebergementEur,
    activitesEur,
    kitManquantEur,
    totalEur,
    affiliation,
  };
}

/**
 * Cout du kit manquant : volume de zone x duree normalisee x couverture.
 *
 * La couverture est la part du kit de zone encore absente de l'inventaire.
 * Un inventaire vide coute 100 % du socle ; un inventaire complet laisse
 * 35 % (consommables, filtres,/usure) - on ne pretend jamais que tout est
 * acquis, mais on ne facture pas deux fois ce qu'on a deja.
 */
export function deriveMissingKitEur(
  zone: ZoneDef,
  hours: number,
  missingCount: number,
  totalItems: number
): number {
  if (missingCount <= 0 || totalItems <= 0) return 0;
  const base = KIT_BASE_EUR * zone.kitFactor * (0.5 + 0.5 * Math.min(1, hours / 120));
  const coverage = clamp(missingCount / totalItems, 0, 1);
  return base * (0.35 + 0.65 * coverage);
}

/* -------------------------------------------------------------------------- */
/* Danger                                                                      */
/* -------------------------------------------------------------------------- */

function dangerFactors(zone: ZoneDef, score: number): DangerFactor[] {
  return [
    {
      id: 'altitude',
      label: 'Altitude',
      display: `${formatNumber(zone.altMeters)} m`,
      score: clamp(Math.round((zone.altMeters / 4200) * 100), 5, 98),
      sourceId: 'alt_meteo_7j',
    },
    {
      id: 'exposition',
      label: 'Exposition',
      display: `${Math.round(zone.expoPct)} %`,
      score: clamp(zone.expoPct, 5, 98),
      sourceId: 'osm',
    },
    {
      id: 'isolation',
      label: 'Isolation',
      display: String(zone.isolation),
      score: clamp(zone.isolation * 28, 5, 98),
      sourceId: 'traces_tribu',
    },
    {
      id: 'meteo',
      label: 'Meteo',
      display: `${score - 24 > 0 ? '+' : '-'}${Math.abs(score - 24)} C`,
      score: clamp(score - 24, 5, 98),
      sourceId: 'meteo',
    },
  ];
}

function deriveDanger(zone: ZoneDef, hours: number, intention: IntentionProfile): DangerReport {
  const base = dangerForHours(hours);
  let bias = 1;
  for (const id of intention.constraints) {
    bias *= CONSTRAINTS[id]?.dangerBias ?? 1;
  }
  const score = clamp(Math.round(base * bias), 5, 96);
  return { score, level: dangerLevel(score), factors: dangerFactors(zone, score) };
}

/* -------------------------------------------------------------------------- */
/* Fenetre meteo & depart                                                     */
/* -------------------------------------------------------------------------- */

function deriveWindow(zone: ZoneDef, hours: number): WindowReport {
  const progress = progressInZone(hours, zone);
  // Lumiere du jour : constante de zone. Le prototype la fixe par zone
  // (11 h 20 en journee, 13 h 40 en expedition) - on ne l'interpole pas, on
  // ne fabrique pas une precision que la source ne donne pas.
  const daylight = zone.daylightH;
  const low = Math.round(4 - progress * 2);
  const high = Math.round(19 + progress * 2);
  const waterPoints = clamp(
    Math.round(zone.radiusKm / 900) * (zone.id === 'expedition' ? 1 : 1),
    1,
    6
  );
  const waterGap = Math.max(3, Math.round(zone.radiusKm / (waterPoints * 3)));

  return {
    ideal: zone.windowIdeal,
    risk: zone.windowRisk === '-' ? null : zone.windowRisk,
    daylight: formatClock(daylight),
    amplitude: `${low} C -> ${high} C`,
    water: `${waterPoints} points - ${waterGap} km`,
    sourceId: 'meteo',
  };
}

/* -------------------------------------------------------------------------- */
/* Etapes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Nombre d'etapes impose par le GRAIN de la zone, pas par le catalogue de
 * la destination. C'est le principe du dossier : changer de zone change le
 * grain des etapes (segment -> jour -> pays), pas la nature du plan.
 *
 * Un tour du monde de 30 j n'a pas 6 etapes parce que la destination en
 * propose 6 : il en a autant que le grain "pays" en demande.
 */
export function stepCountForGrain(zone: ZoneDef, hours: number): number {
  switch (zone.id) {
    case 'run':
      return 1;
    case 'journee':
      return 3;
    case 'raid':
      return Math.max(3, Math.round(hours / 12));
    case 'expedition':
      return Math.max(4, Math.round(hours / 36));
    case 'monde':
      return Math.max(5, Math.round(hours / 168));
    default:
      return 3;
  }
}

/**
 * Echantillonne `count` ancres sur une liste de `available`, en gardant les
 * extremites (on ne saute jamais le depart ni l'arrivee).
 */
function sampleAnchors(anchors: readonly string[], count: number): string[] {
  if (anchors.length === 0) return [];
  if (count >= anchors.length) return [...anchors];
  if (count === 1) return [anchors[0]];

  const picked: string[] = [];
  const lastIndex = anchors.length - 1;
  for (let index = 0; index < count; index += 1) {
    const position = Math.round((index * lastIndex) / (count - 1));
    picked.push(anchors[position]);
  }
  return Array.from(new Set(picked));
}

function deriveSteps(zone: ZoneDef, hours: number, intention: IntentionProfile): PlanStep[] {
  const count = stepCountForGrain(zone, hours);
  const anchors = sampleAnchors(intention.destination.anchors, count);
  const totalKm = Math.max(2, Math.round(hours * intention.destination.paceKmh * 0.62));
  const perStepKm = Math.max(1, Math.round(totalKm / Math.max(1, anchors.length)));

  return anchors.map((anchor, index) => {
    const stepNumber = index + 1;
    const [title, ...rest] = anchor.split(' - ');
    const detail = rest.length > 0 ? rest.join(' - ') : 'Etape de passage';
    return {
      id: `${zone.id}-step-${stepNumber}`,
      title: title ?? anchor,
      detail,
      distanceKm: perStepKm,
      sourceId: stepSourceFor(zone, index, anchors.length),
    } satisfies PlanStep;
  });
}

function stepSourceFor(zone: ZoneDef, index: number, total: number): TrajectoireSourceId {
  if (zone.sources.includes('vols') && index === 0) return 'vols';
  if (zone.sources.includes('viator') && index === total - 1) return 'viator';
  if (zone.sources.includes('refuges') && index % 2 === 1) return 'refuges';
  if (zone.sources.includes('routestack') && index % 3 === 2) return 'routestack';
  if (zone.sources.includes('traces_tribu') && index % 2 === 0) return 'traces_tribu';
  return 'osm';
}

/* -------------------------------------------------------------------------- */
/* Kit                                                                         */
/* -------------------------------------------------------------------------- */

interface KitSeed {
  id: string;
  label: string;
  priceEur: number;
  /** Zone a partir de laquelle l'objet devient necessaire. */
  from: TrajectoireZone;
  weightKg: number;
}

const KIT_SEED: readonly KitSeed[] = [
  { id: 'sac-60', label: 'Sac 60 L', priceEur: 52, from: 'expedition', weightKg: 1.6 },
  { id: 'doudoune-10', label: 'Doudoune -10 C', priceEur: 61, from: 'expedition', weightKg: 0.7 },
  { id: 'tente-4', label: 'Tente 4 saisons', priceEur: 61, from: 'raid', weightKg: 2.4 },
  { id: 'crampons', label: 'Crampons legers', priceEur: 61, from: 'raid', weightKg: 1.1 },
  { id: 'filtre-eau', label: 'Filtre a eau', priceEur: 44, from: 'raid', weightKg: 0.3 },
  { id: 'balise-gps', label: 'Balise GPS', priceEur: 47, from: 'expedition', weightKg: 0.1 },
  { id: 'pharmacie', label: 'Pharmacine altitude', priceEur: 29, from: 'raid', weightKg: 0.4 },
  { id: 'gourde-2l', label: 'Gourde 2 L isotherme', priceEur: 18, from: 'journee', weightKg: 0.2 },
  { id: 'frontale', label: 'Frontale 400 lm', priceEur: 26, from: 'journee', weightKg: 0.1 },
] as const;

function deriveKit(zone: ZoneDef, owned: readonly string[]): KitItem[] {
  const ownedSet = new Set(owned);
  const zoneIdx = ZONES.findIndex((candidate) => candidate.id === zone.id);
  return KIT_SEED.filter((item) => {
    const itemIdx = ZONES.findIndex((candidate) => candidate.id === item.from);
    return itemIdx <= zoneIdx;
  }).map((item) => ({
    id: item.id,
    label: item.label,
    owned: ownedSet.has(item.id),
    priceEur: ownedSet.has(item.id) ? null : item.priceEur,
    sourceId: 'inventaire_lkdv' as TrajectoireSourceId,
  }));
}

function deriveKitLoadKg(zone: ZoneDef, hours: number): number {
  const progress = progressInZone(hours, zone);
  return Math.round((3.2 + zone.packLiters * 0.088 + progress * 1.4) * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* Autopilot                                                                   */
/* -------------------------------------------------------------------------- */

function deriveVeille(zone: ZoneDef, hours: number): VeilleRule[] {
  const progress = progressInZone(hours, zone);
  const rules: VeilleRule[] = [
    {
      kind: 'meteo',
      label: 'Vie meteo',
      detail: zone.windowIdeal,
      active: true,
      sourceId: 'meteo',
    },
    {
      kind: 'prix',
      label: 'Veille prix',
      detail: zone.sources.includes('vols')
        ? 'Vols Routestack'
        : zone.sources.includes('routestack')
          ? 'Train / bus Routestack'
          : 'Sans transport payant',
      active: zone.sources.includes('routestack'),
      sourceId: 'routestack',
    },
    {
      kind: 'creneaux',
      label: 'Creneaux de depart',
      detail:
        zone.id === 'monde'
          ? 'Saisons croisees'
          : `Prochaine fenetre a risque : ${zone.windowRisk === '-' ? 'aucune' : zone.windowRisk}`,
      active: zone.windowRisk !== '-',
      sourceId: 'meteo',
    },
    {
      kind: 'dangerosite',
      label: 'Dangerosite terrain',
      detail: `Seuil de zone ${Math.round(zone.dangerBase)} - position ${Math.round(progress * 100)} %`,
      active: zone.dangerBase >= 46,
      sourceId: 'traces_tribu',
    },
  ];
  return rules;
}

/* -------------------------------------------------------------------------- */
/* Point d'entree                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Derive l'instantane complet de la trajectoire.
 *
 * Fonction pure : mêmes entrees -> meme sortie, toujours. Aucune horloge
 * systeme n'est lue (meme `now` par defaut), aucun aleatoire.
 */
export function deriveTrajectoire(input: DeriveInput): TrajectoireSnapshot {
  const started = nowMs();
  const t = clamp(input.t, 0, 1);
  const hours = hoursFromT(t);
  const zone = zoneForHours(hours);
  const intention = input.intention;
  const owned = input.ownedKit ?? [];
  const traces = input.traces ?? [];

  const kit = deriveKit(zone, owned);
  const missing = kit.filter((item) => !item.owned);
  const missingKitEur = deriveMissingKitEur(zone, hours, missing.length, kit.length);

  const snapshot: TrajectoireSnapshot = {
    t,
    hours,
    days: Math.round((hours / 24) * 10) / 10,
    zone: zone.id,
    zoneLabel: zone.label,
    zoneSub: zone.sub,
    radiusKm: zone.radiusKm,
    packLiters: zone.packLiters,
    grain: stepGrain(zone.id),
    danger: deriveDanger(zone, hours, intention),
    budget: deriveBudget(zone, hours, missingKitEur),
    window: deriveWindow(zone, hours),
    steps: deriveSteps(zone, hours, intention),
    kit,
    kitLoadKg: deriveKitLoadKg(zone, hours),
    traces: matchTraces(traces, { hours, zone: zone.id }),
    veille: deriveVeille(zone, hours),
    provenance: zone.sources,
    computeMs: 0,
  };

  return { ...snapshot, computeMs: round2(nowMs() - started) };
}

/** Duree lisible de l'axe, ex: "169 heures (7 jours)". */
export function describeDuration(hours: number): string {
  if (hours < 24) return formatHoursHuman(hours);
  const days = hours / 24;
  const digits = hours >= 96 ? 0 : 1;
  const rounded = Math.round(days * 10 ** digits) / 10 ** digits;
  const unit = rounded >= 2 ? 'jours' : 'jour';
  return `${formatNumber(hours)} heures (${formatDecimal(rounded, digits)} ${unit})`;
}

export function describeZoneSub(zone: ZoneDef): string {
  return `${zone.sub} - rayon ${formatNumber(zone.radiusKm)} km`;
}

/** Distance totale estimee du plan, en km. */
export function totalDistanceKm(
  snapshot: TrajectoireSnapshot,
  intention: IntentionProfile
): number {
  return Math.max(2, Math.round(snapshot.hours * intention.destination.paceKmh * 0.62));
}

export { ZONES, getZone, tFromHours, zoneForHours };
export type { ZoneDef, TrajectoireZone };

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
