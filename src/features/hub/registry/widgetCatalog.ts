import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import type { ActivityType } from '../engine/activityTypes';
import type { HubWidgetId } from '../engine/hubProfileEngine';
import { tripWidgetRegistry } from '@/features/trips/registry/tripWidgetRegistry';
import { hubWidgetRegistry } from './hubWidgetRegistry';

/**
 * H-ACT §2 — Catalogue central de widgets du hub universel.
 *
 * Source unique de la composition : chaque widget déclare
 *   - les activités compatibles (`activities`)
 *   - les données nécessaires (`requiredData`)
 *   - sa priorité (`priority`)
 *   - sa position (`overview` = bloc de l'aperçu, `sidebar` = colonne droite)
 *   - ses conditions d'affichage (`condition`)
 *   - son action ou sa route (`action`)
 *
 * `hubWidgetRegistry` / `tripWidgetRegistry` restent exposés pour la rétro-
 * compatibilité des tests et de la sidebar existante ; le catalogue central
 * EST la source déclarative qui pilote la composition de l'aperçu par activité.
 */

/** Position de rendu d'un widget. */
export type WidgetPosition = 'overview' | 'sidebar';

/** Clés de données requises par un widget (présence / absence). */
export type DataKey =
  | 'trip.steps'
  | 'trip.items'
  | 'trip.expenses'
  | 'trip.documents'
  | 'trip.notes'
  | 'trip.pois'
  | 'trip.safety'
  | 'route'
  | 'weather'
  | 'budget'
  | 'dates'
  | 'country';

/** Ids des blocs d'aperçu propres aux profils d'activité (position overview). */
export type ActivityBlockId =
  | 'cta-randonnee-active'
  | 'parcours-apercu'
  | 'meteo-rando'
  | 'points-passage'
  | 'points-eau'
  | 'reservations'
  | 'metriques-voyage'
  | 'dettes-groupe'
  | 'journal-apercu'
  | 'groupe-bloc';

/** Id d'un widget du catalogue (bloc d'aperçu OU widget de sidebar existant). */
export type CatalogWidgetId = HubWidgetId | ActivityBlockId;

/** Contexte déclaratif utilisé par les conditions + données requises. */
export interface WidgetConditionContext {
  activity: ActivityType;
  party: 'solo' | 'duo' | 'group';
  hasSteps: boolean;
  hasItems: boolean;
  hasExpenses: boolean;
  hasDocuments: boolean;
  hasNotes: boolean;
  hasPois: boolean;
  hasSafety: boolean;
  hasRoute: boolean;
  hasWeather: boolean;
  hasBudget: boolean;
  hasDates: boolean;
  hasCountry: boolean;
  /** Membres du crew lié (0 = pas de crew, 1 = solo, >1 = collectif). */
  crewMemberCount: number;
  pendingInvites: number;
  /** Points d'eau détectés (POI de l'itinéraire). */
  waterPointsCount: number;
}

export interface WidgetCatalogDef {
  id: CatalogWidgetId;
  label: string;
  activities: ActivityType[] | 'all';
  requiredData: DataKey[];
  priority: number;
  position: WidgetPosition;
  estimatedHeight: number;
  /** Conditions d'affichage supplémentaires (au-delà des données requises). */
  condition: (ctx: WidgetConditionContext) => boolean;
  /** Action ou route — appelé par le rendu du bloc. */
  action?: { label: string };
  phases?: TripPhase[];
}

// ── Vérification des données requises ───────────────────────────────────────

const HAS_DATA: Record<DataKey, (ctx: WidgetConditionContext) => boolean> = {
  'trip.steps': (c) => c.hasSteps,
  'trip.items': (c) => c.hasItems,
  'trip.expenses': (c) => c.hasExpenses,
  'trip.documents': (c) => c.hasDocuments,
  'trip.notes': (c) => c.hasNotes,
  'trip.pois': (c) => c.hasPois,
  'trip.safety': (c) => c.hasSafety,
  route: (c) => c.hasRoute,
  weather: (c) => c.hasWeather,
  budget: (c) => c.hasBudget,
  dates: (c) => c.hasDates,
  country: (c) => c.hasCountry,
};

