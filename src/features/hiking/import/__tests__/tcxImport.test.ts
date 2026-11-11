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

const TCX_V2_NAMESPACE = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';

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

function expectTraceErrorWithMessage(
  run: () => unknown,
  code: TraceImportErrorCode,
  messagePart: string,
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(TraceImportError);
    expect((error as TraceImportError).code).toBe(code);
    expect((error as TraceImportError).message).toContain(messagePart);
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

  it('mesure la taille UTF-8 des caractères multi-octets sans copie du document', () => {
    const withAccents = xml.replace('<Activities>', '<!-- éà漢字 --><Activities>');
    const trace = parseTcx(withAccents);

    expect(trace.provenance.byteLength).toBe(Buffer.byteLength(withAccents, 'utf8'));
  });

  it('accepte un BOM UTF-8 avant la déclaration XML', () => {
    const trace = parseTcx(`\uFEFF${xml}`);

    expect(trace.status).toBe('complete');
    expect(trace.points).toHaveLength(3);
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
    const entity = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><TotalTimeSeconds>1</TotalTimeSeconds><Track><Trackpoint><Time>&xxe;</Time></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(entity), 'external-entity-forbidden');
  });

  it('refuse un XML mal formé, une mauvaise racine et une activité absente', () => {
    expectTraceError(
      () => parseTcx(
        `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities></TrainingCenterDatabase>`,
      ),
      'invalid-xml',
    );
    expectTraceError(() => parseTcx('<gpx version="1.1"></gpx>'), 'not-tcx');
    expectTraceError(
      () => parseTcx(
        `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities></Activities></TrainingCenterDatabase>`,
      ),
      'no-activity',
    );
  });
});

