/**
 * K6.09 / K6.11 — Synchronisation et validation des paquets de cartes et
 * d'itinéraires hors ligne sur montre (Apple Watch & Wear OS) — Recherche 04.
 *
 * Invariants vérifiés :
 * 1. Déclaration séparée des capacités (`viewRouteTrace`, `viewBaseMap`,
 *    `followTurnByTurn`, `localPlaceSearch`, `localRerouting`, `liveWeatherAndClosures`).
 * 2. Un paquet n'est jamais déclaré `available` à la simple création ni avant la
 *    vérification complète des ressources et des droits fournisseur.
 * 3. Si le style ou les tuiles sont présents mais qu'une police (`glyphs`) ou
 *    `sprites` manque, l'état passe en `degraded` (pas de carte blanche silencieuse).
 * 4. Reprise par blocs (`chunkIndex`) après coupure Bluetooth.
 * 5. Lors du remplacement d'une révision d'itinéraire, la dernière version valide
 *    est conservée tant que la nouvelle n'est pas validée (ou en cas d'espace
 *    insuffisant `insufficient_storage`).
 */

import type {
  WatchOfflinePackCapabilities,
  WatchOfflinePackChunk,
  WatchOfflinePackManifest,
  WatchOfflinePackRecord,
} from './types';

export function evaluateOfflinePackCapabilities(
  manifest: WatchOfflinePackManifest,
  verifiedResourceIds: ReadonlySet<string>,
): WatchOfflinePackCapabilities {
  if (!manifest.OfflineLicenseAllowed) {
    return {
      viewRouteTrace: false,
      viewBaseMap: false,
      followTurnByTurn: false,
      localPlaceSearch: false,
      localRerouting: false,
      liveWeatherAndClosures: false,
    };
  }

  const hasVerifiedKind = (
    kind: WatchOfflinePackManifest['resources'][number]['kind'],
  ): boolean => {
    const matching = manifest.resources.filter((r) => r.kind === kind);
    return matching.length > 0 && matching.every((r) => verifiedResourceIds.has(r.resourceId));
  };

  const hasRouteGeometry = hasVerifiedKind('route_geometry');
  const hasStyle = hasVerifiedKind('style_json');
  const hasTiles = hasVerifiedKind('vector_tiles');
  const hasGlyphs = hasVerifiedKind('glyphs');
  const hasManeuvers = hasVerifiedKind('maneuvers');

  return {
    viewRouteTrace: hasRouteGeometry,
    viewBaseMap: hasRouteGeometry && hasStyle && hasTiles && hasGlyphs,
    followTurnByTurn: hasRouteGeometry && hasManeuvers,
    // Recherche 04 : ni l'index d'adresses ni le graphe de routage Valhalla ne
    // sont acquis par le seul paquet cartographique montre.
    localPlaceSearch: false,
    localRerouting: false,
    liveWeatherAndClosures: false,
  };
}

export class WatchOfflinePackManager {
  private readonly packs = new Map<string, WatchOfflinePackRecord>();
  private availableStorageBytes: number;

  constructor(initialStorageBytes = 128 * 1024 * 1024) {
    this.availableStorageBytes = Math.max(0, initialStorageBytes);
  }

  setAvailableStorageBytes(bytes: number): void {
    this.availableStorageBytes = Math.max(0, bytes);
  }

  getAvailableStorageBytes(): number {
    return this.availableStorageBytes;
  }

