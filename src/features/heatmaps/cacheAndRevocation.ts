/**
 * K3.07, K7.06, S3.17, S6.17 — Cache versionné des couches de heatmap et
 * propagation immédiate des révocations de consentement / visibilité / masques.
 *
 * Exigence des fiches C02 :
 * - « Fournir un jeu privé/public et des preuves de suppression dans les agrégats et caches. »
 * - « Révocation avec cache chaud : pas de nouvelle divulgation après retrait. »
 * - Toute cellule qui repasse sous le seuil de k-anonymat après révocation
 *   d'un utilisateur ou d'une activité disparaît immédiatement de l'agrégat.
 */

import { optOutFromGlobalHeatmap } from './consent';
import {
  buildPersonalHeatmapLayer,
  type BuildPersonalHeatmapOptions,
  type PersonalHeatmapAccessResult,
} from './personalHeatmap';
import {
  buildCommunityHeatmapLayer,
  resolvePublicGridResolution,
  resolvePublicMinContributors,
} from './spatialGrid';
import {
  HEATMAP_PROCESSOR_VERSION,
  type AggregateContributionPreferences,
  type CommunityTimeWindow,
  type HeatmapActivityRecord,
  type HeatmapSportFilter,
  type PersonalHeatmapLayer,
  type PublicHeatmapLayer,
  type UserPrivacyZone,
} from './types';

export interface CommunityCacheKeyParams {
  sport: HeatmapSportFilter;
  timeWindow: CommunityTimeWindow;
  gridResolutionDeg?: number;
  minContributors?: number;
}

export interface RevocationProof {
  revokedAt: string;
  reason: 'user_opt_out' | 'activity_visibility_change' | 'privacy_zone_update';
  targetId: string;
  previousEpoch: number;
  newEpoch: number;
  invalidatedCacheKeys: string[];
  /** Cellules entièrement purgées car repassées sous le seuil de k-anonymat. */
  removedCellIds: string[];
  /** Cellules conservées (>= k contributeurs) mais dont le compteur a diminué. */
  decrementedCellIds: string[];
}

interface CachedCommunityEntry {
  key: string;
  epoch: number;
  layer: PublicHeatmapLayer;
}

interface CachedPersonalEntry {
  key: string;
  ownerUserId: string;
  epoch: number;
  layer: PersonalHeatmapLayer;
}

export function formatCommunityCacheKey(params: CommunityCacheKeyParams): string {
  const res = resolvePublicGridResolution(params.gridResolutionDeg);
  const k = resolvePublicMinContributors(params.minContributors);
  return `${HEATMAP_PROCESSOR_VERSION}|community|sport:${params.sport}|win:${params.timeWindow}|res:${res}|k:${k}`;
}

/**
 * Magasin en mémoire versionné des couches de heatmap (communautaires et personnelles)
 * avec invalidation atomique et génération de preuves de révocation.
 */
export class HeatmapAggregateStore {
  private epoch = 1;
  private activities = new Map<string, HeatmapActivityRecord>();
  private consents = new Map<string, AggregateContributionPreferences>();
  private privacyZones = new Map<string, UserPrivacyZone>();
  private revokedUsers = new Set<string>();
  private communityCache = new Map<string, CachedCommunityEntry>();
  private personalCache = new Map<string, CachedPersonalEntry>();

  constructor(initial?: {
    activities?: readonly HeatmapActivityRecord[];
    consents?: readonly AggregateContributionPreferences[];
    privacyZones?: readonly UserPrivacyZone[];
  }) {
    if (initial?.activities) {
      for (const act of initial.activities) {
        this.activities.set(act.activityId, act);
      }
    }
    if (initial?.consents) {
      for (const pref of initial.consents) {
        this.consents.set(pref.userId.trim(), pref);
      }
    }
    if (initial?.privacyZones) {
      for (const zone of initial.privacyZones) {
        this.privacyZones.set(zone.id, zone);
      }
    }
  }

  public getEpoch(): number {
    return this.epoch;
  }

  public getConsent(userId: string): AggregateContributionPreferences | undefined {
    return this.consents.get(userId.trim());
  }

  /** Retourne ou calcule (puis met en cache) une couche communautaire publique. */
  public getCommunityLayer(
    params: CommunityCacheKeyParams & { now?: string }
  ): { layer: PublicHeatmapLayer; fromCache: boolean } {
    const key = formatCommunityCacheKey(params);
    const cached = this.communityCache.get(key);
    if (cached && cached.epoch === this.epoch) {
      return { layer: cached.layer, fromCache: true };
    }

    const layer = buildCommunityHeatmapLayer(Array.from(this.activities.values()), {
      sport: params.sport,
      timeWindow: params.timeWindow,
      gridResolutionDeg: params.gridResolutionDeg,
      minContributors: params.minContributors,
      now: params.now,
      consents: this.consents,
      privacyZones: Array.from(this.privacyZones.values()),
      revokedUserIds: this.revokedUsers,
    });

    this.communityCache.set(key, {
      key,
      epoch: this.epoch,
      layer,
    });

    return { layer, fromCache: false };
  }

