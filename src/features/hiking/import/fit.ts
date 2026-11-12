import {
  type NormalizedTraceImport,
  type NormalizedTraceLap,
  type NormalizedTrackPoint,
  type TraceImportIssue,
  type TraceImportIssueCode,
  type TraceImportOptions,
  type TraceIgnoredSection,
  type TraceTimeBasis,
  TraceImportError,
  resolveTraceImportLimits,
} from './model';
import { sha256Hex } from './fingerprint';
import { computeAvailableMetrics, computeBounds } from './stats';
import { civilTimeKey } from './time';

/**
 * Décodeur FIT local, sans dépendance et sans réseau.
 *
 * Il interprète `file_id` (0), `record` (20), `lap` (19), `session` (18),
 * `device_info` (23) et `activity` (34). Les champs non interprétés de ces
 * messages et les autres messages (par exemple `event`) sont lus puis signalés
 * dans `provenance.ignoredSections` : le fichier reste importable, mais aucune
 * donnée n'est abandonnée en silence.
 *
 * Le décodage applique les échelles et décalages du profil FIT, convertit les
 * semicircles en degrés, les horodatages FIT en ISO 8601 UTC et respecte
 * l'architecture little/big endian de chaque définition. Une CRC invalide est
 * refusée ; un fichier coupé conserve les messages complets et rend
 * `status: 'truncated'`.
 */

const FIT_EPOCH_SECONDS = 631_065_600;
const FIT_MAGIC = '.FIT';

/**
 * Messages réellement interprétés ou consommés pour la normalisation. Les
 * autres messages FIT sont lus (pour ne pas décaler le flux) puis signalés
 * dans `provenance.ignoredSections` : aucun message utilisateur n'est abandonné
 * en silence.
 */
const SUPPORTED_FIT_MESSAGES = new Set([0, 18, 19, 20, 23, 34]);

/** Sports dont la cadence FIT est en pas par minute. */
const RUNNING_CADENCE_SPORTS = new Set([
  'running',
  'walking',
  'hiking',
  'mountaineering',
  'snowshoeing',
]);

/** Sports dont la cadence FIT est en tours par minute. */
const CYCLING_CADENCE_SPORTS = new Set(['cycling', 'e_biking']);

/** Champs du SDK officiel utiles à la normalisation, conservés comme contrat. */
export const FIT_SDK_MESSAGE_FIELDS = {
  fileIdMesgs: ['type', 'manufacturer', 'product', 'serialNumber', 'timeCreated', 'number'],
  deviceInfoMesgs: [
    'timestamp',
    'deviceIndex',
    'manufacturer',
    'product',
    'productName',
    'serialNumber',
    'softwareVersion',
    'batteryStatus',
  ],
  activityMesgs: ['timestamp', 'totalTimerTime', 'numSessions', 'type', 'event', 'eventType'],
  sessionMesgs: [
    'timestamp',
    'startTime',
    'sport',
    'subSport',
    'totalElapsedTime',
    'totalTimerTime',
    'totalDistance',
    'totalCalories',
    'avgSpeed',
    'maxSpeed',
    'enhancedAvgSpeed',
    'enhancedMaxSpeed',
    'avgHeartRate',
    'maxHeartRate',
    'avgCadence',
    'maxCadence',
    'avgPower',
    'maxPower',
    'totalAscent',
    'totalDescent',
    'avgAltitude',
    'maxAltitude',
    'enhancedAvgAltitude',
    'enhancedMinAltitude',
    'firstLapIndex',
    'numLaps',
  ],
  lapMesgs: [
    'timestamp',
    'startTime',
    'totalElapsedTime',
    'totalTimerTime',
    'totalDistance',
    'totalCalories',
    'avgSpeed',
    'maxSpeed',
    'enhancedAvgSpeed',
    'enhancedMaxSpeed',
    'avgHeartRate',
    'maxHeartRate',
    'avgCadence',
    'maxCadence',
    'avgPower',
    'maxPower',
    'totalAscent',
    'totalDescent',
    'intensity',
    'lapTrigger',
    'sport',
    'subSport',
    'event',
    'eventType',
  ],
  recordMesgs: [
    'timestamp',
    'positionLat',
    'positionLong',
    'altitude',
    'enhancedAltitude',
    'distance',
    'speed',
    'enhancedSpeed',
    'heartRate',
    'cadence',
    'fractionalCadence',
    'power',
    'temperature',
    'grade',
    'cycles',
    'verticalOscillation',
    'stanceTime',
    'stepLength',
  ],
  eventMesgs: ['timestamp', 'event', 'eventType', 'eventGroup', 'data'],
} as const;

export const FIT_SDK_READ_OPTIONS = {
  applyScaleAndOffset: true,
  convertDateTimesToDates: true,
  convertTypesToStrings: true,
  mergeHeartRates: true,
} as const;

type FitFieldSpec = {
  name: string;
  scale?: number;
  offset?: number;
  kind?: 'timestamp' | 'semicircle' | 'enum' | 'string';
  enumMap?: Readonly<Record<number, string>>;
};

type FitFieldDefinition = {
  number: number;
  size: number;
  baseType: number;
};

type FitDefinition = {
  globalMessage: number;
  bigEndian: boolean;
  fields: FitFieldDefinition[];
  developerFields: FitFieldDefinition[];
};