  /**
   * Prépare ou met en file un paquet hors ligne pour la montre.
   * Si une révision valide précédente existe déjà pour le même `packId`, elle
   * est sauvegardée dans `previousValidManifest` jusqu'à validation complète
   * de la nouvelle révision.
   */
  stageManifest(
    manifest: WatchOfflinePackManifest,
    totalChunks: number,
    nowUtcMs = Date.now(),
  ): WatchOfflinePackRecord {
    const existing = this.packs.get(manifest.packId);
    const previousValidManifest =
      existing && (existing.status === 'available' || existing.status === 'degraded')
        ? existing.manifest
        : existing?.previousValidManifest ?? null;

    if (!manifest.OfflineLicenseAllowed) {
      const denied: WatchOfflinePackRecord = {
        manifest,
        status: 'error',
        capabilities: evaluateOfflinePackCapabilities(manifest, new Set()),
        transferredBytes: 0,
        ackedChunkIndex: -1,
        totalChunks: Math.max(1, totalChunks),
        verifiedResourceIds: [],
        missingResourceIds: manifest.resources.map((r) => r.resourceId),
        errorReason: 'provider_rights_denied',
        lastVerifiedAtUtcMs: null,
        previousValidManifest,
        updatedAtUtcMs: nowUtcMs,
      };
      this.packs.set(manifest.packId, denied);
      return this.cloneRecord(denied);
    }

    if (manifest.totalBytes > this.availableStorageBytes) {
      // Recherche 04 : si l'espace manque lors d'un remplacement, conserver la
      // dernière version valide utilisable ou signaler explicitement l'erreur.
      if (previousValidManifest) {
        const preserved: WatchOfflinePackRecord = {
          manifest: previousValidManifest,
          status: 'available',
          capabilities: evaluateOfflinePackCapabilities(
            previousValidManifest,
            new Set(previousValidManifest.resources.map((r) => r.resourceId)),
          ),
          transferredBytes: previousValidManifest.totalBytes,
          ackedChunkIndex: Math.max(1, totalChunks) - 1,
          totalChunks: Math.max(1, totalChunks),
          verifiedResourceIds: previousValidManifest.resources.map((r) => r.resourceId),
          missingResourceIds: [],
          errorReason: 'insufficient_storage',
          lastVerifiedAtUtcMs: existing?.lastVerifiedAtUtcMs ?? nowUtcMs,
          previousValidManifest,
          updatedAtUtcMs: nowUtcMs,
        };
        this.packs.set(manifest.packId, preserved);
        return this.cloneRecord(preserved);
      }

      const errored: WatchOfflinePackRecord = {
        manifest,
        status: 'error',
        capabilities: evaluateOfflinePackCapabilities(manifest, new Set()),
        transferredBytes: 0,
        ackedChunkIndex: -1,
        totalChunks: Math.max(1, totalChunks),
        verifiedResourceIds: [],
        missingResourceIds: manifest.resources.map((r) => r.resourceId),
        errorReason: 'insufficient_storage',
        lastVerifiedAtUtcMs: null,
        previousValidManifest: null,
        updatedAtUtcMs: nowUtcMs,
      };
      this.packs.set(manifest.packId, errored);
      return this.cloneRecord(errored);
    }

    const record: WatchOfflinePackRecord = {
      manifest,
      status: 'queued',
      capabilities: evaluateOfflinePackCapabilities(manifest, new Set()),
      transferredBytes: 0,
      ackedChunkIndex: -1,
      totalChunks: Math.max(1, totalChunks),
      verifiedResourceIds: [],
      missingResourceIds: manifest.resources.map((r) => r.resourceId),
      errorReason: null,
      lastVerifiedAtUtcMs: null,
      previousValidManifest,
      updatedAtUtcMs: nowUtcMs,
    };

    this.packs.set(manifest.packId, record);
    return this.cloneRecord(record);
  }

  /**
   * Reçoit un bloc (`WatchOfflinePackChunk`) de manière idempotente et ordonnée.
   */
  ingestChunk(
    chunk: WatchOfflinePackChunk,
    nowUtcMs = Date.now(),
  ): {
    ackedChunkIndex: number;
    record: WatchOfflinePackRecord;
  } {
    const record = this.packs.get(chunk.packId);
    if (!record) {
      throw new Error(`Offline pack not staged: ${chunk.packId}`);
    }

    // Rejeu idempotent d'un bloc déjà acquitté
    if (chunk.chunkIndex <= record.ackedChunkIndex) {
      return {
        ackedChunkIndex: record.ackedChunkIndex,
        record: this.cloneRecord(record),
      };
    }

    // Les blocs doivent arriver dans l'ordre (reprise exacte à ackedChunkIndex + 1)
    if (chunk.chunkIndex !== record.ackedChunkIndex + 1) {
      return {
        ackedChunkIndex: record.ackedChunkIndex,
        record: this.cloneRecord(record),
      };
    }

    record.status = 'transferring';
    record.ackedChunkIndex = chunk.chunkIndex;
    record.transferredBytes = Math.min(
      record.manifest.totalBytes,
      record.transferredBytes + chunk.byteLength,
    );

    const verifiedSet = new Set(record.verifiedResourceIds);
    for (const resId of chunk.resourceIdsCovered) {
      verifiedSet.add(resId);
    }
    record.verifiedResourceIds = Array.from(verifiedSet);
    record.missingResourceIds = record.manifest.resources
      .map((r) => r.resourceId)
      .filter((id) => !verifiedSet.has(id));
    record.errorReason = null;
    record.updatedAtUtcMs = nowUtcMs;

    if (record.ackedChunkIndex + 1 >= record.totalChunks) {
      record.status = 'verifying';
    }

    return {
      ackedChunkIndex: record.ackedChunkIndex,
      record: this.cloneRecord(record),
    };
  }

