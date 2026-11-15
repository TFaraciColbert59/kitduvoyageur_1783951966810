import { evaluateConnectorConsent } from './oauthAndConsent';
import { getDeviceModelProfile, inspectProviderCredentials } from './registry';
import type {
  CanonicalRouteForSync,
  CanonicalRouteWaypoint,
  ConnectorConsentSnapshot,
  ConnectorEnvReader,
  GarminCourseExportPayload,
  GarminCoursePointType,
  GarminUpAheadCoursePoint,
  HammerheadCustomPoi,
  HammerheadPoiType,
  HammerheadRouteSyncPayload,
  LiveSyncBannerViewModel,
  LiveSyncTransferState,
  PartnerProviderId,
  RouteWaypointCategory,
} from './types';

/**
 * K6.08 — Convertit une catégorie de waypoint LKDV vers le type Garmin CoursePoint (Up Ahead).
 */
export function mapWaypointToGarminCoursePointType(
  category: RouteWaypointCategory
): GarminCoursePointType {
  switch (category) {
    case 'summit':
    case 'col_pass':
      return 'summit';
    case 'water_source':
      return 'water';
    case 'refuge_food':
      return 'food';
    case 'danger':
      return 'danger';
    case 'turn_left':
      return 'left';
    case 'turn_right':
      return 'right';
    case 'continue_straight':
      return 'straight';
    case 'first_aid':
      return 'first_aid';
    case 'camping':
      return 'campsite';
    case 'viewpoint':
    case 'custom':
    default:
      return 'generic';
  }
}

function defaultGarminApproachAlertMeters(category: RouteWaypointCategory): number {
  switch (category) {
    case 'danger':
      return 150;
    case 'turn_left':
    case 'turn_right':
    case 'continue_straight':
      return 80;
    case 'summit':
    case 'col_pass':
    case 'water_source':
    case 'refuge_food':
    case 'first_aid':
      return 250;
    default:
      return 200;
  }
}

function mapSportToGarminActivityType(
  sport: CanonicalRouteForSync['sportType']
): GarminCourseExportPayload['garminActivityType'] {
  switch (sport) {
    case 'hiking':
      return 'hiking';
    case 'trail_running':
      return 'trail_running';
    case 'road_cycling':
      return 'road_biking';
    case 'gravel_cycling':
      return 'gravel_cycling';
    case 'mtb':
      return 'mountain_biking';
    case 'mountaineering':
    case 'ski_touring':
    default:
      return 'mountaineering';
  }
}

/**
 * K6.06 & K6.08 — Construit le payload d'export de parcours Garmin (Course + Up Ahead + ascensions + manœuvres).
 * - Vérifie la compatibilité du modèle Garmin cible (ex: fēnix 8 vs vívoactive 3 legacy).
 * - Tronque proprement au plafond `maxWaypointsPerRoute` de l'appareil.
 * - Bascule en `manual_fit_fallback` si les credentials Garmin ou les consentements sont absents (fail-closed).
 */
