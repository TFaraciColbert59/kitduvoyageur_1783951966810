import {
  type NormalizedTraceImport,
  type NormalizedTraceLap,
  type NormalizedTraceTrack,
  type NormalizedTrackPoint,
  type TraceImportIssue,
  type TraceImportIssueCode,
  type TraceImportOptions,
  type TraceIgnoredSection,
  TraceImportError,
  resolveTraceImportLimits,
  utf8ByteLength,
} from './model';
import { sha256Hex } from './fingerprint';
import { computeAvailableMetrics, computeBounds } from './stats';
import { civilTimeKey, instantTimeKey, parseTraceTime, type ParsedTraceTime } from './time';
import { scanSafeXml } from './xml';

const TCX_V1_NAMESPACE = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v1';
const TCX_V2_NAMESPACE = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';
const ACTIVITY_EXTENSION_V2_NAMESPACE =
  'http://www.garmin.com/xmlschemas/ActivityExtension/v2';

/** Sections TCX valides mais hors du périmètre « une activité » de cet import. */
const IGNORED_SECTIONS = new Set(['Courses', 'Workouts', 'Folders', 'Notes', 'Training']);

/** Sports TCX dont `<Cadence>` est une cadence de course/marche (pas/min). */
const RUNNING_SPORTS = new Set([
  'running',
  'trail_running',
  'walking',
  'hiking',
  'mountaineering',
  'snowshoeing',
]);

/** Sports TCX dont `<Cadence>` est une cadence vélo (tours/min). */
const CYCLING_SPORTS = new Set([
  'biking',
  'cycling',
  'e_biking',
  'mountain_biking',
  'road_biking',
  'indoor_cycling',
]);

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Lit un document TCX 2 local et rend un modèle normalisé commun avec l'import
 * FIT. Aucun DOM, aucune entité externe, aucune écriture.
 *
 * Périmètre volontairement borné :
 * - seul le namespace TCX v2 est accepté ; TCX v1 est refusé explicitement ;
 * - tous les noms sont résolus par namespace : un élément TCX dans un autre
 *   namespace est ignoré, jamais interprété comme une donnée TCX ;
 * - une seule `<Activity>` par fichier : plusieurs activités et toute
 *   `<MultiSportSession>` sont refusées explicitement (`multiple-activities`)
 *   au lieu d'être fusionnées silencieusement ;
 * - structure contrôlée `Activities > Activity > Lap > Track > Trackpoint` ;
 *   `Courses`, `Workouts`, `Folders`, `Notes`, `Training` et les `Extensions`
 *   hors `TPX` sont ignorés, signalés dans `provenance.ignoredSections` et par
 *   une alerte `ignored-section` ;
 * - plusieurs `<Track>` sont conservés dans un même `<Lap>` (segmentation XSD),
 *   avec `trackIndex` sur chaque point et `tracks` sur le tour ;
 * - `<Cadence>` est rangée selon `Activity@Sport` : `runCadenceSpm` pour la
 *   course/marche, `cadenceRpm` pour le vélo ; les autres sports sont signalés
 *   au lieu de recevoir une unité fausse ;
 * - la fin d'un lap (`StartTime + TotalTimeSeconds`) alimente `endedAt` /
 *   `endedAtLocal`, même sans trackpoint ou quand le dernier point précède la
 *   fin réelle du lap ;
 * - les activités sans `<Position>` restent lisibles et conservent leurs
 *   bornes d'altitude ;
 * - un `xsd:dateTime` sans fuseau reste une heure civile locale : il est
 *   conservé dans `recordedAtLocal` / `startedAtLocal`, aucun instant UTC n'est
 *   inventé, et une alerte `unqualified-time` le signale ;
 * - les `<Trackpoint>` sans aucune mesure sont ignorés et signalés.
 *
 * - fichier complet : `status: 'complete'` ;
 * - fichier coupé dans la dernière balise : les points/tours entièrement lus
 *   sont conservés, `status: 'truncated'` et une alerte `truncated` sont posés ;
 * - XML invalide, mauvaise racine, namespace/version non pris en charge,
 *   activité absente, structure invalide ou borne dépassée :
 *   `TraceImportError` avec un code stable.
 */
