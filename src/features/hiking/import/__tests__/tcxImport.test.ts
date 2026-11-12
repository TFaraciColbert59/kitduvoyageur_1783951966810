import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FIT_SDK_MESSAGE_FIELDS,
  FIT_SDK_READ_OPTIONS,
  TraceImportError,
  crc16,
  detectTraceFormat,
  isValidXsdOffset,
  parseFit,
  parseTcx,
  parseTraceFile,
  parseTraceTime,
  sha256Hex,
  traceImportDedupeKey,
  type TraceImportErrorCode,
} from '..';

const TCX_V2_NAMESPACE = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

function encodeUtf16(text: string, littleEndian: boolean): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = littleEndian ? 0xff : 0xfe;
  bytes[1] = littleEndian ? 0xfe : 0xff;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const offset = 2 + index * 2;
    bytes[offset] = littleEndian ? code & 0xff : code >> 8;
    bytes[offset + 1] = littleEndian ? code >> 8 : code & 0xff;
  }
  return bytes;
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
      serialNumber: null,
      fileCreatedAt: null,
      sport: 'Running',
      startedAt: '2026-08-09T08:00:00.000Z',
      endedAt: '2026-08-09T08:15:00.000Z',
      startedAtLocal: null,
      endedAtLocal: null,
      timeBasis: 'utc',
      ignoredSections: [],
      fingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
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
      averageSpeedMps: null,
      caloriesKcal: 120,
      averageHeartRateBpm: 140,
      maxHeartRateBpm: 165,
      averageCadenceRpm: null,
      averageCadenceSpm: 80,
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
      averageCadenceRpm: null,
      averageCadenceSpm: 84,
      firstPointIndex: 2,
      pointCount: 1,
    });

    expect(trace.points[0]).toEqual({
      recordedAt: '2026-08-09T08:00:00.000Z',
      recordedAtLocal: null,
      timeOffset: 'Z',
      latitudeDeg: 45.2833,
      longitudeDeg: 5.8667,
      altitudeM: 1200.2,
      distanceM: 0,
      speedMps: 3.2,
      heartRateBpm: 130,
      cadenceRpm: null,
      runCadenceSpm: 78,
      powerW: 210,
      temperatureC: null,
      lapIndex: 0,
      trackIndex: 0,
    });
    expect(trace.points[1]).toMatchObject({
      cadenceRpm: null,
      runCadenceSpm: 170,
    });
    expect(trace.points[2]).toMatchObject({
      recordedAt: '2026-08-09T08:15:00.000Z',
      distanceM: 3000,
      speedMps: 3.8,
      heartRateBpm: 152,
      cadenceRpm: null,
      runCadenceSpm: 86,
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

describe('import TCX · cadence selon le sport', () => {
  function cadenceXml(sport: string, cadence: number): string {
    return `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="${sport}"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Cadence>${cadence + 2}</Cadence><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><DistanceMeters>10</DistanceMeters><Cadence>${cadence}</Cadence></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  }

  it('range la cadence d’une course dans runCadenceSpm, jamais dans cadenceRpm', () => {
    const trace = parseTcx(cadenceXml('Running', 78));

    expect(trace.points[0]).toMatchObject({ cadenceRpm: null, runCadenceSpm: 78 });
    expect(trace.laps[0]).toMatchObject({ averageCadenceRpm: null, averageCadenceSpm: 80 });
    expect(trace.issues).toEqual([]);
  });

  it('range la cadence d’un vélo dans cadenceRpm', () => {
    const trace = parseTcx(cadenceXml('Biking', 90));

    expect(trace.points[0]).toMatchObject({ cadenceRpm: 90, runCadenceSpm: null });
    expect(trace.laps[0]).toMatchObject({ averageCadenceRpm: 92, averageCadenceSpm: null });
    expect(trace.issues).toEqual([]);
  });

  it('signale une cadence générique dont le sport ne donne pas l’unité', () => {
    const trace = parseTcx(cadenceXml('Other', 42));

    expect(trace.points[0]).toMatchObject({ cadenceRpm: null, runCadenceSpm: null });
    expect(trace.laps[0]).toMatchObject({ averageCadenceRpm: null, averageCadenceSpm: null });
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-feature' }),
    ]));
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
      recordedAtLocal: null,
      timeOffset: 'Z',
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

  it('signale une position orpheline sans fabriquer de coordonnée', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: null, longitudeDeg: null });
    expect(trace.issues).toEqual([
      expect.objectContaining({ code: 'missing-position' }),
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
    expect(trace.issues).toEqual([
      expect.objectContaining({ code: 'ignored-section' }),
    ]);
    expect(trace.provenance.ignoredSections).toEqual([
      { name: 'Extensions', elementCount: 3 },
    ]);
  });
});

describe('import TCX · sections Courses et provenance', () => {
  it('ignore Courses et ses Track/Trackpoint sans perdre l’activité valide', () => {
    const trace = parseTcx(fixture('activity-course.tcx'));

    expect(trace.status).toBe('complete');
    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.laps).toHaveLength(1);
    expect(trace.provenance.ignoredSections).toEqual([
      { name: 'Courses', elementCount: expect.any(Number) },
    ]);
    expect(trace.issues).toEqual([
      expect.objectContaining({ code: 'ignored-section', message: expect.stringContaining('Courses') }),
    ]);
  });

  it('ne laisse pas le Creator d’un Course écraser la provenance de l’Activity', () => {
    const trace = parseTcx(fixture('activity-course.tcx'));

    expect(trace.provenance.creator).toBe('Garmin Connect');
    expect(trace.provenance.productId).toBe('111');
  });

  it('rend no-activity pour un TCX de parcours sans Activities, en nommant Courses', () => {
    expectTraceErrorWithMessage(
      () => parseTcx(fixture('activity-course-only.tcx')),
      'no-activity',
      'Courses',
    );
  });

  it('ignore un Track direct de Course sans le confondre avec un Track de Lap', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities><Courses><Course><Track><Trackpoint><Time>2026-08-09T09:00:00.000Z</Time><Position><LatitudeDegrees>46</LatitudeDegrees><LongitudeDegrees>7</LongitudeDegrees></Position></Trackpoint></Track></Course></Courses></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.issues.map((issue) => issue.code)).toEqual(['ignored-section']);
  });

  it('ignore un Course placé avant l’activité et reprend l’activité ensuite', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Courses><Course><Lap><Track><Trackpoint><Time>2026-08-09T07:00:00.000Z</Time><Position><LatitudeDegrees>46</LatitudeDegrees><LongitudeDegrees>7</LongitudeDegrees></Position></Trackpoint></Track></Lap></Course></Courses><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({ latitudeDeg: 45.1, longitudeDeg: 6.1 });
    expect(trace.issues.map((issue) => issue.code)).toEqual(['ignored-section']);
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
    expect(trace.issues.map((issue) => issue.code)).toEqual(['ignored-section', 'ignored-section']);
    expect(trace.provenance.ignoredSections.map((section) => section.name)).toEqual([
      'Workouts',
      'Folders',
    ]);
  });

  it('signale Notes, Training et les Extensions hors TPX', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}" xmlns:ext="urn:lkdv:test"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Notes>note libre</Notes><Training><Plan><Name>plan</Name></Plan></Training><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><DistanceMeters>10</DistanceMeters><Extensions><ext:Custom>1</ext:Custom></Extensions></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(trace.provenance.ignoredSections.map((section) => section.name)).toEqual([
      'Notes',
      'Training',
      'Extensions',
    ]);
    expect(trace.provenance.ignoredSections.find((section) => section.name === 'Extensions'))
      .toMatchObject({ elementCount: 1 });
    expect(trace.issues.filter((issue) => issue.code === 'ignored-section')).toHaveLength(3);
  });

  it('ne signale pas les Extensions qui ne contiennent que TPX', () => {
    const trace = parseTcx(fixture('activity-valid.tcx'));

    expect(trace.provenance.ignoredSections).toEqual([]);
    expect(trace.issues).toEqual([]);
  });

  it('utilise Author de la racine seulement en l’absence de Creator d’Activity', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Author><Name>Root Author</Name><ProductID>42</ProductID></Author><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.creator).toBe('Root Author');
    expect(trace.provenance.productId).toBe('42');
  });

  it('ne mélange pas un Creator partiel avec l’Author de la racine', () => {
    const nameOnly = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Author><Name>Root Author</Name><ProductID>42</ProductID></Author><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Creator><Name>Device Only</Name></Creator><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const productOnly = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Author><Name>Root Author</Name><ProductID>42</ProductID></Author><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Creator><ProductID>111</ProductID></Creator><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;

    const fromName = parseTcx(nameOnly);
    expect(fromName.provenance.creator).toBe('Device Only');
    expect(fromName.provenance.productId).toBeNull();

    const fromProduct = parseTcx(productOnly);
    expect(fromProduct.provenance.creator).toBeNull();
    expect(fromProduct.provenance.productId).toBe('111');
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
    expect(trace.points.map((point) => point.trackIndex)).toEqual([0, 1]);
    expect(trace.laps[0].tracks).toEqual([
      { index: 0, firstPointIndex: 0, pointCount: 1 },
      { index: 1, firstPointIndex: 1, pointCount: 1 },
    ]);
    expect(trace.issues).toEqual([]);
  });

  it('déduit la durée du dernier point sans TotalTimeSeconds et conserve le trou entre Track', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track><Track><Trackpoint><Time>2026-08-09T08:10:00.000Z</Time><Position><LatitudeDegrees>45.2</LatitudeDegrees><LongitudeDegrees>6.2</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.laps[0].elapsedSeconds).toBe(600);
    expect(trace.points.map((point) => point.trackIndex)).toEqual([0, 1]);
    expect(trace.laps[0].tracks).toEqual([
      { index: 0, firstPointIndex: 0, pointCount: 1 },
      { index: 1, firstPointIndex: 1, pointCount: 1 },
    ]);
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
  it('conserve l’heure civile locale sans inventer d’instant UTC', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00</Id><Lap StartTime="2026-08-09T08:00:00"><TotalTimeSeconds>600</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:10:00</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAt).toBeNull();
    expect(trace.provenance.endedAt).toBeNull();
    expect(trace.provenance.startedAtLocal).toBe('2026-08-09T08:00:00');
    expect(trace.provenance.endedAtLocal).toBe('2026-08-09T08:10:00');
    expect(trace.provenance.timeBasis).toBe('local');
    expect(trace.laps[0].startedAt).toBeNull();
    expect(trace.laps[0].startedAtLocal).toBe('2026-08-09T08:00:00');
    expect(trace.laps[0].elapsedSeconds).toBe(600);
    expect(trace.points[0].recordedAt).toBeNull();
    expect(trace.points[0].recordedAtLocal).toBe('2026-08-09T08:10:00');
    expect(trace.points[0].timeOffset).toBeNull();
    expect(trace.issues).toEqual([
      expect.objectContaining({ code: 'unqualified-time' }),
    ]);
  });

  it('déduit une durée nominale d’heures civiles sans TotalTimeSeconds', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00</Id><Lap StartTime="2026-08-09T08:00:00"><Track><Trackpoint><Time>2026-08-09T08:10:00</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.laps[0].elapsedSeconds).toBe(600);
    expect(trace.laps[0].startedAt).toBeNull();
    expect(trace.laps[0].startedAtLocal).toBe('2026-08-09T08:00:00');
    expect(trace.issues.map((issue) => issue.code)).toEqual(['unqualified-time']);
  });

  it('normalise aussi un offset explicite en UTC', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T10:00:00+02:00</Id><Lap StartTime="2026-08-09T10:00:00+02:00"><TotalTimeSeconds>600</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T10:10:00+02:00</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.points[0].recordedAt).toBe('2026-08-09T08:10:00.000Z');
    expect(trace.issues).toEqual([]);
  });

  it('signale un mélange de conventions et ne compare pas un instant à une heure locale', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T10:00:00+02:00</Id><Lap StartTime="2026-08-09T10:00:00+02:00"><Track><Trackpoint><Time>2026-08-09T10:10:00+02:00</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-08-09T08:05:00</Time><Position><LatitudeDegrees>45.2</LatitudeDegrees><LongitudeDegrees>6.2</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.timeBasis).toBe('mixed');
    expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.points[1].recordedAt).toBeNull();
    expect(trace.points[1].recordedAtLocal).toBe('2026-08-09T08:05:00');
    expect(trace.laps[0].elapsedSeconds).toBeNull();
    expect(trace.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unqualified-time',
      'mixed-time-zones',
    ]));
  });

  it('signale un ordre temporel décroissant au lieu de le masquer', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><Track><Trackpoint><Time>2026-08-09T08:10:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.2</LatitudeDegrees><LongitudeDegrees>6.2</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.issues.map((issue) => issue.code)).toContain('time-out-of-order');
  });

  it('signale un Lap dont le début est postérieur à ses points', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T09:00:00.000Z</Id><Lap StartTime="2026-08-09T09:00:00.000Z"><Track><Trackpoint><Time>2026-08-09T08:10:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.laps[0].elapsedSeconds).toBeNull();
    expect(trace.issues.map((issue) => issue.code)).toContain('time-out-of-order');
  });

  it('calcule endedAtLocal avec la fin des laps, sans inventer de fuseau', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00</Id><Lap StartTime="2026-08-09T08:00:00"><TotalTimeSeconds>600</TotalTimeSeconds></Lap><Lap StartTime="2026-08-09T08:10:00"><TotalTimeSeconds>300</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAtLocal).toBe('2026-08-09T08:00:00');
    expect(trace.provenance.endedAtLocal).toBe('2026-08-09T08:15:00');
    expect(trace.provenance.endedAt).toBeNull();
    expect(trace.provenance.timeBasis).toBe('local');
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

  it('calcule endedAt avec la fin des laps de résumé, sans trackpoint', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>600</TotalTimeSeconds></Lap><Lap StartTime="2026-08-09T08:10:00.000Z"><TotalTimeSeconds>300</TotalTimeSeconds></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    expect(trace.provenance.endedAt).toBe('2026-08-09T08:15:00.000Z');
    expect(trace.provenance.timeBasis).toBe('utc');
    expect(trace.laps.map((lap) => lap.elapsedSeconds)).toEqual([600, 300]);
    expect(trace.issues).toEqual([]);
  });

  it('prend la fin du lap quand le dernier point la précède', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>600</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:05:00.000Z</Time><DistanceMeters>100</DistanceMeters></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points[0].recordedAt).toBe('2026-08-09T08:05:00.000Z');
    expect(trace.provenance.endedAt).toBe('2026-08-09T08:10:00.000Z');
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
      cadenceRpm: null,
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

    expect(trace.issues).toHaveLength(2);
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

  it('accepte un attribut __proto__ sans polluer le prototype', () => {
    const xml = `<TrainingCenterDatabase xmlns="${TCX_V2_NAMESPACE}" __proto__="polluted"><Activities><Activity Sport="Running"><Id>2026-08-09T08:00:00.000Z</Id><Lap StartTime="2026-08-09T08:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-08-09T08:00:00.000Z</Time><Position><LatitudeDegrees>45.1</LatitudeDegrees><LongitudeDegrees>6.1</LongitudeDegrees></Position></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const trace = parseTcx(xml);

    expect(trace.points).toHaveLength(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
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

describe('import FIT · décodage local', () => {
  const START = '2026-08-09T08:00:00.000Z';
  const FIT_EPOCH_SECONDS = 631_065_600;

  type FitField = {
    num: number;
    size: number;
    type: number;
    value: number | string;
  };

  function fitSeconds(iso: string): number {
    return Math.floor(Date.parse(iso) / 1000) - FIT_EPOCH_SECONDS;
  }

  function semicircles(degrees: number): number {
    return Math.round((degrees * 2 ** 31) / 180);
  }

  function writeField(
    bytes: number[],
    field: FitField,
    bigEndian: boolean,
    withValue: boolean,
  ): void {
    if (!withValue) return;
    if (typeof field.value === 'string') {
      const raw = [...field.value].map((character) => character.charCodeAt(0));
      while (raw.length < field.size) raw.push(0);
      bytes.push(...raw.slice(0, field.size));
      return;
    }

    const view = new DataView(new ArrayBuffer(8));
    const little = !bigEndian;
    if (field.size === 1) {
      view.setUint8(0, field.value & 0xff);
    } else if (field.size === 2) {
      view.setUint16(0, field.value & 0xffff, little);
    } else if (field.size === 4) {
      view.setUint32(0, field.value >>> 0, little);
    } else {
      throw new Error(`Taille FIT non gérée : ${field.size}`);
    }
    for (let index = 0; index < field.size; index += 1) bytes.push(view.getUint8(index));
  }

  function definition(
    localType: number,
    globalMessage: number,
    fields: FitField[],
    options: { bigEndian?: boolean; developer?: FitField[] } = {},
  ): number[] {
    const bigEndian = options.bigEndian === true;
    const developer = options.developer ?? [];
    const bytes: number[] = [
      0x40 | localType | (developer.length > 0 ? 0x20 : 0),
      0,
      bigEndian ? 1 : 0,
    ];
    bytes.push(
      bigEndian ? (globalMessage >> 8) & 0xff : globalMessage & 0xff,
      bigEndian ? globalMessage & 0xff : (globalMessage >> 8) & 0xff,
    );
    bytes.push(fields.length);
    for (const field of fields) bytes.push(field.num, field.size, field.type);
    if (developer.length > 0) {
      bytes.push(developer.length);
      for (const field of developer) bytes.push(field.num, field.size, field.type);
    }
    return bytes;
  }

  function data(
    localType: number,
    fields: FitField[],
    bigEndian = false,
    developer: FitField[] = [],
  ): number[] {
    const bytes: number[] = [localType | (developer.length > 0 ? 0x20 : 0)];
    for (const field of fields) writeField(bytes, field, bigEndian, true);
    for (const field of developer) writeField(bytes, field, bigEndian, true);
    return bytes;
  }

  function compressedData(
    localType: number,
    fields: FitField[],
    timeOffset: number,
    bigEndian = false,
  ): number[] {
    const bytes: number[] = [0x80 | ((localType & 0x03) << 5) | (timeOffset & 0x1f)];
    for (const field of fields) writeField(bytes, field, bigEndian, true);
    return bytes;
  }

  function hasFileIdDefinition(messages: number[][]): boolean {
    return messages.some(
      (message) => (message[0] & 0xc0) === 0x40 && message[3] === 0 && message[4] === 0,
    );
  }

  function hasDefinition(messages: number[][], globalMessage: number): boolean {
    return messages.some((message) => {
      if ((message[0] & 0xc0) !== 0x40) return false;
      const bigEndian = message[2] === 1;
      const value = bigEndian
        ? (message[3] << 8) | message[4]
        : message[3] | (message[4] << 8);
      return value === globalMessage;
    });
  }

  function buildFit(options: {
    messages: number[][];
    headerSize?: 12 | 14;
    truncateAt?: number;
    corruptCrc?: boolean;
    protocol?: number;
    fileIdType?: number | null;
    injectSession?: boolean;
  }): Uint8Array {
    const fileIdType = options.fileIdType === undefined ? 4 : options.fileIdType;
    let messages = options.messages;
    if (fileIdType != null && !hasFileIdDefinition(messages)) {
      const fileId: FitField[] = [{ num: 0, size: 1, type: 0x00, value: fileIdType }];
      messages = [definition(15, 0, fileId), data(15, fileId), ...messages];
    }
    if (
      options.injectSession !== false
      && !hasDefinition(messages, 18)
      && !hasDefinition(messages, 34)
    ) {
      const session: FitField[] = [
        { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
        { num: 7, size: 4, type: 0x86, value: 60000 },
      ];
      messages = [...messages, definition(14, 18, session), data(14, session)];
    }

    const dataBytes = messages.flat();
    const headerSize = options.headerSize ?? 12;
    const header: number[] = [
      headerSize,
      options.protocol ?? 0x20,
      0x64,
      0x00,
      dataBytes.length & 0xff,
      (dataBytes.length >> 8) & 0xff,
      (dataBytes.length >> 16) & 0xff,
      (dataBytes.length >> 24) & 0xff,
      0x2e,
      0x46,
      0x49,
      0x54,
    ];
    if (headerSize === 14) {
      const headerCrc = crc16(Uint8Array.from(header));
      header.push(headerCrc & 0xff, (headerCrc >> 8) & 0xff);
    }

    const full = Uint8Array.from([...header, ...dataBytes]);
    const crc = crc16(full);
    const withCrc = [...full, crc & 0xff, (crc >> 8) & 0xff];
    if (options.corruptCrc) withCrc[withCrc.length - 1] ^= 0xff;
    const sliced = options.truncateAt == null ? withCrc : withCrc.slice(0, options.truncateAt);
    return Uint8Array.from(sliced);
  }

  function activityMessages(extra: number[][] = []): number[][] {
    const fileId: FitField[] = [
      { num: 0, size: 1, type: 0x00, value: 4 },
      { num: 1, size: 1, type: 0x02, value: 1 },
      { num: 2, size: 2, type: 0x84, value: 1234 },
      { num: 4, size: 4, type: 0x86, value: fitSeconds(START) },
    ];
    const device: FitField[] = [
      { num: 27, size: 12, type: 0x07, value: 'Garmin Test' },
    ];
    const recordA: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 0, size: 4, type: 0x85, value: semicircles(45.1) },
      { num: 1, size: 4, type: 0x85, value: semicircles(6.1) },
      { num: 2, size: 2, type: 0x84, value: (1200 + 500) * 5 },
      { num: 3, size: 1, type: 0x02, value: 130 },
      { num: 4, size: 1, type: 0x02, value: 80 },
      { num: 5, size: 4, type: 0x86, value: 0 },
      { num: 6, size: 2, type: 0x84, value: 3200 },
      { num: 7, size: 2, type: 0x84, value: 210 },
      { num: 13, size: 1, type: 0x01, value: 18 },
    ];
    const recordB: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds('2026-08-09T08:01:00.000Z') },
      { num: 0, size: 4, type: 0x85, value: semicircles(45.2) },
      { num: 1, size: 4, type: 0x85, value: semicircles(6.2) },
      { num: 2, size: 2, type: 0x84, value: (1210 + 500) * 5 },
      { num: 3, size: 1, type: 0x02, value: 145 },
      { num: 4, size: 1, type: 0x02, value: 82 },
      { num: 5, size: 4, type: 0x86, value: 50000 },
      { num: 6, size: 2, type: 0x84, value: 3400 },
      { num: 7, size: 2, type: 0x84, value: 220 },
      { num: 13, size: 1, type: 0x01, value: 19 },
    ];
    const lap: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 7, size: 4, type: 0x86, value: 120000 },
      { num: 9, size: 4, type: 0x86, value: 50000 },
      { num: 14, size: 2, type: 0x84, value: 3300 },
      { num: 15, size: 1, type: 0x02, value: 137 },
      { num: 16, size: 1, type: 0x02, value: 145 },
    ];
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 1 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
      { num: 9, size: 4, type: 0x86, value: 50000 },
    ];

    return [
      definition(0, 0, fileId),
      data(0, fileId),
      definition(1, 23, device),
      data(1, device),
      definition(2, 20, recordA),
      data(2, recordA),
      data(2, recordB),
      definition(3, 19, lap),
      data(3, lap),
      definition(4, 18, session),
      data(4, session),
      ...extra,
    ];
  }

  it('décode une activité FIT complète avec unités, tours et provenance', () => {
    const trace = parseFit(buildFit({ messages: activityMessages() }), { fileName: 'sortie.fit' });

    expect(trace.status).toBe('complete');
    expect(trace.provenance).toMatchObject({
      format: 'fit',
      source: 'local-file',
      fileName: 'sortie.fit',
      creator: 'Garmin Test',
      productId: '1234',
      sport: 'running',
      startedAt: START,
      endedAt: '2026-08-09T08:01:00.000Z',
      timeBasis: 'utc',
      ignoredSections: [],
    });
    expect(trace.provenance.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(trace.points).toHaveLength(2);
    expect(trace.points[0]).toMatchObject({
      recordedAt: START,
      recordedAtLocal: null,
      timeOffset: 'Z',
      latitudeDeg: expect.closeTo(45.1, 5),
      longitudeDeg: expect.closeTo(6.1, 5),
      altitudeM: 1200,
      distanceM: 0,
      speedMps: 3.2,
      heartRateBpm: 130,
      cadenceRpm: null,
      runCadenceSpm: 80,
      powerW: 210,
      temperatureC: 18,
      lapIndex: 0,
      trackIndex: 0,
    });
    expect(trace.laps).toEqual([
      expect.objectContaining({
        index: 0,
        startedAt: START,
        elapsedSeconds: 120,
        distanceM: 500,
        maxSpeedMps: 3.3,
        averageHeartRateBpm: 137,
        maxHeartRateBpm: 145,
        firstPointIndex: 0,
        pointCount: 2,
        tracks: [{ index: 0, firstPointIndex: 0, pointCount: 2 }],
      }),
    ]);
    expect(trace.availableMetrics).toEqual([
      'time',
      'position',
      'altitude',
      'distance',
      'speed',
      'heartRate',
      'cadence',
      'power',
      'temperature',
    ]);
    expect(trace.issues).toEqual([]);
  });

  it('accepte un en-tête FIT de 14 octets avec sa CRC', () => {
    const trace = parseFit(buildFit({ messages: activityMessages(), headerSize: 14 }));

    expect(trace.status).toBe('complete');
    expect(trace.points).toHaveLength(2);
  });

  it('conserve les messages complets d’un FIT tronqué et signale la coupure', () => {
    const full = buildFit({ messages: activityMessages() });
    const trace = parseFit(full.slice(0, full.length - 6));

    expect(trace.status).toBe('truncated');
    expect(trace.points.length).toBeGreaterThanOrEqual(1);
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'truncated' }),
    ]));
  });

  it('refuse un FIT tronqué sans aucun message complet', () => {
    const full = buildFit({ messages: activityMessages() });
    expectTraceError(() => parseFit(full.slice(0, 12)), 'no-activity');
  });

  it('refuse une CRC de fichier invalide', () => {
    expectTraceError(
      () => parseFit(buildFit({ messages: activityMessages(), corruptCrc: true })),
      'fit-integrity',
    );
  });

  it('refuse un fichier qui n’est pas FIT ou vide', () => {
    expectTraceError(() => parseFit(new Uint8Array([1, 2, 3])), 'not-fit');
    expectTraceError(() => parseFit(new Uint8Array()), 'invalid-input');
  });

  it('refuse plusieurs sessions FIT sans les fusionner', () => {
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 1 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
      { num: 9, size: 4, type: 0x86, value: 50000 },
    ];
    const messages = activityMessages([
      definition(5, 18, session),
      data(5, session),
    ]);
    expectTraceError(() => parseFit(buildFit({ messages })), 'multiple-activities');
  });

  it('refuse un FIT de parcours sans activité', () => {
    const fileId: FitField[] = [
      { num: 0, size: 1, type: 0x00, value: 6 },
    ];
    expectTraceError(
      () => parseFit(buildFit({ messages: [definition(0, 0, fileId), data(0, fileId)] })),
      'not-activity',
    );
  });

  it('refuse les file_id sport, workout et monitoring, ainsi que le file_id absent', () => {
    for (const fileType of [3, 5, 12]) {
      const fileId: FitField[] = [{ num: 0, size: 1, type: 0x00, value: fileType }];
      expectTraceError(
        () => parseFit(buildFit({ messages: [definition(0, 0, fileId), data(0, fileId)] })),
        'not-activity',
      );
    }

    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    expectTraceError(
      () => parseFit(buildFit({
        messages: [definition(0, 20, record), data(0, record)],
        fileIdType: null,
      })),
      'not-activity',
    );
  });

  it('refuse une activité complète sans message session ni activity', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    expectTraceError(
      () => parseFit(buildFit({
        messages: [definition(0, 20, record), data(0, record)],
        injectSession: false,
      })),
      'not-activity',
    );
  });

  it('vérifie la CRC-16/ARC sur un vecteur connu', () => {
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0xbb3d);
  });

  it('décode une définition FIT big-endian et son message global', () => {
    const fileId: FitField[] = [{ num: 0, size: 1, type: 0x00, value: 4 }];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 141 },
      { num: 0, size: 4, type: 0x85, value: semicircles(45.3) },
      { num: 1, size: 4, type: 0x85, value: semicircles(6.3) },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 0, fileId, { bigEndian: true }),
        data(0, fileId, true),
        definition(1, 20, record, { bigEndian: true }),
        data(1, record, true),
      ],
    }));

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0]).toMatchObject({
      recordedAt: START,
      heartRateBpm: 141,
      latitudeDeg: expect.closeTo(45.3, 5),
      longitudeDeg: expect.closeTo(6.3, 5),
    });
    expect(trace.issues).toEqual([]);
  });

  it('décode un horodatage FIT compressé, même avec un type local au bit 6 levé', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const startSeconds = fitSeconds(START);
    const timeOffset = ((startSeconds & 0x1f) + 10) & 0x1f;
    const trace = parseFit(buildFit({
      messages: [
        definition(2, 20, record),
        data(2, record),
        compressedData(2, [{ num: 3, size: 1, type: 0x02, value: 150 }], timeOffset),
      ],
    }));

    expect(trace.points).toHaveLength(2);
    expect(trace.points[1].recordedAt).toBe('2026-08-09T08:00:10.000Z');
    expect(trace.points[1].heartRateBpm).toBe(150);
  });

  it('saute les champs développeur sans décaler le message suivant et les signale', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const developer: FitField[] = [{ num: 0, size: 2, type: 0x84, value: 1234 }];
    const next: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds('2026-08-09T08:00:30.000Z') },
      { num: 3, size: 1, type: 0x02, value: 138 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 20, record, { developer }),
        data(0, record, false, developer),
        definition(1, 20, next),
        data(1, next),
      ],
    }));

    expect(trace.points).toHaveLength(2);
    expect(trace.points[1]).toMatchObject({
      recordedAt: '2026-08-09T08:00:30.000Z',
      heartRateBpm: 138,
    });
    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-developer-fields',
      elementCount: 1,
    });
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ignored-section' }),
    ]));
  });

  it('compte les champs développeur par message, pas par définition', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const developer: FitField[] = [{ num: 0, size: 2, type: 0x84, value: 1234 }];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 20, record, { developer }),
        data(0, record, false, developer),
        data(0, record, false, developer),
      ],
    }));

    expect(trace.points).toHaveLength(2);
    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-developer-fields',
      elementCount: 2,
    });
  });

  it('n’interprète pas un champ FIT de type inconnu comme un horodatage', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x99, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const trace = parseFit(buildFit({
      messages: [definition(0, 20, record), data(0, record)],
    }));

    expect(trace.points).toHaveLength(1);
    expect(trace.points[0].recordedAt).toBeNull();
    expect(trace.points[0].heartRateBpm).toBe(120);
    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-field-type:0x99',
      elementCount: 1,
    });
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ignored-section' }),
    ]));
    expect(trace.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'empty-point' }),
    ]));
  });

  it('signale les messages FIT non interprétés avec leur nombre', () => {
    const unknown: FitField[] = [{ num: 2, size: 1, type: 0x02, value: 7 }];
    const trace = parseFit(buildFit({
      messages: activityMessages([
        definition(5, 99, unknown),
        data(5, unknown),
      ]),
    }));

    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-message:99',
      elementCount: 1,
    });
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ignored-section' }),
    ]));
  });

  it('signale un type de champ FIT inconnu sans l’interpréter', () => {
    const unknownType: FitField[] = [{ num: 250, size: 1, type: 0x99, value: 1 }];
    const trace = parseFit(buildFit({
      messages: [definition(0, 20, unknownType), data(0, unknownType)],
    }));

    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-field-type:0x99',
      elementCount: 1,
    });
    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-field:20:250',
      elementCount: 1,
    });
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ignored-section' }),
      expect.objectContaining({ code: 'empty-point' }),
    ]));
  });

  it('signale un message FIT event non interprété', () => {
    const event: FitField[] = [{ num: 0, size: 1, type: 0x00, value: 0 }];
    const trace = parseFit(buildFit({
      messages: activityMessages([
        definition(5, 21, event),
        data(5, event),
      ]),
    }));

    expect(trace.provenance.ignoredSections).toContainEqual({
      name: 'fit-message:21',
      elementCount: 1,
    });
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ignored-section' }),
    ]));
  });

  it('ne prend pas l’horodatage de fin de session pour un début', () => {
    const end = '2026-08-09T08:02:00.000Z';
    const session: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(end) },
      { num: 5, size: 1, type: 0x00, value: 1 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
    ];
    const trace = parseFit(buildFit({
      messages: [definition(0, 18, session), data(0, session)],
    }));

    expect(trace.provenance.startedAt).toBeNull();
    expect(trace.provenance.endedAt).toBe(end);
    expect(trace.laps[0].startedAt).toBeNull();
    expect(trace.laps[0].elapsedSeconds).toBe(120);
  });

  it('préfère l’horodatage de fin de session au dernier record', () => {
    const end = '2026-08-09T08:02:00.000Z';
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 253, size: 4, type: 0x86, value: fitSeconds(end) },
      { num: 5, size: 1, type: 0x00, value: 1 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
    ];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds('2026-08-09T08:01:00.000Z') },
      { num: 3, size: 1, type: 0x02, value: 130 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 18, session),
        data(0, session),
        definition(1, 20, record),
        data(1, record),
      ],
    }));

    expect(trace.provenance.endedAt).toBe(end);
  });

  it('utilise l’horodatage activity en dernier recours pour la fin', () => {
    const end = '2026-08-09T08:02:00.000Z';
    const activity: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(end) },
    ];
    const record: FitField[] = [{ num: 3, size: 1, type: 0x02, value: 120 }];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 34, activity),
        data(0, activity),
        definition(1, 20, record),
        data(1, record),
      ],
    }));

    expect(trace.points).toHaveLength(1);
    expect(trace.provenance.startedAt).toBeNull();
    expect(trace.provenance.endedAt).toBe(end);
  });

  it('ne range pas une cadence de natation dans un champ vélo', () => {
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 5 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
    ];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 4, size: 1, type: 0x02, value: 30 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 18, session),
        data(0, session),
        definition(1, 20, record),
        data(1, record),
      ],
    }));

    expect(trace.points[0].cadenceRpm).toBeNull();
    expect(trace.points[0].runCadenceSpm).toBeNull();
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported-feature' }),
    ]));
  });

  it('conserve une cadence vélo en tours par minute', () => {
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 2 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
    ];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 4, size: 1, type: 0x02, value: 90 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 18, session),
        data(0, session),
        definition(1, 20, record),
        data(1, record),
      ],
    }));

    expect(trace.points[0].cadenceRpm).toBe(90);
    expect(trace.points[0].runCadenceSpm).toBeNull();
    expect(trace.issues).toEqual([]);
  });

  it('refuse plusieurs messages activity FIT', () => {
    const activity: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
    ];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    expectTraceError(
      () => parseFit(buildFit({
        messages: [
          definition(0, 34, activity),
          data(0, activity),
          definition(1, 34, activity),
          data(1, activity),
          definition(2, 20, record),
          data(2, record),
        ],
      })),
      'multiple-activities',
    );
  });

  it('refuse un FIT multisport au lieu de fusionner les sports', () => {
    const fileId: FitField[] = [{ num: 0, size: 1, type: 0x00, value: 4 }];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 18 },
      { num: 7, size: 4, type: 0x86, value: 120000 },
    ];
    expectTraceError(
      () => parseFit(buildFit({
        messages: [
          definition(0, 0, fileId),
          data(0, fileId),
          definition(1, 20, record),
          data(1, record),
          definition(2, 18, session),
          data(2, session),
        ],
      })),
      'multiple-activities',
    );
  });

  it('applique les limites FIT de taille, points, tours et alertes', () => {
    expectTraceError(
      () => parseFit(buildFit({ messages: activityMessages() }), { maxBytes: 10 }),
      'file-too-large',
    );
    expectTraceError(
      () => parseFit(buildFit({ messages: activityMessages() }), { maxPoints: 1 }),
      'too-many-points',
    );
    expectTraceError(
      () => parseFit(buildFit({ messages: activityMessages() }), { maxMessages: 2 }),
      'too-many-messages',
    );

    const lap: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 7, size: 4, type: 0x86, value: 60000 },
    ];
    expectTraceError(
      () => parseFit(
        buildFit({
          messages: activityMessages([
            definition(5, 19, lap),
            data(5, lap),
          ]),
        }),
        { maxLaps: 1 },
      ),
      'too-many-laps',
    );

    const emptyRecord = definition(0, 20, []);
    const trace = parseFit(
      buildFit({
        messages: [emptyRecord, data(0, []), data(0, []), data(0, [])],
      }),
      { maxIssues: 2 },
    );
    expect(trace.issues).toHaveLength(2);
    expect(trace.issues.at(-1)).toMatchObject({ code: 'issue-limit' });
  });

  it('ne rattache pas un point antérieur au premier lap au lap 0', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const lap: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds('2026-08-09T08:10:00.000Z') },
      { num: 7, size: 4, type: 0x86, value: 300000 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 20, record),
        data(0, record),
        definition(1, 19, lap),
        data(1, lap),
      ],
    }));

    expect(trace.points[0].lapIndex).toBe(-1);
    expect(trace.laps[0]).toMatchObject({ firstPointIndex: null, pointCount: 0, tracks: [] });
    expect(trace.issues).toEqual([]);
  });

  it('marque lapIndex -1 quand un point n’a pas d’horodatage', () => {
    const record: FitField[] = [{ num: 3, size: 1, type: 0x02, value: 120 }];
    const lap: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 7, size: 4, type: 0x86, value: 60000 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 20, record),
        data(0, record),
        definition(1, 19, lap),
        data(1, lap),
      ],
    }));

    expect(trace.points[0].recordedAt).toBeNull();
    expect(trace.points[0].lapIndex).toBe(-1);
    expect(trace.laps[0].pointCount).toBe(0);
  });

  it('conserve le résumé session quand des laps existent', () => {
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const lap: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 7, size: 4, type: 0x86, value: 600000 },
      { num: 9, size: 4, type: 0x86, value: 100000 },
      { num: 13, size: 4, type: 0x86, value: 2400 },
    ];
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 1 },
      { num: 7, size: 4, type: 0x86, value: 600000 },
      { num: 9, size: 4, type: 0x86, value: 100000 },
      { num: 11, size: 2, type: 0x84, value: 500 },
      { num: 14, size: 4, type: 0x86, value: 3000 },
      { num: 18, size: 1, type: 0x02, value: 82 },
    ];
    const activity: FitField[] = [
      { num: 0, size: 4, type: 0x86, value: 600000 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 20, record),
        data(0, record),
        definition(1, 19, lap),
        data(1, lap),
        definition(2, 18, session),
        data(2, session),
        definition(3, 34, activity),
        data(3, activity),
      ],
    }));

    expect(trace.summary).toEqual(expect.objectContaining({
      elapsedSeconds: 600,
      distanceM: 1000,
      caloriesKcal: 500,
      averageSpeedMps: 3,
      averageCadenceSpm: 82,
      averageCadenceRpm: null,
      activityTimerSeconds: 600,
    }));
    expect(trace.laps[0]).toMatchObject({
      caloriesKcal: null,
      averageSpeedMps: 2.4,
    });
    expect(trace.issues).toEqual([]);
  });

  it('expose dans availableMetrics les mesures portées par le résumé session', () => {
    const lap: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 7, size: 4, type: 0x86, value: 600000 },
    ];
    const session: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 1, type: 0x00, value: 1 },
      { num: 7, size: 4, type: 0x86, value: 600000 },
      { num: 9, size: 4, type: 0x86, value: 100000 },
      { num: 14, size: 4, type: 0x86, value: 3000 },
      { num: 16, size: 1, type: 0x02, value: 140 },
      { num: 18, size: 1, type: 0x02, value: 82 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 19, lap),
        data(0, lap),
        definition(1, 18, session),
        data(1, session),
      ],
    }));

    expect(trace.laps[0]).toMatchObject({ distanceM: null, averageSpeedMps: null });
    expect(trace.availableMetrics).toEqual([
      'time',
      'distance',
      'speed',
      'heartRate',
      'cadence',
    ]);
    expect(trace.issues).toEqual([]);
  });

  it('normalise timeCreated/serialNumber et signale les champs décodés non consommés', () => {
    const fileId: FitField[] = [
      { num: 0, size: 1, type: 0x00, value: 4 },
      { num: 3, size: 4, type: 0x86, value: 123456 },
      { num: 4, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 5, size: 2, type: 0x84, value: 7 },
    ];
    const device: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 0, size: 1, type: 0x00, value: 0 },
      { num: 1, size: 2, type: 0x84, value: 1 },
      { num: 2, size: 2, type: 0x84, value: 1234 },
      { num: 3, size: 2, type: 0x84, value: 2 },
      { num: 27, size: 12, type: 0x07, value: 'Garmin Test' },
    ];
    const activity: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds('2026-08-09T08:01:00.000Z') },
      { num: 0, size: 4, type: 0x86, value: 60000 },
      { num: 1, size: 1, type: 0x02, value: 1 },
      { num: 2, size: 1, type: 0x00, value: 0 },
      { num: 3, size: 1, type: 0x00, value: 0 },
      { num: 4, size: 1, type: 0x00, value: 0 },
    ];
    const record: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: fitSeconds(START) },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const trace = parseFit(buildFit({
      messages: [
        definition(0, 0, fileId),
        data(0, fileId),
        definition(1, 23, device),
        data(1, device),
        definition(2, 34, activity),
        data(2, activity),
        definition(3, 20, record),
        data(3, record),
      ],
    }));

    expect(trace.provenance.serialNumber).toBe('123456');
    expect(trace.provenance.fileCreatedAt).toBe(START);
    expect(trace.provenance.creator).toBe('Garmin Test');
    const ignoredNames = trace.provenance.ignoredSections.map((section) => section.name);
    expect(ignoredNames).toEqual(expect.arrayContaining([
      'fit-field:0:5',
      'fit-field:23:253',
      'fit-field:23:0',
      'fit-field:23:1',
      'fit-field:23:2',
      'fit-field:23:3',
      'fit-field:34:1',
      'fit-field:34:2',
      'fit-field:34:3',
      'fit-field:34:4',
    ]));
    expect(ignoredNames).not.toContain('fit-field:0:3');
    expect(ignoredNames).not.toContain('fit-field:0:4');
    expect(ignoredNames).not.toContain('fit-field:34:0');
    expect(trace.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ignored-section' }),
    ]));
  });

  it('rattache un point par lap sur un grand nombre de laps', () => {
    const lapShape: FitField[] = [
      { num: 2, size: 4, type: 0x86, value: 0 },
      { num: 7, size: 4, type: 0x86, value: 60000 },
    ];
    const recordShape: FitField[] = [
      { num: 253, size: 4, type: 0x86, value: 0 },
      { num: 3, size: 1, type: 0x02, value: 120 },
    ];
    const messages: number[][] = [
      definition(2, 20, recordShape),
      definition(3, 19, lapShape),
    ];

    for (let index = 0; index < 500; index += 1) {
      const lapTime = fitSeconds(START) + index * 60;
      messages.push(data(3, [
        { ...lapShape[0], value: lapTime },
        lapShape[1],
      ]));
      messages.push(data(2, [
        { ...recordShape[0], value: lapTime + 10 },
        recordShape[1],
      ]));
    }

    const trace = parseFit(buildFit({ messages }));

    expect(trace.points).toHaveLength(500);
    expect(trace.laps).toHaveLength(500);
    expect(trace.points.every((point, index) => point.lapIndex === index)).toBe(true);
    expect(trace.laps.every((lap) => lap.pointCount === 1)).toBe(true);
  });

  it('parse un FIT via le point d’entrée unique et détecte la signature', () => {
    const bytes = buildFit({ messages: activityMessages() });

    expect(detectTraceFormat({ bytes, fileName: 'sortie.bin' })).toBe('fit');
    const trace = parseTraceFile({ bytes, fileName: 'sortie.bin' });
    expect(trace.provenance.format).toBe('fit');
    expect(trace.points).toHaveLength(2);
  });

  it('documente les champs du profil FIT utiles à la normalisation', () => {
    expect(FIT_SDK_MESSAGE_FIELDS.recordMesgs).toEqual(
      expect.arrayContaining(['positionLat', 'positionLong', 'altitude', 'distance', 'speed', 'heartRate', 'cadence', 'power', 'temperature']),
    );
    expect(FIT_SDK_READ_OPTIONS).toMatchObject({
      applyScaleAndOffset: true,
      convertDateTimesToDates: true,
    });
  });
});

