import { computeLocalLegends, type ComputeLocalLegendsOptions } from './localLegends';
import {
  buildSegmentLeaderboard,
  sanitizeLeaderboardFilters,
  type BuildSegmentLeaderboardOptions,
} from './segmentLeaderboard';
import type {
  LeaderboardDrawerState,
  LeaderboardFilterQuery,
  LocalLegendResult,
  SegmentDefinition,
  SegmentEffortInput,
  SegmentLeaderboardResult,
} from './types';

export interface WithdrawalProjectionScenario {
  before: SegmentLeaderboardResult;
  after: SegmentLeaderboardResult;
  beforeLocalLegend: LocalLegendResult;
  afterLocalLegend: LocalLegendResult;
}

/**
 * Produit les scénarios avant et après retrait / changement d'audience
 * d'un effort ou d'un utilisateur (contrat S4.05 / S4.06 / S4.08).
 */
export function buildWithdrawalProjectionScenario(
  segment: SegmentDefinition,
  efforts: ReadonlyArray<SegmentEffortInput>,
  withdrawal: { effortId?: string; userId?: string },
  options: BuildSegmentLeaderboardOptions & ComputeLocalLegendsOptions = {}
): WithdrawalProjectionScenario {
  const before = buildSegmentLeaderboard(segment, efforts, options);
  const beforeLocalLegend = computeLocalLegends(segment, efforts, options);

  const updatedEfforts = efforts.map((effort) => {
    const matchesEffort = withdrawal.effortId && effort.effortId === withdrawal.effortId;
    const matchesUser = withdrawal.userId && effort.userId === withdrawal.userId;
    if (matchesEffort || matchesUser) {
      return {
        ...effort,
        audience: 'private' as const,
      };
    }
    return effort;
  });

  const after = buildSegmentLeaderboard(segment, updatedEfforts, options);
  const afterLocalLegend = computeLocalLegends(segment, updatedEfforts, options);

  return {
    before,
    after,
    beforeLocalLegend,
    afterLocalLegend,
  };
}

/**
 * Magasin de projections avec invalidation déterministe à chaud (P01 / S6.19) :
 * toute révocation d'audience, blocage ou signalement purge immédiatement
 * les projections en cache pour le segment, l'effort ou l'utilisateur concerné.
 */
export class LeaderboardProjectionStore {
  private leaderboardCache = new Map<string, SegmentLeaderboardResult>();
  private legendCache = new Map<string, LocalLegendResult>();
  private version = 0;

  getCacheVersion(): number {
    return this.version;
  }

  getOrComputeLeaderboard(
    cacheKey: string,
    segment: SegmentDefinition,
    efforts: ReadonlyArray<SegmentEffortInput>,
    options: BuildSegmentLeaderboardOptions = {}
  ): SegmentLeaderboardResult {
    const cached = this.leaderboardCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const computed = buildSegmentLeaderboard(segment, efforts, options);
    this.leaderboardCache.set(cacheKey, computed);
    return computed;
  }

  getOrComputeLocalLegend(
    cacheKey: string,
    segment: SegmentDefinition,
    efforts: ReadonlyArray<SegmentEffortInput>,
    options: ComputeLocalLegendsOptions = {}
  ): LocalLegendResult {
    const cached = this.legendCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const computed = computeLocalLegends(segment, efforts, options);
    this.legendCache.set(cacheKey, computed);
    return computed;
  }

  invalidateSegment(segmentId: string): number {
    let removed = 0;
    this.leaderboardCache.forEach((value, key) => {
      if (value.segmentId === segmentId) {
        this.leaderboardCache.delete(key);
        removed += 1;
      }
    });
    this.legendCache.forEach((value, key) => {
      if (value.segmentId === segmentId) {
        this.legendCache.delete(key);
        removed += 1;
      }
    });
    if (removed > 0) this.version += 1;
    return removed;
  }

  invalidateUser(userId: string): number {
    let removed = 0;
    this.leaderboardCache.forEach((value, key) => {
      const hasUser =
        value.entries.some((e) => e.userId === userId) ||
        value.viewerEntry?.userId === userId ||
        value.titles.kom?.userId === userId ||
        value.titles.qom?.userId === userId ||
        value.titles.cr?.userId === userId;
      if (hasUser) {
        this.leaderboardCache.delete(key);
        removed += 1;
      }
    });
    this.legendCache.forEach((value, key) => {
      const hasUser =
        value.rankings.some((r) => r.userId === userId) ||
        value.legend?.userId === userId;
      if (hasUser) {
        this.legendCache.delete(key);
        removed += 1;
      }
    });
    if (removed > 0) this.version += 1;
    return removed;
  }

  invalidateEffort(effortId: string): number {
    let removed = 0;
    this.leaderboardCache.forEach((value, key) => {
      if (value.entries.some((e) => e.effortId === effortId)) {
        this.leaderboardCache.delete(key);
        removed += 1;
      }
    });
    // Pour Local Legends, on invalide tout le cache de légendes par sécurité (fail-closed)
    if (this.legendCache.size > 0) {
      removed += this.legendCache.size;
      this.legendCache.clear();
    }
    if (removed > 0) this.version += 1;
    return removed;
  }

  clearAll(): void {
    this.leaderboardCache.clear();
    this.legendCache.clear();
    this.version += 1;
  }
}

export type LeaderboardDrawerAction =
  | {
      type: 'OPEN_LEADERBOARD_DRAWER';
      segmentId: string;
      parentDrawerContext: string;
      activeTab?: 'leaderboard' | 'local_legend';
      filters?: LeaderboardFilterQuery;
    }
  | { type: 'SET_TAB'; activeTab: 'leaderboard' | 'local_legend' }
  | { type: 'SET_FILTERS'; filters: LeaderboardFilterQuery }
  | { type: 'SET_PAGE_OFFSET'; offset: number }
  | { type: 'CLOSE_LEADERBOARD_DRAWER' };

export function createInitialLeaderboardDrawerState(
  limit = 20
): LeaderboardDrawerState {
  return {
    isOpen: false,
    segmentId: null,
    parentDrawerContext: null,
    activeTab: 'leaderboard',
    filters: sanitizeLeaderboardFilters({}),
    offset: 0,
    limit,
  };
}

/**
 * Réducteur pur du sous-drawer Classement / Local Legend (S4.05 / S4.06 / S4.08) :
 * préserve le contexte du drawer parent à la fermeture et nettoie les filtres.
 */
export function reduceLeaderboardDrawerState(
  state: LeaderboardDrawerState,
  action: LeaderboardDrawerAction
): LeaderboardDrawerState {
  switch (action.type) {
    case 'OPEN_LEADERBOARD_DRAWER':
      return {
        ...state,
        isOpen: true,
        segmentId: action.segmentId,
        parentDrawerContext: action.parentDrawerContext,
        activeTab: action.activeTab ?? 'leaderboard',
        filters: sanitizeLeaderboardFilters(action.filters),
        offset: 0,
      };
    case 'SET_TAB':
      return {
        ...state,
        activeTab: action.activeTab,
        offset: 0,
      };
    case 'SET_FILTERS':
      return {
        ...state,
        filters: sanitizeLeaderboardFilters(action.filters),
        offset: 0,
      };
    case 'SET_PAGE_OFFSET':
      return {
        ...state,
        offset: Math.max(0, Math.floor(action.offset)),
      };
    case 'CLOSE_LEADERBOARD_DRAWER':
      return {
        ...state,
        isOpen: false,
        segmentId: null,
        offset: 0,
        // parentDrawerContext conservé pour restaurer le drawer parent
      };
  }
}
