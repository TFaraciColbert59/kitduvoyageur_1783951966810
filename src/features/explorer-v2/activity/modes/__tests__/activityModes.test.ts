import { describe, expect, it } from 'vitest';
import {
  analyzeSkiTrace,
  buildManualActivitySummary,
  buildManualSyncPayloads,
  createActivityModeSession,
  createManualRehabActivity,
  formatSkiRunForDisplay,
  getActivityModeAvailability,
  getActivityModeDefinition,
  getVisibleRehabDefinitions,
  IndoorSessionEngine,
  mapActivityToRehabVariant,
  OpenWaterSwimSessionEngine,
  PoolSwimSessionEngine,
  RehabSessionEngine,
  SkiSessionEngine,
  SQL_REGISTERED_VARIANTS,
  toServerPersistenceMapping,
  validateIndoorConsoleImport,
  validateManualActivityInput,
  validatePoolConfig,
} from '../../../../activity';
import type { GpsFix } from '../../tracker';

const NOW_MS = Date.UTC(2026, 10, 13, 12, 0, 0);

function buildSkiFixSequence(): GpsFix[] {
  const fixes: GpsFix[] = [];
  let t = Date.UTC(2026, 10, 13, 9, 0, 0);
  let lat = 45.92;
  const lng = 6.87;
  const metersPerDegLat = 111_320;

  const pushSegment = (params: {
    steps: number;
    stepS: number;
    speedMs: number;
    startEle: number;
    endEle: number;
    direction: 1 | -1;
  }) => {
    const { steps, stepS, speedMs, startEle, endEle, direction } = params;
    for (let i = 1; i <= steps; i += 1) {
      t += stepS * 1000;
      const distStepM = speedMs * stepS;
      lat += (direction * distStepM) / metersPerDegLat;
      const fraction = i / steps;
      const ele = startEle + (endEle - startEle) * fraction;
      fixes.push({
        t,
        lat,
        lng,
        ele,
        acc: 6,
        speed: speedMs,
      });
    }
  };

  // Point de départ au sommet (2200 m)
  fixes.push({ t, lat, lng, ele: 2200, acc: 6, speed: 0 });

  // Run 1 : 2200 m -> 1850 m (-350 m) en 100 s à 10 m/s (1000 m)
  pushSegment({
    steps: 20,
    stepS: 5,
    speedMs: 10,
    startEle: 2200,
    endEle: 1850,
    direction: 1,
  });

  // Remontée mécanique 1 : 1850 m -> 2150 m (+300 m) en 150 s à 4 m/s (600 m)
  pushSegment({
    steps: 30,
    stepS: 5,
    speedMs: 4,
    startEle: 1850,
    endEle: 2150,
    direction: -1,
  });

  // Run 2 : 2150 m -> 1750 m (-400 m) en 100 s à 12 m/s (1200 m)
  pushSegment({
    steps: 20,
    stepS: 5,
    speedMs: 12,
    startEle: 2150,
    endEle: 1750,
    direction: 1,
  });

  return fixes;
}