export function buildGarminUpAheadCoursePayload(params: {
  route: CanonicalRouteForSync;
  deviceModelId?: string;
  consentSnapshot?: ConnectorConsentSnapshot;
  env?: ConnectorEnvReader;
}): GarminCourseExportPayload {
  const { route, deviceModelId, consentSnapshot, env } = params;
  const model = deviceModelId ? getDeviceModelProfile(deviceModelId) : getDeviceModelProfile('garmin_fenix_8');

  const upAheadSupported = Boolean(model?.compatible && model.supportsUpAhead);
  const climbProSupported = Boolean(model?.compatible && model.supportsClimbProfile);
  const turnGuidanceSupported = Boolean(model?.compatible && model.supportsTurnByTurn);
  const maxPoints = model?.compatible ? model.maxWaypointsPerRoute : 0;

  // Fusionner les waypoints explicites et, si le modèle supporte le guidage, les manœuvres compatibles
  const combinedWaypoints: CanonicalRouteWaypoint[] = [...route.waypoints];
  if (turnGuidanceSupported && route.maneuvers) {
    for (const m of route.maneuvers) {
      const cat: RouteWaypointCategory =
        m.direction === 'left' || m.direction === 'slight_left' || m.direction === 'sharp_left'
          ? 'turn_left'
          : m.direction === 'right' || m.direction === 'slight_right' || m.direction === 'sharp_right'
            ? 'turn_right'
            : 'continue_straight';
      combinedWaypoints.push({
        id: `maneuver_${m.id}`,
        name: m.instruction.slice(0, 32),
        lat: m.lat,
        lng: m.lng,
        distanceFromStartMeters: m.distanceFromStartMeters,
        category: cat,
        approachAlertMeters: 80,
      });
    }
  }

  combinedWaypoints.sort((a, b) => a.distanceFromStartMeters - b.distanceFromStartMeters);

  const allowedCount = upAheadSupported ? Math.min(combinedWaypoints.length, maxPoints) : 0;
  const truncatedWaypointCount = Math.max(0, combinedWaypoints.length - allowedCount);

  const upAheadPoints: GarminUpAheadCoursePoint[] = combinedWaypoints
    .slice(0, allowedCount)
    .map((wp) => ({
      sourceWaypointId: wp.id,
      name: wp.name.trim().slice(0, 32),
      garminType: mapWaypointToGarminCoursePointType(wp.category),
      lat: wp.lat,
      lng: wp.lng,
      distanceMeters: wp.distanceFromStartMeters,
      elevationMeters: wp.elevationMeters ?? null,
      approachAlertMeters: wp.approachAlertMeters ?? defaultGarminApproachAlertMeters(wp.category),
      notes: wp.description ?? '',
    }));

  const climbSegments = climbProSupported && route.climbs ? [...route.climbs] : [];

  const { configured, missingEnvVars } = inspectProviderCredentials('garmin', env);
  const consentOk = consentSnapshot
    ? evaluateConnectorConsent(consentSnapshot, 'garmin', 'route_export').allowed &&
      evaluateConnectorConsent(consentSnapshot, 'garmin', 'waypoint_export').allowed
    : false;

  const canPushCloud = configured && consentOk && Boolean(model?.compatible && model.supportsRouteImport);

  let statusReason = 'Prêt pour synchronisation Garmin Courses API.';
  if (!model?.compatible || !model.supportsRouteImport) {
    statusReason = `Modèle ${model?.modelName ?? deviceModelId} non compatible avec la navigation de parcours ou Up Ahead.`;
  } else if (!configured) {
    statusReason = `Credentials Garmin absents (${missingEnvVars.join(', ')}) : export FIT manuel préparé.`;
  } else if (!consentOk) {
    statusReason = 'Consentement Garmin (route_export / waypoint_export) non accordé ou révoqué : export FIT manuel uniquement.';
  }

  return {
    routeId: route.routeId,
    revision: route.revision,
    courseName: route.title,
    garminActivityType: mapSportToGarminActivityType(route.sportType),
    totalDistanceMeters: route.totalDistanceMeters,
    elevationGainMeters: route.elevationGainMeters,
    trackPointCount: route.coordinates.length,
    upAheadPoints,
    climbSegments,
    truncatedWaypointCount,
    upAheadSupported,
    climbProSupported,
    turnGuidanceSupported,
    deliveryMode: canPushCloud ? 'cloud_api_ready' : 'manual_fit_fallback',
    statusReason,
  };
}

/**
 * K6.07 — Vérifie l'éligibilité et le contrat de l'application embarquée Garmin Connect IQ et du fond de carte LKDV.
 * Règle UX stricte de K6.07 : `exposeInMainNavigation: false` (aucune entrée dans la navigation principale LKDV).
 */
export interface GarminConnectIqEligibility {
  eligible: boolean;
  deviceModelId: string;
  supportsConnectIqApp: boolean;
  mapTilesAuthorized: boolean;
  exposeInMainNavigation: false;
  status: 'ready' | 'device_incompatible' | 'credentials_missing' | 'consent_missing';
  reason: string;
}

