/**
 * Lot N02 — Gestionnaire de paquets hors ligne (`OfflinePackManager`) :
 * - Machine d'états : `estimated -> queued -> downloading -> paused -> verifying -> available`
 *   (+ `degraded`, `corrupted`, `expired`, `unavailable`).
 * - Staging + Swap atomique : un téléchargement interrompu, corrompu ou hors quota
 *   n'écrase jamais un paquet valide existant.
 * - Reprise sur coupure : seuls les blocs/ressources non encore vérifiés par
 *   SHA-256 sont téléchargés à la reprise.
 * - Quotas & éviction : purge du cache ambiant puis éviction LRU des paquets non
 *   épinglés, protection stricte des paquets épinglés et des séances d'activité.
 * - Politique de déconnexion (logout) : purge explicite des ressources `private_user`
 *   sans détruire les paquets cartographiques publics.
 */

import {
  computeManifestSha256,
  evaluatePackCapabilitiesAndStatus,
  normalizeResourceUri,
  toUtf8Bytes,
  validatePackManifest,
  verifyResourcePayload,
} from './integrity';
import type {
  EvictionResult,
  OfflineDownloadProgress,
  OfflineInstalledPackRecord,
  OfflinePackManifest,
  OfflinePackStatus,
  OfflineResourceDescriptor,
  OfflineStagingSlot,
  StorageQuotaConfig,
  StorageUsageSummary,
  VerifiedResourceChunk,
} from './types';

export type OfflineResourceFetcher = (
  resource: OfflineResourceDescriptor,
  signal?: AbortSignal,
) => Promise<Uint8Array | string>;

export const DEFAULT_STORAGE_QUOTA_CONFIG: StorageQuotaConfig = {
  maxTotalBytes: 500 * 1024 * 1024, // 500 Mo par défaut
  maxAmbientCacheBytes: 64 * 1024 * 1024, // 64 Mo de cache ambiant évictable
  minFreeHeadroomBytes: 2 * 1024 * 1024, // 2 Mo de marge minimale
};

export class OfflinePackManager {
  private readonly quotaConfig: StorageQuotaConfig;
  private readonly activePacks = new Map<string, OfflineInstalledPackRecord>();
  private readonly stagingSlots = new Map<string, OfflineStagingSlot>();
  private readonly estimatedManifests = new Map<string, OfflinePackManifest>();
  private ambientCacheBytes = 0;

  constructor(quotaConfig: Partial<StorageQuotaConfig> = {}) {
    this.quotaConfig = {
      ...DEFAULT_STORAGE_QUOTA_CONFIG,
      ...quotaConfig,
    };
  }

  /** Enregistre ou met à jour le volume occupé par le cache ambiant évictable. */
  setAmbientCacheBytes(bytes: number): void {
    if (Number.isFinite(bytes) && bytes >= 0) {
      this.ambientCacheBytes = Math.floor(bytes);
    }
  }

  getAmbientCacheBytes(): number {
    return this.ambientCacheBytes;
  }

  /**
   * Prépare et valide un manifeste à l'état `estimated` avant mise en file.
   * Recalcule automatiquement `totalExpectedBytes` et `manifestSha256` si omis,
   * et normalise les URIs pour retirer tout jeton éphémère.
   */
  registerEstimatedManifest(
    draft: Omit<OfflinePackManifest, 'manifestSha256' | 'totalExpectedBytes'> & {
      totalExpectedBytes?: number;
      manifestSha256?: string;
    },
  ): { ok: true; manifest: OfflinePackManifest } | { ok: false; reason: string } {
    const normalizedResources: OfflineResourceDescriptor[] = draft.resources.map((r) => ({
      ...r,
      canonicalUri: normalizeResourceUri(r.canonicalUri),
      expectedSha256: r.expectedSha256.toLowerCase(),
    }));
    const computedBytes = normalizedResources.reduce((acc, r) => acc + r.expectedBytes, 0);
    const totalExpectedBytes = draft.totalExpectedBytes ?? computedBytes;

    const baseManifest: Omit<OfflinePackManifest, 'manifestSha256'> = {
      ...draft,
      resources: normalizedResources,
      totalExpectedBytes,
    };
    const manifestSha256 = draft.manifestSha256 ?? computeManifestSha256(baseManifest);
    const fullManifest: OfflinePackManifest = {
      ...baseManifest,
      manifestSha256,
    };

    const validation = validatePackManifest(fullManifest);
    if (!validation.valid) {
      return { ok: false, reason: validation.reason ?? 'invalid_manifest' };
    }

    this.estimatedManifests.set(fullManifest.packId, fullManifest);
    return { ok: true, manifest: fullManifest };
  }