describe('A01 · S1.08 — Saisie manuelle d’activité (sans GPS ni import)', () => {
  it('valide une séance rétrospective nominale et génère un bilan sans trace GPS ni capteur inventé', () => {
    const clientSessionId = '11111111-2222-4333-8444-555555555555';
    const startedAt = NOW_MS - 3 * 3600 * 1000;

    const validation = validateManualActivityInput(
      {
        sportOrVariant: 'rando-journee',
        startedAt,
        durationS: 5400, // 1h30 en mouvement
        elapsedS: 6000, // 1h40 au total (10 min de pause)
        distance: 8.5,
        distanceUnit: 'km',
        elevGain: 420,
        elevationUnit: 'm',
        title: '  Boucle matinale au col  ',
        notes: 'Terrain sec, bonne visibilité.',
        perceivedExertion: 6,
        clientSessionId,
      },
      NOW_MS,
    );

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.value.clientSessionId).toBe(clientSessionId);
    expect(validation.value.distanceM).toBeCloseTo(8500, 3);
    expect(validation.value.elevGainM).toBeCloseTo(420, 3);
    expect(validation.value.movingS).toBe(5400);
    expect(validation.value.elapsedS).toBe(6000);
    expect(validation.value.endedAtMs).toBe(startedAt + 6000 * 1000);
    expect(validation.value.title).toBe('Boucle matinale au col');

    const summary = buildManualActivitySummary(validation.value, 'metric');
    expect(summary.modeKind).toBe('manual');
    expect(summary.localRecord.clientSessionId).toBe(clientSessionId);
    expect(summary.localRecord.lastPointSeq).toBe(0);
    expect(summary.localRecord.status).toBe('finished');
    expect(summary.details.gpsUsed).toBe(false);
    expect(summary.details.importedFile).toBe(false);

    // Métriques déclarées vs capteurs absents
    expect(summary.metrics.distance.status).toBe('manual');
    expect(summary.metrics.distance.formatted).toBe('8.50 km');
    expect(summary.metrics.elevationGain.formatted).toBe('420 m');
    expect(summary.metrics.heartRate.status).toBe('unavailable');
    expect(summary.metrics.power.status).toBe('unavailable');
    expect(summary.metrics.cadence.status).toBe('unavailable');

    // Payloads compatibles avec start / points / finish
    const payloads = buildManualSyncPayloads(validation.value);
    expect(payloads.startBody).toEqual({
      clientSessionId,
      sport: 'rando',
      variantId: 'rando-journee',
      routeId: null,
    });
    const pointsBody = payloads.pointsBody('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(pointsBody.points).toEqual([]);
    expect(pointsBody.metrics.distanceM).toBe(8500);
    expect(pointsBody.metrics.movingS).toBe(5400);
  });

  it('convertit proprement les unités impériales (miles, pieds) et formate le bilan', () => {
    const validation = validateManualActivityInput(
      {
        sportOrVariant: 'course-route',
        startedAt: '2026-11-12T08:00:00Z',
        durationS: 1800,
        distance: 3.1,
        distanceUnit: 'mi',
        elevGain: 328,
        elevationUnit: 'ft',
      },
      NOW_MS,
    );

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.value.distanceM).toBeCloseTo(3.1 * 1609.344, 1);
    expect(validation.value.elevGainM).toBeCloseTo(328 * 0.3048, 1);

    const imperialSummary = buildManualActivitySummary(validation.value, 'imperial');
    expect(imperialSummary.metrics.distance.unit).toBe('mi');
    expect(imperialSummary.metrics.distance.value).toBeCloseTo(3.1, 2);
    expect(imperialSummary.metrics.elevationGain.unit).toBe('ft');
    expect(imperialSummary.metrics.elevationGain.value).toBe(328);
  });

  it('rejette les saisies manuelles invalides (futur, avant 2000, vitesse invraisemblable, D+ sur eau plate)', () => {
    const future = validateManualActivityInput(
      {
        sportOrVariant: 'course-route',
        startedAt: NOW_MS + 3600_000,
        durationS: 1200,
      },
      NOW_MS,
    );
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.code).toBe('ended_in_future');

    const before2000 = validateManualActivityInput(
      {
        sportOrVariant: 'course-route',
        startedAt: '1999-12-31T23:00:00Z',
        durationS: 1200,
      },
      NOW_MS,
    );
    expect(before2000.ok).toBe(false);
    if (!before2000.ok) expect(before2000.code).toBe('started_before_min_epoch');

    const implausibleSpeed = validateManualActivityInput(
      {
        sportOrVariant: 'rando-journee',
        startedAt: NOW_MS - 3600_000,
        durationS: 600, // 10 min
        distance: 50, // 50 km en 10 min à pied
        distanceUnit: 'km',
      },
      NOW_MS,
    );
    expect(implausibleSpeed.ok).toBe(false);
    if (!implausibleSpeed.ok) expect(implausibleSpeed.code).toBe('implausible_speed');

    const flatWaterElev = validateManualActivityInput(
      {
        sportOrVariant: 'natation-piscine',
        startedAt: NOW_MS - 3600_000,
        durationS: 1800,
        distance: 1500,
        distanceUnit: 'm',
        elevGain: 50,
      },
      NOW_MS,
    );
    expect(flatWaterElev.ok).toBe(false);
    if (!flatWaterElev.ok) expect(flatWaterElev.code).toBe('elevation_not_applicable');
  });
});