export function parseTcx(
  xml: string,
  options: TraceImportOptions = {},
): NormalizedTraceImport {
  if (typeof xml !== 'string') {
    throw new TraceImportError('invalid-input', 'Le contenu TCX doit être une chaîne.');
  }
  if (xml.trim().length === 0) {
    throw new TraceImportError('invalid-input', 'Le contenu TCX est vide.');
  }

  const limits = resolveTraceImportLimits(options);
  const byteLength = typeof options.sourceByteLength === 'number'
    && Number.isFinite(options.sourceByteLength)
    && options.sourceByteLength >= 0
    ? Math.floor(options.sourceByteLength)
    : utf8ByteLength(xml);
  if (byteLength > limits.maxBytes) {
    throw new TraceImportError(
      'file-too-large',
      `Fichier TCX de ${byteLength} octets, borne ${limits.maxBytes}.`,
    );
  }

  const points: NormalizedTrackPoint[] = [];
  const laps: NormalizedTraceLap[] = [];
  const issues: TraceImportIssue[] = [];
  const path: string[] = [];
  const textStack: string[] = [];
  const ignoredSections: TraceIgnoredSection[] = [];
  const instantTimestamps: string[] = [];
  const localTimestamps: string[] = [];
  const lapEndInstants: string[] = [];
  const lapEndLocals: string[] = [];
  const extensionScopes: Array<{ depth: number; ignored: number }> = [];
  const ignoredSectionByName = new Map<string, TraceIgnoredSection>();

  // Une section est nommée, jamais répétée : `Extensions` peut apparaître à
  // chaque trackpoint. Agréger par nom conserve le volume exact tout en
  // bornant la provenance au nombre de noms de sections connus.
  const recordIgnoredSection = (name: string, elementCount: number): TraceIgnoredSection => {
    const existing = ignoredSectionByName.get(name);
    if (existing != null) {
      existing.elementCount += elementCount;
      return existing;
    }
    const section = { name, elementCount };
    ignoredSectionByName.set(name, section);
    ignoredSections.push(section);
    return section;
  };

  let issueLimitReported = false;
  let activitiesDepth: number | null = null;
  let activitiesSeen = false;
  let activityDepth: number | null = null;
  let activitySeen = false;
  let activityIdTime: ParsedTraceTime | null = null;
  let activityLapCount = 0;
  let sport: string | null = null;
  let rootNamespace: string | null = null;
  let ignoredSectionDepth: number | null = null;
  let ignoredSection: TraceIgnoredSection | null = null;
  let lapDepth: number | null = null;
  let currentLap: NormalizedTraceLap | null = null;
  let trackDepth: number | null = null;
  let currentTrack: NormalizedTraceTrack | null = null;
  let trackIndex = -1;
  let pointDepth: number | null = null;
  let currentPoint: NormalizedTrackPoint | null = null;
  let extensionsDepth: number | null = null;
  let positionDepth: number | null = null;
  let pointHeartRateDepth: number | null = null;
  let averageHeartRateDepth: number | null = null;
  let maximumHeartRateDepth: number | null = null;
  let currentPointCadence: number | null = null;
  let currentLapCadence: number | null = null;
  let unmappedPointCadence = 0;
  let unmappedLapCadence = 0;
  let tpxDepth: number | null = null;
  let tpxNamespace: string | null = null;
  let activityCreatorDepth: number | null = null;
  let activityCreatorSeen = false;
  let activityCreatorName: string | null = null;
  let activityCreatorProductId: string | null = null;
  let authorDepth: number | null = null;
  let authorSeen = false;
  let authorName: string | null = null;
  let authorProductId: string | null = null;
  let mixedTimeReported = false;

  const scanned = scanSafeXml(
    xml,
    {
      open(element, attributes, _selfClosing, depth) {
        const { localName, namespaceURI } = element;
        const tcx = namespaceURI === TCX_V2_NAMESPACE;
        path.push(localName);
        textStack.push('');

        if (depth === 1) {
          if (localName !== 'TrainingCenterDatabase') {
            throw new TraceImportError(
              'not-tcx',
              `Racine « ${excerpt(localName)} » inconnue : un TCX commence par TrainingCenterDatabase.`,
            );
          }
          if (namespaceURI == null) {
            throw new TraceImportError(
              'not-tcx',
              'Namespace TCX absent : la racine doit déclarer TrainingCenterDatabase/v2.',
            );
          }
          if (namespaceURI === TCX_V1_NAMESPACE) {
            throw new TraceImportError(
              'unsupported-version',
              'TCX v1 n’est pas pris en charge : seul le namespace TrainingCenterDatabase/v2 est accepté.',
            );
          }
          if (namespaceURI !== TCX_V2_NAMESPACE) {
            throw new TraceImportError(
              'not-tcx',
              `Namespace « ${excerpt(namespaceURI)} » inconnu : seul TrainingCenterDatabase/v2 est accepté.`,
            );
          }
          rootNamespace = namespaceURI;
        }

        // Sections hors périmètre : tout leur sous-arbre est ignoré, y compris
        // les Lap/Track/Trackpoint de Course et les Creator de parcours. Le
        // sous-arbre est compté pour pouvoir le signaler sans le lire.
        if (ignoredSection != null) {
          ignoredSection.elementCount += 1;
          return;
        }
        if (tcx && depth > 1 && IGNORED_SECTIONS.has(localName)) {
          ignoredSectionDepth = depth;
          ignoredSection = recordIgnoredSection(localName, 0);
          return;
        }

        // Les extensions hors TPX (par exemple LX) ne sont pas interprétées :
        // leur sous-arbre est compté pour être signalé, sans compter TPX ni
        // ses enfants, qui sont lus.
        if (tcx && localName === 'Extensions') {
          extensionScopes.push({ depth, ignored: 0 });
        } else if (extensionScopes.length > 0) {
          const recognizedTpx = localName === 'TPX'
            && pointDepth != null
            && namespaceURI === ACTIVITY_EXTENSION_V2_NAMESPACE
            && (isDirectChild(extensionsDepth, depth) || isDirectChild(pointDepth, depth));
          if (!recognizedTpx && tpxDepth == null) {
            extensionScopes[extensionScopes.length - 1].ignored += 1;
          }
        }

        if (tcx && localName === 'TrainingCenterDatabase' && depth > 1) {
          throw new TraceImportError(
            'invalid-structure',
            'Un document TCX ne peut contenir qu’un seul élément racine.',
          );
        }

        if (tcx && localName === 'Activities') {
          if (depth !== 2 || activitiesDepth != null || activitiesSeen) {
            throw new TraceImportError(
              'invalid-structure',
              'L’élément Activities doit être l’unique enfant direct de TrainingCenterDatabase.',
            );
          }
          activitiesSeen = true;
          activitiesDepth = depth;
        }

        if (tcx && localName === 'MultiSportSession') {
          if (activitiesDepth == null || depth !== activitiesDepth + 1) {
            throw new TraceImportError(
              'invalid-structure',
              'Une MultiSportSession doit être un enfant direct de Activities.',
            );
          }
          throw new TraceImportError(
            'multiple-activities',
            'Le fichier TCX contient une MultiSportSession (plusieurs sports) : la fusion silencieuse est refusée.',
          );
        }

        if (tcx && localName === 'Activity') {
          if (
            activitiesDepth == null
            || depth !== activitiesDepth + 1
            || activityDepth != null
          ) {
            throw new TraceImportError(
              'invalid-structure',
              'Une Activity doit être un enfant direct de Activities, sans imbrication.',
            );
          }
          if (activitySeen) {
            throw new TraceImportError(
              'multiple-activities',
              'Le fichier TCX contient plusieurs activités : la fusion silencieuse est refusée.',
            );
          }

          activitySeen = true;
          activityDepth = depth;
          activityLapCount = 0;
          sport = attributes.Sport?.trim() || null;
        }

        if (tcx && localName === 'Lap') {
          if (activityDepth == null || depth !== activityDepth + 1 || lapDepth != null) {
            throw new TraceImportError(
              'invalid-structure',
              'Un Lap doit être un enfant direct d’Activity, sans imbrication.',
            );
          }
          lapDepth = depth;
          trackIndex = -1;
          currentLap = createLap(
            laps.length,
            readTime(attributes.StartTime, 'Lap@StartTime'),
          );
        }

        if (tcx && localName === 'Track') {
          if (lapDepth == null || depth !== lapDepth + 1 || trackDepth != null) {
            throw new TraceImportError(
              'invalid-structure',
              'Un Track doit être un enfant direct de Lap, sans imbrication.',
            );
          }
          // Un Lap peut contenir plusieurs Track (maxOccurs="unbounded").
          trackDepth = depth;
          trackIndex += 1;
          currentTrack = { index: trackIndex, firstPointIndex: null, pointCount: 0 };
          currentLap?.tracks.push(currentTrack);
        }

        if (tcx && localName === 'Trackpoint') {
          if (trackDepth == null || depth !== trackDepth + 1 || pointDepth != null) {
            throw new TraceImportError(
              'invalid-structure',
              'Un Trackpoint doit être un enfant direct de Track, sans imbrication.',
            );
          }
          pointDepth = depth;
          currentPoint = {
            recordedAt: null,
            recordedAtLocal: null,
            timeOffset: null,
            latitudeDeg: null,
            longitudeDeg: null,
            altitudeM: null,
            distanceM: null,
            speedMps: null,
            heartRateBpm: null,
            cadenceRpm: null,
            runCadenceSpm: null,
            powerW: null,
            temperatureC: null,
            lapIndex: currentLap?.index ?? 0,
            trackIndex: currentTrack?.index ?? 0,
          };
        }

        // Provenance : uniquement le Creator direct de l'Activity, avec repli
        // sur l'Author direct de la racine. Un Creator de Course ou d'extension
        // ne peut donc plus écraser la provenance de l'activité.
        if (
          tcx
          && localName === 'Creator'
          && isDirectChild(activityDepth, depth)
          && !activityCreatorSeen
        ) {
          activityCreatorDepth = depth;
          activityCreatorSeen = true;
        }
        if (
          tcx
          && localName === 'Author'
          && depth === 2
          && rootNamespace === TCX_V2_NAMESPACE
          && !authorSeen
        ) {
          authorDepth = depth;
          authorSeen = true;
        }

        if (tcx && localName === 'Extensions' && isDirectChild(pointDepth, depth)) {
          extensionsDepth = depth;
        }
        if (tcx && localName === 'Position' && isDirectChild(pointDepth, depth)) {
          positionDepth = depth;
        }
        if (tcx && localName === 'HeartRateBpm' && isDirectChild(pointDepth, depth)) {
          pointHeartRateDepth = depth;
        }
        if (tcx && localName === 'AverageHeartRateBpm' && isDirectChild(lapDepth, depth)) {
          averageHeartRateDepth = depth;
        }
        if (tcx && localName === 'MaximumHeartRateBpm' && isDirectChild(lapDepth, depth)) {
          maximumHeartRateDepth = depth;
        }
        if (
          localName === 'TPX'
          && pointDepth != null
          && namespaceURI === ACTIVITY_EXTENSION_V2_NAMESPACE
          && (isDirectChild(extensionsDepth, depth) || isDirectChild(pointDepth, depth))
        ) {
          tpxDepth = depth;
          tpxNamespace = namespaceURI;
        }
      },

      close(element, depth) {
        const { localName, namespaceURI } = element;
        const tcx = namespaceURI === TCX_V2_NAMESPACE;
        const value = textStack.pop() ?? '';
        const at = path.join('/');

        if (ignoredSection != null) {
          if (depth === ignoredSectionDepth) {
            addIssue(
              'ignored-section',
              `Section TCX « ${ignoredSection.name} » ignorée (${ignoredSection.elementCount} éléments non pris en charge).`,
              at,
            );
            ignoredSectionDepth = null;
            ignoredSection = null;
          }
          path.pop();
          return;
        }

        if (tcx && isDirectChild(activityCreatorDepth, depth)) {
          if (localName === 'Name') activityCreatorName = clean(value);
          else if (localName === 'ProductID') activityCreatorProductId = clean(value);
        }
        if (tcx && isDirectChild(authorDepth, depth)) {
          if (localName === 'Name') authorName = clean(value);
          else if (localName === 'ProductID') authorProductId = clean(value);
        }

        if (tcx && isDirectChild(activityDepth, depth) && localName === 'Id') {
          activityIdTime ??= readTime(value, at);
        }

        if (tcx && isDirectChild(lapDepth, depth) && currentLap != null) {
          if (localName === 'TotalTimeSeconds') currentLap.elapsedSeconds = readNonNegativeNumber(value, at);
          else if (localName === 'DistanceMeters') currentLap.distanceM = readNonNegativeNumber(value, at);
          else if (localName === 'MaximumSpeed') currentLap.maxSpeedMps = readNonNegativeNumber(value, at);
          else if (localName === 'Calories') currentLap.caloriesKcal = readNonNegativeNumber(value, at);
          else if (localName === 'Intensity') currentLap.intensity = clean(value);
          else if (localName === 'Cadence') currentLapCadence = readNonNegativeNumber(value, at);
          else if (localName === 'TriggerMethod') currentLap.triggerMethod = clean(value);
        }

        if (tcx && isDirectChild(pointDepth, depth) && currentPoint != null) {
          if (localName === 'Time') {
            const parsed = readTime(value, at);
            if (parsed != null) {
              currentPoint.recordedAt = parsed.instant;
              currentPoint.recordedAtLocal = parsed.local;
              currentPoint.timeOffset = parsed.offset;
            }
          } else if (localName === 'AltitudeMeters') currentPoint.altitudeM = readNumber(value, at);
          else if (localName === 'DistanceMeters') currentPoint.distanceM = readNonNegativeNumber(value, at);
          else if (localName === 'Cadence') currentPointCadence = readNonNegativeNumber(value, at);
          else if (localName === 'Temperature') currentPoint.temperatureC = readNumber(value, at);
        }

        if (tcx && isDirectChild(positionDepth, depth) && currentPoint != null) {
          if (localName === 'LatitudeDegrees') {
            currentPoint.latitudeDeg = readNumber(value, at);
          } else if (localName === 'LongitudeDegrees') {
            currentPoint.longitudeDeg = readNumber(value, at);
          }
        }

        if (
          tcx
          && isDirectChild(pointHeartRateDepth, depth)
          && currentPoint != null
          && localName === 'Value'
        ) {
          currentPoint.heartRateBpm = readNonNegativeNumber(value, at);
        }
        if (
          tcx
          && isDirectChild(averageHeartRateDepth, depth)
          && currentLap != null
          && localName === 'Value'
        ) {
          currentLap.averageHeartRateBpm = readNonNegativeNumber(value, at);
        }
        if (
          tcx
          && isDirectChild(maximumHeartRateDepth, depth)
          && currentLap != null
          && localName === 'Value'
        ) {
          currentLap.maxHeartRateBpm = readNonNegativeNumber(value, at);
        }

        if (
          isDirectChild(tpxDepth, depth)
          && tpxNamespace === namespaceURI
          && currentPoint != null
        ) {
          if (localName === 'Speed') currentPoint.speedMps = readNonNegativeNumber(value, at);
          else if (localName === 'Watts') currentPoint.powerW = readNonNegativeNumber(value, at);
          else if (localName === 'RunCadence') currentPoint.runCadenceSpm = readNonNegativeNumber(value, at);
          else if (localName === 'Temperature') currentPoint.temperatureC = readNumber(value, at);
        }

        if (tcx && localName === 'Extensions' && extensionScopes.length > 0) {
          const scope = extensionScopes[extensionScopes.length - 1];
          if (scope.depth === depth) {
            extensionScopes.pop();
            if (scope.ignored > 0) {
              recordIgnoredSection('Extensions', scope.ignored);
              addIssue(
                'ignored-section',
                `Extensions TCX hors TPX ignorées (${scope.ignored} éléments non interprétés).`,
                at,
              );
            }
          }
        }
        if (tcx && localName === 'Extensions' && extensionsDepth === depth) {
          extensionsDepth = null;
        }
        if (tcx && localName === 'Position' && positionDepth === depth) {
          if (currentPoint != null) validatePosition(currentPoint, at);
          positionDepth = null;
        }
        if (tcx && localName === 'HeartRateBpm' && pointHeartRateDepth === depth) {
          pointHeartRateDepth = null;
        }
        if (tcx && localName === 'AverageHeartRateBpm' && averageHeartRateDepth === depth) {
          averageHeartRateDepth = null;
        }
        if (tcx && localName === 'MaximumHeartRateBpm' && maximumHeartRateDepth === depth) {
          maximumHeartRateDepth = null;
        }
        if (tcx && localName === 'TPX' && tpxDepth === depth) {
          tpxDepth = null;
          tpxNamespace = null;
        }
        if (tcx && localName === 'Creator' && activityCreatorDepth === depth) {
          activityCreatorDepth = null;
        }
        if (tcx && localName === 'Author' && authorDepth === depth) {
          authorDepth = null;
        }

        if (tcx && localName === 'Trackpoint' && pointDepth === depth) {
          finalizePoint(at);
          pointDepth = null;
          currentPoint = null;
        }
        if (tcx && localName === 'Track' && trackDepth === depth) {
          // Fin d'un Track : le Lap peut en contenir un autre.
          trackDepth = null;
          currentTrack = null;
        }
        if (tcx && localName === 'Lap' && lapDepth === depth) {
          finalizeLap(at);
          lapDepth = null;
          currentLap = null;
          currentTrack = null;
          trackIndex = -1;
          activityLapCount += 1;
        }
        if (tcx && localName === 'Activity' && activityDepth === depth) {
          if (activityLapCount === 0) {
            throw new TraceImportError(
              'invalid-structure',
              'Une Activity TCX doit contenir au moins un Lap.',
            );
          }
          activityDepth = null;
        }
        if (tcx && localName === 'Activities' && activitiesDepth === depth) {
          activitiesDepth = null;
        }

        // Le scanner a déjà vérifié que le nom qualifié de fermeture
        // correspond exactement à l'ouverture, préfixe compris.
        path.pop();
      },

      text(value) {
        if (textStack.length > 0) textStack[textStack.length - 1] += value;
      },
    },
    { maxDepth: limits.maxDepth },
  );

  if (scanned.rootName == null) {
    throw new TraceImportError('invalid-xml', 'Élément racine TCX absent.');
  }
  if (scanned.rootName !== 'TrainingCenterDatabase') {
    throw new TraceImportError(
      'not-tcx',
      `Racine « ${scanned.rootName} » inconnue : un TCX commence par TrainingCenterDatabase.`,
    );
  }
  if (rootNamespace == null) {
    throw new TraceImportError(
      'not-tcx',
      'Namespace TCX absent : la racine doit déclarer TrainingCenterDatabase/v2.',
    );
  }
  if (!activitySeen) {
    const ignored = ignoredSections.map((section) => section.name).join(', ');
    throw new TraceImportError(
      'no-activity',
      ignored.length > 0
        ? `Aucune activité TCX à importer ; sections non prises en charge trouvées : ${ignored}.`
        : 'Aucune activité TCX à importer.',
    );
  }

  // TypeScript ne suit pas les mutations faites dans les callbacks du
  // scanner : ces deux lectures sont donc explicitées.
  const pendingIgnoredSection = ignoredSection as TraceIgnoredSection | null;
  const activityId = activityIdTime as ParsedTraceTime | null;

  if (scanned.truncated) {
    // Le point ouvert au moment de la coupure est incomplet : il est écarté.
    currentPoint = null;
    pointDepth = null;
    if (currentLap != null) finalizeLap('$');
    addIssue('truncated', 'Le fichier TCX se termine avant la fermeture de la racine.', '$');
    if (pendingIgnoredSection != null) {
      addIssue(
        'ignored-section',
        `Section TCX « ${pendingIgnoredSection.name} » ignorée (${pendingIgnoredSection.elementCount} éléments non pris en charge).`,
        '$',
      );
      ignoredSection = null;
      ignoredSectionDepth = null;
    }
  }

  const hasInstantTime = instantTimestamps.length > 0
    || activityId?.instant != null
    || laps.some((lap) => lap.startedAt != null);
  const hasLocalTime = localTimestamps.length > 0
    || activityId?.local != null
    || laps.some((lap) => lap.startedAtLocal != null);
  if (hasLocalTime) {
    addIssue(
      'unqualified-time',
      'Horodatage sans fuseau conservé en heure locale : aucun instant UTC n’a été inventé (voir startedAtLocal / recordedAtLocal).',
      '$',
    );
  }
  if (hasInstantTime && hasLocalTime && !mixedTimeReported) {
    mixedTimeReported = true;
    addIssue(
      'mixed-time-zones',
      'Le fichier mélange des horodatages avec et sans fuseau : les instants et les heures locales ne sont pas comparés entre eux.',
      '$',
    );
  }
  if (hasOutOfOrderTime(points)) {
    addIssue(
      'time-out-of-order',
      'Les horodatages ne sont pas strictement croissants dans l’ordre du document.',
      '$',
    );
  }
  if (unmappedPointCadence > 0 || unmappedLapCadence > 0) {
    addIssue(
      'unsupported-feature',
      `Cadence TCX non interprétée pour le sport « ${sport ?? 'inconnu'} » : unité non couverte (${unmappedPointCadence} points, ${unmappedLapCadence} tours).`,
      '$',
    );
  }

  const startedAt = activityId?.instant
    ?? earliestIso(instantTimestamps)
    ?? laps[0]?.startedAt
    ?? null;
  const startedAtLocal = activityId?.local
    ?? earliestLocal(localTimestamps)
    ?? laps[0]?.startedAtLocal
    ?? null;
  const endedAt = latestIso([...instantTimestamps, ...lapEndInstants]);
  const endedAtLocal = latestLocal([...localTimestamps, ...lapEndLocals]);
  const timeBasis: NormalizedTraceImport['provenance']['timeBasis'] =
    hasInstantTime && hasLocalTime
      ? 'mixed'
      : hasInstantTime
        ? 'utc'
        : hasLocalTime
          ? 'local'
          : 'none';

  // Le repli de provenance se fait au niveau de l'unité : un Creator
  // d'Activity, même partiel, ne se mélange pas avec l'Author de la racine.
  const creator = activityCreatorSeen ? activityCreatorName : authorName;
  const productId = activityCreatorSeen ? activityCreatorProductId : authorProductId;

  return {
    status: scanned.truncated ? 'truncated' : 'complete',
    provenance: {
      format: 'tcx',
      source: 'local-file',
      fileName: clean(options.fileName),
      byteLength,
      schema: rootNamespace,
      creator,
      productId,
      serialNumber: null,
      fileCreatedAt: null,
      sport,
      startedAt,
      endedAt,
      startedAtLocal,
      endedAtLocal,
      timeBasis,
      ignoredSections,
      fingerprint: `sha256:${sha256Hex(xml)}`,
    },
    bounds: computeBounds(points),
    points,
    laps,
    summary: null,
    availableMetrics: computeAvailableMetrics(points, laps, hasInstantTime || hasLocalTime),
    issues,
  };

  function createLap(index: number, startTime: ParsedTraceTime | null): NormalizedTraceLap {
    return {
      index,
      origin: 'device',
      startedAt: startTime?.instant ?? null,
      startedAtLocal: startTime?.local ?? null,
      elapsedSeconds: null,
      distanceM: null,
      maxSpeedMps: null,
      averageSpeedMps: null,
      caloriesKcal: null,
      averageHeartRateBpm: null,
      maxHeartRateBpm: null,
      averageCadenceRpm: null,
      averageCadenceSpm: null,
      maxPowerW: null,
      intensity: null,
      triggerMethod: null,
      firstPointIndex: null,
      pointCount: 0,
      tracks: [],
    };
  }

  function finalizePoint(at: string): void {
    const point = currentPoint;
    if (point == null) return;

    resolvePointCadence(point);

    // Une coordonnée orpheline (Position sans latitude ou sans longitude) ne
    // doit pas devenir un point au large. `validatePosition` a déjà traité le
    // cas d'un Position complet ; ici on protège les documents sans Position.
    if ((point.latitudeDeg == null) !== (point.longitudeDeg == null)) {
      addIssue('missing-position', 'Latitude et longitude doivent être présentes ensemble.', at);
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    }

    // Un Trackpoint vide n'est pas un point : il ne doit ni gonfler le compte
    // de points, ni consommer `maxPoints`, ni créer un trou dans la trace.
    if (isPointEmpty(point)) {
      addIssue('empty-point', 'Trackpoint sans aucune mesure exploitable ignoré.', at);
      return;
    }

    if (points.length >= limits.maxPoints) {
      throw new TraceImportError(
        'too-many-points',
        `Plus de ${limits.maxPoints} points dans le fichier TCX.`,
      );
    }

    if (currentLap != null) {
      if (currentLap.firstPointIndex == null) currentLap.firstPointIndex = points.length;
      currentLap.pointCount += 1;
    }
    if (currentTrack != null) {
      if (currentTrack.firstPointIndex == null) currentTrack.firstPointIndex = points.length;
      currentTrack.pointCount += 1;
    }

    points.push(point);
  }

  function finalizeLap(at: string): void {
    const lap = currentLap;
    if (lap == null) return;

    if (lap.firstPointIndex != null && lap.pointCount > 0) {
      const firstPoint = points[lap.firstPointIndex];
      const lastPoint = points[lap.firstPointIndex + lap.pointCount - 1];
      lap.startedAt ??= firstPoint?.recordedAt ?? null;
      lap.startedAtLocal ??= firstPoint?.recordedAtLocal ?? null;

      if (lap.elapsedSeconds == null) {
        if (lap.startedAt != null && lastPoint?.recordedAt != null) {
          const elapsed = (Date.parse(lastPoint.recordedAt) - Date.parse(lap.startedAt)) / 1000;
          if (Number.isFinite(elapsed)) {
            if (elapsed < 0) {
              addIssue(
                'time-out-of-order',
                'La durée du tour est négative : horodatages incohérents.',
                at,
              );
            } else {
              lap.elapsedSeconds = elapsed;
            }
          }
        } else if (lap.startedAtLocal != null && lastPoint?.recordedAtLocal != null) {
          const start = civilTimeKey(lap.startedAtLocal);
          const end = civilTimeKey(lastPoint.recordedAtLocal);
          if (start != null && end != null) {
            const elapsed = (end - start) / 1000;
            if (elapsed < 0) {
              addIssue(
                'time-out-of-order',
                'La durée du tour est négative : horodatages incohérents.',
                at,
              );
            } else {
              lap.elapsedSeconds = elapsed;
            }
          }
        } else if (
          (lap.startedAt != null && lastPoint?.recordedAtLocal != null)
          || (lap.startedAtLocal != null && lastPoint?.recordedAt != null)
        ) {
          if (!mixedTimeReported) {
            mixedTimeReported = true;
            addIssue(
              'mixed-time-zones',
              'Le tour mélange un début et une fin de conventions temporelles différentes : la durée n’est pas calculée.',
              at,
            );
          }
        }
      }
    }

    resolveLapCadence(lap);

    // La fin d'un lap peut dépasser son dernier point : `TotalTimeSeconds` est
    // la seule source qui donne cette fin. On la conserve pour `endedAt`.
    const lapEndInstant = addSecondsToInstant(lap.startedAt, lap.elapsedSeconds);
    if (lapEndInstant != null) lapEndInstants.push(lapEndInstant);
    const lapEndLocal = addSecondsToCivil(lap.startedAtLocal, lap.elapsedSeconds);
    if (lapEndLocal != null) lapEndLocals.push(lapEndLocal);

    if (isEmptyLap(lap)) {
      addIssue('empty-lap', 'Lap sans aucune mesure exploitable conservé comme tour vide.', at);
    }

    if (laps.length >= limits.maxLaps) {
      throw new TraceImportError(
        'too-many-laps',
        `Plus de ${limits.maxLaps} tours dans le fichier TCX.`,
      );
    }

    laps.push(lap);
  }

  function resolvePointCadence(point: NormalizedTrackPoint): void {
    if (currentPointCadence == null) return;
    const cadence = currentPointCadence;
    currentPointCadence = null;

    if (isRunningSport(sport)) {
      point.runCadenceSpm ??= cadence;
    } else if (isCyclingSport(sport)) {
      point.cadenceRpm = cadence;
    } else {
      unmappedPointCadence += 1;
    }
  }

  function resolveLapCadence(lap: NormalizedTraceLap): void {
    if (currentLapCadence == null) return;
    const cadence = currentLapCadence;
    currentLapCadence = null;

    if (isRunningSport(sport)) {
      lap.averageCadenceSpm = cadence;
    } else if (isCyclingSport(sport)) {
      lap.averageCadenceRpm = cadence;
    } else {
      unmappedLapCadence += 1;
    }
  }

  function validatePosition(point: NormalizedTrackPoint, at: string): void {
    const latitude = point.latitudeDeg;
    const longitude = point.longitudeDeg;

    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null) {
      addIssue('missing-position', 'Latitude et longitude doivent être présentes ensemble.', at);
      point.latitudeDeg = null;
      point.longitudeDeg = null;
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      addIssue(
        'invalid-coordinate',
        `Coordonnée hors bornes (${latitude}, ${longitude}) ignorée.`,
        at,
      );
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    }
  }

  function readNumber(raw: string, at: string): number | null {
    const value = raw.trim();
    if (value.length === 0) return null;
    if (!DECIMAL_NUMBER.test(value)) {
      addIssue('invalid-number', `Valeur numérique invalide « ${excerpt(value)} ».`, at);
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      addIssue('invalid-number', `Valeur numérique invalide « ${excerpt(value)} ».`, at);
      return null;
    }
    return parsed;
  }

  function readNonNegativeNumber(raw: string, at: string): number | null {
    const parsed = readNumber(raw, at);
    if (parsed != null && parsed < 0) {
      addIssue('invalid-number', `Valeur négative interdite (${parsed}).`, at);
      return null;
    }
    return parsed;
  }

  function readTime(raw: string | undefined, at: string): ParsedTraceTime | null {
    const value = raw?.trim();
    if (value == null || value.length === 0) return null;
    const parsed = parseTraceTime(value);
    if (!parsed.ok) {
      if (parsed.reason === 'offset') {
        addIssue(
          'invalid-time-offset',
          `Fuseau horaire hors bornes XSD « ${excerpt(value)} » (attendu de -14:00 à +14:00).`,
          at,
        );
      } else {
        addIssue('invalid-time', `Horodatage invalide « ${excerpt(value)} ».`, at);
      }
      return null;
    }

    if (parsed.value.instant != null) instantTimestamps.push(parsed.value.instant);
    if (parsed.value.local != null) localTimestamps.push(parsed.value.local);
    return parsed.value;
  }

  function addIssue(code: TraceImportIssueCode, message: string, at: string): void {
    // On réserve la dernière entrée à `issue-limit` : la liste ne dépasse
    // jamais `maxIssues`, et le dépassement reste signalé.
    if (issues.length < limits.maxIssues - 1) {
      issues.push({ code, message, path: excerpt(at, 200) });
      return;
    }
    if (!issueLimitReported) {
      issueLimitReported = true;
      issues.push({
        code: 'issue-limit',
        message: `Liste d’alertes bornée à ${limits.maxIssues} entrées.`,
        path: excerpt(at, 200),
      });
    }
  }
}

