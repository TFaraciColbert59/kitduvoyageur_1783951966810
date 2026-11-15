import 'server-only';

import type {
  AthletePrivacySnapshot,
  LeaderboardViewerContext,
  SegmentEffortInput,
} from '@/features/leaderboards';
import type {
  LeaderboardClubOption,
  LeaderboardSegmentView,
  LeaderboardStoreSnapshot,
  LeaderboardViewerRelations,
} from './types';

/**
 * Persistance de travail du lot S02-UI.
 *
 * Le contrat `src/features/leaderboards` est pur : ce module fournit la couche
 * d'accueil serveur des routes `/api/leaderboards` et des écrans
 * `/classements`. Le stockage est un singleton de processus (dev / aperçu),
 * volontairement remplaçable par une implémentation Supabase sans toucher aux
 * routes ni aux composants. Aucune donnée n'est fabriquée : un catalogue vide
 * reste vide.
 */
export interface LeaderboardsStoreState {
  segments: Map<string, LeaderboardSegmentView>;
  efforts: Map<string, SegmentEffortInput>;
  privacy: Map<string, AthletePrivacySnapshot>;
  relations: Map<string, LeaderboardViewerRelations>;
  clubs: Map<string, LeaderboardClubOption>;
}

const STORE_KEY = '__lkdvLeaderboardsStoreV1';

function createState(): LeaderboardsStoreState {
  return {
    segments: new Map(),
    efforts: new Map(),
    privacy: new Map(),
    relations: new Map(),
    clubs: new Map(),
  };
}

function state(): LeaderboardsStoreState {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: LeaderboardsStoreState;
  };
  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = createState();
  }
  return globalStore[STORE_KEY];
}

function cloneSnapshot(snapshot: AthletePrivacySnapshot): AthletePrivacySnapshot {
  return {
    ...snapshot,
    clubIds: snapshot.clubIds ? [...snapshot.clubIds] : undefined,
    friendIds: snapshot.friendIds ? [...snapshot.friendIds] : undefined,
  };
}

function cloneEffort(effort: SegmentEffortInput): SegmentEffortInput {
  return {
    ...effort,
    athlete: effort.athlete ? cloneSnapshot(effort.athlete) : undefined,
  };
}

function cloneRelations(relations: LeaderboardViewerRelations): LeaderboardViewerRelations {
  return {
    userId: relations.userId,
    friendIds: [...relations.friendIds],
    clubIds: [...relations.clubIds],
    blockedUserIds: [...relations.blockedUserIds],
    blockedByUserIds: [...relations.blockedByUserIds],
    mutedUserIds: [...relations.mutedUserIds],
  };
}

function emptyRelations(userId: string): LeaderboardViewerRelations {
  return {
    userId,
    friendIds: [],
    clubIds: [],
    blockedUserIds: [],
    blockedByUserIds: [],
    mutedUserIds: [],
  };
}

export function listLeaderboardSegments(): LeaderboardSegmentView[] {
  return Array.from(state().segments.values()).map((segment) => ({ ...segment }));
}

export function getLeaderboardSegment(segmentId: string): LeaderboardSegmentView | null {
  const segment = state().segments.get(segmentId);
  return segment ? { ...segment } : null;
}

export function upsertLeaderboardSegment(segment: LeaderboardSegmentView): LeaderboardSegmentView {
  const copy: LeaderboardSegmentView = { ...segment };
  state().segments.set(copy.segmentId, copy);
  return { ...copy };
}

export function removeLeaderboardSegment(segmentId: string): boolean {
  return state().segments.delete(segmentId);
}

export function listLeaderboardEfforts(segmentId?: string): SegmentEffortInput[] {
  const all = Array.from(state().efforts.values());
  return (segmentId ? all.filter((effort) => effort.segmentId === segmentId) : all).map(
    (effort) => {
      // Le répertoire de confidentialité fait foi : une révocation de
      // consentement ou un passage en privé s'applique immédiatement, même si
      // l'effort embarque un ancien snapshot.
      const current = state().privacy.get(effort.userId);
      return cloneEffort(current ? { ...effort, athlete: current } : effort);
    }
  );
}