describe('A01 · S1.09 — Enregistrement indoor et entraînements virtuels', () => {
  it('démarre une séance indoor même lorsque le GPS est refusé ou indisponible', () => {
    const availability = getActivityModeAvailability('course-tapis', {
      locationPermission: 'denied',
      gpsAvailable: false,
    });
    expect(availability.status).toBe('ready');
    expect(availability.startable).toBe(true);
    expect(availability.requiresGps).toBe(false);
  });

  it('suit la durée monotone hors pauses et marque les capteurs absents comme indisponibles', () => {
    const engine = new IndoorSessionEngine({
      variantId: 'velo-home-trainer',
      startedAtMs: 1_000_000,
    });

    engine.tick(1_600_000); // +600 s en mouvement
    engine.pause(1_600_000);
    engine.tick(1_900_000); // +300 s en pause (ne compte pas dans movingS)
    engine.resume(1_900_000);
    engine.tick(1_850_000); // Saut d'horloge en arrière ignoré
    engine.tick(2_200_000); // +300 s en mouvement

    const summary = engine.finish(2_200_000, 'metric');
    expect(summary.movingS).toBe(900);
    expect(summary.elapsedS).toBe(1200);
    expect(summary.details.dataSource).toBe('chrono-only');

    // Aucune métrique inventée sans capteur ni saisie console
    expect(summary.metrics.distance.status).toBe('unavailable');
    expect(summary.metrics.speed.status).toBe('unavailable');
    expect(summary.metrics.power.status).toBe('unavailable');
    expect(summary.metrics.cadence.status).toBe('unavailable');
    expect(summary.metrics.heartRate.status).toBe('unavailable');
  });

  it('importe les données de console tapis, home-trainer et rameur (/500 m)', () => {
    const rower = new IndoorSessionEngine({
      variantId: 'rameur-indoor',
      startedAtMs: 1_000_000,
    });

    const importRes = rower.applyConsoleImport({
      distance: 5000,
      distanceUnit: 'm',
      durationS: 1200, // 20 min pour 5000 m => 2:00 /500m
      avgPowerW: 210,
      maxPowerW: 340,
      avgStrokeRateSpm: 26,
      avgHeartRateBpm: 158,
    });
    expect(importRes.ok).toBe(true);

    const summary = rower.finish(1_000_000 + 1200_000, 'metric');
    expect(summary.activity.distanceM).toBe(5000);
    expect(summary.movingS).toBe(1200);
    expect(summary.details.avgPowerW.formatted).toBe('210 W');
    expect(summary.details.maxPowerW.formatted).toBe('340 W');
    expect(summary.details.avgStrokeRateSpm.formatted).toBe('26 coups/min');
    expect(summary.details.avgHeartRateBpm.formatted).toBe('158 bpm');
    expect(summary.details.rowerPacePer500m.value).toBe(120);
    expect(summary.details.rowerPacePer500m.formatted).toBe('2:00 /500m');

    // Rejet d'un import console incohérent (maxPowerW < avgPowerW)
    const invalidImport = validateIndoorConsoleImport({
      avgPowerW: 250,
      maxPowerW: 180,
    });
    expect(invalidImport.ok).toBe(false);
    if (!invalidImport.ok) expect(invalidImport.code).toBe('invalid_power');
  });

  it('ingère un flux temps-réel d’entraînement virtuel avec splits et dénivelé simulé', () => {
    const virtualBike = new IndoorSessionEngine({
      variantId: 'velo-virtuel',
      startedAtMs: 0,
    });

    for (let i = 1; i <= 12; i += 1) {
      virtualBike.addSample({
        tMs: i * 10_000,
        distanceDeltaM: 100, // 12 x 100 m = 1200 m (> 1 km split)
        powerW: 220,
        cadenceRpm: 88,
        heartRateBpm: 148,
        virtualElevGainDeltaM: 5,
      });
    }

    const summary = virtualBike.finish(120_000, 'metric');
    expect(summary.activity.distanceM).toBe(1200);
    expect(summary.activity.elevGainM).toBe(60);
    expect(summary.splits.length).toBe(2);
    expect(summary.splits[0].completed).toBe(true);
    expect(summary.splits[0].distanceM).toBe(1000);
    expect(summary.metrics.power.value).toBe(220);
    expect(summary.metrics.cadence.value).toBe(88);
    expect(summary.metrics.heartRate.value).toBe(148);
  });
});

