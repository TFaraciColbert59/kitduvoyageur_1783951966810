
import {
  HUB_SECTION_ORDER,
  type AdventureNature,
  type AdventureProfile,
  type HubSectionId,
} from '../engine/hubProfileEngine';
import { lkdvIcon, type LKDVIconComponent } from '@/components/ui/lkdvIconComponent';

/**
 * H1.2 — Registre des sections du hub voyageur (source unique de navigation).
 * HubShell, AdventureSwitcher, HubSectionPicker, fil d'Ariane et tests lisent
 * TOUS ce registre. Aucun littéral /hub/ hors d'ici (règle H-D85 n°13).
 *
 * Étape 2 — Hub unique : les sections sortie sont rendues DANS le hub.
 * `/hub/<segment>` est l'URL canonique pour toutes les natures ; les anciennes
 * routes /voyages/* redirigent vers ces sections (hubRedirects).
 */

/** Compteurs affichés dans la navigation (champs tous optionnels — jamais de throw). */
export interface HubCounters {
  items?: number;
  loans?: number;
  alerts?: number;
  steps?: number;
  tripItems?: number;
  collaborators?: number;
  expenses?: number;
  documents?: number;
  unpacked?: number;
  checklistPending?: number;
  pendingSafety?: number;
  notes?: number;
  members?: number;
  invites?: number;
  linkedTrips?: number;
  pois?: number;
  reservations?: number;
}

export interface HubSectionDef {
  id: HubSectionId;
  label: string;
  /** Segment d'URL sous /hub — '' = racine (overview sortie seulement). */
  segment: string;
  icon: LKDVIconComponent;
  natures: AdventureNature[];
  /** Natures pour lesquelles la section est cœur (non désactivable). */
  coreNatures: AdventureNature[];
  /** Compteur affiché dans la navigation (null = pas de compteur). */
  counter: (data: Partial<HubCounters>) => number | null;
}

const num = (v: number | undefined): number | null =>
  typeof v === 'number' && v >= 0 ? v : null;

export const hubSectionRegistry: readonly HubSectionDef[] = [
  { id: 'inventaire', label: 'Inventaire', segment: 'inventaire', icon: lkdvIcon('inventaire'), natures: ['possession'], coreNatures: ['possession'], counter: (d) => num(d.items) },
  { id: 'kit', label: 'Kits', segment: 'kit', icon: lkdvIcon('sac'), natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'preparation', label: 'Préparation', segment: 'preparation', icon: lkdvIcon('recentrer'), natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'depart', label: 'Départ', segment: 'depart', icon: lkdvIcon('randonnee'), natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'disponibilite', label: 'Disponibilité', segment: 'disponibilite', icon: lkdvIcon('calendrier'), natures: ['possession'], coreNatures: [], counter: (d) => num(d.loans) },
  { id: 'alertes', label: 'Alertes', segment: 'alertes', icon: lkdvIcon('notifications'), natures: ['possession'], coreNatures: [], counter: (d) => num(d.alerts) },
  { id: 'oublis', label: 'À ne pas oublier', segment: 'oublis', icon: lkdvIcon('checklist_voyage'), natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'overview', label: 'Aperçu', segment: '', icon: lkdvIcon('boussole'), natures: ['sortie'], coreNatures: ['sortie'], counter: () => null },
  { id: 'itinerary', label: 'Itinéraire', segment: 'itineraire', icon: lkdvIcon('gps'), natures: ['sortie'], coreNatures: [], counter: (d) => num(d.steps) },
  { id: 'gear', label: 'Équipement', segment: 'kit-voyage', icon: lkdvIcon('inventaire'), natures: ['sortie'], coreNatures: [], counter: (d) => num(d.tripItems) },
  { id: 'groupe', label: 'Groupe', segment: 'groupe', icon: lkdvIcon('communaute'), natures: ['sortie', 'collectif'], coreNatures: ['collectif'], counter: (d) => num(d.collaborators ?? d.members) },
  { id: 'budget', label: 'Budget', segment: 'budget', icon: lkdvIcon('paiement'), natures: ['sortie'], coreNatures: [], counter: (d) => num(d.expenses) },
  { id: 'docs', label: 'Documents', segment: 'documents', icon: lkdvIcon('facture'), natures: ['sortie'], coreNatures: [], counter: (d) => num(d.documents) },
  { id: 'checklist', label: 'Checklist', segment: 'checklist', icon: lkdvIcon('checklist'), natures: ['sortie'], coreNatures: [], counter: (d) => num(d.checklistPending) },
  { id: 'safety', label: 'Sécurité', segment: 'securite', icon: lkdvIcon('securite'), natures: ['sortie'], coreNatures: ['sortie'], counter: (d) => num(d.pendingSafety) },
  { id: 'journal', label: 'Journal', segment: 'journal', icon: lkdvIcon('preparateur'), natures: ['sortie'], coreNatures: [], counter: (d) => num(d.notes) },
  { id: 'export', label: 'Export', segment: 'export', icon: lkdvIcon('partager'), natures: ['sortie'], coreNatures: [], counter: () => null },
  { id: 'invitations', label: 'Invitations', segment: 'invitations', icon: lkdvIcon('email'), natures: ['collectif'], coreNatures: [], counter: (d) => num(d.invites) },
  { id: 'voyages-lies', label: 'Voyages liés', segment: 'voyages', icon: lkdvIcon('carte'), natures: ['collectif'], coreNatures: [], counter: (d) => num(d.linkedTrips) },
] as const;

