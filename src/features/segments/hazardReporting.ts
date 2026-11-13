/**
 * S4.11 — Signalement de segment dangereux, exclusion du classement et effets sur les notifications.
 *
 * Responsabilités :
 * - Enregistrer et évaluer les signalements de danger sur un segment (route dangereuse,
 *   intersection sans visibilité, descente périlleuse, sentier fermé/effondré, propriété privée).
 * - Dès qu'un danger est confirmé (par seuil communautaire ou source officielle / créateur),
 *   marquer le segment `hazardous = true`.
 * - Appliquer immédiatement les effets normatifs S4.11 :
 *   1. Exclusion du classement public compétitif (`leaderboardEnabled = false`) et retrait
 *      d'éligibilité publique de tous les efforts associés.
 *   2. Désactivation complète des notifications et alertes de compétition (KOM/CR, records
 *      battus, live segments compétitifs) via `suppressCompetitionNotifications = true`.
 * - Gérer l'état du sous-drawer « Drawer segment → ⋯ → signaler un danger » avec restauration
 *   exacte du contexte du drawer parent à la fermeture.
 */

import type {
  DrawerParentContext,
  SegmentDefinition,
  SegmentEffort,
  SegmentHazardCategory,
  SegmentHazardReport,
} from './types';

export const HAZARD_REPORTS_THRESHOLD_TO_ACTIVATE = 2;
export const MAX_HAZARD_REPORTS_PER_USER_HOUR = 4;

export interface SegmentHazardStatusEvaluation {
  segmentId: string;
  hazardous: boolean;
  dominantCategory: SegmentHazardCategory | null;
  activeReportCount: number;
  distinctReporterCount: number;
  leaderboardEnabled: boolean;
  suppressCompetitionNotifications: boolean;
  safetyBannerMessage: string | null;
}

const HAZARD_LABELS_FR: Record<SegmentHazardCategory, string> = {
  dangerous_road_or_traffic: 'Circulation routière dangereuse — classement et notifications de compétition désactivés',
  blind_intersection: 'Intersection sans visibilité — classement et notifications de compétition désactivés',
  steep_technical_descent: 'Descente technique périlleuse — classement et notifications de compétition désactivés',
  trail_closed_or_collapsed: 'Sentier fermé ou effondré — classement et notifications de compétition désactivés',
  private_property: 'Passage sur propriété privée — classement et notifications de compétition désactivés',
  other_safety_hazard: 'Danger signalé sur ce tronçon — classement et notifications de compétition désactivés',
};

/**
 * Évalue l'état de dangerosité d'un segment à partir de ses signalements actifs
 * et calcule l'impact sur le classement et les notifications de compétition.
 */
export function evaluateSegmentHazardStatus(
  segment: SegmentDefinition,
  reports: SegmentHazardReport[]
): SegmentHazardStatusEvaluation {
  const validReports = reports.filter(
    (r) => r.segmentId === segment.id && (r.status === 'pending' || r.status === 'active')
  );

  const distinctReporters = new Set(validReports.map((r) => r.reporterUserId));
  const hasOfficialOrCreatorReport = validReports.some(
    (r) => r.officialSource === true || r.reporterUserId === segment.createdByUserId
  );

  const hazardous =
    segment.hazardous ||
    hasOfficialOrCreatorReport ||
    distinctReporters.size >= HAZARD_REPORTS_THRESHOLD_TO_ACTIVATE;

  let dominantCategory: SegmentHazardCategory | null = segment.hazardCategory ?? null;
  if (validReports.length > 0) {
    const counts = new Map<SegmentHazardCategory, number>();
    for (const r of validReports) {
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }
    let bestCat: SegmentHazardCategory = validReports[0].category;
    let bestCount = 0;
    for (const [cat, count] of counts.entries()) {
      if (count > bestCount) {
        bestCat = cat;
        bestCount = count;
      }
    }
    dominantCategory = bestCat;
  }

  return {
    segmentId: segment.id,
    hazardous,
    dominantCategory: hazardous ? dominantCategory ?? 'other_safety_hazard' : null,
    activeReportCount: validReports.length,
    distinctReporterCount: distinctReporters.size,
    leaderboardEnabled: !hazardous && segment.visibility === 'public' && !segment.deletedAt,
    suppressCompetitionNotifications: hazardous,
    safetyBannerMessage:
      hazardous && (dominantCategory ?? 'other_safety_hazard')
        ? HAZARD_LABELS_FR[dominantCategory ?? 'other_safety_hazard']
        : null,
  };
}

