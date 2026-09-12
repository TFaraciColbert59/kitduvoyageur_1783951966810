/**
 * Phase 4 — Étape 3 du pipeline : normalisation GeoJSON / GPX / POI.
 *
 * Fonctions pures : aucune lecture réseau, aucun accès base. Tout élément
 * non conforme est rejeté et consigné — jamais corrigé silencieusement.
 */
import type { LatLng, NormalizedPoi, NormalizedRoute, PoiCategory, PoiKind } from './types';
import type { NormalizeResult } from './types-internal';

const POI_KINDS: readonly PoiKind[] = ['geographic', 'commercial_offer', 'affiliate_link'];
const POI_CATEGORIES: readonly PoiCategory[] = [
  'water',
  'refuge',
  'shelter',
  'rescue',
  'restriction',
  'viewpoint',
  'camping',
  'food',
  'transport',
  'lodging',
  'summit',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function stringifyTags(source: unknown): Record<string, string> {
  const tags: Record<string, string> = {};
  if (!isRecord(source)) return tags;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') tags[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') tags[key] = String(value);
  }
  return tags;
}

function parseCoordinatePair(raw: unknown): LatLng | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat, ele] = raw as unknown[];
  if (!isValidLatLng(lat, lng)) return null;
  const point: LatLng = { lat: lat as number, lng: lng as number };
  if (typeof ele === 'number' && Number.isFinite(ele)) point.ele = ele;
  return point;
}

/** Étape 3a — GeoJSON (FeatureCollection, Feature ou géométrie nue). */
export function normalizeGeoJsonRoutes(input: unknown): NormalizeResult<NormalizedRoute> {
  const routes: NormalizedRoute[] = [];
  const errors: string[] = [];

  const features: unknown[] = [];
  if (Array.isArray(input)) {
    features.push(...input);
  } else if (isRecord(input)) {
    if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
      features.push(...input.features);
    } else if (input.type === 'Feature') {
      features.push(input);
    } else if (typeof input.type === 'string' && input.type.endsWith('LineString')) {
      features.push({ type: 'Feature', geometry: input, properties: {} });
    } else {
      errors.push('GeoJSON racine non reconnue (FeatureCollection/Feature/LineString attendu).');
    }
  } else {
    errors.push('Entrée GeoJSON invalide (objet attendu).');
  }

  features.forEach((feature, featureIndex) => {
    if (!isRecord(feature)) {
      errors.push(`Feature #${featureIndex} : objet attendu.`);
      return;
    }
    const geometry = feature.geometry;
    const properties = isRecord(feature.properties) ? feature.properties : {};
    if (!isRecord(geometry)) {
      errors.push(`Feature #${featureIndex} : géométrie absente.`);
      return;
    }

    const name =
      typeof properties.name === 'string' && properties.name.trim().length > 0
        ? properties.name.trim()
        : `feature-${featureIndex}`;
    const externalIdBase =
      properties.id !== undefined && properties.id !== null
        ? String(properties.id)
        : `feature-${featureIndex}`;
    const tags = stringifyTags(properties);

    const geoms: { suffix: string; coordinates: unknown }[] = [];
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      geoms.push({ suffix: '', coordinates: geometry.coordinates });
    } else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
      (geometry.coordinates as unknown[]).forEach((line, lineIndex) => {
        geoms.push({ suffix: `#${lineIndex}`, coordinates: line });
      });
    } else {
      errors.push(`Feature #${featureIndex} : LineString/MultiLineString attendu.`);
      return;
    }

    geoms.forEach(({ suffix, coordinates }) => {
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        errors.push(`Feature #${featureIndex}${suffix} : au moins 2 points requis.`);
        return;
      }
      const points: LatLng[] = [];
      let invalidPoint = false;
      coordinates.forEach((pair, pointIndex) => {
        const point = parseCoordinatePair(pair);
        if (!point) {
          errors.push(`Feature #${featureIndex}${suffix} : point #${pointIndex} hors bornes ou illisible.`);
          invalidPoint = true;
          return;
        }
        points.push(point);
      });
      if (invalidPoint) return;
      routes.push({
        externalId: `${externalIdBase}${suffix}`,
        name,
        source: typeof properties.source === 'string' ? properties.source : '',
        points,
        tags,
      });
    });
  });

  return { items: routes, errors };
}

/**
 * Étape 3b — trace GPX (trkpt + ele). Extraction stricte, tolérante à l'ordre
 * des attributs. Aucune valeur inventée : point illisible ⇒ rejeté.
 */
