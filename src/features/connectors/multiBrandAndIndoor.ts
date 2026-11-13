import { evaluateConnectorConsent } from './oauthAndConsent';
import {
  getDeviceModelProfile,
  inspectProviderCredentials,
  PARTNER_CONNECTOR_DEFINITIONS,
} from './registry';
import type {
  CanonicalRouteForSync,
  ConnectorConsentSnapshot,
  ConnectorEnvReader,
  ManualFallbackFormat,
  NormalizedIndoorActivity,
  PartnerProviderId,
  RawIndoorPlatformActivity,
  StravaImportedActivityRecord,
  StravaSurfaceTarget,
  StravaVisibilityDecision,
} from './types';

// ============================================================================
// K6.14, S3.23, S6.04 — Multi-marques GPS & montres (Garmin, Wahoo, COROS, Suunto, Polar, Samsung Health)
// ============================================================================

export interface BrandSyncDirectionSummary {
  providerId: PartnerProviderId;
  label: string;
  supportsRoutePush: boolean;
  supportsWaypointPush: boolean;
  supportsActivityImport: boolean;
  cloudConfigured: boolean;
  missingEnvVars: string[];
  routePushStatus: 'ready' | 'consent_required' | 'credentials_missing' | 'unsupported';
  activityImportStatus: 'ready' | 'consent_required' | 'credentials_missing' | 'unsupported';
  manualFallbackFormats: readonly ManualFallbackFormat[];
}

/**
 * K6.14 & S6.04 — Vérifie l'équivalent par marque et distingue explicitement
 * l'envoi de parcours (`routePush`) et l'import d'activité (`activityImport`).
 */
export function evaluateBrandSyncDirections(params: {
  providerId: PartnerProviderId;
  consentSnapshot?: ConnectorConsentSnapshot;
  env?: ConnectorEnvReader;
}): BrandSyncDirectionSummary {
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const { configured, missingEnvVars } = inspectProviderCredentials(params.providerId, params.env);

  const supportsRoutePush = def.staticCapabilities.routeExport === 'available';
  const supportsWaypointPush = def.staticCapabilities.waypointExport === 'available';
  const supportsActivityImport =
    def.staticCapabilities.activityImport === 'available' ||
    def.staticCapabilities.activityImport === 'consent_required';

  const routeConsentOk = params.consentSnapshot
    ? evaluateConnectorConsent(params.consentSnapshot, params.providerId, 'route_export').allowed
    : false;
  const activityConsentOk = params.consentSnapshot
    ? evaluateConnectorConsent(params.consentSnapshot, params.providerId, 'activity_import').allowed
    : false;

  const routePushStatus: BrandSyncDirectionSummary['routePushStatus'] = !supportsRoutePush
    ? 'unsupported'
    : !configured
      ? 'credentials_missing'
      : !routeConsentOk
        ? 'consent_required'
        : 'ready';

  const activityImportStatus: BrandSyncDirectionSummary['activityImportStatus'] = !supportsActivityImport
    ? 'unsupported'
    : !configured
      ? 'credentials_missing'
      : !activityConsentOk
        ? 'consent_required'
        : 'ready';

  return {
    providerId: params.providerId,
    label: def.label,
    supportsRoutePush,
    supportsWaypointPush,
    supportsActivityImport,
    cloudConfigured: configured,
    missingEnvVars,
    routePushStatus,
    activityImportStatus,
    manualFallbackFormats: def.staticCapabilities.manualFallbackFormats,
  };
}

export interface PartnerRouteSyncPlan {
  providerId: PartnerProviderId;
  deviceModelId: string | null;
  routeId: string;
  revision: number;
  deliveryMode: 'cloud_push_ready' | 'manual_file_fallback' | 'blocked_consent' | 'incompatible_device';
  exportedWaypointsCount: number;
  truncatedWaypointsCount: number;
  fallbackFormat: ManualFallbackFormat;
  gpxFallbackXml: string;
  reason: string;
}

/**
 * Génère un document GPX 1.1 déterministe avec trace et waypoints (`<wpt>`) pour le repli manuel
 * ou l'échange avec COROS, Polar, Suunto, Wahoo et Samsung Health (S3.23 / K6.14).
 */
