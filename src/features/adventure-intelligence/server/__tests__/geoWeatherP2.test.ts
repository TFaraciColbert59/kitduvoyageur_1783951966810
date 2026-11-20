import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { EffortSegmentInputSchema, EvidenceSchema } from '../../schemas/effort.schema';
import {
   ForbiddenProdProviderError,
  OPEN_DATA_PROVIDER_IDS,
  OdblBiometricSeparationError,
  PROVIDER_TERMS_REGISTRY,
  TERMS_SNAPSHOT_VERSION,
  assertNoForbiddenProdProvider,
  assertOdblBiometricSeparation,
  assertValidLkdvUserAgent,
  buildProviderEvidence,
  formatLicenceSnapshot,
  getProviderTerms,
} from '../providerTerms';
import {
  CALENDAR_DAYS,
  FORECAST_HORIZON_DAYS,
  METEO_FRANCE_LICENCE,
  METEO_FRANCE_SOURCE,
  addDays,
  clearWeatherCellCache,
  climateNormalsUrl,
  climatologyUrl,
  coordCellKey4,
  destinationZone,
  fetchMeteoFranceAromeObsBra,
  forecastUrl,
  getCompasWeather,
  getLkdvWeatherUserAgent,
  getWeatherCellCacheSize,
  knownZoneAt,
  localToday,
  metnoForecastUrl4,
  parseAromePayload,
  parseBraPayload,
  parseDpObsPayload,
  roundCoord4,
  trendUrl,
  trendWindow,
  verifyLkdvWeatherUserAgent,
  zoneAt,
} from '@/features/compas/server/weather';
import {
  DEFAULT_DEM_HYSTERESIS_M,
  IGN_MAX_POINTS_PER_REQUEST,
  IGN_MAX_REQ_PER_SECOND,
  acquireIgnRateLimitSlot,
  areAllPointsInIgnCoverage,
  chunkElevationPoints,
  clearElevationGeometryCache,
  computeGeometrySha256,
  detectIgnCoverageZone,
  fetchElevationLineWithFallback,
  getElevationGeometryCacheSize,
  getRouteElevation,
  isPointInIgnCoverage,
  pointsAltitudeRange,
  pointsMaxAltitudeM,
  resetIgnRateLimiter,
  routeAscentM,
  smoothElevationWithDemHysteresis,
} from '@/features/compas/server/elevation';
import {
  DEFAULT_FALLBACK_ETA,
  DEFAULT_FALLBACK_SURFACE,
  buildTrailSegmentsFromLocalOsmFeatures,
  computeApi72h,
  computeDemHorizonElevationDeg,
  computeLatentGroundState,
  computeTopographicTwilight,
  mapOsmTagsToTerrainEta,
  populateTrailSegmentsFromLocalOsmIdempotent,
  segmentTimedPositionsWithDemFallback,
} from '../terrainMapper';