  /**
   * Suspends le téléchargement lors d'une coupure Bluetooth sans jamais annoncer
   * le paquet comme `available`.
   */
  suspendTransfer(packId: string, nowUtcMs = Date.now()): WatchOfflinePackRecord | null {
    const record = this.packs.get(packId);
    if (!record) return null;
    if (record.status === 'transferring' || record.status === 'queued' || record.status === 'verifying') {
      record.status = 'suspended';
      record.errorReason = 'transfer_interrupted';
      record.updatedAtUtcMs = nowUtcMs;
    }
    return this.cloneRecord(record);
  }

  /**
   * Vérifie la somme de contrôle et les ressources avant d'autoriser l'état
   * `available` ou `degraded` (ex. police `glyphs` absente).
   */
  verifyAndFinalizePack(
    packId: string,
    actualChecksumSha256: string,
    nowUtcMs = Date.now(),
  ): WatchOfflinePackRecord {
    const record = this.packs.get(packId);
    if (!record) {
      throw new Error(`Offline pack not found: ${packId}`);
    }

    if (record.ackedChunkIndex + 1 < record.totalChunks) {
      record.status = 'suspended';
      record.errorReason = 'transfer_interrupted';
      record.updatedAtUtcMs = nowUtcMs;
      return this.cloneRecord(record);
    }

    if (actualChecksumSha256 !== record.manifest.checksumSha256) {
      if (record.previousValidManifest) {
        // Restauration atomique de la dernière version valide
        const prev = record.previousValidManifest;
        const restoredSet = new Set(prev.resources.map((r) => r.resourceId));
        record.manifest = prev;
        record.status = 'available';
        record.capabilities = evaluateOfflinePackCapabilities(prev, restoredSet);
        record.verifiedResourceIds = Array.from(restoredSet);
        record.missingResourceIds = [];
        record.errorReason = 'checksum_mismatch';
        record.updatedAtUtcMs = nowUtcMs;
        return this.cloneRecord(record);
      }

      record.status = 'error';
      record.errorReason = 'checksum_mismatch';
      record.updatedAtUtcMs = nowUtcMs;
      return this.cloneRecord(record);
    }

    const verifiedSet = new Set(record.verifiedResourceIds);
    const capabilities = evaluateOfflinePackCapabilities(record.manifest, verifiedSet);
    record.capabilities = capabilities;

    const missingRequired = record.manifest.resources.filter(
      (r) => r.requiredForFullMap && !verifiedSet.has(r.resourceId),
    );

    if (!capabilities.viewRouteTrace) {
      record.status = 'error';
      record.errorReason = 'missing_required_resource';
    } else if (missingRequired.length > 0 || !capabilities.viewBaseMap) {
      // Trace lisible mais glyphes/sprites/tuiles incomplets => disponibilité dégradée explicite
      record.status = 'degraded';
      record.errorReason = 'missing_required_resource';
      record.lastVerifiedAtUtcMs = nowUtcMs;
    } else {
      record.status = 'available';
      record.errorReason = null;
      record.lastVerifiedAtUtcMs = nowUtcMs;
      record.previousValidManifest = record.manifest;
    }

    record.updatedAtUtcMs = nowUtcMs;
    return this.cloneRecord(record);
  }

  getPack(packId: string): WatchOfflinePackRecord | null {
    const record = this.packs.get(packId);
    return record ? this.cloneRecord(record) : null;
  }

  listPacks(): WatchOfflinePackRecord[] {
    return Array.from(this.packs.values()).map((r) => this.cloneRecord(r));
  }

  removePack(packId: string): boolean {
    return this.packs.delete(packId);
  }

  private cloneRecord(record: WatchOfflinePackRecord): WatchOfflinePackRecord {
    return {
      ...record,
      capabilities: { ...record.capabilities },
      verifiedResourceIds: [...record.verifiedResourceIds],
      missingResourceIds: [...record.missingResourceIds],
    };
  }
}
