import {
  deriveTripProfile,
  type TripSectionId,
  type TripWidgetId,
} from '@/features/trips/engine/tripProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';

/**
 * H1.1 — Moteur de profil d'aventure du hub (chantier H).
 *
 * Fonction PURE : zéro import React, aucun accès window, aucune lecture de
 * l'horloge système — `now` est INJECTÉ (déterminisme des tests et captures).
 * Source de vérité : docs/CHANTIER_H_HUB_VOYAGEUR.md §2.2.
 *
 * RÈGLE D'OR (R2) : la nature `sortie` COMPOSE `deriveTripProfile` — aucune
 * matrice Y n'est recopiée ici. Le champ `reason` trace la décision pour
 * chaque section (affiché par le HubSectionPicker, H2).
 * Les permissions ne filtrent PAS ici : elles filtrent à l'affichage.
 */

export type AdventureNature = 'possession' | 'sortie' | 'collectif';

export type PossessionSectionId =
  | 'inventaire'
  | 'kit'
  | 'preparation'
  | 'depart'
  | 'disponibilite'
  | 'alertes';

export type CollectifSectionId = 'groupe' | 'invitations' | 'voyages-lies';

/** Union des 3 natures — les ids Y sont réutilisés tels quels (composition). */
export type HubSectionId = PossessionSectionId | CollectifSectionId | TripSectionId;

export type PossessionWidgetId =
  | 'stock-apercu'
  | 'alertes-materiel'
  | 'dispo-apercu'
  | 'prochain-depart';

export type CollectifWidgetId =
  | 'invitations-apercu'
  | 'presence-groupe'
  | 'entrer-voyage';

/** Les ids de widgets Y sont réutilisés tels quels pour sortie (composition). */
export type HubWidgetId = TripWidgetId | PossessionWidgetId | CollectifWidgetId;

export interface AdventureProfile {
  nature: AdventureNature;
  /** null si possession ou collectif (pas d'échelle datée). */
  scale: 'day' | 'short' | 'long' | 'expedition' | null;
  party: 'solo' | 'duo' | 'group';
  density: 'compact' | 'comfortable';
  sections: HubSectionId[];
  widgets: HubWidgetId[];
  reason: Record<HubSectionId, string>;
}

/** Ordre canonique du hub (registre §H1) — par nature, dans l'ordre d'usage. */
export const HUB_SECTION_ORDER: HubSectionId[] = [
  'inventaire',
  'kit',
  'preparation',
  'depart',
  'disponibilite',
  'alertes',
  'overview',
  'itinerary',
  'gear',
  'team',
  'budget',
  'docs',
  'checklist',
  'safety',
  'journal',
  'export',
  'groupe',
  'invitations',
  'voyages-lies',
];

export type HubAdventureInput =
  | {
      kind: 'possession';
      itemsCount: number;
      loansCount: number;
      alertsCount: number;
      hasDepartEnCours: boolean;
      enabledSections?: HubSectionId[];
    }
  | { kind: 'sortie'; trip: TripFull; enabledSections?: HubSectionId[] }
  | {
      kind: 'collectif';
      membersCount: number;
      pendingInvites: number;
      linkedTripsCount: number;
      hasLinkedTrip: boolean;
      enabledSections?: HubSectionId[];
    };

// ── Widgets possession/collectif (priorités §H1) ─────────────────────────────

interface HubWidgetRule<T extends PossessionWidgetId | CollectifWidgetId> {
  id: T;
  priority: number;
}

const POSSESSION_WIDGETS: HubWidgetRule<PossessionWidgetId>[] = [
  { id: 'alertes-materiel', priority: 90 },
  { id: 'prochain-depart', priority: 85 },
  { id: 'stock-apercu', priority: 70 },
  { id: 'dispo-apercu', priority: 60 },
];

const COLLECTIF_WIDGETS: HubWidgetRule<CollectifWidgetId>[] = [
  { id: 'invitations-apercu', priority: 90 },
  { id: 'entrer-voyage', priority: 88 },
  { id: 'presence-groupe', priority: 75 },
];

// ── Moteur ───────────────────────────────────────────────────────────────────

function sortByRegistry(sections: HubSectionId[]): HubSectionId[] {
  const rank = new Map<HubSectionId, number>(HUB_SECTION_ORDER.map((id, i) => [id, i]));
  return [...new Set(sections)].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
}

/** Fusionne les sections activées manuellement (HubSectionPicker, jamais verrouillé). */
function withUserEnabled(
  sections: HubSectionId[],
  enabledSections: HubSectionId[] | undefined,
): HubSectionId[] {
  return mergeEnabledSections(sections, enabledSections);
}

function fullReason(
  sections: HubSectionId[],
  userEnabled: HubSectionId[] | undefined,
  explain: (id: HubSectionId, shown: boolean) => string,
): Record<HubSectionId, string> {
  const shown = new Set<HubSectionId>(sections);
  const reason = {} as Record<HubSectionId, string>;
  for (const id of HUB_SECTION_ORDER) {
    if ((userEnabled ?? []).includes(id)) {
      reason[id] = 'affiché : activé manuellement (HubSectionPicker)';
    } else {
      reason[id] = explain(id, shown.has(id));
    }
  }
  return reason;
}

