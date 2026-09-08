import {
  Backpack,
  BellRing,
  BookOpen,
  CalendarCheck,
  CheckSquare,
  Compass,
  CreditCard,
  FileText,
  FlaskConical,
  Footprints,
  MailPlus,
  Map as MapIcon,
  Navigation,
  Package,
  Share2,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import {
  HUB_SECTION_ORDER,
  type AdventureNature,
  type AdventureProfile,
  type HubSectionId,
} from '../engine/hubProfileEngine';

/**
 * H1.2 — Registre des sections du hub voyageur (source unique de navigation).
 * HubShell, AdventureSwitcher, HubSectionPicker, fil d'Ariane et tests lisent
 * TOUS ce registre. Aucun littéral /hub/ hors d'ici (règle H-D85 n°13).
 *
 * Composition : les sections sortie DÉLÈGUENT à `tripSectionHref` (zéro
 * duplication des segments voyage). `team` est partagée sortie+collectif.
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
  pendingSafety?: number;
  notes?: number;
  members?: number;
  invites?: number;
  linkedTrips?: number;
}

export interface HubSectionDef {
  id: HubSectionId;
  label: string;
  /** Segment d'URL sous /hub — '' = racine (overview sortie seulement). */
  segment: string;
  icon: LucideIcon;
  natures: AdventureNature[];
  /** Natures pour lesquelles la section est cœur (non désactivable). */
  coreNatures: AdventureNature[];
  /** Compteur affiché dans la navigation (null = pas de compteur). */
  counter: (data: Partial<HubCounters>) => number | null;
}

const num = (v: number | undefined): number | null =>
  typeof v === 'number' && v >= 0 ? v : null;

export const hubSectionRegistry: readonly HubSectionDef[] = [
  { id: 'inventaire', label: 'Inventaire', segment: 'inventaire', icon: Package, natures: ['possession'], coreNatures: ['possession'], counter: (d) => num(d.items) },
  { id: 'kit', label: 'Kits', segment: 'kit', icon: Backpack, natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'preparation', label: 'Préparation', segment: 'preparation', icon: FlaskConical, natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'depart', label: 'Départ', segment: 'depart', icon: Footprints, natures: ['possession'], coreNatures: [], counter: () => null },
  { id: 'disponibilite', label: 'Disponibilité', segment: 'disponibilite', icon: CalendarCheck, natures: ['possession'], coreNatures: [], counter: (d) => num(d.loans) },
  { id: 'alertes', label: 'Alertes', segment: 'alertes', icon: BellRing, natures: ['possession'], coreNatures: [], counter: (d) => num(d.alerts) },
  { id: 'overview', label: 'Aperçu', segment: '', icon: Compass, natures: ['sortie'], coreNatures: ['sortie'], counter: () => null },
  { id: 'itinerary', label: 'Itinéraire', segment: 'itineraire', icon: Navigation, natures: ['sortie'], coreNatures: [], counter: (d) => num(d.steps) },
  { id: 'gear', label: 'Équipement', segment: 'kit-voyage', icon: Package, natures: ['sortie'], coreNatures: [], counter: (d) => num(d.tripItems) },
  { id: 'team', label: 'Équipage', segment: 'equipage', icon: Users, natures: ['sortie', 'collectif'], coreNatures: [], counter: (d) => num(d.collaborators ?? d.members) },
  { id: 'budget', label: 'Budget', segment: 'budget', icon: CreditCard, natures: ['sortie'], coreNatures: [], counter: (d) => num(d.expenses) },
  { id: 'docs', label: 'Documents', segment: 'documents', icon: FileText, natures: ['sortie'], coreNatures: [], counter: (d) => num(d.documents) },
  { id: 'checklist', label: 'Checklist', segment: 'checklist', icon: CheckSquare, natures: ['sortie'], coreNatures: [], counter: (d) => num(d.unpacked) },
  { id: 'safety', label: 'Sécurité', segment: 'securite', icon: Shield, natures: ['sortie'], coreNatures: ['sortie'], counter: (d) => num(d.pendingSafety) },
  { id: 'journal', label: 'Journal', segment: 'journal', icon: BookOpen, natures: ['sortie'], coreNatures: [], counter: (d) => num(d.notes) },
  { id: 'export', label: 'Export', segment: 'export', icon: Share2, natures: ['sortie'], coreNatures: [], counter: () => null },
  { id: 'groupe', label: 'Groupe', segment: 'groupe', icon: Users, natures: ['collectif'], coreNatures: ['collectif'], counter: (d) => num(d.members) },
  { id: 'invitations', label: 'Invitations', segment: 'invitations', icon: MailPlus, natures: ['collectif'], coreNatures: [], counter: (d) => num(d.invites) },
  { id: 'voyages-lies', label: 'Voyages liés', segment: 'voyages', icon: MapIcon, natures: ['collectif'], coreNatures: [], counter: (d) => num(d.linkedTrips) },
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
    return tripSectionHref(adventure.slug, sectionId as Parameters<typeof tripSectionHref>[1]);
  }
  return def.segment ? `/hub/${def.segment}` : '/hub';
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

export { HUB_SECTION_ORDER };