describe('A01 · S1.10 — Natation piscine et eau libre', () => {
  it('calcule longueurs, distance, repos, allure /100m et SWOLF en piscine', () => {
    const pool = new PoolSwimSessionEngine({
      poolConfig: { poolLength: 25, poolUnit: 'm' },
      startedAtMs: 1_000_000,
    });

    // 4 longueurs de 25 m = 100 m nagés en 100 s + 20 s de repos au mur
    pool.recordLength({ durationS: 24, strokes: 16, restAfterS: 5 });
    pool.recordLength({ durationS: 25, strokes: 17, restAfterS: 5 });
    pool.recordLength({ durationS: 25, strokes: 17, restAfterS: 10 });
    pool.recordLength({ durationS: 26, strokes: 18, restAfterS: 0 });

    const summary = pool.finish(1_120_000, 'metric');
    expect(summary.details.lengthCount).toBe(4);
    expect(summary.activity.distanceM).toBe(100);
    expect(summary.movingS).toBe(100);
    expect(summary.details.restTimeS).toBe(20);
    expect(summary.elapsedS).toBe(120);
    expect(summary.details.pacePer100m.value).toBe(100);
    expect(summary.details.pacePer100m.formatted).toBe('1:40 /100m');
    // SWOLF moyen : (40 + 42 + 42 + 44) / 4 = 42
    expect(summary.details.avgSwolf.status).toBe('measured');
    expect(summary.details.avgSwolf.value).toBe(42);
    expect(summary.laps).toHaveLength(4);
  });

  it('marque SWOLF indisponible si aucun capteur de mouvements de bras n’est présent et gère les bassins en yards', () => {
    const poolYd = new PoolSwimSessionEngine({
      poolConfig: { poolLength: 25, poolUnit: 'yd' },
      startedAtMs: 0,
    });
    poolYd.recordLength({ durationS: 22 });
    poolYd.recordLength({ durationS: 23 });

    const summary = poolYd.finish(45_000, 'imperial');
    expect(summary.metrics.distance.unit).toBe('yd');
    expect(summary.metrics.distance.value).toBe(50);
    expect(summary.details.avgSwolf.status).toBe('unavailable');
    expect(summary.details.avgSwolf.unavailableReason).toBe('stroke_count_missing');

    expect(validatePoolConfig({ poolLength: 5 }).ok).toBe(false);
    expect(validatePoolConfig({ poolLength: 150 }).ok).toBe(false);
  });

  it('suit une trace GPS d’eau libre avec coupures d’immersion et neutralise tout faux D+ GPS', () => {
    const openWater = new OpenWaterSwimSessionEngine({ startedAtMs: 0 });
    const metersPerDegLat = 111_320;

    // 10 points espacés de 30 s à 1,0 m/s (300 m) avec bruit d'altitude GPS de ±12 m
    for (let i = 0; i <= 10; i += 1) {
      openWater.addFix({
        t: i * 30_000,
        lat: 43.29 + (i * 30) / metersPerDegLat,
        lng: 5.36,
        ele: i % 2 === 0 ? 12 : -5,
        acc: 10,
        speed: 1.0,
      });
    }

    const summary = openWater.finish(300_000, 'metric');
    expect(summary.activity.distanceM).toBeGreaterThanOrEqual(295);
    expect(summary.activity.distanceM).toBeLessThanOrEqual(305);
    // D+ strictement nul en natation eau libre
    expect(summary.activity.elevGainM).toBe(0);
    expect(summary.metrics.elevationGain.status).toBe('unavailable');
    expect(summary.details.pacePer100m.status).toBe('measured');
    expect(summary.details.pacePer100m.value).toBeCloseTo(100, 1);
  });
});