  /**
   * Retourne l'état courant d'un paquet.
   * Si un paquet valide est actif et qu'une mise à jour en staging est en cours
   * ou a échoué, le paquet actif reste `available` (conservation de la dernière version valide).
   */
  getPackStatus(packId: string, nowMs: number = Date.now()): OfflinePackStatus {
    const active = this.activePacks.get(packId);
    if (active) {
      if (active.manifest.expiresAtMs !== null && nowMs > active.manifest.expiresAtMs) {
        active.status = 'expired';
      }
      return active.status;
    }

    const staging = this.stagingSlots.get(packId);
    if (staging) {
      return staging.status;
    }

    if (this.estimatedManifests.has(packId)) {
      return 'estimated';
    }

    return 'unavailable';
  }

  /** Retourne l'enregistrement du paquet actif vérifié (ou `null` s'il n'est pas installé). */
  getInstalledPack(packId: string, touchAccessTime = true, nowMs: number = Date.now()): OfflineInstalledPackRecord | null {
    const record = this.activePacks.get(packId);
    if (!record) return null;
    if (record.manifest.expiresAtMs !== null && nowMs > record.manifest.expiresAtMs) {
      record.status = 'expired';
    }
    if (touchAccessTime) {
      record.lastAccessedAtMs = nowMs;
    }
    return record;
  }

  /** Liste tous les paquets installés et vérifiés. */
  listInstalledPacks(nowMs: number = Date.now()): OfflineInstalledPackRecord[] {
    const out: OfflineInstalledPackRecord[] = [];
    for (const record of this.activePacks.values()) {
      if (record.manifest.expiresAtMs !== null && nowMs > record.manifest.expiresAtMs) {
        record.status = 'expired';
      }
      out.push(record);
    }
    return out;
  }

  /** Retourne l'état du slot de staging (téléchargement initial ou mise à jour en cours). */
  getStagingSlot(packId: string): OfflineStagingSlot | null {
    return this.stagingSlots.get(packId) ?? null;
  }

  /**
   * Calcule la synthèse exacte de l'occupation du stockage.
   * Les ressources partagées entre plusieurs paquets (dédupliquées par URI canonique + SHA-256)
   * ne sont comptabilisées qu'une seule fois dans l'espace physique consommé.
   */
  getStorageUsage(): StorageUsageSummary {
    let pinnedPacksBytes = 0;
    let unpinnedPacksBytes = 0;

    for (const pack of this.activePacks.values()) {
      if (pack.manifest.pinned) {
        pinnedPacksBytes += pack.actualStoredBytes;
      } else {
        unpinnedPacksBytes += pack.actualStoredBytes;
      }
    }

    let stagingBytes = 0;
    for (const slot of this.stagingSlots.values()) {
      stagingBytes += slot.stagedBytes;
    }

    const totalUsedBytes =
      pinnedPacksBytes + unpinnedPacksBytes + stagingBytes + this.ambientCacheBytes;
    const availableBytes = Math.max(0, this.quotaConfig.maxTotalBytes - totalUsedBytes);

    return {
      maxTotalBytes: this.quotaConfig.maxTotalBytes,
      pinnedPacksBytes,
      unpinnedPacksBytes,
      stagingBytes,
      ambientCacheBytes: this.ambientCacheBytes,
      totalUsedBytes,
      availableBytes,
      installedPackCount: this.activePacks.size,
      recordedActivitySessionsProtected: true,
    };
  }

