import 'server-only';

import {
  buildSegmentLeaderboard,
  computeLocalLegends,
  getLeaderboardFilterCapabilities,
  sanitizeLeaderboardFilters,
  type LeaderboardFilterQuery,
  type LeaderboardPaginationInput,
  type LeaderboardScope,
  type LocalLegendResult,
  type RejectedEffortDiagnostic,
  type SegmentLeaderboardResult,
} from '@/features/leaderboards';
import {
  buildLeaderboardViewerContext,
  getLeaderboardPrivacyDirectory,
  getLeaderboardSegment,
  getViewerClubOptions,
  listLeaderboardEfforts,
  listLeaderboardSegments,
} from './store';
import type {
  AntiCheatCategory,
  AntiCheatReasonCount,
  AntiCheatSummary,
  LeaderboardClubOption,
  LeaderboardSegmentView,
  SegmentLeaderboardSummary,
} from './types';

export class LeaderboardSegmentNotFoundError extends Error {
  readonly code = 'segment_not_found' as const;
  constructor(segmentId: string) {
    super(`Segment introuvable : ${segmentId}`);
  }
}

export class LeaderboardAuthRequiredError extends Error {
  readonly code = 'authentication_required' as const;
  constructor() {
    super('Une session est requise pour ce classement.');
  }
}

export class LeaderboardClubRequiredError extends Error {
  readonly code = 'club_id_required' as const;
  constructor() {
    super('Un club doit être sélectionné.');
  }
}

export class LeaderboardClubAccessError extends Error {
  readonly code = 'club_access_denied' as const;
  constructor() {
    super('Vous n’êtes pas membre de ce club.');
  }
}

const REASON_LABELS: Record<RejectedEffortDiagnostic['reason'], string> = {
  segment_mismatch: 'Segment incohérent',
  sport_mismatch: 'Sport incohérent',
  invalid_elapsed_time: 'Temps écoulé invalide',
  invalid_moving_time: 'Temps en mouvement invalide',
  incomplete_passage: 'Parcours incomplet',
  off_route: 'Passage hors tracé',
  uturn_detected: 'Demi-tour détecté',
  gps_jump: 'Saut GPS détecté',
  implausible_speed: 'Vitesse implausible',
  motorized_suspected: 'Assistance motorisée suspectée',
  moderation_excluded: 'Effort écarté par la modération',
  invalid_timestamp: 'Horodatage invalide',
  outside_period: 'Hors de la période demandée',
  privacy_missing_snapshot: 'Profil de confidentialité absent',
  privacy_unconsented: 'Consentement aux classements absent',
  privacy_private_account: 'Compte privé',
  privacy_hidden_or_suspended: 'Profil masqué ou suspendu',
  privacy_audience_denied: 'Audience insuffisante',
  privacy_blocked: 'Blocage entre utilisateurs',
  privacy_muted: 'Utilisateur masqué par le spectateur',
  scope_not_in_friends: 'Hors du cercle d’amis',
  scope_not_in_club: 'Hors du club',
};

function categoryForReason(reason: RejectedEffortDiagnostic['reason']): AntiCheatCategory {
  if (reason === 'outside_period') return 'period';
  if (
    reason.startsWith('privacy_') ||
    reason === 'scope_not_in_friends' ||
    reason === 'scope_not_in_club'
  ) {
    return 'privacy';
  }
  return 'anti_cheat';
}

const ANTI_CHEAT_CHECKS = [
  {
    id: 'speed_plausibility',
    label: 'Vitesse plausible',
    detail: 'La vitesse moyenne et maximale est comparée au plafond du sport.',
    enforced: true as const,
  },
  {
    id: 'gps_integrity',
    label: 'Continuité GPS',
    detail: 'Les sauts de position et les traces incohérentes sont écartés.',
    enforced: true as const,
  },
  {
    id: 'route_completion',
    label: 'Parcours complet',
    detail: 'Le passage doit couvrir le segment, sans demi-tour ni sortie de tracé.',
    enforced: true as const,
  },
  {
    id: 'moderation',
    label: 'Modération',
    detail: 'Un effort signalé, exclu ou rejeté ne réapparaît jamais.',
    enforced: true as const,
  },
  {
    id: 'privacy_consent',
    label: 'Consentement et audience',
    detail: 'Profil public, consentement explicite et audience compatible sont requis.',
    enforced: true as const,
  },
  {
    id: 'period_window',
    label: 'Fenêtre de période',
    detail: 'Seuls les efforts compris dans la période choisie sont classés.',
    enforced: true as const,
  },
];