type FitValue = number | string | number[] | null;

type FitMessage = {
  globalMessage: number;
  fields: Record<number, FitValue>;
};

type FitDiagnostics = {
  /** Nombre d'occurrences par message global non interprété. */
  unsupportedMessages: Map<number, number>;
  /** Champs développeur présents mais non interprétés. */
  developerFields: number;
  /** Types de champ inconnus, par code de type. */
  unknownFieldTypes: Map<number, number>;
  /** Champs connus mais non interprétés, par `messageGlobal:champ`. */
  unsupportedFields: Map<string, number>;
};

type BaseTypeInfo = {
  size: number;
  kind: 'signed' | 'unsigned' | 'float' | 'string' | 'byte';
  invalid: number | bigint | null;
};

// La cible TypeScript du dépôt est ES2017 : les littéraux `0n` sont refusés.
// Les sentinelles 64 bits sont donc construites par `BigInt(...)`.
const INVALID_SINT64 = BigInt('0x7fffffffffffffff');
const INVALID_UINT64 = BigInt('0xffffffffffffffff');
const UINT64_ZERO = BigInt(0);
const SINT64_MAX = BigInt('0x7fffffffffffffff');
const SINT64_MODULUS = BigInt('0x10000000000000000');

const BASE_TYPES: Readonly<Record<number, BaseTypeInfo>> = {
  0x00: { size: 1, kind: 'unsigned', invalid: 0xff },
  0x01: { size: 1, kind: 'signed', invalid: 0x7f },
  0x02: { size: 1, kind: 'unsigned', invalid: 0xff },
  0x83: { size: 2, kind: 'signed', invalid: 0x7fff },
  0x84: { size: 2, kind: 'unsigned', invalid: 0xffff },
  0x85: { size: 4, kind: 'signed', invalid: 0x7fffffff },
  0x86: { size: 4, kind: 'unsigned', invalid: 0xffffffff },
  0x07: { size: 1, kind: 'string', invalid: null },
  0x88: { size: 4, kind: 'float', invalid: null },
  0x89: { size: 8, kind: 'float', invalid: null },
  0x0a: { size: 1, kind: 'unsigned', invalid: 0 },
  0x8b: { size: 2, kind: 'unsigned', invalid: 0 },
  0x8c: { size: 4, kind: 'unsigned', invalid: 0 },
  0x0d: { size: 1, kind: 'byte', invalid: null },
  0x8e: { size: 8, kind: 'signed', invalid: INVALID_SINT64 },
  0x8f: { size: 8, kind: 'unsigned', invalid: INVALID_UINT64 },
  0x90: { size: 8, kind: 'unsigned', invalid: UINT64_ZERO },
};

const SPORT_NAMES: Readonly<Record<number, string>> = {
  0: 'generic',
  1: 'running',
  2: 'cycling',
  3: 'transition',
  4: 'fitness_equipment',
  5: 'swimming',
  6: 'basketball',
  7: 'soccer',
  8: 'tennis',
  9: 'american_football',
  10: 'training',
  11: 'walking',
  12: 'cross_country_skiing',
  13: 'alpine_skiing',
  14: 'snowboarding',
  15: 'rowing',
  16: 'mountaineering',
  17: 'hiking',
  18: 'multisport',
  19: 'paddling',
  20: 'flying',
  21: 'e_biking',
  22: 'motorcycling',
  23: 'boating',
  24: 'driving',
  25: 'golf',
  26: 'hang_gliding',
  27: 'horseback_riding',
  28: 'hunting',
  29: 'fishing',
  30: 'inline_skating',
  31: 'rock_climbing',
  32: 'sailing',
  33: 'ice_skating',
  34: 'sky_diving',
  35: 'snowshoeing',
  36: 'snowmobiling',
  37: 'stand_up_paddleboarding',
  38: 'surfing',
  39: 'wakeboarding',
  40: 'water_skiing',
  41: 'kayaking',
  42: 'rafting',
  43: 'windsurfing',
  44: 'kitesurfing',
  45: 'diving',
  46: 'snorkeling',
  47: 'swimrun',
  48: 'water_tubing',
  49: 'wakesurfing',
};

const INTENSITY_NAMES: Readonly<Record<number, string>> = {
  0: 'active',
  1: 'rest',
  2: 'warmup',
  3: 'cooldown',
  4: 'recovery',
  5: 'interval',
  6: 'other',
};

const LAP_TRIGGER_NAMES: Readonly<Record<number, string>> = {
  0: 'manual',
  1: 'time',
  2: 'distance',
  3: 'position_start',
  4: 'position_lap',
  5: 'position_waypoint',
  6: 'position_marked',
  7: 'session_end',
  8: 'fitness_equipment',
};