  /**
   * Libère de l'espace disque pour accueillir `requiredBytes` supplémentaires :
   * 1. Purge d'abord le cache ambiant (`ambientCacheBytes`).
   * 2. Évicte ensuite les paquets non épinglés (`pinned: false`) par ordre LRU
   *    (`lastAccessedAtMs` croissant), en excluant tout paquet explicitement protégé.
   * 3. Ne touche JAMAIS aux paquets épinglés (`pinned: true`) ni aux séances enregistrées.
   */
  evictToFitBytes(
    requiredBytes: number,
    protectedPackIds: ReadonlySet<string> = new Set(),
  ): EvictionResult {
    const neededWithHeadroom = requiredBytes + this.quotaConfig.minFreeHeadroomBytes;
    const initialUsage = this.getStorageUsage();

    if (initialUsage.availableBytes >= neededWithHeadroom) {
      return {
        freedBytes: 0,
        evictedAmbientBytes: 0,
        evictedPackIds: [],
        sufficientSpaceAchieved: true,
        reason: null,
      };
    }

    let deficit = neededWithHeadroom - initialUsage.availableBytes;
    let freedBytes = 0;
    let evictedAmbientBytes = 0;
    const evictedPackIds: string[] = [];

    if (this.ambientCacheBytes > 0) {
      const takeAmbient = Math.min(this.ambientCacheBytes, deficit);
      this.ambientCacheBytes -= takeAmbient;
      evictedAmbientBytes = takeAmbient;
      freedBytes += takeAmbient;
      deficit -= takeAmbient;
    }

    if (deficit > 0) {
      const candidates = Array.from(this.activePacks.values())
        .filter((p) => !p.manifest.pinned && !protectedPackIds.has(p.manifest.packId))
        .sort((a, b) => a.lastAccessedAtMs - b.lastAccessedAtMs);

      for (const candidate of candidates) {
        if (deficit <= 0) break;
        const reclaimed = candidate.actualStoredBytes;
        this.activePacks.delete(candidate.manifest.packId);
        evictedPackIds.push(candidate.manifest.packId);
        freedBytes += reclaimed;
        deficit -= reclaimed;
      }
    }

    const finalUsage = this.getStorageUsage();
    const sufficientSpaceAchieved = finalUsage.availableBytes >= neededWithHeadroom;

    return {
      freedBytes,
      evictedAmbientBytes,
      evictedPackIds,
      sufficientSpaceAchieved,
      reason: sufficientSpaceAchieved ? null : 'insufficient_storage_quota_after_lru_eviction',
    };
  }

  /**
   * Recherche une ressource déjà vérifiée (même URI canonique et même SHA-256)
   * dans les paquets actifs installés afin d'éviter de retélécharger les mêmes tuiles (K4.16).
   */
  private findAlreadyVerifiedResourceInActivePacks(
    descriptor: OfflineResourceDescriptor,
  ): VerifiedResourceChunk | null {
    for (const pack of this.activePacks.values()) {
      if (pack.status !== 'available' && pack.status !== 'degraded') continue;
      for (const chunk of pack.verifiedResources.values()) {
        if (
          chunk.canonicalUri === descriptor.canonicalUri &&
          chunk.actualSha256.toLowerCase() === descriptor.expectedSha256.toLowerCase() &&
          chunk.actualBytes === descriptor.expectedBytes
        ) {
          return chunk;
        }
      }
    }
    return null;
  }