describe('LOT P2 — 1. Registre providerTerms.ts & Coupe-circuit de production', () => {
  it('enregistre les 6 fournisseurs ouverts 0 € avec leurs licences, quotas et attributions', () => {
    expect(OPEN_DATA_PROVIDER_IDS).toEqual([
      'met_norway',
      'meteo_france_open_data',
      'ign_geoplateforme_altimetrie',
      'aws_terrain_tiles',
      'nasa_power',
      'openstreetmap_odbl',
    ]);

    const metno = getProviderTerms('met_norway');
    expect(metno.licenceName).toBe('CC BY 4.0');
    expect(metno.costEur).toBe(0);
    expect(metno.quota.maxRequestsPerSecond).toBe(20);
    expect(metno.quota.coordinatePrecisionDecimals).toBe(4);
    expect(metno.quota.requiresIdentifiedUserAgent).toBe(true);

    const mf = getProviderTerms('meteo_france_open_data');
    expect(mf.licenceName).toBe('Licence Ouverte Etalab 2.0');
    expect(mf.updatedAtRequired).toBe(true);
    expect(mf.termsSnapshotVersion).toBe(TERMS_SNAPSHOT_VERSION);

    const ign = getProviderTerms('ign_geoplateforme_altimetrie');
    expect(ign.licenceName).toBe('Licence Ouverte Etalab 2.0');
    expect(ign.quota.maxPointsPerRequest).toBe(5000);
    expect(ign.quota.maxRequestsPerSecond).toBe(5);

    const aws = getProviderTerms('aws_terrain_tiles');
    expect(aws.licenceName).toBe('ODbL / Public datasets');

    const nasa = getProviderTerms('nasa_power');
    expect(nasa.licenceName).toContain('Public Domain');

    const osm = getProviderTerms('openstreetmap_odbl');
    expect(osm.licenceName).toBe('ODbL 1.0');
    expect(osm.odblDatabaseSeparationRequired).toBe(true);
    expect(Object.keys(PROVIDER_TERMS_REGISTRY)).toHaveLength(6);
  });

  it('assertNoForbiddenProdProvider rejette explicitement Open-Meteo public et Overpass public', () => {
    expect(() =>
      assertNoForbiddenProdProvider('https://api.open-meteo.com/v1/forecast?latitude=45.9&longitude=6.8')
    ).toThrow(ForbiddenProdProviderError);
    expect(() => assertNoForbiddenProdProvider('open-meteo')).toThrow(/FORBIDDEN_OPEN_METEO_PUBLIC/);
    expect(() =>
      assertNoForbiddenProdProvider('https://overpass-api.de/api/interpreter')
    ).toThrow(ForbiddenProdProviderError);
    expect(() =>
      assertNoForbiddenProdProvider('https://lz4.overpass-api.de/api/interpreter')
    ).toThrow(/FORBIDDEN_OVERPASS_PUBLIC/);

    // Les fournisseurs autorisés 0 € passent sans erreur
    expect(() =>
      assertNoForbiddenProdProvider('https://api.met.no/weatherapi/locationforecast/2.0/complete')
    ).not.toThrow();
    expect(() =>
      assertNoForbiddenProdProvider('https://public-api.meteofrance.fr/public/arome/1.0/point')
    ).not.toThrow();
    expect(() =>
      assertNoForbiddenProdProvider(
        'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json'
      )
    ).not.toThrow();
  });

  it('buildProviderEvidence produit un Evidence<T> valide selon EvidenceSchema avec licenceSnapshot', () => {
    const ev = buildProviderEvidence({
      providerId: 'meteo_france_open_data',
      value: 4.2,
      unit: 'm/s',
      kind: 'measured',
      quality: 0.94,
      capturedAt: '2026-11-20T08:00:00.000Z',
      updatedAt: '2026-11-20T06:00:00.000Z',
      modelVersion: 'arome-0.01',
    });

    expect(() => EvidenceSchema.parse(ev)).not.toThrow();
    expect(ev.licenceSnapshot).toContain('Licence Ouverte Etalab 2.0');
    expect(ev.licenceSnapshot).toContain('2026-11-20T06:00:00.000Z');
    expect(formatLicenceSnapshot('met_norway', '2026-11-20T00:00:00.000Z')).toContain('CC BY 4.0');
  });

  it('assertOdblBiometricSeparation rejette tout champ utilisateur ou biométrique dans un payload ODbL', () => {
    expect(() =>
      assertOdblBiometricSeparation({
        osm_id: 12345,
        highway: 'path',
        surface: 'dirt',
        tags: { sac_scale: 'mountain_hiking' },
      })
    ).not.toThrow();

    expect(() =>
      assertOdblBiometricSeparation({
        osm_id: 12345,
        user_id: '00000000-0000-4000-8000-000000000001',
      })
    ).toThrow(OdblBiometricSeparationError);

    expect(() =>
      assertOdblBiometricSeparation({
        osm_id: 12345,
        tags: { weightKg: 72, hrMax: 188 },
      })
    ).toThrow(OdblBiometricSeparationError);
  });
});

