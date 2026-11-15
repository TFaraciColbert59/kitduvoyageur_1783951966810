/**
 * K7.06 & S6.17 — Consentement granulaire aux données agrégées et opt-out strict
 * de la heatmap mondiale.
 *
 * Invariants (Confidentialité fail-closed) :
 * 1. Aucun consentement implicite : si les préférences d'un utilisateur sont
 *    absentes ou invalides, toutes les finalités (`global_heatmap`,
 *    `route_recommendations`, `mobility_aggregates`) sont refusées (`false`).
 * 2. Priorité absolue à l'opt-out (K7.06) : si `globalHeatmapOptOut === true`,
 *    l'utilisateur est exclu de la heatmap mondiale même si `globalHeatmap`
 *    était resté à `true` dans un état incohérent.
 * 3. Indépendance des finalités (S6.17) : un utilisateur peut autoriser les
 *    recommandations de parcours ou les données de mobilité tout en faisant
 *    opt-out de la heatmap mondiale, et inversement.
 * 4. Toute activité privée (`visibility === 'private'` ou `'followers_only'`,
 *    `isPrivate === true`), exclue unitairement (`excludeFromHeatmap === true`),
 *    non terminée (`sessionFinished === false`) ou supprimée (`deletedAt != null`)
 *    est refusée pour toute agrégation publique/communautaire.
 */

import { createHash } from 'node:crypto';
import type {
  AggregateContributionPreferences,
  AggregateContributionScope,
  HeatmapActivityRecord,
} from './types';

/** Raisons explicites et stables de non-éligibilité à une agrégation publique. */
export const HEATMAP_EXCLUSION_REASONS = {
  missingUserId: 'identifiant_utilisateur_manquant',
  missingConsentRecord: 'consentement_utilisateur_absent',
  globalHeatmapOptOut: 'opt_out_heatmap_mondiale_actif',
  scopeConsentDenied: 'consentement_finalite_refuse',
  activityDeleted: 'activite_supprimee',
  sessionNotFinished: 'seance_non_terminee',
  privateVisibility: 'visibilite_non_publique',
  activityOptOut: 'exclusion_unitaire_activite',
  entireTraceHidden: 'trace_entiere_masquee',
  emptyPoints: 'aucun_point_gps',
} as const;

export type HeatmapExclusionReason =
  (typeof HEATMAP_EXCLUSION_REASONS)[keyof typeof HEATMAP_EXCLUSION_REASONS];

export interface ActivityContributionEligibility {
  eligible: boolean;
  reasons: HeatmapExclusionReason[];
}

export interface UpdateContributionPatch {
  globalHeatmapOptOut?: boolean;
  globalHeatmap?: boolean;
  routeRecommendations?: boolean;
  mobilityAggregates?: boolean;
  now?: string;
}

/**
 * Construit un enregistrement de préférences par défaut **fail-closed**
 * (aucune contribution publique tant que l'utilisateur n'a pas consenti).
 */
export function createDefaultContributionPreferences(
  userId: string,
  now = new Date().toISOString()
): AggregateContributionPreferences {
  return {
    userId: userId.trim(),
    globalHeatmapOptOut: true,
    globalHeatmap: false,
    routeRecommendations: false,
    mobilityAggregates: false,
    updatedAt: now,
    revision: 1,
  };
}

/**
 * Normalise un enregistrement de préférences en appliquant la règle K7.06 :
 * `globalHeatmapOptOut === true` force systématiquement `globalHeatmap = false`,
 * et `globalHeatmap === false` maintient `globalHeatmapOptOut = true`.
 */
export function normalizeContributionPreferences(
  prefs: AggregateContributionPreferences
): AggregateContributionPreferences {
  const optedOut = prefs.globalHeatmapOptOut === true || prefs.globalHeatmap !== true;
  return {
    userId: (prefs.userId ?? '').trim(),
    globalHeatmapOptOut: optedOut,
    globalHeatmap: !optedOut,
    routeRecommendations: prefs.routeRecommendations === true,
    mobilityAggregates: prefs.mobilityAggregates === true,
    updatedAt: prefs.updatedAt,
    revision: Number.isFinite(prefs.revision) && prefs.revision >= 1 ? Math.floor(prefs.revision) : 1,
  };
}

/**
 * Met à jour les préférences de contribution aux données agrégées (K7.06, S6.17)
 * en incrémentant la révision et l'horodatage pour déclencher l'invalidation des caches.
 */