const FIT_MESSAGE_SPECS: Readonly<Record<number, Readonly<Record<number, FitFieldSpec>>>> = {
  0: {
    0: { name: 'type' },
    1: { name: 'manufacturer' },
    2: { name: 'product' },
    3: { name: 'serialNumber' },
    4: { name: 'timeCreated', kind: 'timestamp' },
    5: { name: 'number' },
  },
  20: {
    253: { name: 'timestamp', kind: 'timestamp' },
    0: { name: 'positionLat', kind: 'semicircle' },
    1: { name: 'positionLong', kind: 'semicircle' },
    2: { name: 'altitude', scale: 5, offset: 500 },
    3: { name: 'heartRate' },
    4: { name: 'cadence' },
    5: { name: 'distance', scale: 100 },
    6: { name: 'speed', scale: 1000 },
    7: { name: 'power' },
    13: { name: 'temperature' },
    73: { name: 'enhancedSpeed', scale: 1000 },
    78: { name: 'enhancedAltitude', scale: 5, offset: 500 },
  },
  19: {
    253: { name: 'timestamp', kind: 'timestamp' },
    2: { name: 'startTime', kind: 'timestamp' },
    7: { name: 'totalElapsedTime', scale: 1000 },
    8: { name: 'totalTimerTime', scale: 1000 },
    9: { name: 'totalDistance', scale: 100 },
    11: { name: 'totalCalories' },
    13: { name: 'avgSpeed', scale: 1000 },
    14: { name: 'maxSpeed', scale: 1000 },
    15: { name: 'avgHeartRate' },
    16: { name: 'maxHeartRate' },
    17: { name: 'avgCadence' },
    20: { name: 'intensity', kind: 'enum', enumMap: INTENSITY_NAMES },
    24: { name: 'lapTrigger', kind: 'enum', enumMap: LAP_TRIGGER_NAMES },
    25: { name: 'sport', kind: 'enum', enumMap: SPORT_NAMES },
  },
  18: {
    253: { name: 'timestamp', kind: 'timestamp' },
    2: { name: 'startTime', kind: 'timestamp' },
    5: { name: 'sport', kind: 'enum', enumMap: SPORT_NAMES },
    6: { name: 'subSport' },
    7: { name: 'totalElapsedTime', scale: 1000 },
    8: { name: 'totalTimerTime', scale: 1000 },
    9: { name: 'totalDistance', scale: 100 },
    11: { name: 'totalCalories' },
    14: { name: 'avgSpeed', scale: 1000 },
    15: { name: 'maxSpeed', scale: 1000 },
    16: { name: 'avgHeartRate' },
    17: { name: 'maxHeartRate' },
    18: { name: 'avgCadence' },
  },
  34: {
    253: { name: 'timestamp', kind: 'timestamp' },
    0: { name: 'totalTimerTime', scale: 1000 },
    1: { name: 'numSessions' },
    2: { name: 'type' },
    3: { name: 'event' },
    4: { name: 'eventType' },
  },
  23: {
    253: { name: 'timestamp', kind: 'timestamp' },
    0: { name: 'deviceIndex' },
    1: { name: 'manufacturer' },
    2: { name: 'product' },
    27: { name: 'productName', kind: 'string' },
    3: { name: 'softwareVersion' },
  },
  21: {
    253: { name: 'timestamp', kind: 'timestamp' },
    0: { name: 'event' },
    1: { name: 'eventType' },
    2: { name: 'eventGroup' },
    3: { name: 'data' },
  },
};