describe('LOT P2 — 2. weather.ts : Cellule 4 décimales MET Norway & Adaptateur Météo-France (AROME / DPObs / BRA)', () => {
  beforeEach(() => {
    clearWeatherCellCache();
  });

  it('préserve 100 % des exports historiques de src/features/compas/server/weather.ts', () => {
    expect(typeof FORECAST_HORIZON_DAYS).toBe('number');
    expect(typeof CALENDAR_DAYS).toBe('number');
    expect(typeof addDays).toBe('function');
    expect(typeof localToday).toBe('function');
    expect(typeof forecastUrl).toBe('function');
    expect(typeof trendUrl).toBe('function');
    expect(typeof climatologyUrl).toBe('function');
    expect(typeof climateNormalsUrl).toBe('function');
    expect(typeof knownZoneAt).toBe('function');
    expect(typeof zoneAt).toBe('function');
    expect(typeof destinationZone).toBe('function');
    expect(typeof trendWindow).toBe('function');
    expect(typeof getCompasWeather).toBe('function');
  });

  it('arrondit les coordonnées à 4 décimales et vérifie le User-Agent LKDV', () => {
    expect(roundCoord4(45.9237412)).toBe(45.9237);
    expect(roundCoord4(6.869389)).toBe(6.8694);
    expect(coordCellKey4(45.9237412, 6.869389)).toBe('45.9237,6.8694');
    expect(metnoForecastUrl4(45.9237412, 6.869389)).toBe(
      'https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=45.9237&lon=6.8694'
    );

    const ua = getLkdvWeatherUserAgent();
    expect(ua).toMatch(/^kitduvoyageur\/1\.0 \(.*\+https:\/\//);
    expect(verifyLkdvWeatherUserAgent(ua)).toBe(ua);
    expect(() => assertValidLkdvUserAgent('Mozilla/5.0')).toThrow();
    expect(() => assertValidLkdvUserAgent('')).toThrow();
  });

  it('parse un payload GRIB2 simulé AROME (Kelvin -> °C, composantes u10/v10 -> windMs en m/s et direction), DPObs et BRA', () => {
    // 1. Fixture GRIB2 simulée AROME : t2m = 269.15 K (-4.0 °C), u10 = 3 m/s, v10 = 4 m/s => windMs = 5 m/s
    const gribAromeFixture = {
      referenceTime: '2026-11-20T06:00:00.000Z',
      grib: {
        t2m: 269.15,
        u10: 3.0,
        v10: 4.0,
        tp: 1.8,
        rh2m: 82,
        isoZeroM: 1650,
        sd_m: 0.25,
      },
    };
    const parsedArome = parseAromePayload(gribAromeFixture);
    expect(parsedArome).not.toBeNull();
    expect(parsedArome?.tempC).toBeCloseTo(-4.0, 2);
    expect(parsedArome?.windMs).toBeCloseTo(5.0, 2);
    expect(parsedArome?.windDirectionDeg).toBe(217);
    expect(parsedArome?.precipMmPerH).toBe(1.8);
    expect(parsedArome?.snowDepthCm).toBe(25);

    // 2. Fixture DPObs station Météo-France
    const dpObsFixture = {
      id_station: '74056001',
      validity_time: '2026-11-20T07:00:00.000Z',
      t: 268.65, // -4.5 °C
      ff: 6.2, // m/s
      dd: 220,
      rr1: 2.1,
      u: 88,
      rr_72h: [2.1, 1.5, 0.8, 0.0],
    };
    const parsedObs = parseDpObsPayload(dpObsFixture);
    expect(parsedObs).not.toBeNull();
    expect(parsedObs?.stationId).toBe('74056001');
    expect(parsedObs?.tempC).toBeCloseTo(-4.5, 2);
    expect(parsedObs?.windMs).toBe(6.2);
    expect(parsedObs?.precipHistory72hMm).toEqual([2.1, 1.5, 0.8, 0.0]);

    // 3. Fixture BRA (Bulletin Risque Avalanche)
    const braFixture = {
      id_massif: 'MONT-BLANC',
      nom_massif: 'Mont-Blanc',
      date_validite: '2026-11-20T06:00:00.000Z',
      RISQUE_MAX: 4,
      resume_declenchements: 'Plaques à vent nombreuses en versants nord au-dessus de 2200 m.',
    };
    const parsedBra = parseBraPayload(braFixture);
    expect(parsedBra).not.toBeNull();
    expect(parsedBra?.riskIndex).toBe(4);
    expect(parsedBra?.forRiskObjectOnly).toBe(true);
    expect(parseBraPayload({ id_massif: 'MONT-BLANC', RISQUE_MAX: 6 })).toBeNull();
  });

  it('fetchMeteoFranceAromeObsBra combine AROME/DPObs/BRA avec attribution Etalab 2.0 et met en cache par cellule 4 décimales', async () => {
    const calls: string[] = [];
    const mockFetch = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('arome')) {
        return new Response(
          JSON.stringify({
            updatedAt: '2026-11-20T06:00:00.000Z',
            grib: { t2m: 275.15, u10: 4, v10: 3, tp: 0.5, rh2m: 75 },
          }),
          { status: 200 }
        );
      }
      if (url.includes('dpobs')) {
        return new Response(
          JSON.stringify({
            id_station: '74056001',
            validity_time: '2026-11-20T07:30:00.000Z',
            tempC: 1.8,
            windMs: 5.4,
            dd: 240,
            rr1: 0.6,
          }),
          { status: 200 }
        );
      }
      if (url.includes('bra')) {
        return new Response(
          JSON.stringify({
            massifId: 'MONT-BLANC',
            validFrom: '2026-11-20T06:00:00.000Z',
            riskIndex: 3,
          }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    });

    const first = await fetchMeteoFranceAromeObsBra(
      {
        lat: 45.923711,
        lon: 6.869322,
        nowIso: '2026-11-20T08:00:00.000Z',
        aromeUrl: 'https://public-api.meteofrance.fr/public/arome/1.0/point',
        dpObsUrl: 'https://public-api.meteofrance.fr/public/dpobs/1.0/station',
        braUrl: 'https://public-api.meteofrance.fr/public/bra/1.0/massif',
      },
      { fetchFn: mockFetch, nowMs: () => 1_700_000_000_000 }
    );

    expect(first).not.toBeNull();
    expect(first?.provider).toBe('meteo-france');
    expect(first?.fallbackUsed).toBe(false);
    expect(first?.fromCache).toBe(false);
    expect(first?.cellKey).toBe('45.9237,6.8693');
    expect(first?.tempC).toBe(1.8);
    expect(first?.windMs).toBe(5.4);
    expect(first?.bra?.riskIndex).toBe(3);
    expect(first?.bra?.forRiskObjectOnly).toBe(true);
    expect(first?.attribution).toBe(METEO_FRANCE_SOURCE);
    expect(first?.licenceSnapshot).toContain(METEO_FRANCE_LICENCE);
    expect(() => EvidenceSchema.parse(first?.evidence.tempC)).not.toThrow();
    expect(() => EvidenceSchema.parse(first?.evidence.windMs)).not.toThrow();
    expect(() => EvidenceSchema.parse(first?.evidence.braRiskIndex)).not.toThrow();
    expect(getWeatherCellCacheSize()).toBe(1);
    expect(calls).toHaveLength(3);

    // Deuxième appel dans la même cellule à 4 décimales (variation à la 5e décimale) -> servi depuis le cache !
    const second = await fetchMeteoFranceAromeObsBra(
      {
        lat: 45.923744,
        lon: 6.869348,
        nowIso: '2026-11-20T08:05:00.000Z',
      },
      { fetchFn: mockFetch, nowMs: () => 1_700_000_300_000 }
    );
    expect(second?.fromCache).toBe(true);
    expect(second?.cellKey).toBe('45.9237,6.8693');
    expect(calls).toHaveLength(3); // Aucun appel réseau supplémentaire
  });

  it('bascule automatiquement sur MET Norway (CC BY 4.0) quand Météo-France AROME est indisponible', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('meteofrance.fr')) {
        return new Response('Service Unavailable', { status: 503 });
      }
      if (url.includes('api.met.no')) {
        return new Response(
          JSON.stringify({
            properties: {
              meta: { updated_at: '2026-11-20T07:00:00Z' },
              timeseries: [
                {
                  time: '2026-11-20T08:00:00Z',
                  data: {
                    instant: {
                      details: {
                        air_temperature: 3.4,
                        wind_speed: 7.8, // m/s natif MET Norway
                        wind_from_direction: 280,
                        relative_humidity: 70,
                      },
                    },
                    next_1_hours: {
                      details: { precipitation_amount: 1.2 },
                    },
                  },
                },
              ],
            },
          }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    });

    const res = await fetchMeteoFranceAromeObsBra(
      {
        lat: 45.1885,
        lon: 5.7245,
        nowIso: '2026-11-20T08:00:00.000Z',
      },
      { fetchFn: mockFetch }
    );

    expect(res).not.toBeNull();
    expect(res?.provider).toBe('met-norway');
    expect(res?.fallbackUsed).toBe(true);
    expect(res?.tempC).toBe(3.4);
    expect(res?.windMs).toBe(7.8); // Conservé en m/s
    expect(res?.precipMmPerH).toBe(1.2);
    expect(res?.licenceSnapshot).toContain('CC BY 4.0');
  });

  it('rejette immédiatement toute tentative d’utiliser Open-Meteo public dans fetchMeteoFranceAromeObsBra', async () => {
    await expect(
      fetchMeteoFranceAromeObsBra({
        lat: 45.92,
        lon: 6.87,
        aromeUrl: 'https://api.open-meteo.com/v1/forecast',
      })
    ).rejects.toThrow(ForbiddenProdProviderError);
  });
});

describe('LOT P2 — 3. elevation.ts : Emprises France+DROM, IGN Géoplateforme (<= 5 000 pts, <= 5 req/s), Repli AWS & Hystérésis 3 m', () => {
  beforeEach(() => {
    clearElevationGeometryCache();
    resetIgnRateLimiter(1_000_000);
  });

  it('préserve 100 % des exports historiques de src/features/compas/server/elevation.ts', () => {
    expect(typeof getRouteElevation).toBe('function');
    expect(typeof routeAscentM).toBe('function');
    expect(typeof pointsMaxAltitudeM).toBe('function');
    expect(typeof pointsAltitudeRange).toBe('function');
  });

  it('détecte exactement la France métropolitaine et les 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte)', () => {
    expect(detectIgnCoverageZone(45.9237, 6.8694)).toBe('metropole'); // Chamonix
    expect(detectIgnCoverageZone(42.15, 9.15)).toBe('metropole'); // Corse
    expect(detectIgnCoverageZone(16.05, -61.66)).toBe('guadeloupe'); // Soufrière
    expect(detectIgnCoverageZone(14.81, -61.17)).toBe('martinique'); // Montagne Pelée
    expect(detectIgnCoverageZone(4.93, -52.33)).toBe('guyane'); // Cayenne
    expect(detectIgnCoverageZone(-21.09, 55.48)).toBe('reunion'); // Piton des Neiges
    expect(detectIgnCoverageZone(-12.78, 45.22)).toBe('mayotte'); // Mamoudzou

    // Hors emprise IGN
    expect(detectIgnCoverageZone(27.9881, 86.925)).toBeNull(); // Everest (Népal)
    expect(detectIgnCoverageZone(37.7459, -119.5332)).toBeNull(); // Yosemite (USA)
    expect(isPointInIgnCoverage(27.9881, 86.925)).toBe(false);
    expect(
      areAllPointsInIgnCoverage([
        { lat: -21.09, lon: 55.48 },
        { lat: -21.12, lon: 55.52 },
      ])
    ).toBe(true);
  });

  it('découpe les requêtes IGN en lots <= 5 000 pts/req et met en cache par hash SHA-256 de la géométrie', async () => {
    // 11 200 points en France métropolitaine => 3 lots (5000 + 5000 + 1200)
    const points = Array.from({ length: 11_200 }, (_, i) => ({
      lat: 45.0 + (i % 100) * 0.0001,
      lon: 6.0 + Math.floor(i / 100) * 0.0001,
    }));

    const chunks = chunkElevationPoints(points);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(IGN_MAX_POINTS_PER_REQUEST);
    expect(chunks[1]).toHaveLength(IGN_MAX_POINTS_PER_REQUEST);
    expect(chunks[2]).toHaveLength(1200);

    let batchCalls = 0;
    const mockFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      batchCalls += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as { lat: string };
      const count = body.lat.split('|').length;
      expect(count).toBeLessThanOrEqual(IGN_MAX_POINTS_PER_REQUEST);
      return new Response(
        JSON.stringify({
          elevations: Array.from({ length: count }, (_, idx) => ({
            z: 1200 + idx * 0.5,
          })),
        }),
        { status: 200 }
      );
    });

    let fakeNowMs = 1_000_000;
    const res1 = await fetchElevationLineWithFallback(points, {
      fetchFn: mockFetch,
      clock: {
        now: () => fakeNowMs,
        sleep: async (ms) => {
          fakeNowMs += ms;
        },
      },
    });

    expect(res1).not.toBeNull();
    expect(res1?.provider).toBe('ign-geoplateforme');
    expect(res1?.batchCount).toBe(3);
    expect(res1?.fromCache).toBe(false);
    expect(res1?.fallbackUsed).toBe(false);
    expect(res1?.elevations).toHaveLength(11_200);
    expect(res1?.geometryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(batchCalls).toBe(3);
    expect(getElevationGeometryCacheSize()).toBe(1);

    // Deuxième appel avec la même géométrie => servi par le cache SHA-256 (0 appel HTTP)
    const res2 = await fetchElevationLineWithFallback(points, { fetchFn: mockFetch });
    expect(res2?.fromCache).toBe(true);
    expect(res2?.geometryHash).toBe(await computeGeometrySha256(points));
    expect(batchCalls).toBe(3);
  });

  it('applique le rate limiter token-bucket IGN <= 5 req/s/IP', async () => {
    let fakeNowMs = 2_000_000;
    resetIgnRateLimiter(fakeNowMs);
    const sleeps: number[] = [];

    const now = () => fakeNowMs;
    const sleep = async (ms: number) => {
      sleeps.push(ms);
      fakeNowMs += ms;
    };

    // Les 5 premiers jetons de la seconde passent sans attente (0 ms)
    for (let i = 0; i < IGN_MAX_REQ_PER_SECOND; i += 1) {
      const slot = await acquireIgnRateLimitSlot(now, sleep);
      expect(slot.waitedMs).toBe(0);
    }
    expect(sleeps).toHaveLength(0);

    // La 6e requête au même instant doit attendre 200 ms (1/5 s)
    const sixthSlot = await acquireIgnRateLimitSlot(now, sleep);
    expect(sixthSlot.waitedMs).toBe(200);
    expect(sleeps).toEqual([200]);
  });

  it('bascule sur AWS Terrain Tiles hors France/DROM ou si IGN Géoplateforme est en échec', async () => {
    const awsFallback = vi.fn(async (pts: ReadonlyArray<readonly [number, number]>) =>
      pts.map((_, idx) => 2400 + idx * 25)
    );

    // Cas 1 : Point au Népal (hors emprise IGN) -> appel direct AWS Terrain Tiles
    const ignFetchNeverCalled = vi.fn(async () => new Response(null, { status: 500 }));
    const nepalRes = await fetchElevationLineWithFallback(
      [
        { lat: 27.98, lon: 86.92 },
        { lat: 27.99, lon: 86.93 },
      ],
      { fetchFn: ignFetchNeverCalled, fallbackFn: awsFallback }
    );
    expect(ignFetchNeverCalled).not.toHaveBeenCalled();
    expect(nepalRes?.provider).toBe('aws-terrain-tiles');
    expect(nepalRes?.fallbackUsed).toBe(true);
    expect(nepalRes?.elevations).toEqual([2400, 2425]);

    // Cas 2 : Point à La Réunion (emprise IGN) mais IGN répond HTTP 503 -> repli transparent AWS
    const ign503 = vi.fn(async () => new Response('Gateway Timeout', { status: 503 }));
    const reunionRes = await fetchElevationLineWithFallback(
      [
        { lat: -21.09, lon: 55.48 },
        { lat: -21.1, lon: 55.49 },
      ],
      { fetchFn: ign503, fallbackFn: awsFallback }
    );
    expect(ign503).toHaveBeenCalledTimes(1);
    expect(reunionRes?.provider).toBe('aws-terrain-tiles');
    expect(reunionRes?.fallbackUsed).toBe(true);
    expect(reunionRes?.zone).toBe('reunion');
    expect(reunionRes?.elevations).toEqual([2400, 2425]);
  });

  it('smoothElevationWithDemHysteresis : recale sur MNT avec hystérésis 3 m (ignore < 3 m) et calcule D+, D- et gradePct', () => {
    expect(DEFAULT_DEM_HYSTERESIS_M).toBe(3);

    // Plateau avec micro-oscillations < 3 m (±2.4 m) : D+ = 0, D- = 0
    const noisyFlat = [1000, 1001.8, 998.1, 1002.4, 997.9, 1000.5].map((demEleM, i) => ({
      lat: 45.9 + i * 0.001,
      lon: 6.8,
      rawEleM: demEleM + 45, // Biais GPS/baromètre de +45 m corrigé par le recalage MNT
      demEleM,
    }));
    const flatResult = smoothElevationWithDemHysteresis(noisyFlat);
    expect(flatResult.totalGainM).toBe(0);
    expect(flatResult.totalLossM).toBe(0);
    expect(flatResult.smoothedElevationsM).toEqual([1000, 1000, 1000, 1000, 1000, 1000]);
    expect(flatResult.segments.every((s) => s.gradePct === 0)).toBe(true);

    // Montée réelle de 1000 m à 1015 m avec micro-bruit intermédiaire < 3 m, puis descente à 1008 m (-7 m)
    const climbAndDescent = [
      { lat: 45.9, lon: 6.8, demEleM: 1000 },
      { lat: 45.9005, lon: 6.8, demEleM: 1002.2 }, // +2.2 m (< 3 m) -> ignoré
      { lat: 45.901, lon: 6.8, demEleM: 1006.0 }, // +6.0 m (>= 3 m) -> ancre à 1006 (+6 m)
      { lat: 45.9015, lon: 6.8, demEleM: 1004.5 }, // -1.5 m (< 3 m) -> ignoré
      { lat: 45.902, lon: 6.8, demEleM: 1015.0 }, // +9.0 m depuis 1006 (>= 3 m) -> ancre à 1015 (+9 m)
      { lat: 45.903, lon: 6.8, demEleM: 1008.0 }, // -7.0 m depuis 1015 (>= 3 m) -> ancre à 1008 (-7 m)
    ];
    const climbResult = smoothElevationWithDemHysteresis(climbAndDescent);
    expect(climbResult.totalGainM).toBe(15);
    expect(climbResult.totalLossM).toBe(7);
    expect(climbResult.smoothedElevationsM).toEqual([1000, 1000, 1006, 1006, 1015, 1008]);
    expect(climbResult.segments[1].gainM).toBe(6);
    expect(climbResult.segments[1].gradePct).toBeGreaterThan(0);
    expect(climbResult.segments[4].lossM).toBe(7);
    expect(climbResult.segments[4].gradePct).toBeLessThan(0);
  });
});

