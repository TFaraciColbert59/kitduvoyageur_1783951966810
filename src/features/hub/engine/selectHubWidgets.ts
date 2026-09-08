import {
  hubWidgetRegistry,
  HUB_WIDGET_COLUMN_MAX_HEIGHT,
  type HubWidgetDef,
} from '../registry/hubWidgetRegistry';
import type { AdventureProfile } from './hubProfileEngine';

/**
 * H4.1 — Sélection des widgets du hub (extraction pure de HubSidebarRight).
 * Filtre nature + profil, trie par priorité décroissante, replie au-delà de
 * la limite de hauteur (contrainte Y : 2 × fenêtre 1440×900).
 */
export interface HubWidgetSelection {
  shown: HubWidgetDef[];
  folded: number;
}

export function selectHubWidgets(profile: AdventureProfile): HubWidgetSelection {
  const kept = hubWidgetRegistry
    .filter((w) => w.natures.includes(profile.nature) && profile.widgets.includes(w.id))
    .sort((a, b) => b.priority - a.priority);

  const shown: HubWidgetDef[] = [];
  let used = 0;
  for (const w of kept) {
    if (used + w.estimatedHeight > HUB_WIDGET_COLUMN_MAX_HEIGHT) break;
    shown.push(w);
    used += w.estimatedHeight;
  }
  return { shown, folded: kept.length - shown.length };
}