function widgetApplies(def: WidgetCatalogDef, ctx: WidgetConditionContext): boolean {
  const activityOk = def.activities === 'all' || def.activities.includes(ctx.activity);
  if (!activityOk) return false;
  if (!def.requiredData.every((k) => HAS_DATA[k](ctx))) return false;
  return def.condition(ctx);
}

// ── Catalogue central ───────────────────────────────────────────────────────

const always = () => true;

// ── Widgets de sidebar (déclarés EN RICHISSANT les registres existants) ─────

/** Widgets de sidebar réservés au profil Voyage. */
const TRAVEL_ONLY_SIDEBAR: ReadonlySet<HubWidgetId> = new Set([
  'budget-burn',
  'trip-context',
  'country-card',
  'docs-expiry',
]);

const SIDEBAR_LABELS: Record<string, string> = {
  countdown: 'Compte à rebours',
  'primary-action': 'Action',
  alerts: 'Alertes',
  'next-step': 'Prochaine étape',
  'safety-next': 'Sécurité',
  'kit-balance': 'Équipement',
  'budget-burn': 'Budget',
  'group-presence': 'Équipage',
  'trip-context': 'Contexte',
  'country-card': 'Pays',
  'docs-expiry': 'Documents',
  'offline-toggle': 'Hors-ligne',
  'alertes-materiel': 'Alertes matériel',
  'prochain-depart': 'Prochain départ',
  'stock-apercu': 'Stock',
  'dispo-apercu': 'Prêts',
  'invitations-apercu': 'Invitations',
  'entrer-voyage': 'Voyage',
  'presence-groupe': 'Groupe',
};

/** Données requises par widget de sidebar voyage/randonnée. */
const SIDEBAR_REQUIRED: Partial<Record<HubWidgetId, DataKey[]>> = {
  countdown: ['dates'],
  'next-step': ['trip.steps'],
  'safety-next': ['trip.safety'],
  'kit-balance': ['trip.items'],
  'budget-burn': ['budget'],
  'country-card': ['country'],
  'docs-expiry': ['trip.documents'],
};

const ALL_ACTIVITIES: ActivityType[] = ['travel', 'hiking'];

function sidebarDefsFromRegistries(): WidgetCatalogDef[] {
  const tripDefs: WidgetCatalogDef[] = tripWidgetRegistry.map((w) => ({
    id: w.id,
    label: SIDEBAR_LABELS[w.id] ?? w.id,
    activities: TRAVEL_ONLY_SIDEBAR.has(w.id) ? (['travel'] as ActivityType[]) : ALL_ACTIVITIES,
    requiredData: SIDEBAR_REQUIRED[w.id] ?? [],
    priority: w.priority,
    position: 'sidebar',
    estimatedHeight: w.estimatedHeight,
    condition: always,
    phases: w.phases,
  }));
  // Widgets possession/collectif : leur inclusion est déjà arbitrée par le
  // moteur de profil (nature) — déclarés compatibles toutes activités.
  const hubDefs: WidgetCatalogDef[] = hubWidgetRegistry
    .filter((w) => w.natures.includes('possession') || w.natures.includes('collectif'))
    .map((w) => ({
      id: w.id,
      label: SIDEBAR_LABELS[w.id] ?? w.id,
      activities: ALL_ACTIVITIES,
      requiredData: [],
      priority: w.priority,
      position: 'sidebar',
      estimatedHeight: w.estimatedHeight,
      condition: always,
    }));
  return [...tripDefs, ...hubDefs];
}