export function parseFit(
  bytes: Uint8Array,
  options: TraceImportOptions = {},
): NormalizedTraceImport {
  if (!(bytes instanceof Uint8Array)) {
    throw new TraceImportError('invalid-input', 'Le contenu FIT doit être un Uint8Array.');
  }
  if (bytes.length === 0) {
    throw new TraceImportError('invalid-input', 'Le contenu FIT est vide.');
  }

  const limits = resolveTraceImportLimits(options);
  if (bytes.length > limits.maxBytes) {
    throw new TraceImportError(
      'file-too-large',
      `Fichier FIT de ${bytes.length} octets, borne ${limits.maxBytes}.`,
    );
  }

  const headerSize = bytes[0];
  if (headerSize !== 12 && headerSize !== 14) {
    throw new TraceImportError('not-fit', 'En-tête FIT invalide : taille attendue 12 ou 14.');
  }
  if (bytes.length < headerSize) {
    throw new TraceImportError('not-fit', 'En-tête FIT incomplet.');
  }
  if (readAscii(bytes, 8, 12) !== FIT_MAGIC) {
    throw new TraceImportError('not-fit', 'Signature « .FIT » absente.');
  }

  const protocolMajor = bytes[1] >> 4;
  if (protocolMajor > 2) {
    throw new TraceImportError(
      'unsupported-version',
      `Version de protocole FIT ${protocolMajor} non prise en charge.`,
    );
  }

  if (headerSize === 14 && bytes.length >= 14) {
    const expected = readUint16(bytes, 12, false);
    const actual = crc16(bytes, 0, 12);
    if (expected !== actual) {
      throw new TraceImportError('fit-integrity', 'CRC d’en-tête FIT invalide.');
    }
  }

  const dataSize = readUint32(bytes, 4, false);
  const dataStart = headerSize;
  const declaredDataEnd = dataStart + dataSize;
  const fileCrcOffset = declaredDataEnd;
  const completeFile = fileCrcOffset + 2 <= bytes.length;
  const dataEnd = Math.min(declaredDataEnd, bytes.length);
  let truncated = declaredDataEnd > bytes.length;

  if (completeFile) {
    const expected = readUint16(bytes, fileCrcOffset, false);
    const actual = crc16(bytes, 0, fileCrcOffset);
    if (expected !== actual) {
      throw new TraceImportError('fit-integrity', 'CRC de fichier FIT invalide.');
    }
  } else {
    truncated = true;
  }

  const parsed = readFitMessages(bytes, dataStart, dataEnd);
  truncated ||= parsed.truncated;

  const messages = parsed.messages;
  const diagnostics = parsed.diagnostics;
  if (messages.length === 0) {
    throw new TraceImportError(
      'no-activity',
      truncated
        ? 'Aucun message FIT complet avant la troncature.'
        : 'Aucun message FIT exploitable.',
    );
  }

  const fileId = messages.find((message) => message.globalMessage === 0);
  const fileType = numberField(fileId, 0);
  if (fileType === 6) {
    throw new TraceImportError(
      'no-activity',
      'FIT de parcours : cet import attend une activité enregistrée, pas un parcours.',
    );
  }

  const activityMessages = messages.filter((message) => message.globalMessage === 34);
  if (activityMessages.length > 1) {
    throw new TraceImportError(
      'multiple-activities',
      'Le fichier FIT contient plusieurs messages activity : la fusion silencieuse est refusée.',
    );
  }

  const sessions = messages.filter((message) => message.globalMessage === 18);
  if (sessions.length > 1) {
    throw new TraceImportError(
      'multiple-activities',
      'Le fichier FIT contient plusieurs sessions : la fusion silencieuse est refusée.',
    );
  }

  const session = sessions[0] ?? null;
  const lapMessages = messages.filter((message) => message.globalMessage === 19);
  if (lapMessages.length > limits.maxLaps) {
    throw new TraceImportError(
      'too-many-laps',
      `Plus de ${limits.maxLaps} tours dans le fichier FIT.`,
    );
  }

  const records = messages.filter((message) => message.globalMessage === 20);
  if (records.length > limits.maxPoints) {
    throw new TraceImportError(
      'too-many-points',
      `Plus de ${limits.maxPoints} points dans le fichier FIT.`,
    );
  }
  if (records.length === 0 && lapMessages.length === 0 && session == null) {
    const unsupported = [...diagnostics.unsupportedMessages.keys()]
      .sort((left, right) => left - right)
      .map((globalMessage) => String(globalMessage));
    throw new TraceImportError(
      'no-activity',
      unsupported.length > 0
        ? `Aucune activité FIT à importer ; messages non interprétés : ${unsupported.join(', ')}.`
        : 'Aucune activité FIT à importer.',
    );
  }

  const issues: TraceImportIssue[] = [];
  let issueLimitReported = false;
  const addIssue = (code: TraceImportIssueCode, message: string, at: string): void => {
    if (issues.length < limits.maxIssues - 1) {
      issues.push({ code, message, path: at });
      return;
    }
    if (!issueLimitReported) {
      issueLimitReported = true;
      issues.push({
        code: 'issue-limit',
        message: `Liste d’alertes bornée à ${limits.maxIssues} entrées.`,
        path: at,
      });
    }
  };

  if (truncated) {
    addIssue('truncated', 'Le fichier FIT se termine avant la fin des données annoncées.', '$');
  }

  // Tout ce qui n'est pas interprété est nommé, compté et signalé : un
  // consommateur ne peut pas croire que le fichier a été lu intégralement.
  const ignoredSections: TraceIgnoredSection[] = [];
  for (const [globalMessage, count] of [...diagnostics.unsupportedMessages.entries()].sort(
    (left, right) => left[0] - right[0],
  )) {
    ignoredSections.push({ name: `fit-message:${globalMessage}`, elementCount: count });
  }
  if (diagnostics.developerFields > 0) {
    ignoredSections.push({
      name: 'fit-developer-fields',
      elementCount: diagnostics.developerFields,
    });
  }
  for (const [baseType, count] of [...diagnostics.unknownFieldTypes.entries()].sort(
    (left, right) => left[0] - right[0],
  )) {
    ignoredSections.push({
      name: `fit-field-type:0x${baseType.toString(16).padStart(2, '0')}`,
      elementCount: count,
    });
  }
  for (const [fieldKey, count] of [...diagnostics.unsupportedFields.entries()].sort(
    (left, right) => left[0].localeCompare(right[0]),
  )) {
    ignoredSections.push({ name: `fit-field:${fieldKey}`, elementCount: count });
  }
  if (ignoredSections.length > 0) {
    const names = ignoredSections.map((section) => section.name);
    const summary = names.length > 8
      ? `${names.slice(0, 8).join(', ')} (+${names.length - 8})`
      : names.join(', ');
    addIssue('ignored-section', `Éléments FIT non interprétés : ${summary}.`, '$');
  }

  const points: NormalizedTrackPoint[] = [];
  for (const record of records) {
    const point = recordToPoint(record);
    if (point == null) {
      addIssue('empty-point', 'Message FIT record sans mesure exploitable ignoré.', 'record');
      continue;
    }
    if ((point.latitudeDeg == null) !== (point.longitudeDeg == null)) {
      addIssue('missing-position', 'Latitude et longitude FIT incomplètes.', 'record');
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    } else if (
      point.latitudeDeg != null
      && point.longitudeDeg != null
      && (point.latitudeDeg < -90 || point.latitudeDeg > 90 || point.longitudeDeg < -180 || point.longitudeDeg > 180)
    ) {
      addIssue('invalid-coordinate', 'Coordonnée FIT hors bornes ignorée.', 'record');
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    }
    points.push(point);
  }

  // Les laps FIT sont des résumés : on rattache chaque point au dernier lap
  // dont le début précède son horodatage, sans fabriquer de lien entre deux
  // enregistrements absents.
  const lapStarts = lapMessages.map((lap, index) => ({
    index,
    start: timestampSeconds(lap, 2),
  }));

  if (lapStarts.length > 0) {
    for (const point of points) {
      const seconds = point.recordedAt == null ? null : Math.floor(Date.parse(point.recordedAt) / 1000) - FIT_EPOCH_SECONDS;
      let selected = 0;
      for (const lap of lapStarts) {
        if (lap.start != null && seconds != null && lap.start <= seconds) selected = lap.index;
      }
      point.lapIndex = selected;
    }
  }

  const laps: NormalizedTraceLap[] = [];
  if (lapMessages.length > 0) {
    for (let index = 0; index < lapMessages.length; index += 1) {
      laps.push(lapMessageToLap(lapMessages[index], index, points));
    }
  } else {
    laps.push(sessionToLap(session, points));
  }

  const activity = activityMessages[0] ?? null;
  const firstRecordInstant = points.find((point) => point.recordedAt != null)?.recordedAt ?? null;
  const lastRecordInstant = [...points].reverse().find((point) => point.recordedAt != null)?.recordedAt ?? null;
  const startedAt = timestampIsoField(session, 2) ?? firstRecordInstant ?? laps[0]?.startedAt ?? null;
  const endedAt = timestampIsoField(session, 253)
    ?? lastRecordInstant
    ?? endFromLap(laps[laps.length - 1])
    ?? timestampIsoField(activity, 253)
    ?? null;
  // Un fichier multisport contient plusieurs sports dans une seule session :
  // le fusionner produirait une activité dont le sport et les tours seraient
  // faux. On refuse explicitement, comme pour une MultiSportSession TCX.
  const lapSports = lapMessages
    .map((message) => textField(message, 25))
    .filter((value): value is string => value != null);
  const sport = textField(session, 5) ?? lapSports[0] ?? null;
  const distinctSports = new Set<string>(sport == null ? [] : [sport]);
  for (const lapSport of lapSports) distinctSports.add(lapSport);
  if (sport === 'multisport' || distinctSports.size > 1) {
    throw new TraceImportError(
      'multiple-activities',
      'Le fichier FIT contient plusieurs sports (multisport) : la fusion silencieuse est refusée.',
    );
  }

  // La cadence FIT n'a pas la même unité selon le sport. On ne la range
  // jamais dans un champ dont l'unité ne correspond pas.
  if (sport != null && RUNNING_CADENCE_SPORTS.has(sport)) {
    for (const point of points) {
      if (point.cadenceRpm != null) {
        point.runCadenceSpm = point.cadenceRpm;
        point.cadenceRpm = null;
      }
    }
    for (const lap of laps) {
      lap.averageCadenceSpm = lap.averageCadenceRpm;
      lap.averageCadenceRpm = null;
    }
  } else if (sport == null || !CYCLING_CADENCE_SPORTS.has(sport)) {
    const hasCadence = points.some((point) => point.cadenceRpm != null)
      || laps.some((lap) => lap.averageCadenceRpm != null);
    if (hasCadence) {
      for (const point of points) point.cadenceRpm = null;
      for (const lap of laps) lap.averageCadenceRpm = null;
      addIssue(
        'unsupported-feature',
        `Cadence FIT du sport « ${sport ?? 'inconnu'} » non interprétée : unité non couverte.`,
        '$',
      );
    }
  }

  const productName = messages
    .filter((message) => message.globalMessage === 23)
    .map((message) => textField(message, 27))
    .find((value) => value != null) ?? null;
  const manufacturer = numberField(fileId, 1);
  const product = numberField(fileId, 2);
  const creator = productName ?? (manufacturer != null ? `manufacturer:${manufacturer}` : null);
  const hasFitTime = points.some((point) => point.recordedAt != null)
    || startedAt != null
    || endedAt != null;
  const timeBasis: TraceTimeBasis = hasFitTime ? 'utc' : 'none';

  if (hasOutOfOrderFits(points)) {
    addIssue('time-out-of-order', 'Les horodatages FIT ne sont pas croissants.', '$');
  }

  return {
    status: truncated ? 'truncated' : 'complete',
    provenance: {
      format: 'fit',
      source: 'local-file',
      fileName: clean(options.fileName),
      byteLength: bytes.length,
      schema: 'fit',
      creator,
      productId: product == null ? null : String(product),
      sport,
      startedAt,
      endedAt,
      startedAtLocal: null,
      endedAtLocal: null,
      timeBasis,
      ignoredSections,
      fingerprint: `sha256:${sha256Hex(bytes)}`,
    },
    bounds: computeBounds(points),
    points,
    laps,
    availableMetrics: computeAvailableMetrics(points, laps, hasFitTime),
    issues,
  };
}