export function parseGpxTrack(xml: string): NormalizeResult<LatLng> {
  const points: LatLng[] = [];
  const errors: string[] = [];

  if (!xml || typeof xml !== 'string' || !xml.includes('<gpx')) {
    return { items: [], errors: ['Flux GPX absent ou sans balise racine <gpx>.'] };
  }

  const trkptRegex = /<trkpt([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let match: RegExpExecArray | null;
  while ((match = trkptRegex.exec(xml)) !== null) {
    const attributes = match[1];
    const body = match[2];
    const latMatch = /(?:^|\s)lat=["']([^"']+)["']/i.exec(attributes);
    const lonMatch = /(?:^|\s)lon=["']([^"']+)["']/i.exec(attributes);
    if (!latMatch || !lonMatch) {
      errors.push('Point de trace sans latitude/longitude.');
      continue;
    }
    const lat = Number.parseFloat(latMatch[1]);
    const lng = Number.parseFloat(lonMatch[1]);
    if (!isValidLatLng(lat, lng)) {
      errors.push('Point de trace hors bornes géographiques.');
      continue;
    }
    const point: LatLng = { lat, lng };
    const eleMatch = /<ele>([^<]+)<\/ele>/i.exec(body);
    if (eleMatch) {
      const ele = Number.parseFloat(eleMatch[1]);
      if (Number.isFinite(ele)) point.ele = ele;
    }
    const timeMatch = /<time>([^<]+)<\/time>/i.exec(body);
    if (timeMatch) point.time = timeMatch[1].trim();
    points.push(point);
  }

  if (points.length === 0) errors.push('Aucun point de trace exploitable dans le GPX.');
  if (points.length === 1) errors.push('Trace GPX dégénérée : un seul point.');
  return { items: points, errors };
}

/** Étape 3c — normalisation des enregistrements POI/offres/affiliation. */
export function normalizePoiRecords(input: unknown): NormalizeResult<NormalizedPoi> {
  const pois: NormalizedPoi[] = [];
  const errors: string[] = [];

  if (!Array.isArray(input)) {
    return { items: [], errors: ['Inventaire POI invalide : tableau attendu.'] };
  }

  input.forEach((raw, index) => {
    if (!isRecord(raw)) {
      errors.push(`POI #${index} : objet attendu.`);
      return;
    }
    const kind = raw.kind;
    if (typeof kind !== 'string' || !POI_KINDS.includes(kind as PoiKind)) {
      errors.push(`POI #${index} : kind invalide (geographic/commercial_offer/affiliate_link).`);
      return;
    }
    if (!isValidLatLng(raw.lat, raw.lng)) {
      errors.push(`POI #${index} : coordonnées absentes ou hors bornes.`);
      return;
    }
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (name.length === 0) {
      errors.push(`POI #${index} : nom obligatoire.`);
      return;
    }
    const source = typeof raw.source === 'string' ? raw.source.trim() : '';
    if (source.length === 0) {
      errors.push(`POI #${index} : source obligatoire (POI sourcé, sinon rejeté).`);
      return;
    }

    const categoryRaw = raw.category;
    let category: PoiCategory | null = null;
    if (typeof categoryRaw === 'string' && categoryRaw.length > 0) {
      if (!POI_CATEGORIES.includes(categoryRaw as PoiCategory)) {
        errors.push(`POI #${index} : catégorie inconnue « ${categoryRaw} » (jamais inventée).`);
        return;
      }
      category = categoryRaw as PoiCategory;
    }

    if (kind === 'geographic' && category === null) {
      errors.push(`POI #${index} : POI géographique sans catégorie reconnue.`);
      return;
    }

    const price = typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : null;

    pois.push({
      id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `poi-${index}`,
      kind: kind as PoiKind,
      name,
      lat: raw.lat as number,
      lng: raw.lng as number,
      category,
      source,
      price,
      currency: typeof raw.currency === 'string' ? raw.currency : null,
      priceCheckedAt: typeof raw.priceCheckedAt === 'string' ? raw.priceCheckedAt : null,
      availability: typeof raw.availability === 'boolean' ? raw.availability : null,
      availabilityCheckedAt:
        typeof raw.availabilityCheckedAt === 'string' ? raw.availabilityCheckedAt : null,
      expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : null,
      affiliateTargetUrl: typeof raw.affiliateTargetUrl === 'string' ? raw.affiliateTargetUrl : null,
      affiliateDisclosure: typeof raw.affiliateDisclosure === 'string' ? raw.affiliateDisclosure : null,
      tags: stringifyTags(raw.tags),
    });
  });

  return { items: pois, errors };
}