export const widgetCatalog: readonly WidgetCatalogDef[] = [
  // ── Widgets de sidebar (rétrocompatibles hubWidgetRegistry/tripWidgetRegistry) ─
  ...sidebarDefsFromRegistries(),

  // ── Blocs d'aperçu Randonnée ─────────────────────────────────────────────
  {
    id: 'cta-randonnee-active',
    label: 'Démarrer la randonnée',
    activities: ['hiking'],
    requiredData: [],
    priority: 100,
    position: 'overview',
    estimatedHeight: 72,
    condition: () => true,
    action: { label: 'Démarrer' },
  },
  {
    id: 'parcours-apercu',
    label: 'Parcours',
    activities: ['hiking'],
    requiredData: ['trip.steps', 'dates'],
    priority: 90,
    position: 'overview',
    estimatedHeight: 150,
    condition: (c) => c.hasSteps || c.hasRoute,
    action: { label: 'Voir l’itinéraire' },
  },
  {
    id: 'meteo-rando',
    label: 'Météo',
    activities: ['hiking'],
    requiredData: ['weather'],
    priority: 84,
    position: 'overview',
    estimatedHeight: 120,
    condition: always,
  },
  {
    id: 'points-passage',
    label: 'Points de passage',
    activities: ['hiking'],
    requiredData: ['trip.pois'],
    priority: 75,
    position: 'overview',
    estimatedHeight: 110,
    condition: (c) => c.hasPois,
  },
  {
    id: 'points-eau',
    label: 'Points d’eau',
    activities: ['hiking'],
    requiredData: ['trip.pois'],
    priority: 70,
    position: 'overview',
    estimatedHeight: 96,
    condition: (c) => c.waterPointsCount > 0,
  },

  // ── Blocs d'aperçu Voyage ────────────────────────────────────────────────
  {
    id: 'metriques-voyage',
    label: 'Métriques vitales',
    activities: ['travel', 'hiking'],
    requiredData: [],
    priority: 96,
    position: 'overview',
    estimatedHeight: 220,
    condition: always,
    action: { label: 'Voir les détails' },
  },
  {
    id: 'reservations',
    label: 'Réservations',
    activities: ['travel'],
    requiredData: ['trip.steps'],
    priority: 80,
    position: 'overview',
    estimatedHeight: 110,
    condition: (c) => c.hasSteps,
  },
  {
    id: 'dettes-groupe',
    label: 'Qui doit quoi',
    activities: 'all',
    requiredData: ['trip.expenses'],
    priority: 66,
    position: 'overview',
    estimatedHeight: 110,
    condition: (c) => c.party !== 'solo',
  },
  {
    id: 'journal-apercu',
    label: 'Journal récent',
    activities: 'all',
    requiredData: ['trip.notes'],
    priority: 62,
    position: 'overview',
    estimatedHeight: 120,
    condition: always,
  },

  // ── Bloc Groupe universel (toutes activités) ─────────────────────────────
  {
    id: 'groupe-bloc',
    label: 'Groupe',
    activities: 'all',
    requiredData: [],
    priority: 60,
    position: 'overview',
    estimatedHeight: 110,
    condition: always,
  },
];

// ── Sélection ───────────────────────────────────────────────────────────────

export interface WidgetSelection {
  overview: WidgetCatalogDef[];
  sidebar: WidgetCatalogDef[];
}

/**
 * Sélectionne les widgets d'un profil d'activité depuis le catalogue central.
 * `profile.widgets` (côté sidebar) et les blocs `overview` sont séparés.
 */
export function selectWidgets(
  ctx: WidgetConditionContext,
  sidebarIds: readonly HubWidgetId[],
): WidgetSelection {
  const overview: WidgetCatalogDef[] = [];
  const sidebar: WidgetCatalogDef[] = [];
  for (const def of widgetCatalog) {
    if (def.position === 'overview') {
      if (widgetApplies(def, ctx)) overview.push(def);
    } else if (sidebarIds.includes(def.id as HubWidgetId)) {
      if (widgetApplies(def, ctx)) sidebar.push(def);
    }
  }
  overview.sort((a, b) => b.priority - a.priority);
  sidebar.sort((a, b) => b.priority - a.priority);
  return { overview, sidebar };
}

/** Définition d'un widget du catalogue par id (undefined si inconnu). */
export function catalogWidgetDef(id: CatalogWidgetId): WidgetCatalogDef | undefined {
  return widgetCatalog.find((w) => w.id === id);
}