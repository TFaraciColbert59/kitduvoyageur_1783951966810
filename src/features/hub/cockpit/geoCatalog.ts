/**
 * Catalogue géo-environnemental, contrats d'observation et orchestration
 * incrémentale des domaines du HUB (P03-01, P03-02, P08-01, P08-02, P08-07).
 */

export type GeoDomainSourceId =
  | 'met_norway'
  | 'osm_postgis_poi'
  | 'nasa_firms'
  | 'official_weather_alerts'
  | 'community_field_reports'
  | 'elevation_dem';

export interface GeoSourceDescriptor {
  id: GeoDomainSourceId;
  label: string;
  license: string;
  defaultTtlMinutes: number;
  official: boolean;
  caveat: string;
}

export const HUB_GEO_CATALOG: Record<GeoDomainSourceId, GeoSourceDescriptor> = {
  met_norway: {
    id: 'met_norway',
    label: 'MET Norway Locationforecast 2.0',
    license: 'CC BY 4.0',
    defaultTtlMinutes: 60,
    official: true,
    caveat: 'Prévision modèle numérique ; l’horizon fiable décroît au-delà de 3 jours.',
  },
  osm_postgis_poi: {
    id: 'osm_postgis_poi',
    label: 'OpenStreetMap / PostGIS LKDV',
    license: 'ODbL 1.0',
    defaultTtlMinutes: 1440,
    official: false,
    caveat: 'Tag collaboratif : ne prouve ni la potabilité de l’eau ni l’ouverture actuelle.',
  },
  nasa_firms: {
    id: 'nasa_firms',
    label: 'NASA FIRMS Active Fire',
    license: 'Public Domain (NASA)',
    defaultTtlMinutes: 180,
    official: true,
    caveat: 'Anomalie thermique satellite ; vérifier les arrêtés locaux et secours officiels.',
  },
  official_weather_alerts: {
    id: 'official_weather_alerts',
    label: 'Alertes météo officielles',
    license: 'Licence Ouverte / WMO CAP',
    defaultTtlMinutes: 30,
    official: true,
    caveat: 'L’absence de flux configuré ne signifie jamais absence de danger.',
  },
  community_field_reports: {
    id: 'community_field_reports',
    label: 'Signalements terrain LKDV',
    license: 'Interne LKDV',
    defaultTtlMinutes: 10080,
    official: false,
    caveat: 'Observation datée d’un randonneur avec expiration automatique (7 jours).',
  },
  elevation_dem: {
    id: 'elevation_dem',
    label: 'Profil altimétrique',
    license: 'Copernicus / SRTM / Étapes',
    defaultTtlMinutes: 10080,
    official: false,
    caveat: 'Précision dépendante du pas d’échantillonnage ; données manquantes affichées comme inconnues.',
  },
};

export interface SourceObservation<T> {
  sourceId: GeoDomainSourceId;
  status: 'fresh' | 'stale' | 'unavailable' | 'unconfigured';
  observedAt: string | null;
  validUntil: string | null;
  data: T | null;
  reason?: string;
}

export function evaluateSourceFreshness<T>(
  sourceId: GeoDomainSourceId,
  data: T | null,
  observedAt: string | null,
  nowMs = Date.now(),
  unconfigured = false,
): SourceObservation<T> {
  if (unconfigured) {
    return {
      sourceId,
      status: 'unconfigured',
      observedAt: null,
      validUntil: null,
      data: null,
      reason: 'Fournisseur non configuré sur cet environnement.',
    };
  }
  if (data == null || !observedAt) {
    return {
      sourceId,
      status: 'unavailable',
      observedAt,
      validUntil: null,
      data: null,
      reason: 'Donnée momentanément indisponible.',
    };
  }
  const obsMs = Date.parse(observedAt);
  const ttlMs = HUB_GEO_CATALOG[sourceId].defaultTtlMinutes * 60_000;
  if (!Number.isFinite(obsMs)) {
    return { sourceId, status: 'stale', observedAt, validUntil: null, data, reason: 'Horodatage non vérifié.' };
  }
  const validUntil = new Date(obsMs + ttlMs).toISOString();
  const isStale = nowMs > obsMs + ttlMs;
  return {
    sourceId,
    status: isStale ? 'stale' : 'fresh',
    observedAt,
    validUntil,
    data,
    reason: isStale ? 'Donnée dépassée — actualisation recommandée.' : undefined,
  };
}

export type HubDomainEventType =
  | 'step_executed'
  | 'plan_revised'
  | 'expense_recorded'
  | 'kit_toggled'
  | 'moment_created'
  | 'member_changed'
  | 'lifecycle_changed'
  | 'field_report_added';

export type HubWidgetDomain =
  | 'meteo'
  | 'budget'
  | 'carte'
  | 'etapes'
  | 'carnet'
  | 'kit'
  | 'paperasse'
  | 'groupe';

const EVENT_DEPENDENCY_GRAPH: Record<HubDomainEventType, readonly HubWidgetDomain[]> = {
  step_executed: ['etapes', 'carte'],
  plan_revised: ['etapes', 'carte', 'meteo', 'paperasse'],
  expense_recorded: ['budget'],
  kit_toggled: ['kit'],
  moment_created: ['carnet'],
  member_changed: ['groupe', 'budget', 'kit'],
  lifecycle_changed: ['etapes', 'carte', 'groupe', 'meteo'],
  field_report_added: ['carte', 'meteo'],
};

/**
 * Retourne uniquement les domaines dépendants à recalculer pour un événement métier (P08-02).
 */
export function resolveAffectedDomains(event: HubDomainEventType): readonly HubWidgetDomain[] {
  return EVENT_DEPENDENCY_GRAPH[event];
}