describe('A01 · S1.11 — Ski et snowboard avec détection des descentes', () => {
  it('distingue les descentes (runs) des remontées mécaniques et exclut le D+ télésiège en ski alpin / snowboard', () => {
    const fixes = buildSkiFixSequence();
    const alpineSummary = analyzeSkiTrace(fixes, {
      variantId: 'ski-alpin',
      units: 'metric',
    });

    expect(alpineSummary.details.runCount).toBe(2);
    expect(alpineSummary.details.liftCount).toBe(1);
    expect(alpineSummary.details.runs[0].verticalDropM).toBe(350);
    expect(alpineSummary.details.runs[1].verticalDropM).toBe(400);
    expect(alpineSummary.details.totalVerticalDropM).toBe(750);
    expect(alpineSummary.details.totalLiftGainM).toBe(300);

    // En ski alpin, le D+ des remontées mécaniques ne gonfle pas elevGainM !
    expect(alpineSummary.activity.elevGainM).toBe(0);
    // La distance et le temps en mouvement ne comptent que les descentes
    expect(alpineSummary.activity.distanceM).toBe(alpineSummary.details.descentDistanceM);
    expect(alpineSummary.activity.movingS).toBe(alpineSummary.details.descentMovingS);

    const formattedRun1 = formatSkiRunForDisplay(alpineSummary.details.runs[0], 'imperial');
    expect(formattedRun1.label).toBe('Descente 1');
    expect(formattedRun1.verticalDropFormatted).toContain('ft');
  });

  it('comptabilise à la fois le D+ de montée active et les runs de descente en ski de randonnée', () => {
    const fixes = buildSkiFixSequence();
    const randoSummary = analyzeSkiTrace(fixes, {
      variantId: 'ski-rando',
      units: 'metric',
    });

    expect(randoSummary.details.countsUphillEffort).toBe(true);
    expect(randoSummary.details.runCount).toBe(2);
    expect(randoSummary.activity.elevGainM).toBe(300);
    expect(randoSummary.details.totalVerticalDropM).toBe(750);
    expect(randoSummary.activity.distanceM).toBe(
      randoSummary.details.descentDistanceM + randoSummary.details.totalLiftDistanceM,
    );
  });

  it('n’invente aucun run ni dénivelé lorsque la trace GPS ne comporte pas d’altitude', () => {
    const engine = new SkiSessionEngine({ variantId: 'snowboard', startedAtMs: 0 });
    engine.addFix({ t: 0, lat: 45.92, lng: 6.87, ele: null, acc: 5, speed: 8 });
    engine.addFix({ t: 10_000, lat: 45.921, lng: 6.87, ele: null, acc: 5, speed: 8 });
    engine.addFix({ t: 20_000, lat: 45.922, lng: 6.87, ele: null, acc: 5, speed: 8 });

    const summary = engine.finish(20_000, 'metric');
    expect(summary.details.elevationAvailable).toBe(false);
    expect(summary.details.runCount).toBe(0);
    expect(summary.metrics.verticalDrop.status).toBe('unavailable');
    expect(summary.metrics.verticalDrop.unavailableReason).toBe('elevation_missing');
  });
});

