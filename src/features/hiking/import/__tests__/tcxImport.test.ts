import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FIT_SDK_MESSAGE_FIELDS,
  FIT_SDK_READ_OPTIONS,
  TraceImportError,
  parseFit,
  parseTcx,
  type TraceImportErrorCode,
} from '..';

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

function expectTraceError(run: () => unknown, code: TraceImportErrorCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(TraceImportError);
    expect((error as TraceImportError).code).toBe(code);
    return;
  }
  throw new Error(`TraceImportError ${code} attendue, aucune erreur levée`);
}

describe('import TCX · fichier valide', () => {
  const xml = fixture('activity-valid.tcx');

  it('conserve la provenance locale, le format et le sport', () => {
    const trace = parseTcx(xml, { fileName: 'sortie-synthetique.tcx' });

    expect(trace.status).toBe('complete');
    expect(trace.provenance).toEqual({
      format: 'tcx',
      source: 'local-file',
      fileName: 'sortie-synthetique.tcx',
      byteLength: Buffer.byteLength(xml, 'utf8'),
      schema: 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2',
      creator: 'Garmin Connect',
      productId: '1234',
      sport: 'Running',
      startedAt: '2026-08-09T08:00:00.000Z',
      endedAt: '2026-08-09T08:15:00.000Z',
    });
    expect(trace.issues).toEqual([]);
  });

  it('normalise les tours, les index de points et les unités métriques', () => {
    const trace = parseTcx(xml);

    expect(trace.laps).toHaveLength(2);
    expect(trace.points).toHaveLength(3);

    expect(trace.laps[0]).toMatchObject({
      index: 0,
      startedAt: '2026-08-09T08:00:00.000Z',
      elapsedSeconds: 600,
      distanceM: 2000,
      maxSpeedMps: 4.5,
      caloriesKcal: 120,
      averageHeartRateBpm: 140,
      maxHeartRateBpm: 165,
      averageCadenceRpm: 80,
      intensity: 'Active',
      triggerMethod: 'Manual',
      firstPointIndex: 0,
      pointCount: 2,
    });
    expect(trace.laps[1]).toMatchObject({
      index: 1,
      startedAt: '2026-08-09T08:10:00.000Z',
      elapsedSeconds: 300,
      distanceM: 1000,
      firstPointIndex: 2,
      pointCount: 1,
    });

    expect(trace.points[0]).toEqual({
      recordedAt: '2026-08-09T08:00:00.000Z',
      latitudeDeg: 45.2833,
      longitudeDeg: 5.8667,
      altitudeM: 1200.2,
      distanceM: 0,
      speedMps: 3.2,
      heartRateBpm: 130,
      cadenceRpm: 78,
      runCadenceSpm: null,
      powerW: 210,
      temperatureC: null,
      lapIndex: 0,
    });
    expect(trace.points[1]).toMatchObject({
      cadenceRpm: 82,
      runCadenceSpm: 170,
    });
    expect(trace.points[2]).toMatchObject({
      recordedAt: '2026-08-09T08:15:00.000Z',
      distanceM: 3000,
      speedMps: 3.8,
      heartRateBpm: 152,
      cadenceRpm: 86,
      runCadenceSpm: null,
      powerW: 230,
      lapIndex: 1,
    });
  });

  it('calcule les bornes et la liste des métriques réellement disponibles', () => {
    const trace = parseTcx(xml);

    expect(trace.bounds).toEqual({
      minLatitudeDeg: 45.2833,
      maxLatitudeDeg: 45.285,
      minLongitudeDeg: 5.8667,
      maxLongitudeDeg: 5.869,
      minAltitudeM: 1200.2,
      maxAltitudeM: 1220,
    });
    expect(trace.availableMetrics).toEqual([
      'time',
      'position',
      'altitude',
      'distance',
      'speed',
      'heartRate',
      'cadence',
      'power',
    ]);
  });
});

describe('import TCX · fichier tronqué', () => {
  it('rend les enregistrements complets et signale la troncature', () => {
    const trace = parseTcx(fixture('activity-truncated.tcx'), {
      fileName: 'coupee.tcx',
    });

    expect(trace.status).toBe('truncated');
    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({
      recordedAt: '2026-08-09T08:00:00.000Z',
      latitudeDeg: 45.2833,
      altitudeM: 1200.2,
      heartRateBpm: 130,
    });
    expect(trace.laps).toHaveLength(1);
    expect(trace.laps[0]).toMatchObject({ index: 0, firstPointIndex: 0, pointCount: 1 });
    expect(trace.issues).toEqual([
      expect.objectContaining({ code: 'truncated', path: '$' }),
    ]);
    expect(trace.bounds?.maxLatitudeDeg).toBe(45.2833);
  });
});

