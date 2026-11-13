/**
 * K2.23 · Alertes de feux actifs et zones brûlées.
 *
 * Aucun fournisseur de feu n'est appelé ici : le module reçoit des incidents
 * déjà obtenus, ou `null` quand la source manque. Dans ce dernier cas l'état
 * est explicitement `unavailable`, jamais « aucun feu ». Un point chaud n'est
 * pas une fermeture : seul un incident officiel peut déclarer une fermeture.
 */
import {
  isFiniteNumber,
  type AnalysisGap,
  type AnalysisWarning,
} from './types';
import {
  densifyRoute,
  haversineM,
  isValidLatLon,
  parseInstant,
  pointInPolygon,
  round,
  routeSamples,
  toIso,
  type GeoPointInput,
} from './geo';

export type FireIncidentKind = 'official_alert' | 'hotspot' | 'burned_area';
export type FireCoordinate = readonly [number, number];

export interface FirePointGeometry {
  readonly type: 'Point';
  readonly coordinates: FireCoordinate;
}

export interface FirePolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: readonly (readonly FireCoordinate[])[];
}

export interface FireMultiPolygonGeometry {
  readonly type: 'MultiPolygon';
  readonly coordinates: readonly (readonly (readonly FireCoordinate[])[])[];
}

export type FireGeometry = FirePointGeometry | FirePolygonGeometry | FireMultiPolygonGeometry;

export interface FireIncident {
  readonly id: string;
  readonly kind: FireIncidentKind;
  readonly geometry: FireGeometry;
  /** Rayon d'effet pour un point ; absent = rayon nul, aucune supposition. */
  readonly radiusM?: number | null;
  readonly label?: string | null;
  readonly source?: string | null;
  readonly observedAt?: string | null;
  readonly validUntil?: string | null;
  /** Seul un incident officiel peut déclarer une fermeture. */
  readonly closure?: boolean | null;
}

export interface FireSource {
  readonly name: string;
  readonly retrievedAt: string | null;
  readonly license?: string | null;
}

export interface FireAnalysisInput {
  /** `null` = aucune source de feux disponible (≠ tableau vide). */
  readonly incidents: readonly FireIncident[] | null;
  readonly points?: readonly GeoPointInput[] | null;
  readonly source?: FireSource | null;
  readonly now?: string | null;
  readonly maxSegmentM?: number | null;
}

export interface FireImpact {
  readonly incidentId: string;
  readonly kind: FireIncidentKind;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly fromM: number;
  readonly toM: number;
  readonly lengthM: number;
  readonly label: string | null;
  readonly official: boolean;
  readonly closureStatus: 'declared' | 'unknown' | 'not_a_closure';
  readonly message: string;
}

export interface FireLayerFeature {
  readonly incidentId: string;
  readonly kind: FireIncidentKind;
  readonly geometry: FireGeometry;
  readonly mapStyleKey: string;
  readonly label: string | null;
}

export interface FireAnalysis {
  readonly status: 'clear' | 'alerts' | 'partial' | 'unavailable';
  readonly source: FireSource | null;
  readonly impacts: FireImpact[];
  readonly layer: FireLayerFeature[];
  readonly missing: AnalysisGap[];
  readonly warnings: AnalysisWarning[];
}

function validCoordinate(coordinate: unknown): coordinate is FireCoordinate {
  return (
    Array.isArray(coordinate) &&
    coordinate.length >= 2 &&
    isValidLatLon(coordinate[1], coordinate[0])
  );
}

function validRings(rings: unknown): rings is readonly (readonly FireCoordinate[])[] {
  return (
    Array.isArray(rings) &&
    rings.length > 0 &&
    rings.every(
      (ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(validCoordinate)
    )
  );
}

function validGeometry(geometry: FireGeometry | null | undefined): boolean {
  if (!geometry || typeof geometry !== 'object') return false;
  if (geometry.type === 'Point') return validCoordinate(geometry.coordinates);
  if (geometry.type === 'Polygon') return validRings(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every(validRings)
    );
  }
  return false;
}

function isInsideIncident(
  incident: FireIncident,
  point: readonly [number, number]
): boolean {
  if (incident.geometry.type === 'Point') {
    const radiusM = isFiniteNumber(incident.radiusM) ? Math.max(0, incident.radiusM) : 0;
    if (radiusM <= 0) {
      return (
        point[0] === incident.geometry.coordinates[0] &&
        point[1] === incident.geometry.coordinates[1]
      );
    }
    return (
      haversineM(point, incident.geometry.coordinates) <= radiusM
    );
  }
  if (incident.geometry.type === 'Polygon') {
    return pointInPolygon(point, incident.geometry.coordinates);
  }
  return incident.geometry.coordinates.some((rings) => pointInPolygon(point, rings));
}