function readFitMessages(
  bytes: Uint8Array,
  dataStart: number,
  dataEnd: number,
): { messages: FitMessage[]; truncated: boolean; diagnostics: FitDiagnostics } {
  const definitions = new Map<number, FitDefinition>();
  const messages: FitMessage[] = [];
  const diagnostics: FitDiagnostics = {
    unsupportedMessages: new Map(),
    developerFields: 0,
    unknownFieldTypes: new Map(),
    unsupportedFields: new Map(),
  };
  let offset = dataStart;
  let truncated = false;
  let lastTimestamp: number | null = null;

  while (offset < dataEnd) {
    const header = bytes[offset];
    offset += 1;

    // Un en-tête de définition a le bit 7 à 0 et le bit 6 à 1. Un en-tête
    // compressé a le bit 7 à 1 : le bit 6 y appartient au type local.
    if ((header & 0x80) === 0 && (header & 0x40) !== 0) {
      const definition = readDefinition(bytes, offset, dataEnd, header);
      if (definition == null) {
        truncated = true;
        break;
      }
      offset = definition.nextOffset;
      definitions.set(header & 0x0f, definition.definition);
      continue;
    }

    const localType = (header & 0x80) !== 0 ? (header >> 5) & 0x03 : header & 0x0f;
    const definition = definitions.get(localType);
    if (definition == null) {
      throw new TraceImportError(
        'invalid-structure',
        `Message FIT local ${localType} sans définition.`,
      );
    }

    const compressed = (header & 0x80) !== 0;
    let timestamp: number | null = null;
    if (compressed) {
      // Le protocole ne compresse que le premier champ, et seulement s'il
      // s'agit du timestamp.
      if (definition.fields[0]?.number !== 253) {
        throw new TraceImportError(
          'invalid-structure',
          'Horodatage FIT compressé sans champ timestamp en première position.',
        );
      }
      if (definition.developerFields.length > 0) {
        throw new TraceImportError(
          'unsupported-feature',
          'Un message FIT compressé avec champs développeur n’est pas pris en charge.',
        );
      }
      if (lastTimestamp == null) {
        throw new TraceImportError(
          'invalid-structure',
          'Horodatage FIT compressé sans horodatage précédent.',
        );
      }
      const timeOffset = header & 0x1f;
      const low = lastTimestamp & 0x1f;
      timestamp = lastTimestamp - low + timeOffset;
      if (timeOffset < low) timestamp += 0x20;
    }

    if (
      !compressed
      && definition.developerFields.length > 0
      && (header & 0x20) === 0
    ) {
      throw new TraceImportError(
        'invalid-structure',
        'Message FIT avec champs développeur mais sans drapeau développeur.',
      );
    }

    const fields: Record<number, FitValue> = Object.create(null) as Record<number, FitValue>;
    let skipTimestamp = compressed;

    for (const field of definition.fields) {
      if (BASE_TYPES[field.baseType] == null) {
        diagnostics.unknownFieldTypes.set(
          field.baseType,
          (diagnostics.unknownFieldTypes.get(field.baseType) ?? 0) + 1,
        );
      }
      if (
        SUPPORTED_FIT_MESSAGES.has(definition.globalMessage)
        && FIT_MESSAGE_SPECS[definition.globalMessage]?.[field.number] == null
      ) {
        const key = `${definition.globalMessage}:${field.number}`;
        diagnostics.unsupportedFields.set(
          key,
          (diagnostics.unsupportedFields.get(key) ?? 0) + 1,
        );
      }
      if (skipTimestamp && field.number === 253) {
        skipTimestamp = false;
        continue;
      }
      if (offset + field.size > dataEnd) {
        truncated = true;
        break;
      }
      fields[field.number] = readFieldValue(bytes, offset, field, definition.bigEndian);
      offset += field.size;
    }
    if (truncated) break;

    // Les champs développeur sont présents dans le message mais ne sont pas
    // interprétés : ils ne doivent pas décaler la lecture des messages suivants.
    if (!compressed && (header & 0x20) !== 0) {
      diagnostics.developerFields += definition.developerFields.length;
      for (const field of definition.developerFields) {
        if (offset + field.size > dataEnd) {
          truncated = true;
          break;
        }
        offset += field.size;
      }
      if (truncated) break;
    }

    if (compressed && timestamp != null) fields[253] = timestamp;
    const messageTimestamp = asNumber(fields[253]);
    if (messageTimestamp != null) lastTimestamp = messageTimestamp;
    messages.push({ globalMessage: definition.globalMessage, fields });
    if (!SUPPORTED_FIT_MESSAGES.has(definition.globalMessage)) {
      diagnostics.unsupportedMessages.set(
        definition.globalMessage,
        (diagnostics.unsupportedMessages.get(definition.globalMessage) ?? 0) + 1,
      );
    }
  }

  return { messages, truncated, diagnostics };
}

