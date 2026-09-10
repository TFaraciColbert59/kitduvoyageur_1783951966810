import type { LucideIcon } from 'lucide-react';
import {
  Backpack,
  BellRing,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CloudOff,
  CloudSun,
  Compass,
  CreditCard,
  FileText,
  FlaskConical,
  Footprints,
  LayoutGrid,
  MailPlus,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Route,
  Share2,
  Shield,
  TrendingUp,
  Users,
  Vote,
  Wallet,
} from 'lucide-react';
import {
  HUB_HOME_HREF,
  hubSectionHref,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import { tripSwitchHref } from '@/features/trips/registry/tripSectionRegistry';
import { getCanonicalTripSteps } from '@/features/trips/hooks/useTripCounters';
import { getTripDistance } from '@/features/trips/hooks/useTripDistance';
import type {
  Trip,
  TripFull,
  TripNote,
  TripPoi,
  TripSafetyCheckpoint,
  TripStats,
  TripStep,
} from '@/features/trips/types/trip.types';
import type { TripPhase } from '@/features/trips/engine/temporalPhaseEngine';
import { weatherLabel } from '@/features/materiel/services/getWeather';
import type { HubHikingContext } from '../server/getHubAdventureData';
import type { MaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import type { GroupeMenuSummary } from '../server/getGroupeMenu';

export interface MobileSectionTile {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | null;
  accent?: boolean;
}

export interface MobileInfoChip {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: 'default' | 'warn' | 'accent';
  href?: string | null;
}

export interface SortieMetrics {
  stepsCount: number;
  totalKm: number;
  dPlus: number;
  packedPct: number;
  readyItems: number;
  totalItems: number;
}

export interface SortieContext {
  phase: TripPhase;
  dayIndex: number | null;
  totalDays: number | null;
  daysUntil: number | null;
}

export interface SortieSectionBadges {
  steps?: number | null;
  packedPct?: number | null;
  team?: number | null;
  docs?: number | null;
  checklistLabel?: string | null;
  safetyPending?: number | null;
  notes?: number | null;
  budgetLabel?: string | null;
}

const SORTIE_PHASE_ORDER: Record<TripPhase, string[]> = {
  prepare: ['itinerary', 'gear', 'budget', 'groupe', 'checklist', 'docs', 'safety', 'journal', 'context'],
  live: ['cockpit', 'safety', 'itinerary', 'gear', 'journal', 'groupe', 'budget', 'checklist', 'docs', 'context'],
  recount: ['raconter', 'context', 'itinerary', 'gear', 'journal', 'groupe', 'budget', 'checklist', 'docs', 'safety'],
};

function sortieTile(
  key: string,
  ref: HubAdventureRef,
  badges: SortieSectionBadges,
): MobileSectionTile | null {
  const num = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? String(v) : null);
  switch (key) {
    case 'cockpit':
      return {
        key,
        label: 'Cockpit terrain',
        href: `${HUB_HOME_HREF}?phase=live`,
        icon: Compass,
        accent: true,
      };
    case 'raconter':
      return {
        key,
        label: 'Raconter',
        href: `${HUB_HOME_HREF}?phase=recount`,
        icon: Share2,
        accent: true,
      };
    case 'context':
      return {
        key,
        label: 'Contexte',
        href: hubSectionHref(ref, 'overview'),
        icon: LayoutGrid,
      };
    case 'itinerary':
      return {
        key,
        label: 'Itinéraire',
        href: hubSectionHref(ref, 'itinerary'),
        icon: Navigation,
        badge: num(badges.steps),
      };
    case 'gear':
      return {
        key,
        label: 'Équipement',
        href: hubSectionHref(ref, 'gear'),
        icon: Package,
        badge: typeof badges.packedPct === 'number' ? `${badges.packedPct}%` : null,
      };
    case 'budget':
      return {
        key,
        label: 'Budget',
        href: hubSectionHref(ref, 'budget'),
        icon: CreditCard,
        badge: badges.budgetLabel ?? null,
      };
    case 'groupe':
      return {
        key,
        label: 'Groupe',
        href: hubSectionHref(ref, 'groupe'),
        icon: Users,
        badge: num(badges.team),
      };
    case 'checklist':
      return {
        key,
        label: 'Checklist',
        href: hubSectionHref(ref, 'checklist'),
        icon: CheckSquare,
        badge: badges.checklistLabel ?? null,
      };
    case 'docs':
      return {
        key,
        label: 'Documents',
        href: hubSectionHref(ref, 'docs'),
        icon: FileText,
        badge: num(badges.docs),
      };
    case 'safety':
      return {
        key,
        label: 'Sécurité',
        href: hubSectionHref(ref, 'safety'),
        icon: Shield,
        badge: num(badges.safetyPending),
      };
    case 'journal':
      return {
        key,
        label: 'Journal',
        href: hubSectionHref(ref, 'journal'),
        icon: BookOpen,
        badge: num(badges.notes),
      };
    default:
      return null;
  }
}

export function buildSortieSectionTiles(
  ref: HubAdventureRef,
  phase: TripPhase,
  badges: SortieSectionBadges = {},
): MobileSectionTile[] {
  return SORTIE_PHASE_ORDER[phase]
    .map((key) => sortieTile(key, ref, badges))
    .filter((t): t is MobileSectionTile => t !== null);
}

export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '0';
  const rounded = km >= 100 ? Math.round(km) : Math.round(km * 10) / 10;
  return String(rounded).replace('.', ',');
}