describe('import TCX · namespaces et versions', () => {
  it('résout le namespace de la racine préfixée, même si xmlns:xsi précède le préfixe TCX', () => {
    const trace = parseTcx(fixture('activity-prefixed-v2.tcx'));

    expect(trace.status).toBe('complete');
    expect(trace.provenance.schema).toBe(TCX_V2_NAMESPACE);
    expect(trace.provenance.sport).toBe('Cycling');
    expect(trace.laps).toHaveLength(1);
    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({
      latitudeDeg: 44.1,
      longitudeDeg: 7.1,
      altitudeM: 800,
      heartRateBpm: 110,
    });
    expect(trace.issues).toEqual([]);
  });

  it('refuse explicitement un TCX v1 au lieu de perdre ses champs silencieusement', () => {
    expectTraceError(() => parseTcx(fixture('activity-v1.tcx')), 'unsupported-version');
  });

  it('refuse un document sans namespace ou avec un namespace étranger', () => {
    expectTraceError(
      () => parseTcx('<TrainingCenterDatabase><Activities></Activities></TrainingCenterDatabase>'),
      'not-tcx',
    );
    expectTraceError(
      () => parseTcx(
        '<TrainingCenterDatabase xmlns="urn:example:tcx"><Activities></Activities></TrainingCenterDatabase>',
      ),
      'not-tcx',
    );
  });

  it('refuse une fermeture dont le préfixe diffère de l’ouverture', () => {
    const xml = `<t:TrainingCenterDatabase xmlns:t="${TCX_V2_NAMESPACE}"><t:Activities></x:Activities></t:TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });
});

describe('import TCX · namespaces enfants', () => {
  it('refuse un préfixe enfant non lié au lieu de l’accepter sans namespace', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><x:Activities></x:Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });

  it('refuse un préfixe d’attribut non lié', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}" x:version="1"></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });

  it('ignore Activities dans un namespace étranger au lieu d’importer ses points', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities xmlns="urn:evil"><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'no-activity');
  });

  it('traite xmlns="" comme une absence de namespace, sans héritage TCX', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities xmlns=""><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'no-activity');
  });

  it('accepte un autre préfixe que celui de la racine quand il est lié à TCX v2', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}" xmlns:t="${TCX_V2_NAMESPACE}"><t:Activities><t:Activity Sport="Running"><t:Id>2026-08-09T08:00:00.000Z</t:Id><t:Lap StartTime="2026-08-09T08:00:00.000Z"><t:TotalTimeSeconds>60</t:TotalTimeSeconds><t:Track><t:Trackpoint><t:Time>2026-08-09T08:00:00.000Z</t:Time><t:Position><t:LatitudeDegrees>45.1</t:LatitudeDegrees><t:LongitudeDegrees>6.1</t:LongitudeDegrees></t:Position></t:Trackpoint></t:Track></t:Lap></t:Activity></t:Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
  });

  it('ignore une Position et une HeartRateBpm dans un namespace étranger', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position><Position xmlns="urn:evil"><LatitudeDegrees>46</LatitudeDegrees><LongitudeDegrees>7</LongitudeDegrees></Position><HeartRateBpm><Value>120</Value></HeartRateBpm><HeartRateBpm xmlns="urn:evil"><Value>999</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({
      latitudeDeg: 45.1,
      longitudeDeg: 6.1,
      heartRateBpm: 120,
    });
    expect(trace.issues).toEqual([]);
  });

  it('ignore un TPX dans un namespace étranger', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Extensions><TPX xmlns="urn:evil"><Speed>99</Speed><Watts>999</Watts></TPX></Extensions></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ speedMps: null, powerW: null });
    expect(trace.availableMetrics).toEqual(['time']);
    expect(trace.issues).toEqual([]);
  });
});

describe('import TCX · sections Courses et provenance', () => {
  it('ignore Courses et ses Track/Trackpoint sans perdre l’activité valide', () => {
    const trace = parseTcx(fixture('activity-course.tcx'));

    expect(trace.status).toBe('complete');
    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.laps).toHaveLength(1);
    expect(trace.issues).toEqual([]);
  });

  it('ne laisse pas le Creator d’un Course écraser la provenance de l’Activity', () => {
    const trace = parseTcx(fixture('activity-course.tcx'));

    expect(trace.provenance.creator).toBe('Garmin Connect');
    expect(trace.provenance.productId).toBe('111');
  });

  it('rend no-activity pour un TCX de parcours sans Activities', () => {
    expectTraceError(() => parseTcx(fixture('activity-course-only.tcx')), 'no-activity');
  });

  it('ignore un Track direct de Course sans le confondre avec un Track de Lap', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities><Courses><Course><Track><Trackpoint><Time>2026-08-09T09:00:00.000Z</Time><Position><LatitudeDegrees>46</LatitudeDegrees><LongitudeDegrees>7</LongitudeDegrees></Position></Trackpoint></Track></Course></Courses></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.issues).toEqual([]);
  });

  it('ignore un Course placé avant l’activité et reprend l’activité ensuite', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Courses><Course><Lap><Track><Trackpoint><Time>2026-08-09T07:00:00.000Z</Time><Position><LatitudeDegrees>46</LatitudeDegrees><LongitudeDegrees>7</LongitudeDegrees></Position></Trackpoint></Track></Lap></Course></Courses><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.issues).toEqual([]);
  });

  it('ne laisse pas un Creator d’extension écraser la provenance de l’Activity', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Extensions><Creator><Name>ExtensionMaker</Name><ProductID>777</ProductID></Creator></Extensions></Trackpoint></Track></Lap><Creator><Name>Garmin Connect</Name><ProductID>111</ProductID></Creator></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.creator).toBe('Garmin Connect');
    expect(trace.provenance.productId).toBe('111');
  });

  it('ignore aussi Workouts et Folders et leurs sous-arbres', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Workouts><Workout><Lap><Track><Trackpoint><Time>2026-08-09T07:00:00.000Z</Time><Position><LatitudeDegrees>46</LatitudeDegrees><LongitudeDegrees>7</LongitudeDegrees></Position></Trackpoint></Track></Lap></Workout></Workouts><Folders><Folder><Name>Ancien parcours</Name></Folder></Folders><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.issues).toEqual([]);
  });

  it('utilise Author de la racine seulement en l’absence de Creator d’Activity', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Author><Name>Root Author</Name><ProductID>42</ProductID></Author><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.creator).toBe('Root Author');
    expect(trace.provenance.productId).toBe('42');
  });
});

describe('import TCX · plusieurs Track par Lap', () => {
  it('accepte un Lap segmenté en plusieurs Track et conserve tous ses points', () => {
    const trace = parseTcx(fixture('activity-two-tracks.tcx'));

    expect(trace.status).toBe('complete');
    expect(trace.points).toHaveLength(2);
    expect(trace.laps).toHaveLength(1);
    expect(trace.laps[0]).toMatchObject({
      index: 0,
      firstPointIndex: 0,
      pointCount: 2,
      elapsedSeconds: 120,
    });
    expect(trace.points.map((point) => point.lapIndex)).toEqual([0, 0]);
    expect(trace.issues).toEqual([]);
  });
});

describe('import TCX · multisport explicite', () => {
  it('refuse une MultiSportSession avec multiple-activities, jamais invalid-structure', () => {
    expectTraceErrorWithMessage(
      () => parseTcx(fixture('activity-multisport.tcx')),
      'multiple-activities',
      'MultiSportSession',
    );
  });
});

describe('import TCX · horodatages sans fuseau', () => {
  it('lit un dateTime sans fuseau comme UTC au lieu de perdre la donnée', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00</Id><Lap StartTime="2026-08-09T08:00:00"><TotalTimeSeconds>600</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:10:00</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.provenance.endedAt).toBe('2026-08-09T08:10:00.000Z');
    expect(trace.laps[0].startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.points[0].recordedAt).toBe('2026-08-09T08:10:00.000Z');
    expect(trace.issues).toEqual([]);
  });

  it('normalise aussi un offset explicite en UTC', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T10:00:00+02:00</Id><Lap StartTime="2026-08-09T10:00:00+02:00"><TotalTimeSeconds>600</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T10:10:00+02:00</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.points[0].recordedAt).toBe('2026-08-09T08:10:00.000Z');
    expect(trace.issues).toEqual([]);
  });
});

describe('import TCX · structure et multi-activités', () => {
  it('refuse plusieurs activités au lieu de les fusionner silencieusement', () => {
    expectTraceError(() => parseTcx(fixture('activity-multi.tcx')), 'multiple-activities');
  });

  it('refuse une Activity hors de Activities', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activity Sport="Running"><Lap/></Activity></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-structure');
  });

  it('refuse deux conteneurs Activities, même si le premier est vide', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities></Activities><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap/></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-structure');
  });

  it('refuse un Lap imbriqué', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><Track><Trackpoint/></Track><Lap/></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-structure');
  });

  it('refuse un Trackpoint hors de Track', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><Trackpoint/></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-structure');
  });

  it('refuse une Activity sans Lap', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-structure');
  });

  it('signale un Lap entièrement vide sans le confondre avec un Lap de résumé', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap/></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.laps).toHaveLength(1);
    expect(trace.points).toEqual([]);
    expect(trace.issues).toEqual([expect.objectContaining({ code: 'empty-lap' })]);
  });

  it('accepte un Lap de résumé sans Track', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.status).toBe('complete');
    expect(trace.laps).toHaveLength(1);
    expect(trace.laps[0]).toMatchObject({ elapsedSeconds: 60, pointCount: 0 });
    expect(trace.points).toEqual([]);
  });
});

describe('import TCX · activité sans GPS et points vides', () => {
  it('conserve les bornes d’altitude quand aucune position n’est présente', () => {
    const trace = parseTcx(fixture('activity-no-gps.tcx'));

    expect(trace.bounds).toEqual({
      minLatitudeDeg: null,
      maxLatitudeDeg: null,
      minLongitudeDeg: null,
      maxLongitudeDeg: null,
      minAltitudeM: 1500,
      maxAltitudeM: 1510,
    });
    expect(trace.availableMetrics).toEqual([
      'time',
      'altitude',
      'distance',
      'speed',
      'heartRate',
      'cadence',
      'power',
      'temperature',
    ]);
    expect(trace.points[0]).toMatchObject({
      latitudeDeg: null,
      longitudeDeg: null,
      altitudeM: 1500,
      distanceM: 0,
      speedMps: 2.5,
      heartRateBpm: 120,
      cadenceRpm: 80,
      runCadenceSpm: 160,
      powerW: 180,
      temperatureC: 18,
    });
  });

  it('rend des bornes nulles quand ni position ni altitude ne sont présentes', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><DistanceMeters>100</DistanceMeters><HeartRateBpm><Value>110</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.bounds).toBeNull();
    expect(trace.points).toHaveLength(1);
    expect(trace.availableMetrics).toEqual(['time', 'distance', 'heartRate']);
  });

  it('ignore un Trackpoint vide sans consommer la borne maxPoints', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint/><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml, { maxPoints: 1 });

    expect(trace.points).toHaveLength(1);
    expect(trace.laps[0]).toMatchObject({ firstPointIndex: 0, pointCount: 1 });
    expect(trace.issues).toEqual([expect.objectContaining({ code: 'empty-point' })]);
  });

  it('borne la liste d’alertes et signale la troncature de cette liste', () => {
    const emptyPoints = '<Trackpoint/>'.repeat(4);
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap><Track>${emptyPoints}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml, { maxIssues: 2 });

    expect(trace.issues).toHaveLength(3);
    expect(trace.issues.at(-1)).toMatchObject({ code: 'issue-limit' });
  });
});

describe('import TCX · robustesse XML', () => {
  it('refuse deux attributs sans espace entre eux', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}" a="1"b="2"></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });

  it('refuse une référence numérique vers un caractère interdit par XML 1.0', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>&#0;</Id></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });

  it('refuse un caractère de contrôle littéral', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id></Activity></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });

  it('refuse une seconde déclaration XML et une instruction après la racine', () => {
    const declared = `<?xml version="1.0"?><?xml version="1.0"?><TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities></Activities></TrainingCenterDatabase>`;
    expectTraceError(() => parseTcx(declared), 'invalid-xml');

    const trailing = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities></Activities></TrainingCenterDatabase><?pi?>`;
    expectTraceError(() => parseTcx(trailing), 'invalid-xml');
  });

  it('refuse un contenu inachevé après la fermeture de la racine', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities></Activities></TrainingCenterDatabase><!-- commentaire ouvert`;
    expectTraceError(() => parseTcx(xml), 'invalid-xml');
  });

  it('refuse une date civile impossible au lieu de la normaliser', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-02-30T08:00:00Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.issues).toEqual([expect.objectContaining({ code: 'invalid-time' })]);
  });

  it('tronque les valeurs brutes dans les messages d’alerte', () => {
    const huge = '1'.repeat(500);
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>${huge}</LatitudeDegrees><LongitudeDegrees>6</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);
    const issue = trace.issues.find((entry) => entry.code === 'invalid-number');

    expect(issue).toBeDefined();
    expect(issue?.message.length ?? 0).toBeLessThan(120);
    expect(issue?.message).toContain('500 caractères');
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