export function evaluateGarminConnectIqAccess(params: {
  deviceModelId: string;
  consentSnapshot: ConnectorConsentSnapshot;
  env?: ConnectorEnvReader;
}): GarminConnectIqEligibility {
  const model = getDeviceModelProfile(params.deviceModelId);
  if (!model || !model.compatible || !model.supportsConnectIqApp) {
    return {
      eligible: false,
      deviceModelId: params.deviceModelId,
      supportsConnectIqApp: false,
      mapTilesAuthorized: false,
      exposeInMainNavigation: false,
      status: 'device_incompatible',
      reason: `L'appareil ${model?.modelName ?? params.deviceModelId} ne supporte pas l'application Garmin Connect IQ et le fond de carte LKDV.`,
    };
  }

  const { configured, missingEnvVars } = inspectProviderCredentials('garmin_connect_iq', params.env);
  if (!configured) {
    return {
      eligible: false,
      deviceModelId: params.deviceModelId,
      supportsConnectIqApp: true,
      mapTilesAuthorized: false,
      exposeInMainNavigation: false,
      status: 'credentials_missing',
      reason: `Configuration Connect IQ absente (${missingEnvVars.join(', ')}) : aucun flux simulé.`,
    };
  }

  const consentEval = evaluateConnectorConsent(
    params.consentSnapshot,
    'garmin_connect_iq',
    'connect_iq_map'
  );
  if (!consentEval.allowed) {
    return {
      eligible: false,
      deviceModelId: params.deviceModelId,
      supportsConnectIqApp: true,
      mapTilesAuthorized: false,
      exposeInMainNavigation: false,
      status: 'consent_missing',
      reason: consentEval.reason,
    };
  }

  return {
    eligible: true,
    deviceModelId: params.deviceModelId,
    supportsConnectIqApp: true,
    mapTilesAuthorized: true,
    exposeInMainNavigation: false,
    status: 'ready',
    reason: `App Connect IQ et fond de carte autorisés sur ${model.modelName} (associé côté Compte, hors navigation principale).`,
  };
}

/**
 * K6.13 — Convertit une catégorie de waypoint LKDV vers le type de repère personnalisé Hammerhead Karoo.
 */
export function mapWaypointToHammerheadPoiType(
  category: RouteWaypointCategory
): HammerheadPoiType {
  switch (category) {
    case 'summit':
    case 'col_pass':
      return 'summit';
    case 'water_source':
      return 'water';
    case 'refuge_food':
      return 'food';
    case 'danger':
      return 'caution';
    case 'first_aid':
      return 'aid_station';
    case 'viewpoint':
      return 'viewpoint';
    case 'camping':
      return 'camping';
    case 'turn_left':
    case 'turn_right':
    case 'continue_straight':
    case 'custom':
    default:
      return 'custom_pin';
  }
}

/**
 * K6.13 — Prépare la synchronisation des repères personnalisés (waypoints nommés) vers les compteurs Hammerhead compatibles.
 */
export function buildHammerheadCustomPoisPayload(params: {
  route: CanonicalRouteForSync;
  deviceModelId?: string;
  consentSnapshot?: ConnectorConsentSnapshot;
  env?: ConnectorEnvReader;
}): HammerheadRouteSyncPayload {
  const modelId = params.deviceModelId ?? 'hammerhead_karoo_3';
  const model = getDeviceModelProfile(modelId);

  if (!model || !model.compatible || !model.supportsCustomPois) {
    return {
      routeId: params.route.routeId,
      revision: params.route.revision,
      modelId,
      compatible: false,
      customPois: [],
      truncatedPoiCount: params.route.waypoints.length,
      deliveryMode: 'incompatible_device',
      statusReason: `Le modèle ${model?.modelName ?? modelId} ne supporte pas la synchronisation cloud des repères personnalisés Hammerhead.`,
    };
  }

  const namedWaypoints = params.route.waypoints.filter((wp) => wp.name.trim().length > 0);
  const allowedCount = Math.min(namedWaypoints.length, model.maxWaypointsPerRoute);
  const truncatedPoiCount = Math.max(0, namedWaypoints.length - allowedCount);

  const customPois: HammerheadCustomPoi[] = namedWaypoints
    .slice(0, allowedCount)
    .map((wp) => ({
      id: wp.id,
      name: wp.name.trim(),
      hammerheadType: mapWaypointToHammerheadPoiType(wp.category),
      lat: wp.lat,
      lng: wp.lng,
      distanceAlongRouteMeters: wp.distanceFromStartMeters,
      altitudeMeters: wp.elevationMeters ?? null,
      description: wp.description ?? '',
    }));

  const { configured, missingEnvVars } = inspectProviderCredentials('hammerhead', params.env);
  const consentOk = params.consentSnapshot
    ? evaluateConnectorConsent(params.consentSnapshot, 'hammerhead', 'waypoint_export').allowed
    : false;

  const canPushCloud = configured && consentOk;

  return {
    routeId: params.route.routeId,
    revision: params.route.revision,
    modelId,
    compatible: true,
    customPois,
    truncatedPoiCount,
    deliveryMode: canPushCloud ? 'cloud_api_ready' : 'manual_gpx_fallback',
    statusReason: canPushCloud
      ? `${customPois.length} repère(s) personnalisé(s) prêt(s) pour synchronisation vers ${model.modelName}.`
      : !configured
        ? `Credentials Hammerhead absents (${missingEnvVars.join(', ')}) : repli GPX manuel.`
        : 'Consentement Hammerhead (waypoint_export) absent ou révoqué : repli GPX manuel.',
  };
}