export function formatEuro(amount: number): string {
  if (!Number.isFinite(amount)) return '0 €';
  return `${Math.round(amount).toLocaleString('fr-FR')} €`;
}

export function pluralize(count: number, singular: string, pluralForm?: string): string {
  const form = count > 1 ? (pluralForm ?? `${singular}s`) : singular;
  return `${count} ${form}`;
}

export function daysUntilFrom(dateIso: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateIso) return null;
  const target = civilDate(dateIso);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round(diff / 86400000);
}

export function buildSortieInfoChips(args: {
  trip: Trip;
  ref: HubAdventureRef;
  stats: TripStats;
  hiking?: HubHikingContext | null;
  context: SortieContext;
  metrics: SortieMetrics;
}): MobileInfoChip[] {
  const { trip, ref, stats, hiking, context, metrics } = args;
  const chips: MobileInfoChip[] = [];
  const overviewHref = hubSectionHref(ref, 'overview');
  const itineraryHref = hubSectionHref(ref, 'itinerary');

  const current = hiking?.weather?.current ?? null;
  if (current) {
    chips.push({
      key: 'weather',
      icon: CloudSun,
      value: `${Math.round(current.tempC)}°C`,
      label: weatherLabel(current.weathercode),
      href: overviewHref,
    });
  } else {
    chips.push({
      key: 'weather',
      icon: CloudOff,
      value: '—',
      label: 'Météo indisponible',
      href: overviewHref,
    });
  }

  if (trip.destination_name) {
    chips.push({
      key: 'place',
      icon: MapPin,
      value: trip.destination_name,
      label: 'Lieu',
      href: overviewHref,
    });
  }

  if (context.phase === 'prepare') {
    chips.push({
      key: 'countdown',
      icon: CalendarDays,
      value: context.daysUntil != null ? `J-${context.daysUntil}` : '—',
      label: 'Départ',
      tone: context.daysUntil != null && context.daysUntil > 0 && context.daysUntil <= 7 ? 'accent' : 'default',
      href: itineraryHref,
    });
  } else if (context.phase === 'live') {
    chips.push({
      key: 'countdown',
      icon: CalendarDays,
      value: `Jour ${context.dayIndex ?? 1}`,
      label: context.totalDays ? `sur ${context.totalDays}` : 'en cours',
      href: `${HUB_HOME_HREF}?phase=live`,
    });
  } else {
    chips.push({
      key: 'countdown',
      icon: CalendarDays,
      value: 'Terminé',
      label: context.totalDays ? `${context.totalDays} jours` : 'Bilan',
      href: `${HUB_HOME_HREF}?phase=recount`,
    });
  }

  chips.push({
    key: 'distance',
    icon: Route,
    value: metrics.totalKm > 0 ? `${formatKm(metrics.totalKm)} km` : '—',
    label: 'Distance',
    href: itineraryHref,
  });
  chips.push({
    key: 'steps',
    icon: Footprints,
    value: String(metrics.stepsCount),
    label: 'Étapes',
    href: itineraryHref,
  });
  if (metrics.dPlus > 0) {
    chips.push({
      key: 'elevation',
      icon: TrendingUp,
      value: `+${metrics.dPlus.toLocaleString('fr-FR')} m`,
      label: 'Dénivelé',
      href: itineraryHref,
    });
  }
  chips.push({
    key: 'budget',
    icon: Wallet,
    value: formatEuro(stats.total_spent),
    label: stats.estimated_budget > 0 ? `sur ${formatEuro(stats.estimated_budget)}` : 'Dépensé',
    href: hubSectionHref(ref, 'budget'),
  });
  chips.push({
    key: 'kit',
    icon: Backpack,
    value: `${metrics.packedPct}%`,
    label: metrics.totalItems > 0 ? `${metrics.readyItems}/${metrics.totalItems} prêts` : 'Équipement',
    href: hubSectionHref(ref, 'gear'),
  });

  return chips;
}

