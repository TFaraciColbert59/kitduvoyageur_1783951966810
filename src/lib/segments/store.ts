import 'server-only';

import type {
  EffortFlagRecord,
  EffortReviewRecord,
  SegmentDefinition,
  SegmentEffort,
  SegmentHazardReport,
  UserSegmentPreferences,
} from '@/features/segments';

/**
 * Persistance de travail du lot S01-UI.
 *
 * Le contrat `src/features/segments` est pur : ce module fournit la couche
 * d'accueil serveur des routes `/api/segments` et de l'écran `/segments`.
 * Le stockage est un singleton de processus (dev / aperçu), volontairement
 * remplaçable par une implémentation Supabase sans toucher aux routes ni aux
 * composants. Aucune donnée n'est fabriquée : un catalogue vide reste vide.
 */

export interface SegmentsStoreState {
  segments: Map<string, SegmentDefinition>;
  efforts: Map<string, SegmentEffort>;
  preferences: Map<string, UserSegmentPreferences>;
  hazardReports: Map<string, SegmentHazardReport>;
  effortFlags: Map<string, EffortFlagRecord>;
  effortReviews: Map<string, EffortReviewRecord>;
}

const STORE_KEY = '__lkdvSegmentsStoreV1';

function createState(): SegmentsStoreState {
  return {
    segments: new Map(),
    efforts: new Map(),
    preferences: new Map(),
    hazardReports: new Map(),
    effortFlags: new Map(),
    effortReviews: new Map(),
  };
}

function state(): SegmentsStoreState {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: SegmentsStoreState;
  };
  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = createState();
  }
  return globalStore[STORE_KEY];
}

export function listSegments(): SegmentDefinition[] {
  return Array.from(state().segments.values());
}

export function getSegment(segmentId: string): SegmentDefinition | null {
  return state().segments.get(segmentId) ?? null;
}

export function upsertSegment(segment: SegmentDefinition): SegmentDefinition {
  state().segments.set(segment.id, segment);
  return segment;
}

export function upsertSegments(segments: SegmentDefinition[]): void {
  for (const segment of segments) {
    state().segments.set(segment.id, segment);
  }
}

export function listEfforts(segmentId?: string): SegmentEffort[] {
  const all = Array.from(state().efforts.values());
  return segmentId ? all.filter((effort) => effort.segmentId === segmentId) : all;
}

export function getEffort(effortId: string): SegmentEffort | null {
  return state().efforts.get(effortId) ?? null;
}

export function upsertEfforts(efforts: SegmentEffort[]): void {
  for (const effort of efforts) {
    state().efforts.set(effort.effortId, effort);
  }
}

export function replaceEffortsForSegment(segmentId: string, efforts: SegmentEffort[]): void {
  const store = state();
  for (const [effortId, effort] of store.efforts.entries()) {
    if (effort.segmentId === segmentId) store.efforts.delete(effortId);
  }
  for (const effort of efforts) {
    store.efforts.set(effort.effortId, effort);
  }
}

export function replaceAllEfforts(efforts: SegmentEffort[]): void {
  const store = state();
  store.efforts.clear();
  for (const effort of efforts) {
    store.efforts.set(effort.effortId, effort);
  }
}

export function getPreferences(userId: string): UserSegmentPreferences {
  const existing = state().preferences.get(userId);
  if (existing) {
    return {
      ...existing,
      starredSegmentIds: [...existing.starredSegmentIds],
      hiddenSegmentIds: [...existing.hiddenSegmentIds],
    };
  }
  return { userId, starredSegmentIds: [], hiddenSegmentIds: [] };
}

export function savePreferences(preferences: UserSegmentPreferences): UserSegmentPreferences {
  const copy: UserSegmentPreferences = {
    userId: preferences.userId,
    starredSegmentIds: [...new Set(preferences.starredSegmentIds)],
    hiddenSegmentIds: [...new Set(preferences.hiddenSegmentIds)],
  };
  state().preferences.set(copy.userId, copy);
  return {
    ...copy,
    starredSegmentIds: [...copy.starredSegmentIds],
    hiddenSegmentIds: [...copy.hiddenSegmentIds],
  };
}

export function listHazardReports(segmentId?: string): SegmentHazardReport[] {
  const all = Array.from(state().hazardReports.values());
  return segmentId ? all.filter((report) => report.segmentId === segmentId) : all;
}

export function saveHazardReport(report: SegmentHazardReport): void {
  state().hazardReports.set(report.reportId, report);
}

export function saveHazardReports(reports: SegmentHazardReport[]): void {
  for (const report of reports) state().hazardReports.set(report.reportId, report);
}

export function listEffortFlags(segmentId?: string): EffortFlagRecord[] {
  const all = Array.from(state().effortFlags.values());
  return segmentId ? all.filter((flag) => flag.segmentId === segmentId) : all;
}

export function getEffortFlags(effortId: string): EffortFlagRecord[] {
  return Array.from(state().effortFlags.values()).filter((flag) => flag.effortId === effortId);
}

export function saveEffortFlag(flag: EffortFlagRecord): void {
  state().effortFlags.set(flag.flagId, flag);
}

export function getEffortReview(effortId: string): EffortReviewRecord | null {
  return state().effortReviews.get(effortId) ?? null;
}

export function saveEffortReview(review: EffortReviewRecord): void {
  state().effortReviews.set(review.effortId, review);
}

export function countHazardReportsByUserSince(userId: string, sinceMs: number): number {
  return Array.from(state().hazardReports.values()).filter(
    (report) => report.reporterUserId === userId && Date.parse(report.createdAt) >= sinceMs
  ).length;
}

export function countEffortFlagsByUserSince(userId: string, sinceMs: number): number {
  return Array.from(state().effortFlags.values()).filter(
    (flag) => flag.reporterUserId === userId && Date.parse(flag.createdAt) >= sinceMs
  ).length;
}

/** Réservé aux tests : remet le singleton à zéro entre deux cas. */
export function resetSegmentsStore(): void {
  const store = state();
  store.segments.clear();
  store.efforts.clear();
  store.preferences.clear();
  store.hazardReports.clear();
  store.effortFlags.clear();
  store.effortReviews.clear();
}