describe('import TCX · bornes et erreurs de lecture', () => {
  const xml = fixture('activity-valid.tcx');

  it('refuse un fichier au-delà de la borne d’octets', () => {
    expectTraceError(() => parseTcx(xml, { maxBytes: 100 }), 'file-too-large');
  });

  it('refuse un fichier au-delà de la borne de points', () => {
    expectTraceError(() => parseTcx(xml, { maxPoints: 1 }), 'too-many-points');
  });

  it('refuse un fichier au-delà de la borne de tours', () => {
    expectTraceError(() => parseTcx(xml, { maxLaps: 1 }), 'too-many-laps');
  });

  it('refuse une profondeur XML au-delà de la borne', () => {
    expectTraceError(() => parseTcx(xml, { maxDepth: 3 }), 'xml-too-deep');
  });

  it('ignore une coordonnée hors bornes sans contaminer le tracé', () => {
    const trace = parseTcx(fixture('activity-invalid-point.tcx'));

    expect(trace.points).toHaveLength(3);
    expect(trace.points[1]).toMatchObject({
      latitudeDeg: null,
      longitudeDeg: null,
      heartRateBpm: 110,
      cadenceRpm: null,
    });
    expect(trace.bounds).toEqual({
      minLatitudeDeg: 45.1,
      maxLatitudeDeg: 45.3,
      minLongitudeDeg: 6.1,
      maxLongitudeDeg: 6.3,
      minAltitudeM: null,
      maxAltitudeM: null,
    });
    expect(trace.issues.map((issue) => issue.code)).toEqual([
      'invalid-coordinate',
      'invalid-number',
    ]);
  });

  it('refuse une DTD ou une entité externe sans la traiter', () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE TrainingCenterDatabase [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>`;
    expectTraceError(() => parseTcx(xxe), 'external-entity-forbidden');
  });

  it('refuse une entité nommée non prédéfinie', () => {
    const entity = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><TotalTimeSeconds>1</TotalTimeSeconds><Track><Trackpoint><Time>&xxe;</Time></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(entity), 'external-entity-forbidden');
  });

  it('refuse un XML mal formé, une mauvaise racine et une activité absente', () => {
    expectTraceError(
      () => parseTcx('<TrainingCenterDatabase><Activities></TrainingCenterDatabase>'),
      'invalid-xml',
    );
    expectTraceError(() => parseTcx('<gpx version="1.1"></gpx>'), 'not-tcx');
    expectTraceError(
      () => parseTcx('<TrainingCenterDatabase><Activities></Activities></TrainingCenterDatabase>'),
      'no-activity',
    );
  });
});

describe('import FIT · raccordement seulement', () => {
  it('ne prétend pas décoder un FIT sans décodeur branché', () => {
    expectTraceError(() => parseFit(new Uint8Array([0x0e, 0x10])), 'fit-decoder-unavailable');
  });

  it('documente les champs du SDK officiel utiles à la normalisation', () => {
    expect(FIT_SDK_MESSAGE_FIELDS.recordMesgs).toEqual(
      expect.arrayContaining(['positionLat', 'positionLong', 'altitude', 'distance', 'speed', 'heartRate', 'cadence', 'power', 'temperature']),
    );
    expect(FIT_SDK_MESSAGE_FIELDS.lapMesgs).toEqual(
      expect.arrayContaining(['startTime', 'totalTimerTime', 'totalDistance', 'avgHeartRate', 'maxHeartRate']),
    );
    expect(FIT_SDK_MESSAGE_FIELDS.sessionMesgs).toEqual(
      expect.arrayContaining(['startTime', 'sport', 'totalElapsedTime', 'totalDistance']),
    );
    expect(FIT_SDK_MESSAGE_FIELDS.fileIdMesgs).toEqual(
      expect.arrayContaining(['type', 'manufacturer', 'product', 'timeCreated']),
    );
    expect(FIT_SDK_MESSAGE_FIELDS.deviceInfoMesgs).toEqual(
      expect.arrayContaining(['manufacturer', 'product', 'productName', 'softwareVersion']),
    );
    expect(FIT_SDK_READ_OPTIONS).toMatchObject({
      applyScaleAndOffset: true,
      convertDateTimesToDates: true,
    });
  });
});