function readDefinition(
  bytes: Uint8Array,
  offset: number,
  dataEnd: number,
  header: number,
): { definition: FitDefinition; nextOffset: number } | null {
  // réservé + architecture + message global + nombre de champs
  if (offset + 5 > dataEnd) return null;
  const architecture = bytes[offset + 1];
  if (architecture !== 0 && architecture !== 1) {
    throw new TraceImportError('invalid-structure', 'Architecture FIT inconnue.');
  }
  const bigEndian = architecture === 1;
  const globalMessage = readUint16(bytes, offset + 2, bigEndian);
  const fieldCount = bytes[offset + 4];
  let cursor = offset + 5;

  if (cursor + fieldCount * 3 > dataEnd) return null;
  const fields: FitFieldDefinition[] = [];
  for (let index = 0; index < fieldCount; index += 1) {
    fields.push({
      number: bytes[cursor],
      size: bytes[cursor + 1],
      baseType: bytes[cursor + 2],
    });
    cursor += 3;
  }

  const developerFields: FitFieldDefinition[] = [];
  if ((header & 0x20) !== 0) {
    if (cursor + 1 > dataEnd) return null;
    const developerCount = bytes[cursor];
    cursor += 1;
    if (cursor + developerCount * 3 > dataEnd) return null;
    for (let index = 0; index < developerCount; index += 1) {
      developerFields.push({
        number: bytes[cursor],
        size: bytes[cursor + 1],
        baseType: 0x0d,
      });
      cursor += 3;
    }
  }

  return {
    definition: { globalMessage, bigEndian, fields, developerFields },
    nextOffset: cursor,
  };
}