export interface SubmitSegmentHazardResult {
  accepted: boolean;
  rejectionReason?: 'rate_limit_exceeded' | 'duplicate_reporter' | 'invalid_description';
  report?: SegmentHazardReport;
  updatedSegment: SegmentDefinition;
  updatedEfforts: SegmentEffort[];
  evaluation: SegmentHazardStatusEvaluation;
}

/**
 * Soumet un signalement de segment dangereux et met à jour le segment ainsi que
 * l'éligibilité au classement de tous les efforts rattachés.
 */
export function reportSegmentHazard(params: {
  segment: SegmentDefinition;
  existingReports: SegmentHazardReport[];
  efforts: SegmentEffort[];
  reporterUserId: string;
  reporterReportsLastHour: number;
  category: SegmentHazardCategory;
  description: string;
  officialSource?: boolean;
  nowIso?: string;
}): SubmitSegmentHazardResult {
  const {
    segment,
    existingReports,
    efforts,
    reporterUserId,
    reporterReportsLastHour,
    category,
    description,
    officialSource,
  } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();

  if (!officialSource && reporterReportsLastHour >= MAX_HAZARD_REPORTS_PER_USER_HOUR) {
    return {
      accepted: false,
      rejectionReason: 'rate_limit_exceeded',
      updatedSegment: segment,
      updatedEfforts: efforts,
      evaluation: evaluateSegmentHazardStatus(segment, existingReports),
    };
  }

  const alreadyReported = existingReports.some(
    (r) =>
      r.segmentId === segment.id &&
      r.reporterUserId === reporterUserId &&
      (r.status === 'pending' || r.status === 'active')
  );
  if (alreadyReported) {
    return {
      accepted: false,
      rejectionReason: 'duplicate_reporter',
      updatedSegment: segment,
      updatedEfforts: efforts,
      evaluation: evaluateSegmentHazardStatus(segment, existingReports),
    };
  }

  if (!description || description.trim().length < 5) {
    return {
      accepted: false,
      rejectionReason: 'invalid_description',
      updatedSegment: segment,
      updatedEfforts: efforts,
      evaluation: evaluateSegmentHazardStatus(segment, existingReports),
    };
  }

  const newReport: SegmentHazardReport = {
    reportId: `haz_${segment.id}_${reporterUserId}_${Date.parse(nowIso) || 0}`,
    segmentId: segment.id,
    reporterUserId,
    category,
    description: description.trim().slice(0, 1000),
    createdAt: nowIso,
    officialSource: officialSource ?? false,
    status: 'active',
  };

  const allReports = [...existingReports, newReport];
  const evaluation = evaluateSegmentHazardStatus(segment, allReports);

  const updatedSegment: SegmentDefinition = {
    ...segment,
    hazardous: evaluation.hazardous,
    hazardCategory: evaluation.dominantCategory,
    hazardReportedAt: evaluation.hazardous ? segment.hazardReportedAt ?? nowIso : segment.hazardReportedAt,
    verified: evaluation.hazardous ? false : segment.verified,
    updatedAt: nowIso,
  };

  const updatedEfforts = efforts.map((effort) => {
    if (effort.segmentId !== segment.id) return effort;
    if (!evaluation.hazardous) return effort;
    const nextReasons = effort.exclusionReasons.includes('segment_hazardous')
      ? effort.exclusionReasons
      : [...effort.exclusionReasons, 'segment_hazardous' as const];
    return {
      ...effort,
      exclusionReasons: nextReasons,
      eligibleForPublicLeaderboard: false,
    };
  });

  return {
    accepted: true,
    report: newReport,
    updatedSegment,
    updatedEfforts,
    evaluation,
  };
}

