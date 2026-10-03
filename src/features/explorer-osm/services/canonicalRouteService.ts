/**
 * LE KIT DU VOYAGEUR — SERVICE DE CANONICALISATION LKDV
 * Gestion de l'identité canonique unique dans `hiking_routes`.
 * Persistance normalisée et auditable :
 *   hiking_routes (id canonique RouteId)
 *     ├── hiking_route_sources (provenance, external_id, provider)
 *     └── hiking_route_revisions (versioning, geometry_hash, quality)
 * Matérialisation strictement idempotente, anti-doublon et concurrente-safe.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CanonicalRoute,
  ExternalRouteDetail,
  HikingRouteRevision,
  HikingRouteSource,
  MaterializationResult,
  RouteId,
} from '../domain/types';
import { toRouteId } from '../domain/types';
import {
  computeGeometryHash,
  hierarchyToGeoJsonMultiLineString,
} from '../domain/geometry';

/**
 * Récupère une route canonique existante par son ID LKDV avec sa source et ses révisions
 */
export async function getCanonicalRoute(
  supabase: SupabaseClient,
  routeId: RouteId | number
): Promise<CanonicalRoute | null> {
  const numericId = typeof routeId === 'number' ? routeId : Number(routeId);

  const { data: routeData, error: routeErr } = await supabase
    .from('hiking_routes')
    .select('id, osm_relation_id, name, ref, network, distance_km, geom, region, created_at')
    .eq('id', numericId)
    .maybeSingle();

  if (routeErr || !routeData) return null;

  // Récupération de la source normalisée
  const { data: sourceData } = await supabase
    .from('hiking_route_sources')
    .select('id, route_id, provider, external_type, external_id, source_version, source_timestamp, license, fetched_at, updated_at')
    .eq('route_id', numericId)
    .maybeSingle();

  // Récupération des révisions géométriques
  const { data: revisionsData } = await supabase
    .from('hiking_route_revisions')
    .select('id, route_id, revision_number, geometry_hash, source_version, quality, is_current, geom, created_at')
    .eq('route_id', numericId)
    .order('revision_number', { ascending: false });

  const revisions: HikingRouteRevision[] = (revisionsData || []).map((r: any) => ({
    id: r.id,
    routeId: toRouteId(r.route_id),
    revisionNumber: r.revision_number,
    geometryHash: r.geometry_hash,
    sourceVersion: r.source_version ?? null,
    quality: r.quality,
    isCurrent: Boolean(r.is_current),
    geom: r.geom,
    createdAt: r.created_at,
  }));

  const currentRevision = revisions.find((r) => r.isCurrent) || revisions[0];

  const source: HikingRouteSource | null = sourceData
    ? {
        id: sourceData.id,
        routeId: toRouteId(sourceData.route_id),
        provider: sourceData.provider,
        externalType: sourceData.external_type,
        externalId: sourceData.external_id,
        sourceVersion: sourceData.source_version ?? null,
        sourceTimestamp: sourceData.source_timestamp ?? null,
        license: sourceData.license || 'ODbL-1.0',
        fetchedAt: sourceData.fetched_at,
        updatedAt: sourceData.updated_at,
      }
    : null;

  const geometryStatus = routeData.geom
    ? (currentRevision?.quality || 'complete')
    : 'unavailable';

  return {
    id: toRouteId(routeData.id),
    osmRelationId: Number(routeData.osm_relation_id || (sourceData?.provider === 'openstreetmap' ? sourceData.external_id : 0)),
    name: routeData.name || 'Itinéraire sans titre',
    ref: routeData.ref || null,
    network: routeData.network || null,
    distanceKm: Number(routeData.distance_km || 0),
    geom: routeData.geom || null,
    tags: {},
    region: routeData.region || null,
    sourceStatus: currentRevision?.quality === 'source_deleted' ? 'source_deleted' : 'active',
    geometryStatus,
    currentRevisionHash: currentRevision?.geometryHash || null,
    createdAt: routeData.created_at,
    source,
    revisions,
  };
}

/**
 * Récupère la géométrie pure d'une route canonique LKDV
 */
