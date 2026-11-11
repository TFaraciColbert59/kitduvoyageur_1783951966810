import {
  type NormalizedTraceImport,
  type TraceImportOptions,
  TraceImportError,
} from './model';

/**
 * Point d'injection prévu pour le décodeur FIT officiel Garmin.
 *
 * Aucun paquet `@garmin/fitsdk` n'est installé dans cette tranche : `parseFit`
 * refuse explicitement un fichier FIT plutôt que de simuler un décodage. Quand
 * le décodeur sera branché, son adaptateur devra :
 *
 * 1. construire `Stream.fromByteArray(bytes)` puis `new Decoder(stream)` ;
 * 2. vérifier `decoder.isFIT()` et `decoder.checkIntegrity()` ;
 * 3. appeler `decoder.read({ applyScaleAndOffset: true,
 *    convertDateTimesToDates: true, convertTypesToStrings: true,
 *    mergeHeartRates: true })` ;
 * 4. convertir les messages listés dans `FIT_SDK_MESSAGE_FIELDS` vers
 *    `NormalizedTraceImport` (unités du modèle, `null` si absent) ;
 * 5. poser `status: 'truncated'` si `errors` est non vide alors que des
 *    messages ont été lus, et `TraceImportError` si rien n'est exploitable.
 */
export interface FitDecoder {
  decode(
    bytes: Uint8Array,
    options?: TraceImportOptions,
  ): NormalizedTraceImport | Promise<NormalizedTraceImport>;
}

/** Options de `Decoder.read()` attendues par l'adaptateur futur. */
export const FIT_SDK_READ_OPTIONS = {
  applyScaleAndOffset: true,
  convertDateTimesToDates: true,
  convertTypesToStrings: true,
  mergeHeartRates: true,
} as const;

/**
 * Champs du SDK officiel `@garmin/fitsdk` à extraire pour alimenter le modèle
 * normalisé. Les clés sont les dictionnaires de `decoder.read().messages` :
 * `recordMesgs`, `lapMesgs`, `sessionMesgs`, `activityMesgs`, `fileIdMesgs`,
 * `deviceInfoMesgs`, `eventMesgs` (profil FIT 21.x).
 *
 * Repères d'unités du SDK :
 * - `positionLat` / `positionLong` restent en semicircles (scale 1) : convertir
 *   avec `semicircles * (180 / 2 ** 31)` puis valider les bornes du modèle ;
 * - `altitude` / `enhancedAltitude` sont en mètres, `distance` en mètres,
 *   `speed` / `enhancedSpeed` en m/s (préférer les champs `enhanced*` quand ils
 *   existent), `heartRate` en bpm, `power` en watts, `temperature` en °C ;
 * - `cadence` est en rpm pour le vélo ; pour la course, la mapper vers
 *   `runCadenceSpm` selon `sport`/`subSport`, sans mélanger les unités ;
 * - `totalTimerTime` et `totalElapsedTime` sont en secondes.
 */
export const FIT_SDK_MESSAGE_FIELDS = {
  fileIdMesgs: [
    'type',
    'manufacturer',
    'product',
    'serialNumber',
    'timeCreated',
    'number',
  ],
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
  activityMesgs: [
    'timestamp',
    'totalTimerTime',
    'numSessions',
    'type',
    'event',
    'eventType',
  ],
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

/**
 * Refus honnête tant que le décodeur officiel n'est pas installé. Le jour du
 * raccordement, cette fonction deviendra l'appel à un `FitDecoder` injecté ;
 * elle ne doit pas devenir un faux parseur.
 */
export function parseFit(
  _bytes: Uint8Array,
  _options: TraceImportOptions = {},
): never {
  throw new TraceImportError(
    'fit-decoder-unavailable',
    'Le décodeur FIT n’est pas branché : aucun fichier FIT n’est lu dans cette tranche.',
  );
}