export function updateAggregateContributionPreferences(
  current: AggregateContributionPreferences,
  patch: UpdateContributionPatch
): AggregateContributionPreferences {
  const now = patch.now ?? new Date().toISOString();
  let nextGlobalHeatmap = current.globalHeatmap;
  let nextOptOut = current.globalHeatmapOptOut;

  if (typeof patch.globalHeatmapOptOut === 'boolean') {
    nextOptOut = patch.globalHeatmapOptOut;
    if (nextOptOut) {
      nextGlobalHeatmap = false;
    } else if (typeof patch.globalHeatmap !== 'boolean') {
      nextGlobalHeatmap = true;
    }
  }

  if (typeof patch.globalHeatmap === 'boolean') {
    nextGlobalHeatmap = patch.globalHeatmap && patch.globalHeatmapOptOut !== true;
    nextOptOut = !nextGlobalHeatmap;
  }

  return normalizeContributionPreferences({
    userId: current.userId,
    globalHeatmapOptOut: nextOptOut,
    globalHeatmap: nextGlobalHeatmap,
    routeRecommendations:
      typeof patch.routeRecommendations === 'boolean'
        ? patch.routeRecommendations
        : current.routeRecommendations,
    mobilityAggregates:
      typeof patch.mobilityAggregates === 'boolean'
        ? patch.mobilityAggregates
        : current.mobilityAggregates,
    updatedAt: now,
    revision: (current.revision || 0) + 1,
  });
}

/**
 * Active immédiatement l'opt-out strict de la heatmap mondiale (K7.06).
 * Conserve les choix S6.17 des autres finalités sauf si `revokeAllAggregates` est vrai.
 */
export function optOutFromGlobalHeatmap(
  current: AggregateContributionPreferences,
  options: { revokeAllAggregates?: boolean; now?: string } = {}
): AggregateContributionPreferences {
  return updateAggregateContributionPreferences(current, {
    globalHeatmapOptOut: true,
    globalHeatmap: false,
    ...(options.revokeAllAggregates
      ? { routeRecommendations: false, mobilityAggregates: false }
      : {}),
    now: options.now,
  });
}

/**
 * Vérifie de manière fail-closed si un utilisateur autorise une finalité d'agrégation donnée (S6.17).
 */
export function isScopeConsented(
  prefs: AggregateContributionPreferences | null | undefined,
  scope: AggregateContributionScope
): boolean {
  if (!prefs || typeof prefs.userId !== 'string' || prefs.userId.trim() === '') {
    return false;
  }
  const normalized = normalizeContributionPreferences(prefs);
  switch (scope) {
    case 'global_heatmap':
      return normalized.globalHeatmap === true && normalized.globalHeatmapOptOut === false;
    case 'route_recommendations':
      return normalized.routeRecommendations === true;
    case 'mobility_aggregates':
      return normalized.mobilityAggregates === true;
    default:
      return false;
  }
}

/**
 * Évalue si une activité peut contribuer à un agrégat public pour une finalité donnée
 * (`global_heatmap` par défaut). Fail-closed sur toute condition manquante ou ambiguë.
 */
export function evaluateActivityPublicEligibility(
  activity: HeatmapActivityRecord,
  userPreferences: AggregateContributionPreferences | null | undefined,
  scope: AggregateContributionScope = 'global_heatmap'
): ActivityContributionEligibility {
  const reasons: HeatmapExclusionReason[] = [];

  const userId = (activity.userId ?? '').trim();
  if (!userId) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.missingUserId);
  }

  if (!userPreferences || (userPreferences.userId ?? '').trim() !== userId) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.missingConsentRecord);
  } else {
    if (
      scope === 'global_heatmap' &&
      (userPreferences.globalHeatmapOptOut === true || userPreferences.globalHeatmap !== true)
    ) {
      reasons.push(HEATMAP_EXCLUSION_REASONS.globalHeatmapOptOut);
    } else if (!isScopeConsented(userPreferences, scope)) {
      reasons.push(HEATMAP_EXCLUSION_REASONS.scopeConsentDenied);
    }
  }

  if (activity.deletedAt != null && activity.deletedAt !== '') {
    reasons.push(HEATMAP_EXCLUSION_REASONS.activityDeleted);
  }

  if (activity.sessionFinished === false) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.sessionNotFinished);
  }

  const isPubliclyAggregableVisibility =
    activity.visibility === 'collective_anonymized' || activity.visibility === 'public';

  if (!isPubliclyAggregableVisibility || activity.isPrivate === true) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.privateVisibility);
  }

  if (activity.excludeFromHeatmap === true) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.activityOptOut);
  }

  if (activity.maskingRule?.hideEntireTrace === true) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.entireTraceHidden);
  }

  if (!Array.isArray(activity.points) || activity.points.length === 0) {
    reasons.push(HEATMAP_EXCLUSION_REASONS.emptyPoints);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Hash irréversible d'un identifiant utilisateur pour le comptage k-anonymat
 * dans une cellule sans jamais conserver l'identifiant brut en mémoire d'agrégat.
 */
export function anonymizeContributorId(userId: string, salt = 'lkdv-c02-k-anon-v1'): string {
  return createHash('sha256')
    .update(`${salt}:${userId.trim()}`)
    .digest('hex')
    .slice(0, 32);
}