export function summarizeRejectedEfforts(
  diagnostics: ReadonlyArray<RejectedEffortDiagnostic>,
  computedAt: string
): AntiCheatSummary {
  const counts = new Map<RejectedEffortDiagnostic['reason'], number>();
  for (const diagnostic of diagnostics) {
    counts.set(diagnostic.reason, (counts.get(diagnostic.reason) ?? 0) + 1);
  }

  const reasons: AntiCheatReasonCount[] = Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      category: categoryForReason(reason),
      label: REASON_LABELS[reason],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const antiCheatRejectedCount = reasons
    .filter((item) => item.category === 'anti_cheat')
    .reduce((total, item) => total + item.count, 0);
  const privacyRejectedCount = reasons
    .filter((item) => item.category === 'privacy')
    .reduce((total, item) => total + item.count, 0);
  const periodRejectedCount = reasons
    .filter((item) => item.category === 'period')
    .reduce((total, item) => total + item.count, 0);

  return {
    rejectedCount: diagnostics.length,
    antiCheatRejectedCount,
    privacyRejectedCount,
    periodRejectedCount,
    reasons,
    checks: ANTI_CHEAT_CHECKS,
    computedAt,
  };
}

function assertScopeAccess(
  filters: ReturnType<typeof sanitizeLeaderboardFilters>,
  viewerId: string | null
) {
  if (filters.scope !== 'global' && !viewerId) {
    throw new LeaderboardAuthRequiredError();
  }
  if (filters.scope === 'club') {
    if (!filters.clubId) {
      throw new LeaderboardClubRequiredError();
    }
    const viewerClubs = getViewerClubOptions(viewerId);
    if (!viewerClubs.some((club) => club.id === filters.clubId)) {
      throw new LeaderboardClubAccessError();
    }
  }
}

export interface GetSegmentLeaderboardOptions {
  viewerId: string | null;
  query?: LeaderboardFilterQuery;
  pagination?: LeaderboardPaginationInput;
  nowIso?: string;
}

export interface SegmentLeaderboardView {
  segment: LeaderboardSegmentView;
  leaderboard: SegmentLeaderboardResult;
  antiCheat: AntiCheatSummary;
}

/**
 * Construit la vue d'un classement de segment avec filtres S4.06, titres
 * KOM/QOM/CR (S4.05) et agrégat anti-triche. Les diagnostics nominatifs du
 * moteur sont consommés ici puis supprimés : ils ne sortent jamais de l'API.
 */
export function getSegmentLeaderboardView(
  segmentId: string,
  options: GetSegmentLeaderboardOptions
): SegmentLeaderboardView {
  const segment = getLeaderboardSegment(segmentId);
  if (!segment) throw new LeaderboardSegmentNotFoundError(segmentId);

  const filters = sanitizeLeaderboardFilters(options.query);
  assertScopeAccess(filters, options.viewerId);

  const computedAt = options.nowIso ?? new Date().toISOString();
  const raw = buildSegmentLeaderboard(segment, listLeaderboardEfforts(segmentId), {
    // Le moteur re-sanitise : lui passer la requête d'origine préserve la trace
    // des filtres âge/poids retirés pour l'écran et l'API.
    filters: options.query,
    viewer: buildLeaderboardViewerContext(options.viewerId),
    pagination: options.pagination,
    nowIso: computedAt,
    privacyDirectory: getLeaderboardPrivacyDirectory(),
    includeDiagnostics: true,
  });

  const { diagnostics = [], ...leaderboard } = raw;
  return {
    segment,
    leaderboard,
    antiCheat: summarizeRejectedEfforts(diagnostics, leaderboard.computedAt),
  };
}