export interface SortieMoment {
  eyebrow: string;
  badge: string;
  dateLabel: string | null;
  title: string;
  distanceKm: number;
  dPlus: number;
  dMinus: number;
  stepCount: number;
  pois: TripPoi[];
  accommodation: string | null;
  checkpoint: TripSafetyCheckpoint | null;
  note: TripNote | null;
  routeCoords: Array<[number, number]>;
  highlightCoords: Array<[number, number]>;
  highlightSteps: TripStep[];
}

function civilDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortDate(iso: string | null | undefined): string | null {
  const d = civilDate(iso);
  if (!d) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function stepCoords(step: TripStep): [number, number] | null {
  if (step.latitude == null || step.longitude == null) return null;
  const lat = Number(step.latitude);
  const lon = Number(step.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

function sortSteps(steps: TripStep[]): TripStep[] {
  return [...steps].sort(
    (a, b) => (a.day_number ?? 0) - (b.day_number ?? 0) || (a.order_index ?? 0) - (b.order_index ?? 0),
  );
}

function dedupeCoords(coords: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const c of coords) {
    const last = out[out.length - 1];
    if (last && last[0] === c[0] && last[1] === c[1]) continue;
    out.push(c);
  }
  return out;
}

function localTodayIso(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localIsoOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function selectSortieMoment(args: {
  trip: TripFull;
  context: SortieContext;
  now?: Date;
}): SortieMoment {
  const { trip, context } = args;
  const now = args.now ?? new Date();
  const canonical = getCanonicalTripSteps(trip.steps);
  const allSteps = sortSteps(trip.steps ?? []);
  const routeCoords = dedupeCoords(
    allSteps.map(stepCoords).filter((c): c is [number, number] => c !== null),
  );
  const totals = getTripDistance(trip.steps);

  if (context.phase === 'live') {
    const day = context.dayIndex ?? 1;
    const daySteps = allSteps.filter((s) => s.day_number === day);
    const dayDistance = getTripDistance(daySteps);
    const highlightCoords = daySteps
      .map(stepCoords)
      .filter((c): c is [number, number] => c !== null);
    const dayStepIds = new Set(daySteps.map((s) => s.id));
    const today = localTodayIso(now);
    const checkpointDateIso = (c: TripSafetyCheckpoint): string | null => {
      if (!c.scheduled_at) return null;
      const parsed = new Date(c.scheduled_at);
      return Number.isNaN(parsed.getTime()) ? c.scheduled_at.slice(0, 10) : localIsoOf(parsed);
    };
    const checkpoints = (trip.safety_checkpoints ?? []).filter((c) => c.status !== 'checked');
    const checkpoint =
      checkpoints.find((c) => checkpointDateIso(c) === today) ??
      [...checkpoints].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ??
      null;
    const note = (trip.notes ?? []).find((n) => n.day_number === day) ?? null;

    return {
      eyebrow: 'Aujourd’hui',
      badge: `Jour ${day}${context.totalDays ? `/${context.totalDays}` : ''}`,
      dateLabel: now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      title: daySteps[0]?.title ?? `Étape ${day}`,
      distanceKm: dayDistance.totalKm,
      dPlus: dayDistance.dPlus,
      dMinus: dayDistance.dMinus,
      stepCount: daySteps.length,
      pois: (trip.pois ?? []).filter((p) => p.step_id != null && dayStepIds.has(p.step_id)),
      accommodation: daySteps.find((s) => s.accommodation_name)?.accommodation_name ?? null,
      checkpoint,
      note,
      routeCoords,
      highlightCoords,
      highlightSteps: daySteps,
    };
  }

  if (context.phase === 'recount') {
    const notes = [...(trip.notes ?? [])].sort(
      (a, b) => (b.day_number ?? 0) - (a.day_number ?? 0) || b.created_at.localeCompare(a.created_at),
    );
    return {
      eyebrow: 'Bilan',
      badge: 'Bilan',
      dateLabel: shortDate(trip.end_date),
      title: trip.title,
      distanceKm: totals.totalKm,
      dPlus: totals.dPlus,
      dMinus: totals.dMinus,
      stepCount: canonical.length,
      pois: [],
      accommodation: null,
      checkpoint: null,
      note: notes[0] ?? null,
      routeCoords,
      highlightCoords: [],
      highlightSteps: [],
    };
  }

  const first = canonical[0] ?? null;
  const firstStepIds = new Set(first ? [first.id] : []);
  const checkpoints = (trip.safety_checkpoints ?? []).filter((c) => c.status !== 'checked');
  return {
    eyebrow: 'Départ',
    badge: context.daysUntil != null ? `J-${context.daysUntil}` : 'À venir',
    dateLabel: shortDate(trip.start_date),
    title: first?.title ?? 'Départ',
    distanceKm: totals.totalKm,
    dPlus: totals.dPlus,
    dMinus: totals.dMinus,
    stepCount: canonical.length,
    pois: (trip.pois ?? []).filter((p) => p.step_id != null && firstStepIds.has(p.step_id)),
    accommodation: first?.accommodation_name ?? null,
    checkpoint:
      [...checkpoints].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null,
    note: null,
    routeCoords,
    highlightCoords: first ? [stepCoords(first)].filter((c): c is [number, number] => c !== null) : [],
    highlightSteps: first ? [first] : [],
  };
}

export function buildPossessionSectionTiles(
  ref: HubAdventureRef,
  summary: MaterielSummary,
  now: Date = new Date(),
): MobileSectionTile[] {
  const departDays = daysUntilFrom(summary.depart.startsAt, now);
  return [
    {
      key: 'depart',
      label: 'Départ',
      href: hubSectionHref(ref, 'depart'),
      icon: Footprints,
      badge:
        !summary.depart.isEstimated && departDays != null && departDays >= 0 ? `J-${departDays}` : null,
    },
    {
      key: 'alertes',
      label: 'Alertes',
      href: hubSectionHref(ref, 'alertes'),
      icon: BellRing,
      badge: summary.alertes.count > 0 ? String(summary.alertes.count) : null,
    },
    {
      key: 'inventaire',
      label: 'Inventaire',
      href: hubSectionHref(ref, 'inventaire'),
      icon: Package,
      badge: summary.inventaire.count > 0 ? String(summary.inventaire.count) : null,
    },
    {
      key: 'kit',
      label: 'Kits',
      href: hubSectionHref(ref, 'kit'),
      icon: Backpack,
      badge: summary.kits.count > 0 ? String(summary.kits.count) : null,
    },
    {
      key: 'preparation',
      label: 'Préparation',
      href: hubSectionHref(ref, 'preparation'),
      icon: FlaskConical,
      badge: summary.kits.count > 0 ? `${summary.kits.avgCompletionPct}%` : null,
    },
    {
      key: 'disponibilite',
      label: 'Disponibilité',
      href: hubSectionHref(ref, 'disponibilite'),
      icon: CalendarCheck,
      badge: summary.dispo.total > 0 ? `${summary.dispo.availableCount}/${summary.dispo.total}` : null,
    },
    {
      key: 'oublis',
      label: 'À ne pas oublier',
      href: hubSectionHref(ref, 'oublis'),
      icon: ClipboardList,
      badge: summary.forget.forgetRemaining > 0 ? String(summary.forget.forgetRemaining) : null,
    },
  ];
}

export function buildPossessionInfoChips(
  ref: HubAdventureRef,
  summary: MaterielSummary,
  now: Date = new Date(),
): MobileInfoChip[] {
  const departDays = daysUntilFrom(summary.depart.startsAt, now);
  const planned = summary.depart.destination !== 'Aucun départ planifié';
  const scheduled = planned && !summary.depart.isEstimated && departDays != null && departDays >= 0;
  const chips: MobileInfoChip[] = [
    {
      key: 'depart',
      icon: Footprints,
      value: scheduled ? `J-${departDays}` : '—',
      label: summary.depart.isEstimated
        ? 'départ à planifier'
        : planned
          ? summary.depart.destination
          : 'Aucun départ',
      href: hubSectionHref(ref, 'depart'),
    },
    {
      key: 'readiness',
      icon: CheckSquare,
      value: `${summary.depart.readinessPct}%`,
      label: 'prêt au départ',
      href: hubSectionHref(ref, 'depart'),
    },
    {
      key: 'objets',
      icon: Package,
      value: String(summary.inventaire.count),
      label: 'objets',
      href: hubSectionHref(ref, 'inventaire'),
    },
    {
      key: 'kits',
      icon: Backpack,
      value: String(summary.kits.count),
      label: summary.kits.totalWeightKg > 0 ? `${summary.kits.totalWeightKg.toFixed(1)} kg` : 'kits',
      href: hubSectionHref(ref, 'kit'),
    },
  ];
  if (summary.alertes.count > 0) {
    chips.push({
      key: 'alertes',
      icon: BellRing,
      value: String(summary.alertes.count),
      label: summary.alertes.criticalCount > 0 ? `${summary.alertes.criticalCount} critique(s)` : 'alertes',
      tone: summary.alertes.criticalCount > 0 ? 'warn' : 'default',
      href: hubSectionHref(ref, 'alertes'),
    });
  }
  chips.push({
    key: 'fiabilite',
    icon: Shield,
    value: `${summary.alertes.reliabilityScore}%`,
    label: 'fiabilité',
    href: hubSectionHref(ref, 'alertes'),
  });
  if (summary.dispo.total > 0) {
    chips.push({
      key: 'dispo',
      icon: CalendarCheck,
      value: `${summary.dispo.availableCount}/${summary.dispo.total}`,
      label: 'disponibles',
      href: hubSectionHref(ref, 'disponibilite'),
    });
  }
  if (summary.forget.forgetRemaining > 0) {
    chips.push({
      key: 'oublis',
      icon: ClipboardList,
      value: String(summary.forget.forgetRemaining),
      label: 'à cocher',
      tone: 'warn',
      href: hubSectionHref(ref, 'oublis'),
    });
  }
  return chips;
}

export function buildCollectifSectionTiles(
  ref: HubAdventureRef,
  summary: GroupeMenuSummary,
  linkedTripSlug?: string | null,
): MobileSectionTile[] {
  const groupeHref = hubSectionHref(ref, 'groupe');
  const tab = (id: string) => `${groupeHref}?onglet=${id}`;
  const num = (v: number) => (v > 0 ? String(v) : null);

  const tiles: MobileSectionTile[] = [
    {
      key: 'groupe',
      label: summary.name ?? 'Groupe',
      href: groupeHref,
      icon: Users,
      badge: num(summary.members),
      accent: true,
    },
    {
      key: 'tasks',
      label: 'Tâches',
      href: tab('tasks'),
      icon: CheckSquare,
      badge: num(summary.tasksOpen),
    },
    {
      key: 'equipment',
      label: 'Équipement',
      href: tab('equipment'),
      icon: Package,
      badge: num(summary.equipmentCount),
    },
    {
      key: 'expenses',
      label: 'Dépenses',
      href: tab('expenses'),
      icon: CreditCard,
      badge: summary.expensesTotal > 0 ? formatEuro(summary.expensesTotal) : null,
    },
    {
      key: 'decisions',
      label: 'Décisions',
      href: tab('decisions'),
      icon: Vote,
      badge: num(summary.pollsOpen),
    },
    {
      key: 'discussion',
      label: 'Discussion',
      href: tab('discussion'),
      icon: MessageSquare,
    },
    {
      key: 'invitations',
      label: 'Invitations',
      href: hubSectionHref(ref, 'invitations'),
      icon: MailPlus,
      badge: num(summary.pendingInvites),
    },
    {
      key: 'voyages-lies',
      label: 'Voyages liés',
      href: hubSectionHref(ref, 'voyages-lies'),
      icon: MapIcon,
      badge: num(summary.linkedTrips),
    },
  ];
  if (linkedTripSlug) {
    tiles.push({
      key: 'voyage-actif',
      label: 'Voyage actif',
      href: tripSwitchHref(linkedTripSlug),
      icon: Compass,
      accent: true,
    });
  }
  return tiles;
}

export function buildCollectifInfoChips(
  ref: HubAdventureRef,
  summary: GroupeMenuSummary,
): MobileInfoChip[] {
  const groupeHref = hubSectionHref(ref, 'groupe');
  const tab = (id: string) => `${groupeHref}?onglet=${id}`;
  const chips: MobileInfoChip[] = [
    { key: 'membres', icon: Users, value: String(summary.members), label: 'membres', href: groupeHref },
    {
      key: 'invitations',
      icon: MailPlus,
      value: String(summary.pendingInvites),
      label: 'en attente',
      tone: summary.pendingInvites > 0 ? 'accent' : 'default',
      href: hubSectionHref(ref, 'invitations'),
    },
  ];
  chips.push({
    key: 'tasks',
    icon: CheckSquare,
    value: String(summary.tasksOpen),
    label: 'tâches',
    href: tab('tasks'),
  });
  const perPerson = summary.members > 0 ? Math.round(summary.expensesTotal / summary.members) : summary.expensesTotal;
  chips.push({
    key: 'expenses',
    icon: CreditCard,
    value: formatEuro(summary.expensesTotal),
    label: summary.members > 0 ? `≈ ${formatEuro(perPerson)}/pers.` : 'dépensé',
    href: tab('expenses'),
  });
  chips.push({ key: 'decisions', icon: Vote, value: String(summary.pollsOpen), label: 'votes', href: tab('decisions') });
  chips.push({
    key: 'progression',
    icon: TrendingUp,
    value: `${summary.progression}%`,
    label: 'préparation',
    href: groupeHref,
  });
  if (summary.departureLabel) {
    chips.push({ key: 'depart', icon: CalendarDays, value: summary.departureLabel, label: 'départ', href: groupeHref });
  }
  return chips;
}

export interface PoiCategoryMeta {
  label: string;
  color: string;
}

const POI_PATTERNS: Array<{ test: RegExp; meta: PoiCategoryMeta }> = [
  { test: /\b(eau|water|fontaine|source)\b/i, meta: { label: 'Point d’eau', color: '#2A5A6E' } },
  { test: /\b(refuge|gîte|gite|cabane|chalet|hut)\b/i, meta: { label: 'Refuge', color: '#7A7258' } },
  { test: /\b(sommet|summit|pic|peak)\b/i, meta: { label: 'Sommet', color: '#7A7365' } },
  { test: /\b(point de vue|viewpoint|panorama|belvédère|belvedere)\b/i, meta: { label: 'Point de vue', color: '#5B7F55' } },
  { test: /\b(camp|camping|bivouac)\b/i, meta: { label: 'Camping', color: '#3D7A52' } },
  { test: /\b(col|pass)\b/i, meta: { label: 'Col', color: '#968C81' } },
];

export function poiCategoryMeta(category: string | null | undefined, name?: string | null): PoiCategoryMeta {
  const haystack = `${category ?? ''} ${name ?? ''}`;
  for (const entry of POI_PATTERNS) {
    if (entry.test.test(haystack)) return entry.meta;
  }
  return { label: category || 'Point d’intérêt', color: '#5B7F55' };
}
