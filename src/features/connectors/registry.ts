import type {
  CapabilitySupportState,
  ConnectorCapabilitiesMatrix,
  ConnectorConsentSnapshot,
  ConnectorEnvReader,
  DeviceModelProfile,
  PartnerConnectorDefinition,
  PartnerProviderId,
  ResolvedPartnerConnectorState,
} from './types';

/**
 * Catalogue déclaratif des connecteurs partenaires (D01).
 *
 * Chaque connecteur distingue explicitement :
 * - l'import d'activité (cloud / webhook / FIT)
 * - l'envoi d'itinéraire (route push)
 * - l'export de waypoints / Up Ahead / repères personnalisés
 * - le Live Sync en cours de navigation (K6.12)
 * - le client embarqué Connect IQ (K6.07)
 * - la préservation des séries indoor (S6.05)
 * - le repli manuel FIT/GPX/TCX lorsque l'API partenaire n'est pas configurée
 */
export const PARTNER_CONNECTOR_DEFINITIONS: Readonly<Record<PartnerProviderId, PartnerConnectorDefinition>> = {
  garmin: {
    id: 'garmin',
    label: 'Garmin Connect',
    category: 'gps_wearable',
    fiches: ['K6.06', 'K6.08', 'K6.12', 'K6.14', 'S3.23', 'S6.04'],
    requiredEnvVars: ['GARMIN_CLIENT_ID', 'GARMIN_CLIENT_SECRET', 'GARMIN_WEBHOOK_SECRET'],
    webhookSecretEnvVar: 'GARMIN_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://connect.garmin.com/oauthConfirm',
    oauthTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    oauthRevokeUrl: 'https://apis.garmin.com/wellness-api/rest/user/registration',
    defaultScopes: ['activities:read', 'courses:write', 'waypoints:write'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'waypoint_export', 'live_sync'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'available',
      liveSyncInSession: 'available',
      embeddedMapApp: 'available',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit', 'gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  garmin_connect_iq: {
    id: 'garmin_connect_iq',
    label: 'Garmin Connect IQ (App & Fond LKDV)',
    category: 'embedded_app',
    fiches: ['K6.07'],
    requiredEnvVars: ['GARMIN_CLIENT_ID', 'GARMIN_CLIENT_SECRET', 'GARMIN_CONNECT_IQ_APP_ID'],
    oauthAuthorizeUrl: 'https://connect.garmin.com/oauthConfirm',
    oauthTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    defaultScopes: ['connect_iq:routes', 'connect_iq:map_tiles'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['route_export', 'connect_iq_map'],
    staticCapabilities: {
      activityImport: 'unsupported',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'available',
      liveSyncInSession: 'available',
      embeddedMapApp: 'available',
      indoorSeriesPreservation: 'unsupported',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['fit', 'gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'external_native_device',
  },
  wahoo: {
    id: 'wahoo',
    label: 'Wahoo Cloud (ELEMNT)',
    category: 'bike_computer',
    fiches: ['K6.12', 'K6.14', 'S6.04'],
    requiredEnvVars: ['WAHOO_CLIENT_ID', 'WAHOO_CLIENT_SECRET', 'WAHOO_WEBHOOK_SECRET'],
    webhookSecretEnvVar: 'WAHOO_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://api.wahooligan.com/oauth/authorize',
    oauthTokenUrl: 'https://api.wahooligan.com/oauth/token',
    oauthRevokeUrl: 'https://api.wahooligan.com/oauth/revoke',
    defaultScopes: ['user_read', 'workouts_read', 'routes_write', 'plans_write'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'waypoint_export', 'live_sync'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'available',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit', 'gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  coros: {
    id: 'coros',
    label: 'COROS Training Hub',
    category: 'gps_wearable',
    fiches: ['K6.14', 'S3.23', 'S6.04'],
    requiredEnvVars: ['COROS_CLIENT_ID', 'COROS_CLIENT_SECRET', 'COROS_WEBHOOK_SECRET'],
    webhookSecretEnvVar: 'COROS_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://open.coros.com/oauth2/authorize',
    oauthTokenUrl: 'https://open.coros.com/oauth2/accesstoken',
    defaultScopes: ['workout:read', 'navigation:write'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'waypoint_export'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit', 'gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  suunto: {
    id: 'suunto',
    label: 'Suunto Cloud / SuuntoPlus',
    category: 'gps_wearable',
    fiches: ['K6.14', 'S3.23', 'S6.04'],
    requiredEnvVars: ['SUUNTO_CLIENT_ID', 'SUUNTO_CLIENT_SECRET', 'SUUNTO_SUBSCRIPTION_KEY'],
    webhookSecretEnvVar: 'SUUNTO_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://cloudapi-oauth.suunto.com/oauth/authorize',
    oauthTokenUrl: 'https://cloudapi-oauth.suunto.com/oauth/token',
    defaultScopes: ['workout', 'route'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'waypoint_export'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit', 'gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  polar: {
    id: 'polar',
    label: 'Polar Flow / AccessLink',
    category: 'gps_wearable',
    fiches: ['K6.14', 'S3.23', 'S6.04'],
    requiredEnvVars: ['POLAR_CLIENT_ID', 'POLAR_CLIENT_SECRET'],
    webhookSecretEnvVar: 'POLAR_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://flow.polar.com/oauth2/authorization',
    oauthTokenUrl: 'https://polarremote.com/v2/oauth2/token',
    defaultScopes: ['accesslink.read_all', 'routes.write'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'waypoint_export'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['gpx', 'tcx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  hammerhead: {
    id: 'hammerhead',
    label: 'Hammerhead Karoo',
    category: 'bike_computer',
    fiches: ['K6.13', 'K6.14'],
    requiredEnvVars: ['HAMMERHEAD_CLIENT_ID', 'HAMMERHEAD_CLIENT_SECRET'],
    webhookSecretEnvVar: 'HAMMERHEAD_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://api.hammerhead.io/v1/auth/oauth/authorize',
    oauthTokenUrl: 'https://api.hammerhead.io/v1/auth/oauth/token',
    oauthRevokeUrl: 'https://api.hammerhead.io/v1/auth/oauth/deauthorize',
    defaultScopes: ['route:read', 'route:write', 'poi:write', 'activity:read'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'waypoint_export'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'available',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'unsupported',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['gpx', 'fit'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'external_native_device',
  },
  bosch: {
    id: 'bosch',
    label: 'Bosch eBike Flow',
    category: 'ebike_watch',
    fiches: ['K6.12', 'K6.14'],
    requiredEnvVars: ['BOSCH_EBIKE_CLIENT_ID', 'BOSCH_EBIKE_CLIENT_SECRET'],
    oauthAuthorizeUrl: 'https://singlekey-id.com/auth/connect/authorize',
    oauthTokenUrl: 'https://singlekey-id.com/auth/connect/token',
    defaultScopes: ['ebike:routes:write', 'ebike:activities:read'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import', 'route_export', 'live_sync'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'unsupported',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'available',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'unsupported',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'route_drawer_transient_live_sync',
  },
  apple_watch: {
    id: 'apple_watch',
    label: 'Apple Watch (WorkoutKit / Live Sync)',
    category: 'ebike_watch',
    fiches: ['K6.12'],
    requiredEnvVars: ['APPLE_WORKOUTKIT_BRIDGE_ENABLED'],
    defaultScopes: ['workout_route_live_sync'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['route_export', 'live_sync'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'available',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'route_drawer_transient_live_sync',
  },
  samsung_health: {
    id: 'samsung_health',
    label: 'Samsung Health',
    category: 'health_platform',
    fiches: ['S3.23'],
    requiredEnvVars: ['SAMSUNG_HEALTH_PARTNER_APP_ID', 'SAMSUNG_HEALTH_CLIENT_SECRET'],
    defaultScopes: ['exercise.route.write', 'exercise.read'],
    // Note : dépend aussi de external_readiness si des métriques de santé sont activées, mais pour S3.23
    // la synchronisation de parcours exige personal_performance + partenariat Samsung Health validé.
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['route_export', 'waypoint_export'],
    staticCapabilities: {
      activityImport: 'consent_required',
      routeExport: 'available',
      waypointExport: 'available',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'unsupported',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['gpx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'route_drawer_send_to_device',
  },
  zwift: {
    id: 'zwift',
    label: 'Zwift',
    category: 'indoor_platform',
    fiches: ['S6.05'],
    requiredEnvVars: ['ZWIFT_CLIENT_ID', 'ZWIFT_CLIENT_SECRET', 'ZWIFT_WEBHOOK_SECRET'],
    webhookSecretEnvVar: 'ZWIFT_WEBHOOK_SECRET',
    oauthAuthorizeUrl: 'https://secure.zwift.com/auth/realms/zwift/protocol/openid-connect/auth',
    oauthTokenUrl: 'https://secure.zwift.com/auth/realms/zwift/protocol/openid-connect/token',
    defaultScopes: ['activity:read', 'profile:read'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'unsupported',
      waypointExport: 'unsupported',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  peloton: {
    id: 'peloton',
    label: 'Peloton',
    category: 'indoor_platform',
    fiches: ['S6.05'],
    requiredEnvVars: ['PELOTON_CLIENT_ID', 'PELOTON_CLIENT_SECRET'],
    oauthAuthorizeUrl: 'https://auth.onepeloton.com/authorize',
    oauthTokenUrl: 'https://auth.onepeloton.com/oauth/token',
    defaultScopes: [' workouts:read'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'unsupported',
      waypointExport: 'unsupported',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'unsupported',
      manualFallbackFormats: ['fit', 'tcx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  trainerroad: {
    id: 'trainerroad',
    label: 'TrainerRoad',
    category: 'indoor_platform',
    fiches: ['S6.05'],
    requiredEnvVars: ['TRAINERROAD_CLIENT_ID', 'TRAINERROAD_CLIENT_SECRET'],
    oauthAuthorizeUrl: 'https://www.trainerroad.com/oauth/authorize',
    oauthTokenUrl: 'https://www.trainerroad.com/oauth/token',
    defaultScopes: ['activities:read', 'workouts:read'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'unsupported',
      waypointExport: 'unsupported',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit', 'tcx'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  rouvy: {
    id: 'rouvy',
    label: 'ROUVY',
    category: 'indoor_platform',
    fiches: ['S6.05'],
    requiredEnvVars: ['ROUVY_CLIENT_ID', 'ROUVY_CLIENT_SECRET'],
    oauthAuthorizeUrl: 'https://api.rouvy.com/oauth/authorize',
    oauthTokenUrl: 'https://api.rouvy.com/oauth/token',
    defaultScopes: ['activity:read'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'unsupported',
      waypointExport: 'unsupported',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['fit'],
    },
    visibilityRestriction: 'standard_p01',
    drawerSurface: 'compte_devices_drawer',
  },
  strava: {
    id: 'strava',
    label: 'Strava',
    category: 'social_partner',
    fiches: ['S6.27'],
    requiredEnvVars: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_WEBHOOK_VERIFY_TOKEN'],
    webhookSecretEnvVar: 'STRAVA_WEBHOOK_VERIFY_TOKEN',
    oauthAuthorizeUrl: 'https://www.strava.com/oauth/authorize',
    oauthTokenUrl: 'https://www.strava.com/oauth/token',
    oauthRevokeUrl: 'https://www.strava.com/oauth/deauthorize',
    defaultScopes: ['read', 'activity:read', 'activity:read_all'],
    requiredPurposes: ['personal_performance'],
    supportedUsages: ['activity_import'],
    staticCapabilities: {
      activityImport: 'available',
      routeExport: 'unsupported',
      waypointExport: 'unsupported',
      upAheadClimbGuidance: 'unsupported',
      liveSyncInSession: 'unsupported',
      embeddedMapApp: 'unsupported',
      indoorSeriesPreservation: 'available',
      historicalBackfill: 'available',
      manualFallbackFormats: ['gpx', 'fit'],
    },
    visibilityRestriction: 'owner_only_no_public_or_ai',
    drawerSurface: 'compte_devices_drawer',
  },
};

/**
 * Catalogue des modèles d'appareils pour vérifier la compatibilité réelle (K6.06..K6.14, S3.23, S6.04).
 * Contient des modèles compatibles et des modèles anciens/incompatibles pour les tests de non-régression.
 */
export const DEVICE_MODEL_CATALOG: readonly DeviceModelProfile[] = [
  {
    modelId: 'garmin_fenix_8',
    providerId: 'garmin',
    brand: 'Garmin',
    modelName: 'fēnix 8 / Epix Pro',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: true,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: true,
    supportsConnectIqApp: true,
    supportsCustomPois: true,
    maxWaypointsPerRoute: 200,
    preferredFormat: 'fit',
    notes: 'Support complet Course FIT, Up Ahead, ClimbPro, Live Sync et Connect IQ Map.',
  },
  {
    modelId: 'garmin_edge_1040',
    providerId: 'garmin',
    brand: 'Garmin',
    modelName: 'Edge 1040 / 840 / 540',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: true,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: true,
    supportsConnectIqApp: true,
    supportsCustomPois: true,
    maxWaypointsPerRoute: 200,
    preferredFormat: 'fit',
    notes: 'Compteur vélo compatible Up Ahead, ClimbPro et Live Sync.',
  },
  {
    modelId: 'garmin_vivoactive_3_legacy',
    providerId: 'garmin',
    brand: 'Garmin',
    modelName: 'vívoactive 3 (Legacy)',
    compatible: false,
    supportsRouteImport: false,
    supportsWaypoints: false,
    supportsUpAhead: false,
    supportsClimbProfile: false,
    supportsTurnByTurn: false,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: false,
    maxWaypointsPerRoute: 0,
    preferredFormat: 'fit',
    notes: 'Import d’activité supporté mais aucune navigation de parcours native ni Up Ahead.',
  },
  {
    modelId: 'hammerhead_karoo_3',
    providerId: 'hammerhead',
    brand: 'Hammerhead',
    modelName: 'Karoo (3e gén.) / Karoo 2',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: true,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: true,
    maxWaypointsPerRoute: 150,
    preferredFormat: 'fit',
    notes: 'Supporte la synchronisation des repères personnalisés (POI nommés K6.13) et CLIMBER.',
  },
  {
    modelId: 'hammerhead_karoo_1_legacy',
    providerId: 'hammerhead',
    brand: 'Hammerhead',
    modelName: 'Karoo 1 (OS Legacy)',
    compatible: false,
    supportsRouteImport: true,
    supportsWaypoints: false,
    supportsUpAhead: false,
    supportsClimbProfile: false,
    supportsTurnByTurn: true,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: false,
    maxWaypointsPerRoute: 0,
    preferredFormat: 'gpx',
    notes: 'Repli GPX uniquement ; pas de synchronisation cloud des repères personnalisés K6.13.',
  },
  {
    modelId: 'wahoo_elemnt_roam_v2',
    providerId: 'wahoo',
    brand: 'Wahoo',
    modelName: 'ELEMNT ROAM v2 / BOLT v2 / ACE',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: false,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: true,
    supportsConnectIqApp: false,
    supportsCustomPois: true,
    maxWaypointsPerRoute: 100,
    preferredFormat: 'fit',
    notes: 'Supporte Summit Freeride, routes cloud et Live Sync K6.12.',
  },
  {
    modelId: 'coros_vertix_2s',
    providerId: 'coros',
    brand: 'COROS',
    modelName: 'VERTIX 2S / APEX 2 Pro / PACE 3',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: false,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: true,
    maxWaypointsPerRoute: 100,
    preferredFormat: 'fit',
    notes: 'Supporte l’envoi d’itinéraires et d’alertes waypoints (S3.23) + sync activités (S6.04).',
  },
  {
    modelId: 'suunto_vertical',
    providerId: 'suunto',
    brand: 'Suunto',
    modelName: 'Suunto Vertical / Race / 9 Peak Pro',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: false,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: true,
    maxWaypointsPerRoute: 100,
    preferredFormat: 'fit',
    notes: 'Supporte l’envoi d’itinéraires et waypoints Suunto App (S3.23) + sync activités (S6.04).',
  },
  {
    modelId: 'polar_vantage_v3',
    providerId: 'polar',
    brand: 'Polar',
    modelName: 'Polar Vantage V3 / Grit X2 Pro',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: false,
    supportsClimbProfile: true,
    supportsTurnByTurn: true,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: false,
    maxWaypointsPerRoute: 50,
    preferredFormat: 'gpx',
    notes: 'Supporte les itinéraires Polar Flow (S3.23) et l’import de séances AccessLink (S6.04).',
  },
  {
    modelId: 'bosch_kiox_300',
    providerId: 'bosch',
    brand: 'Bosch',
    modelName: 'Bosch Smart System (Kiox 300 / 500)',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: false,
    supportsUpAhead: false,
    supportsClimbProfile: false,
    supportsTurnByTurn: true,
    supportsLiveSync: true,
    supportsConnectIqApp: false,
    supportsCustomPois: false,
    maxWaypointsPerRoute: 0,
    preferredFormat: 'gpx',
    notes: 'Supporte le Live Sync de parcours en cours de navigation (K6.12).',
  },
  {
    modelId: 'apple_watch_ultra_2',
    providerId: 'apple_watch',
    brand: 'Apple',
    modelName: 'Apple Watch Ultra 2 / Series 9+',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: false,
    supportsClimbProfile: false,
    supportsTurnByTurn: true,
    supportsLiveSync: true,
    supportsConnectIqApp: false,
    supportsCustomPois: false,
    maxWaypointsPerRoute: 50,
    preferredFormat: 'gpx',
    notes: 'Supporte le Live Sync vers l’app compagnon Apple Watch (K6.12).',
  },
  {
    modelId: 'samsung_galaxy_watch_ultra',
    providerId: 'samsung_health',
    brand: 'Samsung',
    modelName: 'Galaxy Watch Ultra / 7 (Samsung Health)',
    compatible: true,
    supportsRouteImport: true,
    supportsWaypoints: true,
    supportsUpAhead: false,
    supportsClimbProfile: false,
    supportsTurnByTurn: true,
    supportsLiveSync: false,
    supportsConnectIqApp: false,
    supportsCustomPois: false,
    maxWaypointsPerRoute: 50,
    preferredFormat: 'gpx',
    notes: 'Supporte l’import de parcours GPX/waypoints vers Samsung Health (S3.23).',
  },
];

/**
 * Inspecte les variables d'environnement requises pour un connecteur partenaire.
 * Aucune valeur vide ou espace blanc n'est acceptée comme credential valide.
 */
export function inspectProviderCredentials(
  providerId: PartnerProviderId,
  env: ConnectorEnvReader = typeof process !== 'undefined' ? process.env : {}
): { configured: boolean; missingEnvVars: string[] } {
  const def = PARTNER_CONNECTOR_DEFINITIONS[providerId];
  const missingEnvVars: string[] = [];

  for (const key of def.requiredEnvVars) {
    const val = env[key];
    if (!val || val.trim().length === 0) {
      missingEnvVars.push(key);
    }
  }

  return {
    configured: missingEnvVars.length === 0,
    missingEnvVars,
  };
}

function degradeCapability(
  staticState: CapabilitySupportState,
  credentialsConfigured: boolean,
  consentGranted: boolean
): CapabilitySupportState {
  if (staticState === 'unsupported') return 'unsupported';
  if (!credentialsConfigured) return 'credentials_missing';
  if (!consentGranted) return 'consent_required';
  return staticState;
}

/**
 * Résout l'état réel d'un connecteur partenaire (invariant fail-closed).
 * - Si les variables d'environnement manquent : `status = 'credentials_missing'` et `connected = false`.
 * - Si la liaison utilisateur a été révoquée : `status = 'revoked'` et `connected = false`.
 */
export function resolveConnectorState(
  providerId: PartnerProviderId,
  options?: {
    env?: ConnectorEnvReader;
    consentSnapshot?: ConnectorConsentSnapshot;
    lastSyncedAt?: string | null;
    forceServiceUnavailable?: boolean;
  }
): ResolvedPartnerConnectorState {
  const def = PARTNER_CONNECTOR_DEFINITIONS[providerId];
  const { configured, missingEnvVars } = inspectProviderCredentials(providerId, options?.env);
  const grant = options?.consentSnapshot?.providers[providerId];
  const purposeGranted = def.requiredPurposes.every(
    (p) => p !== 'external_readiness' && options?.consentSnapshot?.purposes[p] === true
  );

  if (options?.forceServiceUnavailable) {
    return {
      definition: def,
      status: 'unavailable',
      missingEnvVars,
      capabilities: {
        activityImport: def.staticCapabilities.activityImport === 'unsupported' ? 'unsupported' : 'error',
        routeExport: def.staticCapabilities.routeExport === 'unsupported' ? 'unsupported' : 'error',
        waypointExport: def.staticCapabilities.waypointExport === 'unsupported' ? 'unsupported' : 'error',
        upAheadClimbGuidance: def.staticCapabilities.upAheadClimbGuidance === 'unsupported' ? 'unsupported' : 'error',
        liveSyncInSession: def.staticCapabilities.liveSyncInSession === 'unsupported' ? 'unsupported' : 'error',
        embeddedMapApp: def.staticCapabilities.embeddedMapApp === 'unsupported' ? 'unsupported' : 'error',
        indoorSeriesPreservation:
          def.staticCapabilities.indoorSeriesPreservation === 'unsupported' ? 'unsupported' : 'error',
        historicalBackfill: def.staticCapabilities.historicalBackfill === 'unsupported' ? 'unsupported' : 'error',
        manualFallbackFormats: def.staticCapabilities.manualFallbackFormats,
      },
      connected: false,
      revocable: Boolean(grant?.connected),
      lastSyncedAt: options?.lastSyncedAt ?? null,
      statusReason: `Service partenaire ${def.label} temporairement indisponible. Repli manuel (${def.staticCapabilities.manualFallbackFormats.join('/').toUpperCase()}) disponible.`,
    };
  }

  if (grant?.revokedAt) {
    return {
      definition: def,
      status: 'revoked',
      missingEnvVars,
      capabilities: {
        activityImport: degradeCapability(def.staticCapabilities.activityImport, configured, false),
        routeExport: degradeCapability(def.staticCapabilities.routeExport, configured, false),
        waypointExport: degradeCapability(def.staticCapabilities.waypointExport, configured, false),
        upAheadClimbGuidance: degradeCapability(def.staticCapabilities.upAheadClimbGuidance, configured, false),
        liveSyncInSession: degradeCapability(def.staticCapabilities.liveSyncInSession, configured, false),
        embeddedMapApp: degradeCapability(def.staticCapabilities.embeddedMapApp, configured, false),
        indoorSeriesPreservation: degradeCapability(def.staticCapabilities.indoorSeriesPreservation, configured, false),
        historicalBackfill: degradeCapability(def.staticCapabilities.historicalBackfill, configured, false),
        manualFallbackFormats: def.staticCapabilities.manualFallbackFormats,
      },
      connected: false,
      revocable: false,
      lastSyncedAt: options?.lastSyncedAt ?? null,
      statusReason: `Connexion ${def.label} révoquée le ${grant.revokedAt}. Toute collecte et tout envoi sont coupés.`,
    };
  }

  if (!configured) {
    return {
      definition: def,
      status: 'credentials_missing',
      missingEnvVars,
      capabilities: {
        activityImport: degradeCapability(def.staticCapabilities.activityImport, false, purposeGranted),
        routeExport: degradeCapability(def.staticCapabilities.routeExport, false, purposeGranted),
        waypointExport: degradeCapability(def.staticCapabilities.waypointExport, false, purposeGranted),
        upAheadClimbGuidance: degradeCapability(def.staticCapabilities.upAheadClimbGuidance, false, purposeGranted),
        liveSyncInSession: degradeCapability(def.staticCapabilities.liveSyncInSession, false, purposeGranted),
        embeddedMapApp: degradeCapability(def.staticCapabilities.embeddedMapApp, false, purposeGranted),
        indoorSeriesPreservation: degradeCapability(
          def.staticCapabilities.indoorSeriesPreservation,
          false,
          purposeGranted
        ),
        historicalBackfill: degradeCapability(def.staticCapabilities.historicalBackfill, false, purposeGranted),
        manualFallbackFormats: def.staticCapabilities.manualFallbackFormats,
      },
      connected: false,
      revocable: false,
      lastSyncedAt: options?.lastSyncedAt ?? null,
      statusReason: `Identifiants partenaires ${def.label} absents (${missingEnvVars.join(', ')}). Aucun jeton ni synchronisation n'est simulé ; export/import manuel (${def.staticCapabilities.manualFallbackFormats.join('/').toUpperCase()}) disponible.`,
    };
  }

  const isConnected = Boolean(grant?.connected && !grant.revokedAt && purposeGranted);
  const capabilities: ConnectorCapabilitiesMatrix = {
    activityImport: degradeCapability(def.staticCapabilities.activityImport, true, isConnected),
    routeExport: degradeCapability(def.staticCapabilities.routeExport, true, isConnected),
    waypointExport: degradeCapability(def.staticCapabilities.waypointExport, true, isConnected),
    upAheadClimbGuidance: degradeCapability(def.staticCapabilities.upAheadClimbGuidance, true, isConnected),
    liveSyncInSession: degradeCapability(def.staticCapabilities.liveSyncInSession, true, isConnected),
    embeddedMapApp: degradeCapability(def.staticCapabilities.embeddedMapApp, true, isConnected),
    indoorSeriesPreservation: degradeCapability(def.staticCapabilities.indoorSeriesPreservation, true, isConnected),
    historicalBackfill: degradeCapability(def.staticCapabilities.historicalBackfill, true, isConnected),
    manualFallbackFormats: def.staticCapabilities.manualFallbackFormats,
  };

  return {
    definition: def,
    status: 'configured',
    missingEnvVars: [],
    capabilities,
    connected: isConnected,
    revocable: isConnected,
    lastSyncedAt: options?.lastSyncedAt ?? null,
    statusReason: isConnected
      ? `Connecteur ${def.label} actif et autorisé.`
      : `Connecteur ${def.label} configuré côté serveur, en attente d'autorisation OAuth et de consentement explicite.`,
  };
}

/**
 * Liste tous les connecteurs partenaires avec leur état réel.
 */
export function listPartnerConnectors(options?: {
  env?: ConnectorEnvReader;
  consentSnapshot?: ConnectorConsentSnapshot;
  category?: PartnerConnectorDefinition['category'];
}): ResolvedPartnerConnectorState[] {
  const defs = Object.values(PARTNER_CONNECTOR_DEFINITIONS).filter((def) =>
    options?.category ? def.category === options.category : true
  );
  return defs.map((def) =>
    resolveConnectorState(def.id, {
      env: options?.env,
      consentSnapshot: options?.consentSnapshot,
    })
  );
}

export function getDeviceModelProfile(modelId: string): DeviceModelProfile | null {
  return DEVICE_MODEL_CATALOG.find((m) => m.modelId === modelId) ?? null;
}

export function listDeviceModelsForProvider(providerId: PartnerProviderId): DeviceModelProfile[] {
  return DEVICE_MODEL_CATALOG.filter((m) => m.providerId === providerId);
}