export async function getRouteGeometry(
  supabase: SupabaseClient,
  routeId: RouteId | number
): Promise<GeoJSON.Geometry | null> {
  const numericId = typeof routeId === 'number' ? routeId : Number(routeId);

  // Utilise get_route_geojson si présent ou lit geom directement
  const { data: rpcData } = await supabase.rpc('get_route_geojson', { p_route_id: numericId });
  if (rpcData) {
    if (typeof rpcData === 'string') {
      try {
        return JSON.parse(rpcData);
      } catch {
        // fallback
      }
    } else {
      return rpcData as GeoJSON.Geometry;
    }
  }

  const { data } = await supabase
    .from('hiking_routes')
    .select('geom')
    .eq('id', numericId)
    .maybeSingle();

  return (data?.geom as GeoJSON.Geometry) || null;
}

/**
 * Prépare un MultiLineString GeoJSON compatible avec la colonne
 * PostGIS `geometry(MultiLineString, 4326)` de la table `hiking_routes`.
 */
function ensurePostGisMultiLineString(
  externalDetail: ExternalRouteDetail
): GeoJSON.MultiLineString | null {
  if (externalDetail.geometryHierarchy) {
    const mls = hierarchyToGeoJsonMultiLineString(externalDetail.geometryHierarchy, true);
    if (mls) return mls;
  }

  const raw = externalDetail.geojson;
  if (!raw) return null;

  if (raw.type === 'MultiLineString') {
    return raw as GeoJSON.MultiLineString;
  }
  if (raw.type === 'LineString') {
    return {
      type: 'MultiLineString',
      coordinates: [(raw as GeoJSON.LineString).coordinates],
    };
  }
  return null;
}

/**
 * Matérialise une route externe (ex. OSM) dans `hiking_routes` de manière STRICTEMENT IDEMPOTENTE.
 * Deux appels simultanés pour la même relation produiront toujours le même objet canonique.
 * Enregistre les métadonnées de source dans `hiking_route_sources`
 * et les versions géométriques successives dans `hiking_route_revisions`.
 */