export function upsertLeaderboardEffort(effort: SegmentEffortInput): SegmentEffortInput {
  const copy = cloneEffort(effort);
  state().efforts.set(copy.effortId, copy);
  if (copy.athlete) {
    state().privacy.set(copy.athlete.userId, cloneSnapshot(copy.athlete));
  }
  return cloneEffort(copy);
}

export function replaceLeaderboardEffortsForSegment(
  segmentId: string,
  efforts: ReadonlyArray<SegmentEffortInput>
): void {
  const store = state();
  for (const [effortId, effort] of store.efforts.entries()) {
    if (effort.segmentId === segmentId) store.efforts.delete(effortId);
  }
  for (const effort of efforts) {
    const copy = cloneEffort(effort);
    store.efforts.set(copy.effortId, copy);
    if (copy.athlete) store.privacy.set(copy.athlete.userId, cloneSnapshot(copy.athlete));
  }
}

export function upsertAthletePrivacy(snapshot: AthletePrivacySnapshot): AthletePrivacySnapshot {
  const copy = cloneSnapshot(snapshot);
  state().privacy.set(copy.userId, copy);
  return cloneSnapshot(copy);
}

export function getAthletePrivacy(userId: string): AthletePrivacySnapshot | null {
  const snapshot = state().privacy.get(userId);
  return snapshot ? cloneSnapshot(snapshot) : null;
}

export function getLeaderboardPrivacyDirectory(): ReadonlyMap<string, AthletePrivacySnapshot> {
  const directory = new Map<string, AthletePrivacySnapshot>();
  for (const [userId, snapshot] of state().privacy.entries()) {
    directory.set(userId, cloneSnapshot(snapshot));
  }
  return directory;
}

export function upsertLeaderboardClub(club: LeaderboardClubOption): LeaderboardClubOption {
  const copy = { id: club.id, name: club.name };
  state().clubs.set(copy.id, copy);
  return { ...copy };
}

export function listLeaderboardClubs(): LeaderboardClubOption[] {
  return Array.from(state().clubs.values()).map((club) => ({ ...club }));
}

export function getLeaderboardViewerRelations(userId: string): LeaderboardViewerRelations {
  const relations = state().relations.get(userId);
  return relations ? cloneRelations(relations) : emptyRelations(userId);
}

export function saveLeaderboardViewerRelations(
  relations: LeaderboardViewerRelations
): LeaderboardViewerRelations {
  const copy = cloneRelations(relations);
  state().relations.set(copy.userId, copy);
  return cloneRelations(copy);
}

/**
 * Contexte spectateur du contrat S02 (P01 / S6.19). Un visiteur anonyme reste
 * explicitement non authentifié : les scopes amis et club échouent en
 * fail-closed côté moteur.
 */
export function buildLeaderboardViewerContext(viewerId: string | null): LeaderboardViewerContext {
  if (!viewerId) {
    return { viewerId: null, isAuthenticated: false };
  }
  const relations = getLeaderboardViewerRelations(viewerId);
  return {
    viewerId,
    isAuthenticated: true,
    friendIds: relations.friendIds,
    clubIds: relations.clubIds,
    blockedUserIds: relations.blockedUserIds,
    blockedByUserIds: relations.blockedByUserIds,
    mutedUserIds: relations.mutedUserIds,
  };
}

export function getViewerClubOptions(viewerId: string | null): LeaderboardClubOption[] {
  if (!viewerId) return [];
  const relations = getLeaderboardViewerRelations(viewerId);
  const clubIds = new Set(relations.clubIds);
  return listLeaderboardClubs().filter((club) => clubIds.has(club.id));
}

export function getLeaderboardsStoreSnapshot(): LeaderboardStoreSnapshot {
  return {
    segments: listLeaderboardSegments(),
    efforts: listLeaderboardEfforts(),
  };
}

/** Réservé aux tests : remet le singleton à zéro entre deux cas. */
export function resetLeaderboardsStore(): void {
  const store = state();
  store.segments.clear();
  store.efforts.clear();
  store.privacy.clear();
  store.relations.clear();
  store.clubs.clear();
}
