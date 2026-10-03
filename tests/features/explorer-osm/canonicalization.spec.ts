import { describe, it, expect, vi } from 'vitest';
import {
  getCanonicalRoute,
  getOrCreateCanonicalRoute,
} from '@/features/explorer-osm/services/canonicalRouteService';
import type { ExternalRouteDetail } from '@/features/explorer-osm/domain/types';

describe('Canonical Route Service — Idempotence & Modèle Normalisé (sources & révisions)', () => {
  const mockDetail: ExternalRouteDetail = {
    id: 'osm:relation:999888',
    osmRelationId: 999888,
    name: 'Tour des Aiguilles Rouges',
    ref: 'TAR',
    network: 'rwn',
    representativePoint: [6.88, 45.95],
    representativePointKind: 'bbox-center',
    declaredDistanceKm: 32.5,
    calculatedDistanceKm: 32.8,
    geometryStatus: 'complete',
    source: {
      provider: 'openstreetmap',
      externalId: '999888',
      sourceType: 'relation',
      sourceVersion: '12',
      fetchedAt: '2026-10-03T09:00:00Z',
      license: 'ODbL-1.0',
    },
    tags: { name: 'Tour des Aiguilles Rouges', ref: 'TAR' },
    geometryHierarchy: {
      status: 'complete',
      mainSegments: [],
      alternatives: [],
      approaches: [],
      excursions: [],
      connections: [],
      totalDistanceKm: 32.8,
      gapCount: 0,
      geometryHash: 'geo_hash_v12',
      warnings: [],
    },
    geojson: {
      type: 'LineString',
      coordinates: [
        [6.88, 45.95],
        [6.89, 45.96],
      ],
    },
  };

  function createMockSupabase(initialData?: {
    routes?: any[];
    sources?: any[];
    revisions?: any[];
  }) {
    const db = {
      hiking_routes: [...(initialData?.routes || [])],
      hiking_route_sources: [...(initialData?.sources || [])],
      hiking_route_revisions: [...(initialData?.revisions || [])],
      trail_metadata: [] as any[],
    };

    let nextRouteId = 1000;

    const mockClient = {
      _db: db,
      from: (table: string) => {
        const rows = (db as any)[table] || [];

        return {
          select: (cols?: string) => {
            let filterCol: string | null = null;
            let filterVal: any = null;
            let orderCol: string | null = null;
            let isAsc = true;
            let limitVal: number | null = null;

            const builder: any = {
              eq: (col: string, val: any) => {
                filterCol = col;
                filterVal = val;
                return builder;
              },
              order: (col: string, opts?: { ascending?: boolean }) => {
                orderCol = col;
                isAsc = opts?.ascending ?? true;
                return builder;
              },
              limit: (n: number) => {
                limitVal = n;
                return builder;
              },
              maybeSingle: async () => {
                let matches = rows;
                if (filterCol !== null) {
                  matches = matches.filter((r: any) => String(r[filterCol!]) === String(filterVal));
                }
                return { data: matches[0] ? { ...matches[0] } : null, error: null };
              },
              single: async () => {
                let matches = rows;
                if (filterCol !== null) {
                  matches = matches.filter((r: any) => String(r[filterCol!]) === String(filterVal));
                }
                if (!matches[0]) {
                  return { data: null, error: { message: 'Row not found' } };
                }
                return { data: { ...matches[0] }, error: null };
              },
              then: (resolve: any) => {
                let matches = [...rows];
                if (filterCol !== null) {
                  matches = matches.filter((r: any) => String(r[filterCol!]) === String(filterVal));
                }
                if (orderCol) {
                  matches.sort((a, b) => (isAsc ? a[orderCol!] - b[orderCol!] : b[orderCol!] - a[orderCol!]));
                }
                if (limitVal) {
                  matches = matches.slice(0, limitVal);
                }
                return Promise.resolve({ data: matches.map((m) => ({ ...m })), error: null }).then(resolve);
              },
            };
            return builder;
          },
          insert: (payload: any) => {
            const arr = Array.isArray(payload) ? payload : [payload];

            for (const item of arr) {
              if (table === 'hiking_routes' && item.osm_relation_id != null) {
                const dup = rows.find((r: any) => r.osm_relation_id === item.osm_relation_id);
                if (dup) {
                  return {
                    select: () => ({
                      single: async () => ({
                        data: null,
                        error: {
                          code: '23505',
                          message: 'duplicate key value violates unique constraint idx_hiking_routes_osm_relation_id',
                        },
                      }),
                    }),
                    then: (resolve: any) =>
                      Promise.resolve({
                        data: null,
                        error: { code: '23505', message: 'duplicate key value' },
                      }).then(resolve),
                  };
                }
              }
            }

            const inserted = arr.map((item) => {
              const row = {
                id: item.id || (table === 'hiking_routes' ? nextRouteId++ : `uuid_${Math.random()}`),
                ...item,
                created_at: item.created_at || new Date().toISOString(),
              };
              rows.push(row);
              return row;
            });

            return {
              select: () => ({
                single: async () => ({ data: { ...inserted[0] }, error: null }),
              }),
              then: (resolve: any) => Promise.resolve({ data: inserted, error: null }).then(resolve),
            };
          },
          update: (payload: any) => ({
            eq: (col: string, val: any) => {
              let updated = 0;
              for (const r of rows) {
                if (String(r[col]) === String(val)) {
                  Object.assign(r, payload);
                  updated++;
                }
              }
              return {
                eq: (col2: string, val2: any) => {
                  for (const r of rows) {
                    if (String(r[col]) === String(val) && String(r[col2]) === String(val2)) {
                      Object.assign(r, payload);
                    }
                  }
                  return { error: null };
                },
                error: null,
              };
            },
          }),
          upsert: (payload: any, opts?: any) => {
            if (table === 'hiking_route_sources') {
              const idx = rows.findIndex(
                (r: any) => r.provider === payload.provider && r.external_id === payload.external_id
              );
              if (idx >= 0) {
                Object.assign(rows[idx], payload);
              } else {
                rows.push({ id: `uuid_${Math.random()}`, ...payload });
              }
            } else if (table === 'trail_metadata') {
              const idx = rows.findIndex((r: any) => r.trail_id === payload.trail_id);
              if (idx >= 0) {
                Object.assign(rows[idx], payload);
              } else {
                rows.push({ id: `uuid_${Math.random()}`, ...payload });
              }
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      rpc: async () => ({ data: null, error: null }),
    };

    return mockClient;
  }

  it('matérialise une nouvelle route avec sources et révisions normalisées', async () => {
    const mockSupabase = createMockSupabase();

    const result = await getOrCreateCanonicalRoute(mockSupabase as any, mockDetail);
    expect(result.isNewlyCreated).toBe(true);
    expect(result.canonicalId).toBe(1000);
    expect(result.route.name).toBe('Tour des Aiguilles Rouges');

    // Vérifie que hiking_routes a été inséré
    expect(mockSupabase._db.hiking_routes).toHaveLength(1);
    expect(mockSupabase._db.hiking_routes[0].id).toBe(1000);

    // Vérifie que hiking_route_sources a été inséré avec provider et external_id
    expect(mockSupabase._db.hiking_route_sources).toHaveLength(1);
    expect(mockSupabase._db.hiking_route_sources[0].route_id).toBe(1000);
    expect(mockSupabase._db.hiking_route_sources[0].provider).toBe('openstreetmap');
    expect(mockSupabase._db.hiking_route_sources[0].external_id).toBe('999888');

    // Vérifie que hiking_route_revisions a été inséré avec révision 1 et is_current: true
    expect(mockSupabase._db.hiking_route_revisions).toHaveLength(1);
    expect(mockSupabase._db.hiking_route_revisions[0].route_id).toBe(1000);
    expect(mockSupabase._db.hiking_route_revisions[0].revision_number).toBe(1);
    expect(mockSupabase._db.hiking_route_revisions[0].is_current).toBe(true);
    expect(mockSupabase._db.hiking_route_revisions[0].quality).toBe('complete');
  });

  it('second appel : IDEMPOTENCE STRICTE (même ID retourné, aucune ligne dupliquée)', async () => {
    const mockSupabase = createMockSupabase();

    const res1 = await getOrCreateCanonicalRoute(mockSupabase as any, mockDetail);
    const res2 = await getOrCreateCanonicalRoute(mockSupabase as any, mockDetail);

    expect(res1.isNewlyCreated).toBe(true);
    expect(res2.isNewlyCreated).toBe(false);
    expect(res2.canonicalId).toBe(res1.canonicalId);

    // Strictement une seule ligne dans chaque table
    expect(mockSupabase._db.hiking_routes).toHaveLength(1);
    expect(mockSupabase._db.hiking_route_sources).toHaveLength(1);
    expect(mockSupabase._db.hiking_route_revisions).toHaveLength(1);
  });

  it('TEST CONCURRENT RÉEL : deux matérialisations concurrentes retournent le même RouteId', async () => {
    const mockSupabase = createMockSupabase();

    // Lancement simultané de 2 appels concurrents
    const [resA, resB] = await Promise.all([
      getOrCreateCanonicalRoute(mockSupabase as any, mockDetail),
      getOrCreateCanonicalRoute(mockSupabase as any, mockDetail),
    ]);

    // Les deux appels convergent vers le même RouteId canonique
    expect(resA.canonicalId).toBe(resB.canonicalId);
    expect(resA.canonicalId).toBe(1000);
  });

  it('mise à jour source (version & hash modifiés) : conserve le même RouteId et ajoute révision 2', async () => {
    const initialRoute = {
      id: 777,
      osm_relation_id: 999888,
      name: 'Tour des Aiguilles Rouges',
      ref: 'TAR',
      created_at: '2026-09-01T00:00:00Z',
    };
    const initialSource = {
      id: 'src_1',
      route_id: 777,
      provider: 'openstreetmap',
      external_type: 'relation',
      external_id: '999888',
      source_version: '12',
    };
    const initialRevision = {
      id: 'rev_1',
      route_id: 777,
      revision_number: 1,
      geometry_hash: 'geo_hash_v12',
      source_version: '12',
      quality: 'complete',
      is_current: true,
      created_at: '2026-09-01T00:00:00Z',
    };

    const mockSupabase = createMockSupabase({
      routes: [initialRoute],
      sources: [initialSource],
      revisions: [initialRevision],
    });

    const updatedDetail: ExternalRouteDetail = {
      ...mockDetail,
      source: {
        ...mockDetail.source,
        sourceVersion: '13', // Nouvelle version amont !
      },
      geometryHierarchy: {
        ...mockDetail.geometryHierarchy,
        geometryHash: 'geo_hash_v13_new', // Nouveau hash géométrique !
        totalDistanceKm: 33.1,
      },
    };

    const result = await getOrCreateCanonicalRoute(mockSupabase as any, updatedDetail);

    // MÊME ROUTE ID LKDV PRÉSERVÉ !
    expect(result.canonicalId).toBe(777);
    expect(result.isNewlyCreated).toBe(false);

    // Table hiking_routes : toujours 1 seule ligne avec ID 777
    expect(mockSupabase._db.hiking_routes).toHaveLength(1);
    expect(mockSupabase._db.hiking_routes[0].id).toBe(777);

    // Table hiking_route_revisions : 2 révisions conservées (historique auditable)
    expect(mockSupabase._db.hiking_route_revisions).toHaveLength(2);

    const rev1 = mockSupabase._db.hiking_route_revisions.find((r) => r.revision_number === 1);
    const rev2 = mockSupabase._db.hiking_route_revisions.find((r) => r.revision_number === 2);

    expect(rev1.is_current).toBe(false); // Ancienne révision dépréciée mais préservée
    expect(rev2.is_current).toBe(true);  // Nouvelle révision active
    expect(rev2.geometry_hash).toBe('geo_hash_v13_new');
    expect(rev2.source_version).toBe('13');
  });

  it('source supprimée sur OSM : préserve la géométrie historique et crée révision source_deleted', async () => {
    const initialRoute = {
      id: 555,
      osm_relation_id: 999888,
      name: 'Sentier disparu',
      geom: { type: 'MultiLineString', coordinates: [[[6.88, 45.95], [6.89, 45.96]]] },
      created_at: '2026-09-01T00:00:00Z',
    };
    const initialSource = {
      id: 'src_1',
      route_id: 555,
      provider: 'openstreetmap',
      external_type: 'relation',
      external_id: '999888',
      source_version: '1',
    };
    const initialRevision = {
      id: 'rev_1',
      route_id: 555,
      revision_number: 1,
      geometry_hash: 'geo_v1',
      quality: 'complete',
      is_current: true,
      geom: initialRoute.geom,
      created_at: '2026-09-01T00:00:00Z',
    };

    const mockSupabase = createMockSupabase({
      routes: [initialRoute],
      sources: [initialSource],
      revisions: [initialRevision],
    });

    const deletedDetail: ExternalRouteDetail = {
      ...mockDetail,
      geometryStatus: 'source_deleted',
    };

    const result = await getOrCreateCanonicalRoute(mockSupabase as any, deletedDetail);
    expect(result.canonicalId).toBe(555);
    expect(result.route.sourceStatus).toBe('source_deleted');

    // La géométrie historique dans hiking_routes n'a pas été écrasée
    expect(mockSupabase._db.hiking_routes[0].geom).toEqual(initialRoute.geom);

    // Une révision de traçabilité a été ajoutée
    const currentRev = mockSupabase._db.hiking_route_revisions.find((r) => r.is_current);
    expect(currentRev.quality).toBe('source_deleted');
  });

  it('getCanonicalRoute lit les relations normalisées sans cast imaginaire', async () => {
    const initialRoute = {
      id: 123,
      osm_relation_id: 2251447,
      name: 'Tour du Mont-Blanc',
      ref: 'TMB',
      network: 'nwn',
      distance_km: 170.0,
      geom: { type: 'MultiLineString', coordinates: [] },
      region: 'Alpes',
      created_at: '2026-09-01T00:00:00Z',
    };
    const initialSource = {
      id: 'src_tmb',
      route_id: 123,
      provider: 'openstreetmap',
      external_type: 'relation',
      external_id: '2251447',
      source_version: '42',
      fetched_at: '2026-09-01T00:00:00Z',
    };
    const initialRevision = {
      id: 'rev_tmb',
      route_id: 123,
      revision_number: 1,
      geometry_hash: 'geo_tmb_42',
      source_version: '42',
      quality: 'complete',
      is_current: true,
      created_at: '2026-09-01T00:00:00Z',
    };

    const mockSupabase = createMockSupabase({
      routes: [initialRoute],
      sources: [initialSource],
      revisions: [initialRevision],
    });

    const route = await getCanonicalRoute(mockSupabase as any, 123);
    expect(route).not.toBeNull();
    if (!route) return;

    expect(route.id).toBe(123);
    expect(route.name).toBe('Tour du Mont-Blanc');
    expect(route.source?.provider).toBe('openstreetmap');
    expect(route.source?.externalId).toBe('2251447');
    expect(route.source?.sourceVersion).toBe('42');
    expect(route.revisions).toHaveLength(1);
    expect(route.currentRevisionHash).toBe('geo_tmb_42');
    expect(route.geometryStatus).toBe('complete');
  });

  it('route sans géométrie (geom IS NULL) : geometryStatus explicite unavailable', async () => {
    const routeNoGeom = {
      id: 456,
      osm_relation_id: 999111,
      name: 'Sentier sans tracé',
      geom: null,
      created_at: '2026-09-01T00:00:00Z',
    };
    const mockSupabase = createMockSupabase({
      routes: [routeNoGeom],
      revisions: [
        {
          id: 'rev_nogeom',
          route_id: 456,
          revision_number: 1,
          geometry_hash: 'no_geom',
          quality: 'unavailable',
          is_current: true,
          created_at: '2026-09-01T00:00:00Z',
        },
      ],
    });

    const route = await getCanonicalRoute(mockSupabase as any, 456);
    expect(route).not.toBeNull();
    expect(route?.geometryStatus).toBe('unavailable');
    expect(route?.geom).toBeNull();
  });
});