/**
 * K6.12 — Contrôleur d'état temporaire pour le Live Sync vers Garmin, Wahoo, Bosch et Apple Watch.
 *
 * Règle d'affichage de la fiche K6.12 :
 * - Mode : État temporaire dans le drawer du parcours.
 * - Afficher SEULEMENT si le transfert est actif (`transferring`) ou échoue (`failed`).
 * - Retirer immédiatement à sa résolution (`resolved` ou `idle`).
 * - Les commandes principales du parcours restent toujours disponibles (`mainControlsAvailable: true`).
 */
export class LiveSyncSessionController {
  private state: LiveSyncTransferState = 'idle';
  private providerId: PartnerProviderId = 'garmin';
  private deviceModelId = 'garmin_fenix_8';
  private routeId = '';
  private revision = 1;
  private isMidNavigationUpdate = false;
  private message: string | null = null;

  public startTransfer(params: {
    providerId: 'garmin' | 'wahoo' | 'bosch' | 'apple_watch';
    deviceModelId: string;
    routeId: string;
    revision: number;
    isMidNavigationUpdate: boolean;
    consentSnapshot: ConnectorConsentSnapshot;
    env?: ConnectorEnvReader;
  }): LiveSyncBannerViewModel {
    this.providerId = params.providerId;
    this.deviceModelId = params.deviceModelId;
    this.routeId = params.routeId;
    this.revision = params.revision;
    this.isMidNavigationUpdate = params.isMidNavigationUpdate;

    const model = getDeviceModelProfile(params.deviceModelId);
    if (!model || !model.compatible || !model.supportsLiveSync) {
      this.state = 'failed';
      this.message = `Appareil ${model?.modelName ?? params.deviceModelId} non compatible avec le Live Sync en direct.`;
      return this.getBannerViewModel();
    }

    const consentEval = evaluateConnectorConsent(
      params.consentSnapshot,
      params.providerId,
      'live_sync'
    );
    if (!consentEval.allowed) {
      this.state = 'failed';
      this.message = consentEval.reason;
      return this.getBannerViewModel();
    }

    const { configured, missingEnvVars } = inspectProviderCredentials(params.providerId, params.env);
    if (!configured) {
      this.state = 'failed';
      this.message = `Live Sync indisponible : credentials ${params.providerId} absents (${missingEnvVars.join(', ')}).`;
      return this.getBannerViewModel();
    }

    this.state = 'transferring';
    this.message = params.isMidNavigationUpdate
      ? `Mise à jour de l'itinéraire (v${params.revision}) en cours vers ${model.modelName}…`
      : `Envoi de l'itinéraire en direct vers ${model.modelName}…`;

    return this.getBannerViewModel();
  }

  public markSignalLostOrFailed(reason = 'Signal appareil perdu pendant le Live Sync.'): LiveSyncBannerViewModel {
    this.state = 'failed';
    this.message = reason;
    return this.getBannerViewModel();
  }

  public resolveTransfer(): LiveSyncBannerViewModel {
    this.state = 'resolved';
    this.message = null;
    return this.getBannerViewModel();
  }

  public reset(): LiveSyncBannerViewModel {
    this.state = 'idle';
    this.message = null;
    return this.getBannerViewModel();
  }

  public getBannerViewModel(): LiveSyncBannerViewModel {
    const visible = this.state === 'transferring' || this.state === 'failed';
    return {
      visible,
      state: this.state,
      providerId: this.providerId,
      deviceModelId: this.deviceModelId,
      routeId: this.routeId,
      revision: this.revision,
      isMidNavigationUpdate: this.isMidNavigationUpdate,
      message: visible ? this.message : null,
      canRetry: this.state === 'failed',
      mainControlsAvailable: true,
    };
  }
}