  /**
   * Lance ou reprend le téléchargement d'un paquet dans un slot de staging isolé,
   * vérifie chaque ressource par SHA-256 et procède au swap atomique uniquement
   * si toutes les ressources obligatoires sont intègres.
   */
  async downloadOrResumePack(
    manifestInput: OfflinePackManifest,
    fetcher: OfflineResourceFetcher,
    options: {
      signal?: AbortSignal;
      nowMs?: number;
      hasLocalRoutingEngine?: boolean;
      onProgress?: (progress: OfflineDownloadProgress) => void;
    } = {},
  ): Promise<OfflineDownloadProgress> {
    const nowMs = options.nowMs ?? Date.now();
    const manifestValidation = validatePackManifest(manifestInput);
    const existingActive = this.activePacks.get(manifestInput.packId);

    if (!manifestValidation.valid) {
      if (existingActive) {
        existingActive.preservedPreviousVersionOnFailure = true;
      }
      return {
        packId: manifestInput.packId,
        status: 'corrupted',
        verifiedResourcesCount: 0,
        totalResourcesCount: manifestInput.resources.length,
        downloadedBytes: 0,
        totalExpectedBytes: manifestInput.totalExpectedBytes,
        reusedCachedTilesCount: 0,
        reusedCachedBytes: 0,
        failureReason: manifestValidation.reason ?? 'invalid_manifest',
      };
    }

    // Récupère ou initialise le slot de staging sans toucher au paquet actif existant
    let slot = this.stagingSlots.get(manifestInput.packId);
    if (!slot || slot.targetManifest.manifestSha256 !== manifestInput.manifestSha256) {
      slot = {
        packId: manifestInput.packId,
        targetManifest: manifestInput,
        status: 'queued',
        verifiedChunks: new Map<string, VerifiedResourceChunk>(),
        reusedResourceIds: new Set<string>(),
        stagedBytes: 0,
        startedAtMs: nowMs,
        updatedAtMs: nowMs,
        failureReason: null,
      };
      this.stagingSlots.set(manifestInput.packId, slot);
    }

    // Détermine les ressources restant à acquérir et celles réutilisables en cache
    let additionalBytesNeeded = 0;
    let reusedCachedTilesCount = 0;
    let reusedCachedBytes = 0;

    for (const resource of manifestInput.resources) {
      if (slot.verifiedChunks.has(resource.id)) {
        if (slot.reusedResourceIds.has(resource.id)) {
          reusedCachedTilesCount += 1;
          reusedCachedBytes += resource.expectedBytes;
        }
        continue;
      }

      const cachedChunk = this.findAlreadyVerifiedResourceInActivePacks(resource);
      if (cachedChunk) {
        slot.verifiedChunks.set(resource.id, {
          ...cachedChunk,
          resourceId: resource.id,
        });
        slot.reusedResourceIds.add(resource.id);
        reusedCachedTilesCount += 1;
        reusedCachedBytes += resource.expectedBytes;
      } else {
        additionalBytesNeeded += resource.expectedBytes;
      }
    }

    // Vérifie le quota de stockage avant de télécharger (protège la version active existante)
    const protectedIds = new Set<string>([manifestInput.packId]);
    const eviction = this.evictToFitBytes(additionalBytesNeeded, protectedIds);
    if (!eviction.sufficientSpaceAchieved) {
      slot.status = 'paused';
      slot.failureReason = 'insufficient_storage_space';
      slot.updatedAtMs = nowMs;
      if (existingActive) {
        existingActive.preservedPreviousVersionOnFailure = true;
      }
      const progress: OfflineDownloadProgress = {
        packId: manifestInput.packId,
        status: 'paused',
        verifiedResourcesCount: slot.verifiedChunks.size,
        totalResourcesCount: manifestInput.resources.length,
        downloadedBytes: slot.stagedBytes + reusedCachedBytes,
        totalExpectedBytes: manifestInput.totalExpectedBytes,
        reusedCachedTilesCount,
        reusedCachedBytes,
        failureReason: 'insufficient_storage_space',
      };
      options.onProgress?.(progress);
      return progress;
    }

    slot.status = 'downloading';
    slot.failureReason = null;
    slot.updatedAtMs = nowMs;

    for (const resource of manifestInput.resources) {
      if (slot.verifiedChunks.has(resource.id)) {
        continue;
      }

      if (options.signal?.aborted) {
        slot.status = 'paused';
        slot.failureReason = 'download_interrupted';
        slot.updatedAtMs = Date.now();
        if (existingActive) {
          existingActive.preservedPreviousVersionOnFailure = true;
        }
        const interruptedProgress: OfflineDownloadProgress = {
          packId: manifestInput.packId,
          status: 'paused',
          verifiedResourcesCount: slot.verifiedChunks.size,
          totalResourcesCount: manifestInput.resources.length,
          downloadedBytes: slot.stagedBytes + reusedCachedBytes,
          totalExpectedBytes: manifestInput.totalExpectedBytes,
          reusedCachedTilesCount,
          reusedCachedBytes,
          failureReason: 'download_interrupted',
        };
        options.onProgress?.(interruptedProgress);
        return interruptedProgress;
      }

      try {
        const payload = await fetcher(resource, options.signal);
        const verification = verifyResourcePayload(resource, payload);

        if (!verification.ok) {
          if (resource.required) {
            // Fail-closed : une ressource obligatoire corrompue ou tronquée bloque le paquet
            slot.status = 'corrupted';
            slot.failureReason = `resource_${resource.id}_${verification.failureReason}`;
            slot.updatedAtMs = Date.now();
            if (existingActive) {
              existingActive.preservedPreviousVersionOnFailure = true;
            }
            const corruptedProgress: OfflineDownloadProgress = {
              packId: manifestInput.packId,
              status: 'corrupted',
              verifiedResourcesCount: slot.verifiedChunks.size,
              totalResourcesCount: manifestInput.resources.length,
              downloadedBytes: slot.stagedBytes + reusedCachedBytes,
              totalExpectedBytes: manifestInput.totalExpectedBytes,
              reusedCachedTilesCount,
              reusedCachedBytes,
              failureReason: slot.failureReason,
            };
            options.onProgress?.(corruptedProgress);
            return corruptedProgress;
          }
          // Ressource optionnelle (ex. glyphe ou aperçu média secondaire) absente/invalide -> mode dégradé
          continue;
        }

        const chunk: VerifiedResourceChunk = {
          resourceId: resource.id,
          canonicalUri: resource.canonicalUri,
          actualSha256: verification.actualSha256,
          actualBytes: verification.actualBytes,
          verifiedAtMs: Date.now(),
          payload: payload instanceof Uint8Array ? new Uint8Array(payload) : toUtf8Bytes(payload),
        };
        slot.verifiedChunks.set(resource.id, chunk);
        slot.stagedBytes += verification.actualBytes;
        slot.updatedAtMs = Date.now();

        options.onProgress?.({
          packId: manifestInput.packId,
          status: 'downloading',
          verifiedResourcesCount: slot.verifiedChunks.size,
          totalResourcesCount: manifestInput.resources.length,
          downloadedBytes: slot.stagedBytes + reusedCachedBytes,
          totalExpectedBytes: manifestInput.totalExpectedBytes,
          reusedCachedTilesCount,
          reusedCachedBytes,
          failureReason: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'network_or_io_interruption';
        // Si une ressource optionnelle échoue parce qu'elle est introuvable (404/missing),
        // on continue pour permettre l'état `degraded` ; sinon on met en pause pour reprise.
        if (!resource.required && message.includes('optional_missing')) {
          continue;
        }

        slot.status = 'paused';
        slot.failureReason = 'download_interrupted';
        slot.updatedAtMs = Date.now();
        if (existingActive) {
          existingActive.preservedPreviousVersionOnFailure = true;
        }
        const pausedProgress: OfflineDownloadProgress = {
          packId: manifestInput.packId,
          status: 'paused',
          verifiedResourcesCount: slot.verifiedChunks.size,
          totalResourcesCount: manifestInput.resources.length,
          downloadedBytes: slot.stagedBytes + reusedCachedBytes,
          totalExpectedBytes: manifestInput.totalExpectedBytes,
          reusedCachedTilesCount,
          reusedCachedBytes,
          failureReason: 'download_interrupted',
        };
        options.onProgress?.(pausedProgress);
        return pausedProgress;
      }
    }

    // Phase de vérification finale avant swap atomique
    slot.status = 'verifying';
    const evaluation = evaluatePackCapabilitiesAndStatus(
      manifestInput,
      slot.verifiedChunks,
      {
        nowMs,
        hasLocalRoutingEngine: options.hasLocalRoutingEngine,
      },
    );

    if (evaluation.status === 'corrupted') {
      slot.status = 'corrupted';
      slot.failureReason = 'final_integrity_verification_failed';
      if (existingActive) {
        existingActive.preservedPreviousVersionOnFailure = true;
      }
      const failedProgress: OfflineDownloadProgress = {
        packId: manifestInput.packId,
        status: 'corrupted',
        verifiedResourcesCount: slot.verifiedChunks.size,
        totalResourcesCount: manifestInput.resources.length,
        downloadedBytes: slot.stagedBytes + reusedCachedBytes,
        totalExpectedBytes: manifestInput.totalExpectedBytes,
        reusedCachedTilesCount,
        reusedCachedBytes,
        failureReason: slot.failureReason,
      };
      options.onProgress?.(failedProgress);
      return failedProgress;
    }

    // Swap atomique : promotion du slot de staging vers `activePacks`
    const verifiedManifest: OfflinePackManifest = {
      ...manifestInput,
      verifiedAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const installedRecord: OfflineInstalledPackRecord = {
      manifest: verifiedManifest,
      status: evaluation.status,
      capabilities: evaluation.capabilities,
      verifiedResources: new Map(slot.verifiedChunks),
      actualStoredBytes: slot.stagedBytes,
      lastAccessedAtMs: nowMs,
      installedAtMs: nowMs,
      failureReason: null,
      preservedPreviousVersionOnFailure: false,
    };

    this.activePacks.set(manifestInput.packId, installedRecord);
    this.stagingSlots.delete(manifestInput.packId);
    this.estimatedManifests.delete(manifestInput.packId);

    const completedProgress: OfflineDownloadProgress = {
      packId: manifestInput.packId,
      status: evaluation.status,
      verifiedResourcesCount: installedRecord.verifiedResources.size,
      totalResourcesCount: manifestInput.resources.length,
      downloadedBytes: installedRecord.actualStoredBytes + reusedCachedBytes,
      totalExpectedBytes: manifestInput.totalExpectedBytes,
      reusedCachedTilesCount,
      reusedCachedBytes,
      failureReason: null,
    };
    options.onProgress?.(completedProgress);
    return completedProgress;
  }

  /**
   * Supprime un paquet hors ligne ou annule son téléchargement en cours,
   * libère exactement l'espace annoncé et conserve intactes les séances d'activité.
   */
  removePack(packId: string): {
    removed: boolean;
    freedBytes: number;
    storageSummary: StorageUsageSummary;
  } {
    let freedBytes = 0;
    let removed = false;

    const staging = this.stagingSlots.get(packId);
    if (staging) {
      freedBytes += staging.stagedBytes;
      this.stagingSlots.delete(packId);
      removed = true;
    }

    const active = this.activePacks.get(packId);
    if (active) {
      freedBytes += active.actualStoredBytes;
      this.activePacks.delete(packId);
      removed = true;
    }

    if (this.estimatedManifests.delete(packId)) {
      removed = true;
    }

    return {
      removed,
      freedBytes,
      storageSummary: this.getStorageUsage(),
    };
  }

  /**
   * Recherche 04 §Manifeste proposé :
   * « un logout doit traiter explicitement les médias privés téléchargés ; la
   * carte publique et la trace personnelle n'ont pas la même politique. »
   */
  purgePrivateDataOnLogout(userId: string): {
    removedPackIds: string[];
    strippedPrivateResourceCount: number;
    freedBytes: number;
  } {
    const removedPackIds: string[] = [];
    let strippedPrivateResourceCount = 0;
    let freedBytes = 0;

    for (const [packId, slot] of this.stagingSlots.entries()) {
      if (slot.targetManifest.ownerUserId === userId) {
        freedBytes += slot.stagedBytes;
        this.stagingSlots.delete(packId);
        removedPackIds.push(packId);
      }
    }

    for (const [packId, pack] of this.activePacks.entries()) {
      const isUserOwnedRoutePack =
        pack.manifest.ownerUserId === userId && pack.manifest.kind === 'route_corridor';

      if (isUserOwnedRoutePack) {
        freedBytes += pack.actualStoredBytes;
        this.activePacks.delete(packId);
        removedPackIds.push(packId);
        continue;
      }

      // Pour un pack régional conservé sur l'appareil, purger toute ressource `private_user`
      const mutableResources = new Map(pack.verifiedResources);
      let packFreed = 0;
      for (const descriptor of pack.manifest.resources) {
        if (descriptor.privacyScope === 'private_user') {
          const chunk = mutableResources.get(descriptor.id);
          if (chunk) {
            packFreed += chunk.actualBytes;
            mutableResources.delete(descriptor.id);
            strippedPrivateResourceCount += 1;
          }
        }
      }
      if (packFreed > 0) {
        freedBytes += packFreed;
        pack.actualStoredBytes = Math.max(0, pack.actualStoredBytes - packFreed);
        (pack as { verifiedResources: ReadonlyMap<string, VerifiedResourceChunk> }).verifiedResources =
          mutableResources;
      }
    }

    return {
      removedPackIds,
      strippedPrivateResourceCount,
      freedBytes,
    };
  }
}