export function buildRouteGpxFallbackDocument(
  route: CanonicalRouteForSync,
  maxWaypoints = route.waypoints.length
): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const waypointsSlice = route.waypoints.slice(0, Math.max(0, maxWaypoints));
  const wptXml = waypointsSlice
    .map((wp) => {
      const eleTag = wp.elevationMeters !== undefined ? `<ele>${wp.elevationMeters}</ele>` : '';
      return `  <wpt lat="${wp.lat}" lon="${wp.lng}">${eleTag}<name>${escapeXml(wp.name)}</name><type>${escapeXml(wp.category)}</type></wpt>`;
    })
    .join('\n');

  const trkptsXml = route.coordinates
    .map(([lat, lng, ele]) => {
      const eleTag = ele !== undefined ? `<ele>${ele}</ele>` : '';
      return `      <trkpt lat="${lat}" lon="${lng}">${eleTag}</trkpt>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="LKDV Connecteurs D01" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(route.title)}</name></metadata>`,
    wptXml,
    '  <trk>',
    `    <name>${escapeXml(route.title)}</name>`,
    `    <type>${escapeXml(route.sportType)}</type>`,
    '    <trkseg>',
    trkptsXml,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * S3.23 & K6.14 — Prépare la synchronisation d'un itinéraire et de ses waypoints
 * vers Garmin, COROS, Polar, Suunto, Wahoo ou Samsung Health selon leurs capacités réelles.
 */
export function buildMultiBrandRouteSyncPlan(params: {
  providerId: 'garmin' | 'coros' | 'polar' | 'suunto' | 'wahoo' | 'samsung_health';
  route: CanonicalRouteForSync;
  deviceModelId?: string;
  consentSnapshot: ConnectorConsentSnapshot;
  env?: ConnectorEnvReader;
}): PartnerRouteSyncPlan {
  const def = PARTNER_CONNECTOR_DEFINITIONS[params.providerId];
  const fallbackFormat = def.staticCapabilities.manualFallbackFormats[0] ?? 'gpx';
  const model = params.deviceModelId ? getDeviceModelProfile(params.deviceModelId) : null;

  if (model && (!model.compatible || !model.supportsRouteImport)) {
    return {
      providerId: params.providerId,
      deviceModelId: model.modelId,
      routeId: params.route.routeId,
      revision: params.route.revision,
      deliveryMode: 'incompatible_device',
      exportedWaypointsCount: 0,
      truncatedWaypointsCount: params.route.waypoints.length,
      fallbackFormat,
      gpxFallbackXml: buildRouteGpxFallbackDocument(params.route, 0),
      reason: `Le modèle ${model.modelName} ne prend pas en charge l'import d'itinéraire.`,
    };
  }

  const maxWaypoints = model
    ? model.supportsWaypoints
      ? model.maxWaypointsPerRoute
      : 0
    : 100;
  const exportedWaypointsCount = Math.min(params.route.waypoints.length, maxWaypoints);
  const truncatedWaypointsCount = Math.max(0, params.route.waypoints.length - exportedWaypointsCount);
  const gpxFallbackXml = buildRouteGpxFallbackDocument(params.route, exportedWaypointsCount);

  // Vérification du consentement P01 S6.16 avant toute synchronisation sortante
  const consentEval = evaluateConnectorConsent(
    params.consentSnapshot,
    params.providerId,
    'route_export'
  );
  if (!consentEval.allowed) {
    return {
      providerId: params.providerId,
      deviceModelId: model?.modelId ?? null,
      routeId: params.route.routeId,
      revision: params.route.revision,
      deliveryMode: 'blocked_consent',
      exportedWaypointsCount,
      truncatedWaypointsCount,
      fallbackFormat,
      gpxFallbackXml,
      reason: consentEval.reason,
    };
  }

  const { configured, missingEnvVars } = inspectProviderCredentials(params.providerId, params.env);
  if (!configured) {
    return {
      providerId: params.providerId,
      deviceModelId: model?.modelId ?? null,
      routeId: params.route.routeId,
      revision: params.route.revision,
      deliveryMode: 'manual_file_fallback',
      exportedWaypointsCount,
      truncatedWaypointsCount,
      fallbackFormat,
      gpxFallbackXml,
      reason: `Credentials ${def.label} absents (${missingEnvVars.join(', ')}) : export ${fallbackFormat.toUpperCase()} manuel prêt.`,
    };
  }

  return {
    providerId: params.providerId,
    deviceModelId: model?.modelId ?? null,
    routeId: params.route.routeId,
    revision: params.route.revision,
    deliveryMode: 'cloud_push_ready',
    exportedWaypointsCount,
    truncatedWaypointsCount,
    fallbackFormat,
    gpxFallbackXml,
    reason: `Itinéraire et ${exportedWaypointsCount} waypoint(s) prêts pour l'envoi vers ${def.label}.`,
  };
}

// ============================================================================
// S6.05 — Plateformes Indoor (Zwift, Peloton, TrainerRoad, Rouvy)
// ============================================================================

function averageNonNull(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

function maxNonNull(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

/**
 * S6.05 — Normalise une séance issue d'une plateforme indoor (Zwift, Peloton, TrainerRoad, Rouvy) :
 * - Préserve le type d'effort (`virtual_ride`, `erg_structured_workout`, etc.), les intervalles et les séries capteurs.
 * - N'invente aucune métrique absente (retourne `null` si un capteur n'a pas transmis).
 * - Invariant Recherche 08 : marque explicitement `hasRealOutdoorGpsTrace: false` et
 *   `eligibleForOutdoorGpsSegments: false` (ne jamais fabriquer une éligibilité segment GPS depuis une séance virtuelle/indoor).
 */
export function normalizeIndoorPlatformActivity(
  raw: RawIndoorPlatformActivity
): NormalizedIndoorActivity {
  const hasPower = raw.samples.some((s) => typeof s.powerWatts === 'number');
  const hasCadence = raw.samples.some((s) => typeof s.cadenceRpm === 'number');
  const hasHeartRate = raw.samples.some((s) => typeof s.heartRateBpm === 'number');
  const hasSpeed = raw.samples.some((s) => typeof s.speedKph === 'number');
  const hasResistance = raw.samples.some((s) => typeof s.resistanceLevel === 'number');

  return {
    providerId: raw.providerId,
    externalActivityId: raw.externalActivityId,
    userId: raw.userId,
    title: raw.title.trim() || `${raw.providerId.toUpperCase()} Session`,
    effortType: raw.effortType,
    virtualWorldName: raw.virtualWorldName ?? null,
    startTimeIso: raw.startTimeIso,
    elapsedSeconds: Math.max(0, raw.elapsedSeconds),
    movingSeconds: Math.max(0, Math.min(raw.elapsedSeconds, raw.movingSeconds)),
    distanceMeters: raw.distanceMeters !== undefined && raw.distanceMeters !== null
      ? Math.max(0, raw.distanceMeters)
      : null,
    elevationGainMeters:
      raw.elevationGainMeters !== undefined && raw.elevationGainMeters !== null
        ? Math.max(0, raw.elevationGainMeters)
        : null,
    availableSeries: {
      power: hasPower,
      cadence: hasCadence,
      heartRate: hasHeartRate,
      speed: hasSpeed,
      resistance: hasResistance,
    },
    summaryMetrics: {
      avgPowerWatts: averageNonNull(raw.samples.map((s) => s.powerWatts)),
      maxPowerWatts: maxNonNull(raw.samples.map((s) => s.powerWatts)),
      avgCadenceRpm: averageNonNull(raw.samples.map((s) => s.cadenceRpm)),
      avgHeartRateBpm: averageNonNull(raw.samples.map((s) => s.heartRateBpm)),
      maxHeartRateBpm: maxNonNull(raw.samples.map((s) => s.heartRateBpm)),
    },
    samples: [...raw.samples],
    intervals: raw.intervals ? [...raw.intervals] : [],
    hasRealOutdoorGpsTrace: false,
    eligibleForOutdoorGpsSegments: false,
  };
}

// ============================================================================
// S6.27 — Connexion à Strava depuis une app partenaire & règles de visibilité API
// ============================================================================

/**
 * S6.27 — Applique la règle contractuelle de visibilité des données importées via l'API Strava :
 * - Visible par le propriétaire uniquement (`owner_private_history`, `owner_activity_detail`) tant que le connecteur n'est pas révoqué.
 * - Strictement exclu des surfaces destinées aux autres utilisateurs (`public_community_feed`, `club_activity_feed`,
 *   `third_party_profile_view`, `public_segment_leaderboard`, `community_heatmap_aggregation`).
 * - Strictement exclu de tout entraînement IA ou agrégat (`ai_model_training_or_coaching`).
 * - Immédiatement masqué/inaccessible si le connecteur est révoqué ou dé-autorisé.
 */
export function evaluateStravaActivityVisibility(params: {
  activity: StravaImportedActivityRecord;
  viewerUserId: string | null;
  surface: StravaSurfaceTarget;
  consentSnapshot?: ConnectorConsentSnapshot;
}): StravaVisibilityDecision {
  const { activity, viewerUserId, surface, consentSnapshot } = params;

  const grantRevoked = Boolean(
    activity.connectorRevoked ||
      consentSnapshot?.providers.strava?.revokedAt ||
      (consentSnapshot && !consentSnapshot.providers.strava?.connected)
  );

  if (grantRevoked) {
    return {
      allowed: false,
      surface,
      reason: 'revoked_or_deauthorized',
      projectedActivity: null,
    };
  }

  if (surface === 'ai_model_training_or_coaching') {
    return {
      allowed: false,
      surface,
      reason: 'strava_api_prohibits_ai_or_aggregation',
      projectedActivity: null,
    };
  }

  if (
    surface === 'public_community_feed' ||
    surface === 'club_activity_feed' ||
    surface === 'third_party_profile_view' ||
    surface === 'public_segment_leaderboard' ||
    surface === 'community_heatmap_aggregation'
  ) {
    return {
      allowed: false,
      surface,
      reason: 'strava_api_prohibits_public_feed_or_heatmap',
      projectedActivity: null,
    };
  }

  if (!viewerUserId || viewerUserId !== activity.ownerUserId) {
    return {
      allowed: false,
      surface,
      reason: 'strava_api_visibility_restricted_non_owner',
      projectedActivity: null,
    };
  }

  return {
    allowed: true,
    surface,
    reason: 'owner_authorized',
    projectedActivity: activity,
  };
}