  /** Retourne ou calcule (avec contrôle propriétaire strict) une couche personnelle. */
  public getPersonalLayer(
    options: BuildPersonalHeatmapOptions
  ): PersonalHeatmapAccessResult & { fromCache: boolean } {
    const ownerId = (options.ownerUserId ?? '').trim();
    const viewerId = (options.viewerUserId ?? '').trim();
    if (!ownerId || !viewerId || ownerId !== viewerId) {
      const denied = buildPersonalHeatmapLayer([], options);
      return { ...denied, fromCache: false };
    }

    const sportKey =
      options.sport === undefined || options.sport === 'all'
        ? 'all'
        : Array.isArray(options.sport)
          ? [...options.sport].sort().join(',')
          : String(options.sport);
    const periodKey = options.period
      ? `${options.period.kind}:${options.period.fromIso ?? ''}:${options.period.toIso ?? ''}:${options.period.nocturnalOnly ?? false}`
      : 'all_time';
    const key = `personal|${ownerId}|${sportKey}|${periodKey}|priv:${options.includePrivateActivities ?? true}|zones:${options.applyPrivacyZones ?? false}`;

    const cached = this.personalCache.get(key);
    if (cached && cached.epoch === this.epoch) {
      return { authorized: true, layer: cached.layer, fromCache: true };
    }

    const result = buildPersonalHeatmapLayer(
      Array.from(this.activities.values()),
      {
        ...options,
        privacyZones: options.privacyZones ?? Array.from(this.privacyZones.values()),
      }
    );

    if (result.authorized && result.layer) {
      this.personalCache.set(key, {
        key,
        ownerUserId: ownerId,
        epoch: this.epoch,
        layer: result.layer,
      });
    }

    return { ...result, fromCache: false };
  }

  /**
   * Révoque la contribution d'un utilisateur à la heatmap mondiale (K7.06 / S6.17),
   * invalide tous les caches communautaires chauds et produit la preuve de suppression.
   */
  public revokeUserHeatmapContribution(
    userId: string,
    options: { now?: string; revokeAllAggregates?: boolean } = {}
  ): RevocationProof {
    const uid = userId.trim();
    const now = options.now ?? new Date().toISOString();
    const existingPrefs = this.consents.get(uid);

    if (existingPrefs) {
      this.consents.set(
        uid,
        optOutFromGlobalHeatmap(existingPrefs, {
          revokeAllAggregates: options.revokeAllAggregates,
          now,
        })
      );
    }
    this.revokedUsers.add(uid);

    return this.invalidateAndProve('user_opt_out', uid, now);
  }

  /**
   * Met à jour ou révoque la visibilité / suppression d'une activité (P01 / A02 / K3.07)
   * et propage l'invalidation dans les caches communautaires et personnels.
   */
  public updateOrRevokeActivity(
    activityId: string,
    patch: Partial<
      Pick<
        HeatmapActivityRecord,
        'visibility' | 'isPrivate' | 'excludeFromHeatmap' | 'deletedAt' | 'maskingRule'
      >
    >,
    now = new Date().toISOString()
  ): RevocationProof {
    const current = this.activities.get(activityId);
    if (current) {
      this.activities.set(activityId, {
        ...current,
        ...patch,
      });
    }
    return this.invalidateAndProve('activity_visibility_change', activityId, now);
  }

  /**
   * Ajoute ou met à jour une zone de confidentialité géographique (K7.05 / S6.14)
   * et recalcule immédiatement les agrégats mis en cache.
   */
  public upsertPrivacyZone(
    zone: UserPrivacyZone,
    now = new Date().toISOString()
  ): RevocationProof {
    this.privacyZones.set(zone.id, zone);
    return this.invalidateAndProve('privacy_zone_update', zone.id, now);
  }

  private invalidateAndProve(
    reason: RevocationProof['reason'],
    targetId: string,
    now: string
  ): RevocationProof {
    const previousEpoch = this.epoch;
    this.epoch += 1;

    const invalidatedCacheKeys = [
      ...Array.from(this.communityCache.keys()),
      ...Array.from(this.personalCache.keys()),
    ];

    const removedSet = new Set<string>();
    const decrementedSet = new Set<string>();

    // Pour chaque couche communautaire en cache chaud, on compare l'état avant/après
    // afin de prouver la disparition ou décrémentation des cellules affectées.
    for (const entry of this.communityCache.values()) {
      const beforeLayer = entry.layer;
      const afterLayer = buildCommunityHeatmapLayer(Array.from(this.activities.values()), {
        sport: beforeLayer.sport,
        timeWindow: beforeLayer.timeWindow,
        gridResolutionDeg: beforeLayer.gridResolutionDeg,
        minContributors: beforeLayer.minContributors,
        now,
        consents: this.consents,
        privacyZones: Array.from(this.privacyZones.values()),
        revokedUserIds: this.revokedUsers,
      });

      const afterCellsById = new Map(afterLayer.cells.map((c) => [c.cellId, c]));
      for (const beforeCell of beforeLayer.cells) {
        const afterCell = afterCellsById.get(beforeCell.cellId);
        if (!afterCell) {
          removedSet.add(beforeCell.cellId);
        } else if (
          afterCell.distinctContributorCount < beforeCell.distinctContributorCount ||
          afterCell.passageCount < beforeCell.passageCount
        ) {
          decrementedSet.add(beforeCell.cellId);
        }
      }
    }

    // Purge effective des caches chauds
    this.communityCache.clear();
    this.personalCache.clear();

    return {
      revokedAt: now,
      reason,
      targetId,
      previousEpoch,
      newEpoch: this.epoch,
      invalidatedCacheKeys,
      removedCellIds: Array.from(removedSet).sort(),
      decrementedCellIds: Array.from(decrementedSet).sort(),
    };
  }
}