function readFieldValue(
  bytes: Uint8Array,
  offset: number,
  field: FitFieldDefinition,
  bigEndian: boolean,
): FitValue {
  const type = BASE_TYPES[field.baseType];
  if (type == null) {
    // Type inconnu : l'offset avance de `field.size` chez l'appelant, mais la
    // valeur reste nulle. Rendre un octet brut la ferait passer pour une
    // mesure (un faux horodatage si le champ est 253).
    return null;
  }
  if (type.kind === 'string') {
    let end = offset;
    while (end < offset + field.size && bytes[end] !== 0) end += 1;
    return decodeUtf8(bytes, offset, end);
  }
  if (type.kind === 'float') {
    if (field.size < type.size) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const value = type.size === 4
      ? view.getFloat32(offset, !bigEndian)
      : view.getFloat64(offset, !bigEndian);
    return Number.isFinite(value) ? value : null;
  }
  if (field.size < type.size) return null;

  const count = Math.floor(field.size / type.size);
  if (count > 1) {
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const value = readNumeric(bytes, offset + index * type.size, type, bigEndian);
      if (value == null) return null;
      values.push(value);
    }
    return values;
  }
  return readNumeric(bytes, offset, type, bigEndian);
}

function readNumeric(
  bytes: Uint8Array,
  offset: number,
  type: BaseTypeInfo,
  bigEndian: boolean,
): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let raw: number;
  let signed = type.kind === 'signed';

  if (type.size === 1) {
    raw = bytes[offset];
    if (signed && raw > 0x7f) raw -= 0x100;
  } else if (type.size === 2) {
    raw = view.getUint16(offset, !bigEndian);
    if (signed && raw > 0x7fff) raw -= 0x10000;
  } else if (type.size === 4) {
    raw = view.getUint32(offset, !bigEndian);
    if (signed && raw > 0x7fffffff) raw -= 0x100000000;
  } else {
    const value = view.getBigUint64(offset, !bigEndian);
    if (typeof type.invalid === 'bigint' && value === type.invalid) return null;
    if (signed && value > SINT64_MAX) return Number(value - SINT64_MODULUS);
    return Number(value);
  }

  if (type.invalid != null && raw === type.invalid) return null;
  return raw;
}

function normalizeField(message: FitMessage | null | undefined, fieldNumber: number): number | string | null {
  if (message == null) return null;
  const spec = FIT_MESSAGE_SPECS[message.globalMessage]?.[fieldNumber];
  const raw = message.fields[fieldNumber];
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return null;

  if (typeof value === 'string') return value.trim().length > 0 ? value.trim() : null;
  if (spec?.kind === 'timestamp') return timestampIso(value);
  if (spec?.kind === 'semicircle') return value * (180 / 2 ** 31);
  if (spec?.kind === 'enum') return spec.enumMap?.[value] ?? String(value);

  let result = value;
  if (spec?.scale != null) result /= spec.scale;
  if (spec?.offset != null) result -= spec.offset;
  return result;
}

function recordToPoint(record: FitMessage): NormalizedTrackPoint | null {
  const recordedAt = timestampIsoField(record, 253);
  const latitudeDeg = valueAsNumber(record, 0);
  const longitudeDeg = valueAsNumber(record, 1);
  const altitudeM = valueAsNumber(record, 78) ?? valueAsNumber(record, 2);
  const distanceM = valueAsNumber(record, 5);
  const speedMps = valueAsNumber(record, 73) ?? valueAsNumber(record, 6);
  const heartRateBpm = valueAsNumber(record, 3);
  const cadenceRaw = valueAsNumber(record, 4);
  const powerW = valueAsNumber(record, 7);
  const temperatureC = valueAsNumber(record, 13);

  const point: NormalizedTrackPoint = {
    recordedAt,
    recordedAtLocal: null,
    timeOffset: recordedAt == null ? null : 'Z',
    latitudeDeg,
    longitudeDeg,
    altitudeM,
    distanceM,
    speedMps,
    heartRateBpm,
    cadenceRpm: cadenceRaw,
    runCadenceSpm: null,
    powerW,
    temperatureC,
    lapIndex: 0,
    trackIndex: 0,
  };

  const empty = recordedAt == null
    && latitudeDeg == null
    && longitudeDeg == null
    && altitudeM == null
    && distanceM == null
    && speedMps == null
    && heartRateBpm == null
    && cadenceRaw == null
    && powerW == null
    && temperatureC == null;
  if (empty) return null;
  return point;
}