function impactMessage(incident: FireIncident): string {
  const label = incident.label?.trim();
  const suffix = label ? ` « ${label} »` : '';
  if (incident.kind === 'official_alert') {
    return incident.closure === true
      ? `Alerte officielle${suffix} : fermeture déclarée sur ce tronçon.`
      : `Alerte officielle${suffix} : vérifier l’accès, la fermeture n’est pas déclarée par la source.`;
  }
  if (incident.kind === 'burned_area') {
    return `Zone brûlée${suffix} traversée : l’ouverture du sentier n’est pas déterminée.`;
  }
  return `Point chaud${suffix} à proximité : ce n’est pas une fermeture de sentier.`;
}

function mapStyleKey(kind: FireIncidentKind): string {
  if (kind === 'official_alert') return 'fire-official';
  if (kind === 'burned_area') return 'fire-burned';
  return 'fire-hotspot';
}

export function analyzeFireAlerts(input: FireAnalysisInput): FireAnalysis {
  const missing: AnalysisGap[] = [];
  const warnings: AnalysisWarning[] = [];

  if (input.incidents === null) {
    return {
      status: 'unavailable',
      source: input.source ?? null,
      impacts: [],
      layer: [],
      missing: [
        {
          code: 'fire_source_unavailable',
          message:
            'Aucune source de feux actifs ou de zones brûlées n’est disponible : aucun état « aucun feu » n’est affiché.',
        },
      ],
      warnings: [],
    };
  }

  const points = routeSamples(input.points ?? []);
  if (points.length < 2) {
    return {
      status: 'unavailable',
      source: input.source ?? null,
      impacts: [],
      layer: [],
      missing: [
        {
          code: 'route_geometry_unavailable',
          message: 'La géométrie du parcours est absente : les feux ne peuvent pas être situés.',
        },
      ],
      warnings: [],
    };
  }

  const nowMs = parseInstant(input.now ?? null, 'UTC') ?? Date.now();
  const maxSegmentM = isFiniteNumber(input.maxSegmentM)
    ? Math.max(10, input.maxSegmentM)
    : 50;
  const densified = densifyRoute(points, maxSegmentM);
  const impacts: FireImpact[] = [];
  const layer: FireLayerFeature[] = [];

  if (!input.source) {
    missing.push({
      code: 'fire_source_metadata_missing',
      message: 'La source des incidents n’est pas documentée : fraîcheur non vérifiable.',
    });
  }

  for (const incident of input.incidents) {
    if (!incident.id || !validGeometry(incident.geometry)) {
      warnings.push({
        code: 'fire_geometry_invalid',
        message: `Incident ${incident.id || '(sans identifiant)'} ignoré : géométrie invalide.`,
        severity: 'warning',
      });
      continue;
    }

    const validUntilMs = parseInstant(incident.validUntil ?? null, 'UTC');
    if (validUntilMs !== null && validUntilMs < nowMs) {
      warnings.push({
        code: 'fire_incident_expired',
        message: `Incident ${incident.id} expiré (${toIso(validUntilMs)}), ignoré.`,
        severity: 'info',
      });
      continue;
    }
    if (!incident.source && !input.source) {
      warnings.push({
        code: 'fire_incident_source_missing',
        message: `Incident ${incident.id} sans source : provenance incomplète.`,
        severity: 'info',
      });
    }
    if (incident.geometry.type === 'Point' && !isFiniteNumber(incident.radiusM)) {
      warnings.push({
        code: 'fire_radius_missing',
        message: `Incident ${incident.id} ponctuel sans rayon : seul un passage exact est signalé.`,
        severity: 'info',
      });
    }

    layer.push({
      incidentId: incident.id,
      kind: incident.kind,
      geometry: incident.geometry,
      mapStyleKey: mapStyleKey(incident.kind),
      label: incident.label?.trim() || null,
    });

    let runStart: number | null = null;
    const flush = (endIndex: number) => {
      if (runStart === null) return;
      const fromM = densified[runStart].distanceM;
      const toM = densified[endIndex].distanceM;
      impacts.push({
        incidentId: incident.id,
        kind: incident.kind,
        severity:
          incident.kind === 'official_alert'
            ? incident.closure === true
              ? 'critical'
              : 'warning'
            : 'info',
        fromM: round(fromM, 1),
        toM: round(toM, 1),
        lengthM: round(Math.max(0, toM - fromM), 1),
        label: incident.label?.trim() || null,
        official: incident.kind === 'official_alert',
        closureStatus:
          incident.kind !== 'official_alert'
            ? 'not_a_closure'
            : incident.closure === true
              ? 'declared'
              : 'unknown',
        message: impactMessage(incident),
      });
      runStart = null;
    };

    for (let index = 0; index < densified.length; index += 1) {
      const point = densified[index];
      const inside = isInsideIncident(incident, [point.lon, point.lat]);
      if (inside && runStart === null) runStart = index;
      if (!inside && runStart !== null) flush(index - 1);
    }
    flush(densified.length - 1);
  }

  const hasImpact = impacts.length > 0;
  const hasMetadataGap = missing.length > 0 || warnings.some((warning) => warning.severity === 'warning');
  const status = hasImpact ? 'alerts' : hasMetadataGap ? 'partial' : 'clear';

  return {
    status,
    source: input.source ?? null,
    impacts: impacts.sort((a, b) => a.fromM - b.fromM),
    layer,
    missing,
    warnings,
  };
}
