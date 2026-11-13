import {
  getTileProviderPolicy,
  type OfflineCapabilityEntry,
  type OfflineCapabilityMatrix,
  type OfflineInstalledPackRecord,
} from '@/features/offline';
import type { PackSummaryInput } from './schemas';

/**
 * Lot N02-UI — Adaptateurs entre les résumés transmis par le client et le
 * contrat `OfflineInstalledPackRecord`.
 *
 * Les routes restent sans état : elles ne téléchargent ni ne stockent aucun
 * paquet. Les résumés ne servent qu’aux calculs de couverture et de raccourcis.
 */

function unavailable(reason: string): OfflineCapabilityEntry {
  return { status: 'unavailable', reason };
}

export function emptyCapabilityMatrix(): OfflineCapabilityMatrix {
  return {
    viewRoute: unavailable('Aucune géométrie de parcours incluse dans ce paquet.'),
    viewMapAround: unavailable('Tuiles ou style de carte incomplets pour couvrir la zone.'),
    followInstructions: unavailable('Manœuvres ou tracé de référence absents du paquet.'),
    searchAddresses: unavailable('Index de lieux local absent du résumé.'),
    recalculateRoute: unavailable('Aucun graphe de routage local dans le paquet.'),
    liveWeatherAndClosures: unavailable(
      'Source externe temps réel indisponible hors réseau ; dernière donnée datée uniquement.'
    ),
  };
}

export function summaryToInstalledRecord(summary: PackSummaryInput): OfflineInstalledPackRecord {
  const nowMs = summary.installedAtMs ?? summary.verifiedAtMs ?? 0;
  const providerId = summary.providerId ?? 'openfreemap-vector';
  const license =
    summary.licenseAttribution ?? getTileProviderPolicy(providerId).attributionRequired;

  return {
    manifest: {
      packId: summary.packId,
      version: summary.version ?? 1,
      ownerUserId: null,
      kind: summary.kind,
      title: summary.title,
      regionId: summary.regionId ?? null,
      routeId: summary.routeId ?? null,
      routeRevision: null,
      bounds: summary.bounds,
      minZoom: summary.minZoom,
      maxZoom: summary.maxZoom,
      pixelRatio: 1,
      providerId,
      licenseAttribution: license,
      styleVersion: 'api-summary',
      engineVersion: 'api-summary',
      pinned: summary.pinned ?? false,
      sharedPublicly: false,
      resources: [],
      totalExpectedBytes: summary.storedBytes,
      manifestSha256: summary.manifestSha256 ?? '0'.repeat(64),
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      expiresAtMs: summary.expiresAtMs ?? null,
      verifiedAtMs: summary.verifiedAtMs ?? null,
    },
    status: summary.status,
    capabilities: emptyCapabilityMatrix(),
    verifiedResources: new Map(),
    actualStoredBytes: summary.storedBytes,
    lastAccessedAtMs: summary.lastAccessedAtMs ?? nowMs,
    installedAtMs: nowMs,
    failureReason: null,
    preservedPreviousVersionOnFailure: false,
  };
}