/**
 * Résout ou lève l'état de dangerosité d'un segment (après réouverture du sentier ou modération).
 */
export function resolveSegmentHazard(params: {
  segment: SegmentDefinition;
  reports: SegmentHazardReport[];
  efforts: SegmentEffort[];
  nowIso?: string;
}): {
  updatedSegment: SegmentDefinition;
  updatedReports: SegmentHazardReport[];
  updatedEfforts: SegmentEffort[];
  evaluation: SegmentHazardStatusEvaluation;
} {
  const { segment, reports, efforts } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();

  const updatedReports = reports.map((r) =>
    r.segmentId === segment.id && (r.status === 'active' || r.status === 'pending')
      ? { ...r, status: 'resolved' as const }
      : r
  );

  const clearedSegment: SegmentDefinition = {
    ...segment,
    hazardous: false,
    hazardCategory: null,
    hazardReportedAt: null,
    updatedAt: nowIso,
  };

  const evaluation = evaluateSegmentHazardStatus(clearedSegment, updatedReports);

  const updatedEfforts = efforts.map((effort) => {
    if (effort.segmentId !== segment.id) return effort;
    const remainingReasons = effort.exclusionReasons.filter((r) => r !== 'segment_hazardous');
    const isNowValid = effort.status === 'valid' && remainingReasons.length === 0;
    return {
      ...effort,
      exclusionReasons: remainingReasons,
      eligibleForPublicLeaderboard:
        isNowValid && effort.visibility === 'public' && clearedSegment.visibility === 'public',
    };
  });

  return {
    updatedSegment: clearedSegment,
    updatedReports,
    updatedEfforts,
    evaluation,
  };
}

export interface CompetitionNotificationCandidate {
  notificationId: string;
  segmentId: string;
  recipientUserId: string;
  type: 'kom_lost' | 'new_pr_leaderboard' | 'top_10_achieved' | 'live_segment_approaching';
}

/**
 * Filtre les notifications de compétition : aucune notification compétitive ne part
 * pour un segment dangereux (`hazardous = true`) ou privé.
 */
export function filterCompetitionNotificationsForHazardousSegments(
  notifications: CompetitionNotificationCandidate[],
  segmentsById: ReadonlyMap<string, SegmentDefinition>
): CompetitionNotificationCandidate[] {
  return notifications.filter((notif) => {
    const seg = segmentsById.get(notif.segmentId);
    if (!seg) return false;
    if (seg.hazardous || seg.visibility === 'private' || seg.deletedAt) {
      return false;
    }
    return true;
  });
}

/**
 * Machine d'état du sous-drawer « Signaler un danger » (S4.11)
 * avec restauration garantie du contexte parent.
 */
export interface HazardDrawerState {
  isOpen: boolean;
  segmentId: string | null;
  category: SegmentHazardCategory | null;
  description: string;
  parentContext: DrawerParentContext | null;
}

export function openHazardReportDrawer(
  segmentId: string,
  parentContext: DrawerParentContext
): HazardDrawerState {
  return {
    isOpen: true,
    segmentId,
    category: 'dangerous_road_or_traffic',
    description: '',
    parentContext: { ...parentContext },
  };
}

export function closeHazardReportDrawer(state: HazardDrawerState): {
  drawerState: HazardDrawerState;
  restoredParentContext: DrawerParentContext | null;
} {
  return {
    drawerState: {
      isOpen: false,
      segmentId: null,
      category: null,
      description: '',
      parentContext: null,
    },
    restoredParentContext: state.parentContext ? { ...state.parentContext } : null,
  };
}