function isDirectChild(parentDepth: number | null, depth: number): boolean {
  return parentDepth != null && depth === parentDepth + 1;
}

function isEmptyLap(lap: NormalizedTraceLap): boolean {
  return (
    lap.pointCount === 0
    && lap.elapsedSeconds == null
    && lap.distanceM == null
    && lap.maxSpeedMps == null
    && lap.averageSpeedMps == null
    && lap.caloriesKcal == null
    && lap.averageHeartRateBpm == null
    && lap.maxHeartRateBpm == null
    && lap.averageCadenceRpm == null
    && lap.averageCadenceSpm == null
    && lap.intensity == null
    && lap.triggerMethod == null
  );
}

function isRunningSport(sport: string | null): boolean {
  const normalized = sport?.trim().toLowerCase();
  return normalized != null && RUNNING_SPORTS.has(normalized);
}

function isCyclingSport(sport: string | null): boolean {
  const normalized = sport?.trim().toLowerCase();
  return normalized != null && CYCLING_SPORTS.has(normalized);
}

/**
 * Ajoute une durée à un instant UTC. Utilisé pour la fin d'un lap de résumé,
 * quand le dernier point est antérieur à la fin réelle du lap.
 */
function addSecondsToInstant(instant: string | null, seconds: number | null): string | null {
  if (instant == null || seconds == null) return null;
  const start = Date.parse(instant);
  if (!Number.isFinite(start)) return null;
  return isoFromMilliseconds(start + seconds * 1000);
}