describe('import de trace · sélection du format et déduplication', () => {
  const VALID = readFileSync(
    new URL('./fixtures/activity-valid.tcx', import.meta.url),
    'utf8',
  );

  it('détecte TCX et FIT par signature, pas seulement par extension', () => {
    const fitMagic = new Uint8Array(12);
    fitMagic.set([0x2e, 0x46, 0x49, 0x54], 8);

    expect(detectTraceFormat({ text: VALID, fileName: 'sortie.bin' })).toBe('tcx');
    expect(detectTraceFormat({ text: VALID, fileName: 'sortie.fit' })).toBe('tcx');
    expect(detectTraceFormat({ bytes: new TextEncoder().encode(VALID), fileName: 'sortie.bin' })).toBe('tcx');
    expect(detectTraceFormat({ bytes: new TextEncoder().encode(VALID), fileName: 'sortie.fit' })).toBe('tcx');
    expect(detectTraceFormat({ bytes: fitMagic, fileName: 'sortie.bin' })).toBe('fit');
    expect(detectTraceFormat({ bytes: fitMagic, fileName: 'sortie.tcx' })).toBe('fit');
    expect(detectTraceFormat({ bytes: new Uint8Array(12), fileName: 'sortie.fit' })).toBe('fit');
    expect(detectTraceFormat({ bytes: new Uint8Array(12) })).toBeNull();
  });

  it('parse un fichier TCX via le point d’entrée unique', () => {
    const trace = parseTraceFile({ text: VALID, fileName: 'sortie.tcx' });

    expect(trace.provenance.format).toBe('tcx');
    expect(trace.points).toHaveLength(3);
  });

  it('décode un TCX UTF-16 avec BOM, little et big endian', () => {
    for (const littleEndian of [true, false]) {
      const bytes = encodeUtf16(VALID, littleEndian);

      expect(detectTraceFormat({ bytes, fileName: 'sortie.bin' })).toBe('tcx');
      const trace = parseTraceFile({ bytes, fileName: littleEndian ? 'le.tcx' : 'be.tcx' });
      expect(trace.provenance.format).toBe('tcx');
      expect(trace.provenance.byteLength).toBe(bytes.length);
      expect(trace.points).toHaveLength(3);
      expect(trace.provenance.startedAt).toBe('2026-08-09T08:00:00.000Z');
    }
  });

  it('refuse un format inconnu avec un code stable', () => {
    expectTraceError(() => parseTraceFile({ text: '<gpx></gpx>' }), 'invalid-input');
  });

  it('calcule SHA-256 sur des vecteurs connus', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('rend une empreinte stable et dépendante du contenu', () => {
    const first = parseTcx(VALID);
    const second = parseTcx(VALID);
    const changed = parseTcx(VALID.replace('Running', 'Biking'));

    expect(first.provenance.fingerprint).toBe(second.provenance.fingerprint);
    expect(first.provenance.fingerprint).not.toBe(changed.provenance.fingerprint);
  });

  it('scope la clé de déduplication au propriétaire et à la source', () => {
    const trace = parseTcx(VALID);
    const keyA = traceImportDedupeKey(trace, 'user-a');
    const keyB = traceImportDedupeKey(trace, 'user-b');

    expect(keyA).toContain(trace.provenance.fingerprint);
    expect(keyA).not.toBe(keyB);
  });
});

describe('import de trace · primitives temporelles', () => {
  it('distingue un instant d’une heure civile', () => {
    const instant = parseTraceTime('2026-08-09T10:00:00+02:00');
    const local = parseTraceTime('2026-08-09T10:00:00');

    expect(instant).toEqual({
      ok: true,
      value: {
        instant: '2026-08-09T08:00:00.000Z',
        local: null,
        offset: '+02:00',
      },
    });
    expect(local).toEqual({
      ok: true,
      value: {
        instant: null,
        local: '2026-08-09T10:00:00',
        offset: null,
      },
    });
  });

  it('applique les bornes XSD aux offsets', () => {
    expect(isValidXsdOffset('Z')).toBe(true);
    expect(isValidXsdOffset('-14:00')).toBe(true);
    expect(isValidXsdOffset('+14:00')).toBe(true);
    expect(isValidXsdOffset('+14:01')).toBe(false);
    expect(isValidXsdOffset('+15:00')).toBe(false);
    expect(isValidXsdOffset('+23:59')).toBe(false);
    expect(isValidXsdOffset('+14:60')).toBe(false);
  });

  it('rejette une date civile impossible et un offset invalide', () => {
    expect(parseTraceTime('2026-02-30T08:00:00Z')).toEqual({ ok: false, reason: 'civil' });
    expect(parseTraceTime('2026-08-09T08:00:00+15:00')).toEqual({ ok: false, reason: 'offset' });
  });
});