describe('LOT P2 — 4. terrainMapper.ts : OSM -> η, API_72h, Crépuscule MNT, ODbL idempotent & Fallback positions_timed', () => {
  it('mapOsmTagsToTerrainEta : mapping déterministe OSM tags -> η + technicité 1..5 + Evidence<number>', () => {
    const asphalt = mapOsmTagsToTerrainEta({
      surface: 'asphalt',
      smoothness: 'excellent',
      sac_scale: 'hiking',
    });
    expect(asphalt.eta).toBe(1.0);
    expect(asphalt.technicite).toBe(1);
    expect(asphalt.isPaved).toBe(true);
    expect(() => EvidenceSchema.parse(asphalt.evidence)).not.toThrow();

    const dirt = mapOsmTagsToTerrainEta({ surface: 'dirt', sac_scale: 'hiking' });
    expect(dirt.eta).toBe(1.1);
    expect(dirt.technicite).toBe(1);

    const alpineScree = mapOsmTagsToTerrainEta({
      surface: 'scree',
      sac_scale: 'alpine_hiking',
      smoothness: 'horrible',
    });
    expect(alpineScree.eta).toBeGreaterThan(1.8);
    expect(alpineScree.technicite).toBe(4);

    // Neige Pandolf 1976 : eta = min(5.0, 1.30 + 0.082 * snowSinkCm)
    const snow20cm = mapOsmTagsToTerrainEta({ surface: 'snow', snowSinkCm: 20 });
    expect(snow20cm.eta).toBeCloseTo(1.3 + 0.082 * 20, 4);

    // Fallback sans aucun tag => dirt / eta = 1.10
    const fallback = mapOsmTagsToTerrainEta({});
    expect(fallback.normalizedSurface).toBe(DEFAULT_FALLBACK_SURFACE);
    expect(fallback.eta).toBe(DEFAULT_FALLBACK_ETA);
    expect(fallback.isFallback).toBe(true);
  });

  it('computeApi72h & computeLatentGroundState : modulation boue si soilTempC > 0 sur sol meuble, flag verglas = true si soilTempC <= 0 et humide', () => {
    const precip72h = Array.from({ length: 72 }, (_, i) => (i < 12 ? 3.5 : 0.2));
    const api = computeApi72h(precip72h, 0.95);
    expect(api).toBeGreaterThan(25);

    // 1. Sol non revêtu (dirt) + humide + soilTempC > 0 => modulation boue active, verglas = false
    const muddyGround = computeLatentGroundState({
      surface: 'dirt',
      baseEta: 1.1,
      hourlyPrecipMm: precip72h,
      soilMoistureVwc: 0.38,
      soilTempC: 7.5,
    });
    expect(muddyGround.mudModulationActive).toBe(true);
    expect(muddyGround.verglas).toBe(false);
    expect(muddyGround.effectiveEta).toBeGreaterThan(1.1);

    // 2. Sol revêtu (asphalt) + humide + soilTempC > 0 => aucune modulation boue
    const wetAsphalt = computeLatentGroundState({
      surface: 'asphalt',
      baseEta: 1.0,
      hourlyPrecipMm: precip72h,
      soilMoistureVwc: 0.4,
      soilTempC: 8.0,
    });
    expect(wetAsphalt.mudModulationActive).toBe(false);
    expect(wetAsphalt.effectiveEta).toBe(1.0);

    // 3. Sol humide + soilTempC <= 0 => flag verglas = true
    const icyGround = computeLatentGroundState({
      surface: 'rock',
      baseEta: 1.25,
      hourlyPrecipMm: precip72h,
      soilMoistureVwc: 0.32,
      soilTempC: -2.5,
    });
    expect(icyGround.verglas).toBe(true);
    expect(icyGround.mudModulationActive).toBe(false);
  });

  it('computeTopographicTwilight : le soleil passe sous le masque d’horizon MNT avant le coucher plat et le crépuscule civil plat', () => {
    // Crête MNT à 2 400 m située à 2 000 m à l'ouest d'un fond de vallée à 1 200 m (~31° d'élévation)
    const ridgeAngleDeg = computeDemHorizonElevationDeg(1200, [
      { distanceM: 2000, altitudeM: 2400, azimuthDeg: 260 },
    ]);
    expect(ridgeAngleDeg).toBeGreaterThan(25);

    const flat = computeTopographicTwilight({
      lat: 45.9237,
      lon: 6.8694,
      date: '2026-10-15T12:00:00.000Z',
      horizonMaskDeg: 0,
    });

    const valley = computeTopographicTwilight({
      lat: 45.9237,
      lon: 6.8694,
      date: '2026-10-15T12:00:00.000Z',
      horizonMaskDeg: [
        { azimuthDeg: 240, elevationDeg: 18 },
        { azimuthDeg: 270, elevationDeg: 18 },
      ],
    });

    // En vallée encaissée (18°), le coucher topographique et le crépuscule effectif
    // surviennent strictement AVANT le coucher plat et le crépuscule civil plat
    expect(Date.parse(valley.topographicSunsetTime)).toBeLessThan(Date.parse(flat.flatSunsetTime));
    expect(Date.parse(valley.topographicSunsetTime)).toBeLessThan(
      Date.parse(flat.flatCivilDuskTime)
    );
    expect(Date.parse(valley.effectiveTwilightTime)).toBeLessThan(
      Date.parse(flat.flatCivilDuskTime)
    );
    expect(valley.twilightAdvanceS).toBeGreaterThan(600);
  });

  it('buildTrailSegmentsFromLocalOsmFeatures : peuplement idempotent sans Overpass public et séparation ODbL stricte', async () => {
    const localFeatures = [
      {
        osm_id: 900102,
        name: 'Sentier du Balcon Nord',
        highway: 'path',
        surface: 'rock',
        sac_scale: 'mountain_hiking',
        coordinates: [
          [6.8694, 45.9237, 1500],
          [6.872, 45.925, 1545],
          [6.875, 45.927, 1590],
        ],
      },
      {
        osm_id: 900101,
        name: 'Piste Forestière des Houches',
        highway: 'track',
        surface: 'dirt',
        tracktype: 'grade2',
        coordinates: [
          [6.79, 45.89, 1010],
          [6.8, 45.895, 1030],
        ],
      },
      // Les trottoirs urbains (footway=sidewalk) sont écartés
      {
        osm_id: 900999,
        highway: 'footway',
        tags: { footway: 'sidewalk' },
        coordinates: [
          [6.86, 45.92, 1035],
          [6.861, 45.921, 1035],
        ],
      },
    ];

    const once = buildTrailSegmentsFromLocalOsmFeatures(localFeatures, {
      sourceUrlOrPath: '/data/osm/france-haute-savoie.geojson',
    });
    // Idempotence : passer deux fois les mêmes extraits produit exactement les mêmes lignes triées par osm_id
    const twice = buildTrailSegmentsFromLocalOsmFeatures([...localFeatures, ...localFeatures], {
      sourceUrlOrPath: '/data/osm/france-haute-savoie.geojson',
    });

    expect(once).toHaveLength(2);
    expect(twice).toEqual(once);
    expect(once.map((r) => r.osm_id)).toEqual([900101, 900102]);
    expect(once[0].feature.licence_snapshot).toBe('ODbL 1.0');
    expect(once[1].feature.technical_class).toBe(3);

    // Test du store idempotent par osm_id
    const persistedByOsmId = new Map<number, unknown>();
    const store = {
      upsertTrailSegments: async (rows: ReadonlyArray<{ osm_id: number }>) => {
        for (const r of rows) persistedByOsmId.set(r.osm_id, r);
        return { upsertedCount: rows.length };
      },
    };
    await populateTrailSegmentsFromLocalOsmIdempotent(localFeatures, store);
    await populateTrailSegmentsFromLocalOsmIdempotent(localFeatures, store);
    expect(persistedByOsmId.size).toBe(2);

    // Rejet d'Overpass public
    expect(() =>
      buildTrailSegmentsFromLocalOsmFeatures(localFeatures, {
        sourceUrlOrPath: 'https://overpass-api.de/api/interpreter',
      })
    ).toThrow(ForbiddenProdProviderError);

    // Rejet strict de toute contamination biométrique/utilisateur dans un extrait ODbL
    expect(() =>
      buildTrailSegmentsFromLocalOsmFeatures([
        {
          ...localFeatures[0],
          tags: { highway: 'path', user_id: 'leak-123', weight_kg: 70 },
        },
      ])
    ).toThrow(OdblBiometricSeparationError);
  });

  it('segmentTimedPositionsWithDemFallback : segmente directement positions_timed + MNT + fallback dirt (eta = 1.10) quand trail_segments = 0', async () => {
    // Trace horodatée de 5 points (~450 m de marche en montée régulière)
    const positionsTimed = [
      { lat: 45.92, lng: 6.87, timestamp: '2026-11-20T08:00:00.000Z', elevationM: 1200 },
      { lat: 45.921, lng: 6.87, timestamp: '2026-11-20T08:02:00.000Z', elevationM: 1202 },
      { lat: 45.922, lng: 6.87, timestamp: '2026-11-20T08:04:00.000Z', elevationM: 1215 },
      { lat: 45.923, lng: 6.87, timestamp: '2026-11-20T08:06:00.000Z', elevationM: 1216.5 },
      { lat: 45.924, lng: 6.87, timestamp: '2026-11-20T08:08:00.000Z', elevationM: 1230 },
    ];

    // MNT simulé avec micro-oscillation < 3 m au point 1 (+1.8 m) et point 3 (+1.4 m)
    const demLookup = vi.fn(async () => [1200, 1201.8, 1214, 1215.4, 1228]);

    const segments = await segmentTimedPositionsWithDemFallback(positionsTimed, demLookup, {
      minSegmentDistanceM: 100,
    });

    expect(demLookup).toHaveBeenCalledTimes(1);
    expect(segments.length).toBeGreaterThanOrEqual(2);

    let totalGain = 0;
    for (const seg of segments) {
      expect(() => EffortSegmentInputSchema.parse(seg)).not.toThrow();
      expect(seg.surface).toBe('dirt');
      expect(seg.terrainFactorEta).toBe(1.1);
      expect(seg.gradeDec).toBeCloseTo(seg.gradePct / 100, 6);
      totalGain += seg.gainM;
    }

    // L'hystérésis 3 m sur [1200, 1201.8, 1214, 1215.4, 1228] donne exactement 1228 - 1200 = 28 m de D+
    expect(totalGain).toBe(28);
  });
});