describe('A01 · S1.12 — Rééducation comme type d’activité', () => {
  it('masque le mode rééducation tant qu’il n’est pas activé, et l’expose après activation', () => {
    expect(getVisibleRehabDefinitions(false)).toHaveLength(0);
    expect(getVisibleRehabDefinitions(true)).toHaveLength(4);

    const disabledAvail = getActivityModeAvailability('rehab-mobilite', {
      locationPermission: 'denied',
      gpsAvailable: false,
      rehabEnabled: false,
    });
    expect(disabledAvail.visible).toBe(false);
    expect(disabledAvail.startable).toBe(false);

    const enabledAvail = getActivityModeAvailability('rehab-mobilite', {
      locationPermission: 'denied',
      gpsAvailable: false,
      rehabEnabled: true,
    });
    expect(enabledAvail.visible).toBe(true);
    expect(enabledAvail.startable).toBe(true);
  });

  it('mappe les activités compatibles vers les variantes de rééducation et le socle SQL', () => {
    expect(mapActivityToRehabVariant('rando')?.rehabVariantId).toBe('rehab-marche');
    expect(mapActivityToRehabVariant('velo-home-trainer')?.rehabVariantId).toBe('rehab-velo-doux');
    expect(mapActivityToRehabVariant('natation-piscine')?.rehabVariantId).toBe('rehab-aquatique');
    expect(mapActivityToRehabVariant('escalade-salle')?.rehabVariantId).toBe('rehab-mobilite');
    expect(mapActivityToRehabVariant('inconnu')).toBeNull();
  });

  it('valide la saisie manuelle de rééducation et le suivi en direct à marche très lente (0,2 m/s)', () => {
    const manualRehab = createManualRehabActivity(
      {
        rehabVariant: 'rehab-mobilite',
        startedAt: NOW_MS - 3600_000,
        durationS: 1800,
        painLevel: 2,
        mobilityScore: 4,
        bodyZone: 'genou',
        supervisedByPractitioner: true,
        perceivedExertion: 3,
        notes: 'Bonne flexion sans douleur résiduelle.',
      },
      { nowMs: NOW_MS },
    );

    expect(manualRehab.ok).toBe(true);
    if (!manualRehab.ok) return;
    expect(manualRehab.summary.modeKind).toBe('rehab');
    expect(manualRehab.summary.details.painLevel).toBe(2);
    expect(manualRehab.summary.details.mobilityScore).toBe(4);
    expect(manualRehab.summary.details.bodyZone).toBe('genou');
    expect(manualRehab.summary.details.supervisedByPractitioner).toBe(true);

    // Marche thérapeutique très lente (0,2 m/s = 0,72 km/h)
    const liveWalk = new RehabSessionEngine({
      rehabVariant: 'rehab-marche',
      startedAtMs: 0,
    });
    const metersPerDegLat = 111_320;
    for (let i = 0; i <= 10; i += 1) {
      liveWalk.addFix({
        t: i * 10_000,
        lat: 45.0 + (i * 2) / metersPerDegLat, // 2 m toutes les 10 s = 0,2 m/s
        lng: 6.0,
        acc: 5,
        speed: 0.2,
      });
    }
    const liveSummary = liveWalk.finish({
      endedAtMs: 100_000,
      painLevel: 1,
      mobilityScore: 5,
      bodyZone: 'cheville',
    });
    expect(liveSummary.details.gpsUsed).toBe(true);
    expect(liveSummary.movingS).toBe(100);
    expect(liveSummary.activity.distanceM).toBeGreaterThanOrEqual(19);
  });
});

describe('A01 · Factory / Dispatcher unifié et compatibilité SQL', () => {
  it('instancie chaque mode via createActivityModeSession et garantit un mapping SQL valide', () => {
    const modeIds = [
      'course-tapis',
      'velo-home-trainer',
      'rameur-indoor',
      'natation-piscine',
      'natation-eau-libre',
      'ski-alpin',
      'snowboard',
      'ski-rando',
      'rehab-mobilite',
      'rehab-marche',
      'rando-journee',
    ];

    for (const id of modeIds) {
      const def = getActivityModeDefinition(id);
      expect(def).not.toBeNull();
      const mapping = toServerPersistenceMapping(def!);
      expect(mapping).not.toBeNull();
      if (mapping!.serverVariantId !== null) {
        expect(SQL_REGISTERED_VARIANTS.has(mapping!.serverVariantId)).toBe(true);
      }

      const session = createActivityModeSession({
        variantOrSport: id,
        startedAtMs: 1_000_000,
      });
      session.tick(1_060_000);
      const summary = session.finish({ endedAtMs: 1_060_000 });
      expect(summary.activity.sport).toBe(mapping!.serverSport);
      expect(summary.localRecord.clientSessionId).toBe(session.clientSessionId);
      expect(summary.localRecord.status).toBe('finished');
    }
  });
});