/**
 * Ajoute une durée à une heure civile, sans lui inventer de fuseau. La clé
 * civile est manipulée comme une date UTC, puis reformatée sans `Z`.
 */
function addSecondsToCivil(local: string | null, seconds: number | null): string | null {
  if (local == null || seconds == null) return null;
  const start = civilTimeKey(local);
  if (start == null) return null;
  const end = start + seconds * 1000;
  if (!Number.isFinite(end) || Math.abs(end) > 8.64e15) return null;
  const iso = new Date(end).toISOString();
  const hasFraction = local.includes('.') || !Number.isInteger(seconds);
  return hasFraction ? iso.slice(0, 23) : iso.slice(0, 19);
}

function isPointEmpty(point: NormalizedTrackPoint): boolean {
  return (
    point.recordedAt == null
    && point.recordedAtLocal == null
    && point.latitudeDeg == null
    && point.longitudeDeg == null
    && point.altitudeM == null
    && point.distanceM == null
    && point.speedMps == null
    && point.heartRateBpm == null
    && point.cadenceRpm == null
    && point.runCadenceSpm == null
    && point.powerW == null
    && point.temperatureC == null
  );
}

function hasOutOfOrderTime(points: NormalizedTrackPoint[]): boolean {
  let lastInstant = Number.NEGATIVE_INFINITY;
  let lastLocal = Number.NEGATIVE_INFINITY;
  let outOfOrder = false;

  for (const point of points) {
    if (point.recordedAt != null) {
      const key = instantTimeKey(point.recordedAt);
      if (key != null) {
        if (key < lastInstant) outOfOrder = true;
        lastInstant = Math.max(lastInstant, key);
      }
    }
    if (point.recordedAtLocal != null) {
      const key = civilTimeKey(point.recordedAtLocal);
      if (key != null) {
        if (key < lastLocal) outOfOrder = true;
        lastLocal = Math.max(lastLocal, key);
      }
    }
  }

  return outOfOrder;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed != null && trimmed.length > 0 ? trimmed : null;
}