function derivePossession(input: Extract<HubAdventureInput, { kind: 'possession' }>): AdventureProfile {
  const sections: HubSectionId[] = ['inventaire', 'kit'];
  if (input.itemsCount > 0) sections.push('preparation');
  if (input.hasDepartEnCours) sections.push('depart');
  if (input.loansCount > 0) sections.push('disponibilite');
  if (input.alertsCount > 0) sections.push('alertes');

  const finalSections = withUserEnabled(sections, input.enabledSections);

  const widgetIncluded = (id: PossessionWidgetId): boolean => {
    switch (id) {
      case 'stock-apercu':
        return true;
      case 'alertes-materiel':
        return input.alertsCount > 0;
      case 'dispo-apercu':
        return input.loansCount > 0;
      case 'prochain-depart':
        return input.hasDepartEnCours;
    }
  };
  const widgets: HubWidgetId[] = POSSESSION_WIDGETS.filter((w) => widgetIncluded(w.id))
    .sort((a, b) => b.priority - a.priority)
    .map((w) => w.id);

  const shownReasons: Record<string, string> = {
    inventaire: 'affiché : source patrimoniale (/materiel)',
    kit: 'affiché : kits de l’inventaire',
    preparation: `affiché : ${input.itemsCount} objet(s) à préparer`,
    depart: 'affiché : départ en cours',
    disponibilite: `affiché : ${input.loansCount} prêt(s) en cours`,
    alertes: `affiché : ${input.alertsCount} alerte(s) matériel`,
  };
  const maskedReasons: Record<string, string> = {
    preparation: 'masqué : aucun objet dans l’inventaire',
    depart: 'masqué : aucun départ en cours',
    disponibilite: 'masqué : aucun prêt en cours',
    alertes: 'masqué : aucune alerte matériel',
  };
  const reason = fullReason(finalSections, input.enabledSections, (id, shown) =>
    shown
      ? (shownReasons[id] ?? `affiché : ${id}`)
      : (maskedReasons[id] ?? `masqué : nature possession (pas d’itinéraire ni de budget)`),
  );

  return {
    nature: 'possession',
    scale: null,
    party: 'solo',
    density: 'comfortable',
    sections: finalSections,
    widgets,
    reason,
  };
}

function deriveSortie(
  input: Extract<HubAdventureInput, { kind: 'sortie' }>,
  now: Date,
): AdventureProfile {
  // COMPOSITION — le moteur Y décide, le hub transmet (R2 : zéro duplication).
  const trip = deriveTripProfile(input.trip, now);
  // Miroir Y2.4 : un voyage annulé ignore les sections manuelles (aperçu seul).
  const cancelled = input.trip.status === 'cancelled';
  const effectiveEnabled = cancelled ? undefined : input.enabledSections;
  const finalSections = withUserEnabled([...trip.sections], effectiveEnabled);

  const reason = fullReason(finalSections, effectiveEnabled, (id, shown) => {
    if (cancelled && id !== 'overview') {
      return 'masqué : voyage annulé (aperçu seul)';
    }
    if (id === 'overview' && (trip.sections as HubSectionId[]).includes('overview')) {
      return 'affiché : nature sortie (composition tripProfileEngine, zéro duplication)';
    }
    if (shown) return (trip.reason as Record<string, string>)[id] ?? `affiché : ${id}`;
    return (trip.reason as Record<string, string>)[id] ?? 'masqué : profil sortie';
  });

  return {
    nature: 'sortie',
    scale: trip.scale,
    party: trip.party,
    density: trip.density,
    sections: finalSections,
    widgets: [...trip.widgets],
    reason,
  };
}

function deriveCollectif(input: Extract<HubAdventureInput, { kind: 'collectif' }>): AdventureProfile {
  const sections: HubSectionId[] = ['groupe'];
  if (input.pendingInvites > 0) sections.push('invitations');
  if (input.linkedTripsCount > 0) sections.push('voyages-lies');

  const finalSections = withUserEnabled(sections, input.enabledSections);

  const party = input.membersCount <= 1 ? 'solo' : input.membersCount === 2 ? 'duo' : 'group';

  const widgetIncluded = (id: CollectifWidgetId): boolean => {
    switch (id) {
      case 'presence-groupe':
        return true;
      case 'invitations-apercu':
        return input.pendingInvites > 0;
      case 'entrer-voyage':
        return input.hasLinkedTrip;
    }
  };
  const widgets: HubWidgetId[] = COLLECTIF_WIDGETS.filter((w) => widgetIncluded(w.id))
    .sort((a, b) => b.priority - a.priority)
    .map((w) => w.id);

  const shownReasons: Record<string, string> = {
    groupe: `affiché : ${input.membersCount} membre(s), rôles et invitations`,
    invitations: `affiché : ${input.pendingInvites} invitation(s) en attente`,
    'voyages-lies': `affiché : ${input.linkedTripsCount} voyage(s) lié(s)${input.hasLinkedTrip ? ' — bouton « entrer dans le voyage »' : ''}`,
  };
  const reason = fullReason(finalSections, input.enabledSections, (id, shown) =>
    shown ? (shownReasons[id] ?? `affiché : ${id}`) : 'masqué : nature collectif',
  );

  return {
    nature: 'collectif',
    scale: null,
    party,
    density: 'comfortable',
    sections: finalSections,
    widgets,
    reason,
  };
}

/** Fusionne base serveur + customs locaux dans l'ordre du registre (client HubShell). */
export function mergeEnabledSections(
  base: HubSectionId[],
  customs: HubSectionId[] | undefined,
): HubSectionId[] {
  if (!customs) return sortByRegistry(base);
  const merged = [...base];
  for (const s of customs) {
    if (HUB_SECTION_ORDER.includes(s) && !merged.includes(s)) merged.push(s);
  }
  return sortByRegistry(merged);
}

export function deriveHubProfile(input: HubAdventureInput, now: Date): AdventureProfile {
  switch (input.kind) {
    case 'possession':
      return derivePossession(input);
    case 'sortie':
      return deriveSortie(input, now);
    case 'collectif':
      return deriveCollectif(input);
    default:
      throw new Error(`Nature d'aventure inconnue : ${(input as { kind: string }).kind}`);
  }
}
