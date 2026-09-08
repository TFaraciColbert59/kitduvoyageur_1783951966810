import { tripWidgetRegistry } from '@/features/trips/registry/tripWidgetRegistry';
import type { AdventureNature, HubWidgetId } from '../engine/hubProfileEngine';

/**
 * H1.2 — Registre des widgets du hub (source unique).
 * La colonne droite du HubShell lit ce registre, filtre par nature + profil
 * (les widgets retenus par deriveHubProfile), ordonne par priorité.
 * Contrainte Y : somme des hauteurs par nature ≤ 2 × fenêtre 1440×900.
 *
 * Composition : les 12 widgets sortie sont IMPORTÉS du tripWidgetRegistry
 * (mêmes ids, mêmes priorités, mêmes hauteurs — jamais recopiés).
 */

export interface HubWidgetDef {
  id: HubWidgetId;
  priority: number;
  /** Hauteur rendue estimée en px, pour le test de repli. */
  estimatedHeight: number;
  natures: AdventureNature[];
}

const HUB_OWN_WIDGETS: readonly HubWidgetDef[] = [
  { id: 'alertes-materiel', priority: 90, estimatedHeight: 96, natures: ['possession'] },
  { id: 'prochain-depart', priority: 85, estimatedHeight: 72, natures: ['possession'] },
  { id: 'stock-apercu', priority: 70, estimatedHeight: 110, natures: ['possession'] },
  { id: 'dispo-apercu', priority: 60, estimatedHeight: 96, natures: ['possession'] },
  { id: 'invitations-apercu', priority: 90, estimatedHeight: 96, natures: ['collectif'] },
  { id: 'entrer-voyage', priority: 88, estimatedHeight: 72, natures: ['collectif'] },
  { id: 'presence-groupe', priority: 75, estimatedHeight: 110, natures: ['collectif'] },
];

export const hubWidgetRegistry: readonly HubWidgetDef[] = [
  ...HUB_OWN_WIDGETS,
  ...tripWidgetRegistry.map((w) => ({
    id: w.id as HubWidgetId,
    priority: w.priority,
    estimatedHeight: w.estimatedHeight,
    natures: ['sortie'] as AdventureNature[],
  })),
] as const;

/** Limite de hauteur avant repli (contrainte Y : 2 × fenêtre 1440×900). */
export const HUB_WIDGET_COLUMN_MAX_HEIGHT = 2 * 900;

export function hubWidgetDef(id: HubWidgetId): HubWidgetDef | undefined {
  return hubWidgetRegistry.find((w) => w.id === id);
}

/** Widgets d'une nature, triés par priorité décroissante. */
export function hubWidgetsForNature(nature: AdventureNature): HubWidgetId[] {
  return hubWidgetRegistry
    .filter((w) => w.natures.includes(nature))
    .sort((a, b) => b.priority - a.priority)
    .map((w) => w.id);
}

/** Somme des hauteurs estimées d'une liste de widgets. */
export function hubEstimatedHeight(ids: readonly HubWidgetId[]): number {
  return ids.reduce((sum, id) => sum + (hubWidgetDef(id)?.estimatedHeight ?? 0), 0);
}