function lapMessageToLap(
  message: FitMessage,
  index: number,
  points: NormalizedTrackPoint[],
): NormalizedTraceLap {
  const firstPointIndex = points.findIndex((point) => point.lapIndex === index);
  const pointCount = points.filter((point) => point.lapIndex === index).length;
  const startedAt = timestampIsoField(message, 2);
  const lap: NormalizedTraceLap = {
    index,
    startedAt,
    startedAtLocal: null,
    elapsedSeconds: valueAsNumber(message, 7) ?? valueAsNumber(message, 8),
    distanceM: valueAsNumber(message, 9),
    maxSpeedMps: valueAsNumber(message, 14),
    caloriesKcal: valueAsNumber(message, 11),
    averageHeartRateBpm: valueAsNumber(message, 15),
    maxHeartRateBpm: valueAsNumber(message, 16),
    averageCadenceRpm: valueAsNumber(message, 17),
    averageCadenceSpm: null,
    intensity: textField(message, 20),
    triggerMethod: textField(message, 24),
    firstPointIndex: firstPointIndex >= 0 ? firstPointIndex : null,
    pointCount,
    tracks: pointCount > 0 && firstPointIndex >= 0
      ? [{ index: 0, firstPointIndex, pointCount }]
      : [],
  };
  return lap;
}

function sessionToLap(
  session: FitMessage | null,
  points: NormalizedTrackPoint[],
): NormalizedTraceLap {
  const elapsedSeconds = session == null
    ? null
    : valueAsNumber(session, 7) ?? valueAsNumber(session, 8);
  const startedAt = timestampIsoField(session, 2);
  return {
    index: 0,
    startedAt,
    startedAtLocal: null,
    elapsedSeconds,
    distanceM: valueAsNumber(session, 9),
    maxSpeedMps: valueAsNumber(session, 15),
    caloriesKcal: valueAsNumber(session, 11),
    averageHeartRateBpm: valueAsNumber(session, 16),
    maxHeartRateBpm: valueAsNumber(session, 17),
    averageCadenceRpm: valueAsNumber(session, 18),
    averageCadenceSpm: null,
    intensity: null,
    triggerMethod: null,
    firstPointIndex: points.length > 0 ? 0 : null,
    pointCount: points.length,
    tracks: points.length > 0 ? [{ index: 0, firstPointIndex: 0, pointCount: points.length }] : [],
  };
}

function endFromLap(lap: NormalizedTraceLap | undefined): string | null {
  if (lap == null || lap.startedAt == null || lap.elapsedSeconds == null) return null;
  const timestamp = Date.parse(lap.startedAt) + lap.elapsedSeconds * 1000;
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function timestampIsoField(message: FitMessage | null | undefined, field: number): string | null {
  const seconds = timestampSeconds(message, field);
  return seconds == null ? null : timestampIso(seconds);
}

function timestampSeconds(message: FitMessage | null | undefined, field: number): number | null {
  // Les champs d'horodatage sont lus bruts : `normalizeField` les convertit en
  // ISO, alors que le calcul FIT a besoin des secondes depuis l'époque FIT.
  return numberField(message, field);
}

function timestampIso(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 0xffffffff) return null;
  const milliseconds = (seconds + FIT_EPOCH_SECONDS) * 1000;
  if (Math.abs(milliseconds) > 8.64e15) return null;
  return new Date(milliseconds).toISOString();
}

function valueAsNumber(message: FitMessage | null | undefined, field: number): number | null {
  const value = normalizeField(message, field);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberField(message: FitMessage | null | undefined, field: number): number | null {
  const raw = message?.fields[field];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textField(message: FitMessage | null | undefined, field: number): string | null {
  const value = normalizeField(message, field);
  return typeof value === 'string' ? value : null;
}

function asNumber(value: FitValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'number' && Number.isFinite(first) ? first : null;
  }
  return null;
}

function hasOutOfOrderFits(points: NormalizedTrackPoint[]): boolean {
  let last = Number.NEGATIVE_INFINITY;
  let outOfOrder = false;
  for (const point of points) {
    if (point.recordedAt == null) continue;
    const key = civilTimeKey(point.recordedAt.slice(0, 19)) ?? Date.parse(point.recordedAt);
    if (!Number.isFinite(key)) continue;
    if (key < last) outOfOrder = true;
    last = Math.max(last, key);
  }
  return outOfOrder;
}

function readAscii(bytes: Uint8Array, start: number, end: number): string {
  let result = '';
  for (let index = start; index < end; index += 1) result += String.fromCharCode(bytes[index]);
  return result;
}

function decodeUtf8(bytes: Uint8Array, start: number, end: number): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes.subarray(start, end));
  let result = '';
  for (let index = start; index < end; index += 1) result += String.fromCharCode(bytes[index]);
  return result;
}

function readUint16(bytes: Uint8Array, offset: number, bigEndian: boolean): number {
  return bigEndian
    ? (bytes[offset] << 8) | bytes[offset + 1]
    : bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number, bigEndian: boolean): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, !bigEndian);
}

/** CRC-16/ARC, utilisée par l'en-tête et la fin de fichier FIT. */
export function crc16(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0;
  for (let index = start; index < end; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed != null && trimmed.length > 0 ? trimmed : null;
}