export interface HubAdventureRef {
  nature: AdventureNature;
  /** Slug du voyage — requis pour la nature sortie (délégation registre voyage). */
  slug?: string;
}

/** Constructeur d'URL typé — LE seul point du code qui écrit /hub/. */
export function hubSectionHref(adventure: HubAdventureRef, sectionId: HubSectionId): string {
  const def = hubSectionRegistry.find((s) => s.id === sectionId);
  if (!def) throw new Error(`Section hub inconnue : ${sectionId}`);
  if (!def.natures.includes(adventure.nature)) {
    throw new Error(`Section ${sectionId} incompatible avec la nature ${adventure.nature}`);
  }
  if (adventure.nature === 'sortie') {
    if (!adventure.slug) throw new Error('hubSectionHref sortie requiert un slug de voyage');
  }
  return def.segment ? `/hub/${def.segment}` : '/hub';
}

/**
 * Une section peut-elle s'ouvrir sous cette aventure active ? Les sections « possession »
 * (inventaire, kits, prêts, alertes…) sont des surfaces PERSONNELLES, indépendantes de
 * l'aventure : elles s'ouvrent quelle que soit la nature active (sinon /materiel et les
 * redirections héritées menaient à un 404 dès qu'une sortie était active — constat K-002).
 * Les autres sections restent propres à leurs natures.
 */
export function isHubSectionServable(def: HubSectionDef, nature: AdventureNature): boolean {
  return def.natures.includes(nature) || def.natures.includes('possession');
}

/** Retrouve la section active depuis un pathname (état actif du shell). */
export function hubSectionFromPathname(pathname: string | null): HubSectionId | null {
  if (!pathname) return null;
  const clean = pathname.split(/[?#]/)[0];
  const match = clean.match(/^\/hub(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  const segment = match[1] ?? '';
  if (!segment) return null;
  const def = hubSectionRegistry.find((s) => s.segment === segment);
  return def?.id ?? null;
}

/** Sections visibles pour un profil donné, dans l'ordre du registre. */
export function visibleHubSections(profile: AdventureProfile): HubSectionDef[] {
  const shown = new Set<HubSectionId>(profile.sections);
  return hubSectionRegistry.filter((s) => shown.has(s.id));
}

/**
 * H5 — Lien statique vers les alertes du hub (hamburger mobile).
 * Calculé par le registre (R13 : aucun littéral /hub/ ailleurs).
 */
export const HUB_ALERTES_HREF = hubSectionHref({ nature: 'possession' }, 'alertes');

/** H5 — Idem pour le départ (défauts du store, R13). */
export const HUB_DEPART_HREF = hubSectionHref({ nature: 'possession' }, 'depart');

/** H5 — Entrée du wizard de création (bouton « Nouvelle activité », R13). */
export const HUB_NEW_HREF = '/compas?nouvelle=1';
/** Mode Génération IA de la création (suite autoGen). */
export const HUB_NEW_IA_HREF = '/compas?nouvelle=1';
/** Racine du hub = MENU de cartes-onglets (retour depuis n'importe quelle section). */
export const HUB_HOME_HREF = '/hub';

/** H5 — Liens statiques d'aperçu matériel (overviews, R13/R14 : zéro littéral hors registre). */
export const HUB_POSSESSION_HREFS = {
  inventaire: hubSectionHref({ nature: 'possession' }, 'inventaire'),
  disponibilite: hubSectionHref({ nature: 'possession' }, 'disponibilite'),
  alertes: HUB_ALERTES_HREF,
} as const;

/** H5 — Lien statique « voyages liés » d'aperçu collectif (overviews, R13/R14). */
export const HUB_COLLECTIF_HREFS = {
  voyagesLies: hubSectionHref({ nature: 'collectif' }, 'voyages-lies'),
} as const;

export { HUB_SECTION_ORDER };