function earliestIso(values: string[]): string | null {
  let earliest = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const timestamp = instantTimeKey(value);
    if (timestamp != null && timestamp < earliest) earliest = timestamp;
  }
  return isoFromMilliseconds(earliest);
}

function latestIso(values: string[]): string | null {
  let latest = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const timestamp = instantTimeKey(value);
    if (timestamp != null && timestamp > latest) latest = timestamp;
  }
  return isoFromMilliseconds(latest);
}

function earliestLocal(values: string[]): string | null {
  let earliest = Number.POSITIVE_INFINITY;
  let selected: string | null = null;
  for (const value of values) {
    const timestamp = civilTimeKey(value);
    if (timestamp != null && timestamp < earliest) {
      earliest = timestamp;
      selected = value;
    }
  }
  return selected;
}

function latestLocal(values: string[]): string | null {
  let latest = Number.NEGATIVE_INFINITY;
  let selected: string | null = null;
  for (const value of values) {
    const timestamp = civilTimeKey(value);
    if (timestamp != null && timestamp > latest) {
      latest = timestamp;
      selected = value;
    }
  }
  return selected;
}

function isoFromMilliseconds(timestamp: number): string | null {
  // Plage valide d'un Date ECMAScript : ±8,64e15 ms.
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) return null;
  return new Date(timestamp).toISOString();
}

function excerpt(value: string, maxLength = 40): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}… (${value.length} caractères)`;
}