export interface GetLocalLegendsOptions {
  viewerId: string | null;
  scope?: LeaderboardScope;
  clubId?: string | null;
  windowDays?: number;
  minEffortsForTitle?: number;
  nowIso?: string;
}

export interface SegmentLocalLegendView {
  segment: LeaderboardSegmentView;
  localLegend: LocalLegendResult;
}

/**
 * Vue Local Legends (S4.08). `shouldDisplayMention` reste la seule autorité
 * d'affichage : segment dangereux, archivé, seuil non atteint ou données
 * insuffisantes produisent une mention masquée, jamais un titre inventé.
 */
export function getSegmentLocalLegendsView(
  segmentId: string,
  options: GetLocalLegendsOptions
): SegmentLocalLegendView {
  const segment = getLeaderboardSegment(segmentId);
  if (!segment) throw new LeaderboardSegmentNotFoundError(segmentId);

  const filters = sanitizeLeaderboardFilters({
    scope: options.scope ?? 'global',
    clubId: options.clubId ?? null,
  });
  assertScopeAccess(filters, options.viewerId);

  const nowIso = options.nowIso ?? new Date().toISOString();
  const localLegend = computeLocalLegends(segment, listLeaderboardEfforts(segmentId), {
    scope: filters.scope,
    clubId: filters.clubId,
    viewer: buildLeaderboardViewerContext(options.viewerId),
    windowDays: options.windowDays,
    minEffortsForTitle: options.minEffortsForTitle,
    nowIso,
    privacyDirectory: getLeaderboardPrivacyDirectory(),
  });

  return { segment, localLegend };
}

export function getLeaderboardClubs(viewerId: string | null): LeaderboardClubOption[] {
  return getViewerClubOptions(viewerId);
}

export function getLeaderboardCapabilities() {
  return getLeaderboardFilterCapabilities();
}

export interface ListSegmentLeaderboardsOptions {
  viewerId: string | null;
  q?: string;
  sport?: LeaderboardSegmentView['sport'];
  limit?: number;
  nowIso?: string;
}

/**
 * Cartes de l'index `/classements` : top 3, titres, Local Legend autorisée et
 * compteur de passages écartés. Aucune donnée privée n'est sérialisée.
 */
export function listSegmentLeaderboardSummaries(
  options: ListSegmentLeaderboardsOptions
): SegmentLeaderboardSummary[] {
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 50)));
  const query = options.q?.trim().toLocaleLowerCase('fr-FR') ?? '';
  const nowIso = options.nowIso ?? new Date().toISOString();

  const summaries: SegmentLeaderboardSummary[] = [];
  for (const segment of listLeaderboardSegments()) {
    if (options.sport && segment.sport !== options.sport) continue;
    if (query) {
      const haystack = `${segment.name} ${segment.region ?? ''}`.toLocaleLowerCase('fr-FR');
      if (!haystack.includes(query)) continue;
    }

    const view = getSegmentLeaderboardView(segment.segmentId, {
      viewerId: options.viewerId,
      query: { scope: 'global' },
      pagination: { limit: 3 },
      nowIso,
    });
    const legendView = getSegmentLocalLegendsView(segment.segmentId, {
      viewerId: options.viewerId,
      scope: 'global',
      nowIso,
    });

    summaries.push({
      segment: view.segment,
      totalEntries: view.leaderboard.page.totalEntries,
      rejectedCount: view.leaderboard.rejectedCount,
      topEntries: view.leaderboard.entries.slice(0, 3),
      titles: view.leaderboard.titles,
      localLegend:
        legendView.localLegend.shouldDisplayMention && legendView.localLegend.legend
          ? {
              displayName: legendView.localLegend.legend.displayName,
              effortCount: legendView.localLegend.legend.effortCount,
            }
          : null,
      computedAt: view.leaderboard.computedAt,
    });
  }

  return summaries
    .sort((a, b) => b.totalEntries - a.totalEntries || a.segment.name.localeCompare(b.segment.name))
    .slice(0, limit);
}