export async function getOrCreateCanonicalRoute(
  supabase: SupabaseClient,
  externalDetail: ExternalRouteDetail
): Promise<MaterializationResult> {
  const osmId = externalDetail.osmRelationId;
  const provider = externalDetail.source.provider || 'openstreetmap';
  const externalType = externalDetail.source.sourceType || 'relation';
  const externalId = String(externalDetail.source.externalId || osmId);

  if (!externalId) {
    throw new Error('Identifiant externe manquant pour la matérialisation canonique');
  }

  const geomMultiLine = ensurePostGisMultiLineString(externalDetail);
  const distanceKm =
    externalDetail.calculatedDistanceKm ??
    externalDetail.declaredDistanceKm ??
    0;

  const currentGeoHash =
    externalDetail.geometryHierarchy?.geometryHash ||
    computeGeometryHash(externalDetail.geometryHierarchy?.mainSegments || []);

  const newSourceVersion =
    externalDetail.source.sourceVersion != null
      ? String(externalDetail.source.sourceVersion)
      : null;

  const nowIso = new Date().toISOString();

  // 1. Recherche d'une source existante (clé composite provider + external_id)
  const { data: existingSource } = await supabase
    .from('hiking_route_sources')
    .select('id, route_id, provider, external_type, external_id, source_version, source_timestamp, license, fetched_at, updated_at')
    .eq('provider', provider)
    .eq('external_id', externalId)
    .maybeSingle();

  // Fallback rétrocompatible pour les routes OSM déjà importées dans hiking_routes
  let existingRouteId = existingSource?.route_id ? Number(existingSource.route_id) : null;
  if (!existingRouteId && osmId && Number.isFinite(osmId)) {
    const { data: legacyRoute } = await supabase
      .from('hiking_routes')
      .select('id')
      .eq('osm_relation_id', osmId)
      .maybeSingle();
    if (legacyRoute) {
      existingRouteId = Number(legacyRoute.id);
    }
  }

  // Si la route existe déjà : vérification des révisions ou retour idempotent
  if (existingRouteId) {
    const { data: existingRoute } = await supabase
      .from('hiking_routes')
      .select('id, osm_relation_id, name, ref, network, distance_km, geom, region, created_at')
      .eq('id', existingRouteId)
      .maybeSingle();

    if (existingRoute) {
      const { data: currentRev } = await supabase
        .from('hiking_route_revisions')
        .select('id, route_id, revision_number, geometry_hash, source_version, quality, is_current, geom, created_at')
        .eq('route_id', existingRouteId)
        .eq('is_current', true)
        .maybeSingle();

    const existingGeoHash = currentRev?.geometry_hash;
    const existingVersion = currentRev?.source_version ?? existingSource?.source_version;

    const isSourceDeleted = externalDetail.geometryStatus === 'source_deleted';
    const isGeometryUpdated = Boolean(
      currentGeoHash &&
      existingGeoHash &&
      currentGeoHash !== existingGeoHash &&
      !isSourceDeleted
    );
    const isVersionUpdated = Boolean(
      newSourceVersion &&
      existingVersion &&
      newSourceVersion !== String(existingVersion)
    );

    // Détection d'une mise à jour de la source : création d'une nouvelle révision normalisée
    if (isGeometryUpdated || isVersionUpdated || isSourceDeleted) {
      // 1. Clôture de la révision courante précédente
      await supabase
        .from('hiking_route_revisions')
        .update({ is_current: false })
        .eq('route_id', existingRouteId)
        .eq('is_current', true);

      // 2. Détermination du numéro de révision suivant
      const { data: maxRevData } = await supabase
        .from('hiking_route_revisions')
        .select('revision_number')
        .eq('route_id', existingRouteId)
        .order('revision_number', { ascending: false })
        .limit(1);

      const nextRevNum = ((maxRevData?.[0]?.revision_number) || 1) + 1;

      // 3. Insertion de la nouvelle révision
      await supabase
        .from('hiking_route_revisions')
        .insert({
          route_id: existingRouteId,
          revision_number: nextRevNum,
          geometry_hash: isSourceDeleted ? (existingGeoHash || 'geo_deleted') : currentGeoHash,
          source_version: newSourceVersion || existingVersion,
          quality: externalDetail.geometryStatus,
          is_current: true,
          geom: isSourceDeleted ? (currentRev?.geom || null) : geomMultiLine,
          created_at: nowIso,
        });

      // 4. Mise à jour de la source
      await supabase
        .from('hiking_route_sources')
        .upsert(
          {
            route_id: existingRouteId,
            provider,
            external_type: externalType,
            external_id: externalId,
            source_version: newSourceVersion || existingVersion,
            source_timestamp: externalDetail.source.sourceTimestamp ?? existingSource?.source_timestamp ?? null,
            updated_at: nowIso,
          },
          { onConflict: 'provider,external_id' }
        );

      // 5. Mise à jour de hiking_routes sans changer l'ID
      const updatePayload: Record<string, any> = {
        name: externalDetail.name || existingRoute.name,
        ref: externalDetail.ref || existingRoute.ref,
        network: externalDetail.network || existingRoute.network,
      };

      if (!isSourceDeleted && geomMultiLine) {
        updatePayload.geom = geomMultiLine;
        updatePayload.distance_km = Math.round(distanceKm * 1000) / 1000;
      }

      await supabase
        .from('hiking_routes')
        .update(updatePayload)
        .eq('id', existingRouteId);

      const updatedRoute: CanonicalRoute = {
        id: toRouteId(existingRouteId),
        osmRelationId: Number(existingRoute.osm_relation_id || (provider === 'openstreetmap' ? externalId : 0)),
        name: updatePayload.name,
        ref: updatePayload.ref,
        network: updatePayload.network,
        distanceKm: Number(updatePayload.distance_km ?? existingRoute.distance_km ?? 0),
        geom: (updatePayload.geom as any) || existingRoute.geom,
        tags: {},
        region: existingRoute.region || null,
        sourceStatus: isSourceDeleted ? 'source_deleted' : 'active',
        geometryStatus: externalDetail.geometryStatus,
        currentRevisionHash: isSourceDeleted ? existingGeoHash : currentGeoHash,
        createdAt: existingRoute.created_at,
        updatedAt: nowIso,
      };

      return {
        canonicalId: toRouteId(existingRouteId),
        isNewlyCreated: false,
        route: updatedRoute,
      };
    }

    // Aucun changement : retour idempotent de la route existante
    return {
      canonicalId: toRouteId(existingRouteId),
      isNewlyCreated: false,
      route: {
        id: toRouteId(existingRouteId),
        osmRelationId: Number(existingRoute.osm_relation_id || (provider === 'openstreetmap' ? externalId : 0)),
        name: existingRoute.name || externalDetail.name,
        ref: existingRoute.ref || externalDetail.ref,
        network: existingRoute.network || externalDetail.network,
        distanceKm: Number(existingRoute.distance_km || externalDetail.calculatedDistanceKm || 0),
        geom: existingRoute.geom || geomMultiLine,
        tags: {},
        region: existingRoute.region || null,
        sourceStatus: 'active',
        geometryStatus: currentRev?.quality || externalDetail.geometryStatus,
        currentRevisionHash: currentRev?.geometry_hash || currentGeoHash,
        createdAt: existingRoute.created_at,
      },
    };
    }
  }

  // 2. Création d'une nouvelle route canonique
  const insertPayload = {
    osm_relation_id: osmId && Number.isFinite(osmId) ? osmId : null,
    name: externalDetail.name || 'Itinéraire sans titre',
    ref: externalDetail.ref || null,
    network: externalDetail.network || null,
    distance_km: Math.round(distanceKm * 1000) / 1000,
    geom: geomMultiLine as any,
  };

  // 3. Insertion avec protection stricte contre les accès concurrents
  const { data: inserted, error: insertErr } = await supabase
    .from('hiking_routes')
    .insert(insertPayload)
    .select('id, osm_relation_id, name, ref, network, distance_km, geom, region, created_at')
    .single();

  if (insertErr) {
    // Si code 23505 (unique_violation) : course concurrente gagnée par une autre requête
    if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
      const { data: reSelected } = await supabase
        .from('hiking_routes')
        .select('id, osm_relation_id, name, ref, network, distance_km, geom, region, created_at')
        .eq('osm_relation_id', osmId)
        .single();

      if (reSelected) {
        return {
          canonicalId: toRouteId(reSelected.id),
          isNewlyCreated: false,
          route: {
            id: toRouteId(reSelected.id),
            osmRelationId: Number(reSelected.osm_relation_id),
            name: reSelected.name || externalDetail.name,
            ref: reSelected.ref || externalDetail.ref,
            network: reSelected.network || externalDetail.network,
            distanceKm: Number(reSelected.distance_km || 0),
            geom: reSelected.geom as any,
            tags: {},
            region: reSelected.region || null,
            sourceStatus: 'active',
            geometryStatus: externalDetail.geometryStatus,
            currentRevisionHash: currentGeoHash,
            createdAt: reSelected.created_at,
          },
        };
      }
    }

    throw new Error(`Échec de matérialisation de la route canonique: ${insertErr.message}`);
  }

  const canonicalId = toRouteId(inserted.id);

  // 4. Enregistrement de la source externe normalisée
  await supabase
    .from('hiking_route_sources')
    .insert({
      route_id: inserted.id,
      provider,
      external_type: externalType,
      external_id: externalId,
      source_version: newSourceVersion,
      source_timestamp: externalDetail.source.sourceTimestamp || null,
      license: externalDetail.source.license || 'ODbL-1.0',
      fetched_at: externalDetail.source.fetchedAt || nowIso,
      updated_at: nowIso,
    });

  // 5. Enregistrement de la révision initiale (révision 1)
  await supabase
    .from('hiking_route_revisions')
    .insert({
      route_id: inserted.id,
      revision_number: 1,
      geometry_hash: currentGeoHash,
      source_version: newSourceVersion,
      quality: externalDetail.geometryStatus,
      is_current: true,
      geom: geomMultiLine,
      created_at: nowIso,
    });

  // 6. Enrichissement optionnel dans trail_metadata
  if (
    externalDetail.elevationGainM != null ||
    externalDetail.difficulty != null ||
    externalDetail.elevationLossM != null
  ) {
    try {
      await supabase
        .from('trail_metadata')
        .upsert(
          {
            trail_id: inserted.id,
            elevation_gain: externalDetail.elevationGainM ?? null,
            elevation_loss: externalDetail.elevationLossM ?? null,
            difficulty: externalDetail.difficulty ?? 'Modérée',
            terrain_type: externalDetail.network === 'nwn' ? 'Grande randonnée nationale' : 'Sentier de randonnée',
          },
          { onConflict: 'trail_id' }
        );
    } catch {
      // Non bloquant : la route canonique reste valide
    }
  }

  return {
    canonicalId,
    isNewlyCreated: true,
    route: {
      id: canonicalId,
      osmRelationId: Number(inserted.osm_relation_id || (provider === 'openstreetmap' ? externalId : 0)),
      name: inserted.name,
      ref: inserted.ref,
      network: inserted.network,
      distanceKm: Number(inserted.distance_km),
      geom: inserted.geom as any,
      tags: {},
      region: inserted.region || null,
      sourceStatus: 'active',
      geometryStatus: externalDetail.geometryStatus,
      currentRevisionHash: currentGeoHash,
      createdAt: inserted.created_at,
    },
  };
}
