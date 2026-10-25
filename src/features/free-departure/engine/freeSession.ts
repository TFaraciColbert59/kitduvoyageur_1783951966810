/**
 * « Partir librement » — mesures, trace et libelles (ecrans 61 et 62).
 *
 * Deux regles gouvernent ce module :
 *
 * 1. **Aucune invention.** Une mesure absente reste absente : elle s'affiche
 *    `—`, jamais `0`. Un `0` affiche est un fait affirme ; un `—` est un fait
 *    honnete.
 * 2. **Aucune note.** Le retour libre n'affiche ni score, ni pourcentage, ni
 *    calories : ce sont des metriques de jeu, pas des mesures de sortie.
 */

import { guessActivity, type ActivityGuess, type FreeSessionSignals } from './activityGuess';

/** Point de trace minimal : ce que la carte sait dessiner. */
export interface TracePoint {
  lat: number;
  lon: number;
}

/**
 * Bornes de la trace persistee.
 *
 * Une sortie de plusieurs heures depasse tres vite quelques milliers de points.
 * On en garde 400 : assez pour dessiner la forme exacte du parcours a l'echelle
 * d'un telephone, assez peu pour tenir dans `localStorage` sans le faire
 * ramer. La carte du hub, elle, lit la trace vive du controleur, jamais celle-ci.
 */
export const MAX_TRACE_POINTS = 400;

/** Ce que `—` signifie partout dans ce module : la mesure n'existe pas. */
export const NO_VALUE = '—';

/* ------------------------------------------------------------------ */
/* Trace                                                               */
/* ------------------------------------------------------------------ */

/**
 * Un couple de coordonnees est-il exploitable ?
 *
 * (0, 0) est le couple neutre renvoye par le traceur : le garder dessinerait un
 * point fictional quelque part dans l'Atlantique. Les valeurs non finies
 * casseraient la carte de facon bien plus grave.
 */
export function isUsableCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    !(lat === 0 && lon === 0)
  );
}

/**
 * Trace nette et bornee, prete a etre dessinee ET persistee.
 *
 * La liste recue n'est jamais modifiee : la fonction en renvoie une nouvelle.
 * Le premier et le dernier point sont toujours conserves — sans eux, la trace
 * perdrait ses extremites, donc le debut et l'arrivee de la sortie.
 */
export function buildTrace(
  points: readonly TracePoint[],
  limit: number = MAX_TRACE_POINTS
): TracePoint[] {
  const usable = points
    .filter((point) => isUsableCoord(point.lat, point.lon))
    .map((point) => ({ lat: point.lat, lon: point.lon }));

  const bound = Number.isFinite(limit) && limit >= 2 ? Math.trunc(limit) : MAX_TRACE_POINTS;
  if (usable.length <= bound) return usable;

  const last = usable.length - 1;
  const step = last / (bound - 1);
  const sampled: TracePoint[] = [];
  for (let index = 0; index < bound; index += 1) {
    const source = usable[Math.min(last, Math.round(index * step))];
    // Un pas non entier peut retomber deux fois sur le meme index : on retire
    // le doublon plutot que de dessiner un point deux fois.
    const previous = sampled[sampled.length - 1];
    if (previous && previous.lat === source.lat && previous.lon === source.lon) continue;
    sampled.push(source);
  }
  return sampled;
}

/**
 * Forme minimale d'un point GPS, telle que la trace en a besoin.
 *
 * On ne depend pas du type du traceur : les deux modules peuvent evoluer
 * chacun de leur cote, tant que le contrat `latitude` / `longitude` tient.
 */
export interface GeoSample {
  latitude: number;
  longitude: number;
}

/**
 * Trace depuis les points bruts du traceur.
 *
 * Sans cet adaptateur, un traceur qui publie `latitude` / `longitude` et un
 * moteur qui attend `lat` / `lon` ne remarquent rien : `buildTrace` filtre
 * des `NaN` et renvoie une liste vide, donc une carte muette et une distance
 * de fin a zero. Le convertisseur est donc explicite, et filtre les points
 * inexploitables au meme endroit que `buildTrace`.
 */
export function toTracePoints(samples: readonly GeoSample[]): TracePoint[] {
  if (!Array.isArray(samples)) return [];
  return buildTrace(
    samples
      .filter(
        (sample) =>
          sample !== null &&
          typeof sample === 'object' &&
          isUsableCoord(sample.latitude, sample.longitude)
      )
      .map((sample) => ({ lat: sample.latitude, lon: sample.longitude }))
  );
}

/* ------------------------------------------------------------------ */
/* Resume fige                                                        */
/* ------------------------------------------------------------------ */

/** Instantane de fin de session : ce que l'ecran 62 relit, meme apres rechargement. */
export interface FreeSessionSummary {
  distanceKm: number;
  durationSeconds: number;
  /** Denivele positif. `0` signifie « capteur absent », pas « plat ». */
  elevationGainM: number;
  averageSpeedKmH: number;
  trace: TracePoint[];
  endedAt: number;
}

export interface SummaryInput {
  distanceKm: number | null;
  durationSeconds: number | null;
  elevationGainM: number | null;
  averageSpeedKmH: number | null;
  positions: readonly TracePoint[];
  endedAt: number | null;
}

/** Un nombre inexploitable devient 0 : c'est une absence, pas une negation. */
function safe(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Fige les mesures de fin de session.
 *
 * La trace est bornee ici et non a l'affichage : c'est ce meme objet qui part
 * dans le stockage local, donc c'est lui qui doit rester lisible par un
 * telephone, pas seulement par la carte.
 */
export function buildSummary(input: SummaryInput): FreeSessionSummary {
  return {
    distanceKm: safe(input.distanceKm),
    durationSeconds: Math.trunc(safe(input.durationSeconds)),
    elevationGainM: safe(input.elevationGainM),
    averageSpeedKmH: safe(input.averageSpeedKmH),
    trace: buildTrace(input.positions),
    endedAt:
      typeof input.endedAt === 'number' && Number.isFinite(input.endedAt) ? input.endedAt : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Mise en forme                                                      */
/* ------------------------------------------------------------------ */

/**
 * Horloge d'ecoulement. `HH:MM:SS` au-dela d'une heure, `MM:SS` en dessous :
 * c'est le format qu'un athlete lit le plus vite, et il n'est jamais ambigu
 * (`12:34` ne peut pas etre lu 12 h 34 comme 12 min 34 dans ce contexte).
 */
export function formatClock(totalSeconds: number | null): string {
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return totalSeconds === null || totalSeconds === undefined ? NO_VALUE : '0:00';
  }
  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

/** Distance au format francais, une decimale : au centimetre, c'est du bruit. */
export function formatDistanceKm(km: number | null): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return NO_VALUE;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

/** Denivele positif, en metres entiers. */
export function formatElevation(m: number | null): string {
  if (typeof m !== 'number' || !Number.isFinite(m) || m < 0) return NO_VALUE;
  return `${Math.round(m)} m`;
}

/**
 * Allure en minutes par kilometre, deduite de la vitesse moyenne.
 *
 * On ne deduit JAMAIS l'allure d'une distance nulle : la division donnerait
 * `Infinity`, presentee a l'ecran comme `Infinity:NaN`. Une allure qui n'existe
 * pas s'affiche `—`.
 */
export function paceFromSpeed(speedKmH: number | null): number | null {
  if (typeof speedKmH !== 'number' || !Number.isFinite(speedKmH) || speedKmH <= 0) return null;
  return 60 / speedKmH;
}

/** Allure formatee `M:SS`, comme sur la maquette. */
export function formatPace(minPerKm: number | null): string {
  if (typeof minPerKm !== 'number' || !Number.isFinite(minPerKm) || minPerKm <= 0) {
    return NO_VALUE;
  }
  const whole = Math.floor(minPerKm);
  const seconds = Math.round((minPerKm - whole) * 60);
  // L'arrondi a la seconde peut basculer a 60 : on reporte, on n'affiche jamais
  // « 11:60 ».
  if (seconds === 60) return `${whole + 1}:00`;
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Proposition : ce qui la rend credible                               */
/* ------------------------------------------------------------------ */

/** Seuil de duree en dessous duquel aucune distinction n'est defendable. */
const MIN_DURATION_S = 15 * 60;
const MIN_DISTANCE_KM = 0.3;
/** En dessous : arret ou derive. Au-dessus : bug de traceur. */
const MIN_READABLE_SPEED = 3;
const MAX_READABLE_SPEED = 45;

/**
 * Phrase expliquant pourquoi AUCUNE activite n'est proposee.
 *
 * Le retour libre doit pouvoir dire « je ne sais pas » sans que l'ecran
 * ressemble a une panne. Cette fonction est l'inverse exact de `guessActivity` :
 * pour chaque cas de refus, elle donne la raison, en mots de sortie.
 * `null` n'est jamais renvoye : meme sur une entree vide, l'utilisateur a droit
 * a une explication.
 */
export function unknownGuessReason(signals: FreeSessionSignals): string {
  const { distanceKm, durationSeconds, averageSpeedKmH } = signals;

  if (durationSeconds < MIN_DURATION_S) {
    return 'La session est trop courte (moins de 15 minutes) pour distinguer une randonnée d’une course.';
  }
  if (distanceKm === null) {
    return 'Aucune distance enregistrée : le traceur n’a fourni aucune position exploitable.';
  }
  if (distanceKm < MIN_DISTANCE_KM) {
    return 'Trop peu de distance enregistrée pour distinguer l’activité.';
  }
  if (averageSpeedKmH === null || averageSpeedKmH <= 0) {
    return 'La vitesse moyenne n’a pas pu être calculée à partir de la trace.';
  }
  if (averageSpeedKmH < MIN_READABLE_SPEED) {
    return 'La vitesse enregistrée est trop basse pour être lisible : arrêt, ou traceur à la dérive.';
  }
  if (averageSpeedKmH > MAX_READABLE_SPEED) {
    return 'La mesure de vitesse semble incohérente : aucune proposition n’est affichée plutôt qu’une idée fausse.';
  }
  return 'Aucune proposition ne se dégage de cette sortie : les mesures ne permettent pas de trancher.';
}

/** Proposition calculee a partir du resume fige. `null` = rien de defendable. */
export function guessFromSummary(summary: FreeSessionSummary): ActivityGuess | null {
  return guessActivity({
    distanceKm: summary.distanceKm,
    durationSeconds: summary.durationSeconds,
    averageSpeedKmH: summary.averageSpeedKmH,
    elevationGainM: summary.elevationGainM,
  });
}

/**
 * Titre de l'ecran 62.
 *
 * Une proposition s'affiche comme une QUESTION — c'est la seule facon honnete
 * de presenter une deduction. Un choix affirmatif ne l'est pas : le remettre en
 * question quand l'utilisateur a deja tranche serait un doutage gratuit.
 */
export function guessHeadline(label: string, isGuess: boolean): string {
  if (!isGuess) return `Activité : ${label}`;
  const trimmed = label.trim();
  // Nom commun : dans la question il s'écrit en minuscules. « C'était une
  // randonnée ? », jamais « … une Randonnée ? ».
  const head = trimmed.charAt(0).toLocaleLowerCase('fr') + trimmed.slice(1);
  return `C’était ${indefiniteArticle(trimmed)} ${head} ?`;
}

/**
 * Activités du catalogue dont le nom était féminin, comparées SANS accents.
 *
 * Une règle par terminaison se trompe sur la moitié du catalogue — « un
 * alpinisme », « un parapente », « un voyage » — parce que l'article suit le
 * genre du nom, pas sa dernière lettre. Le catalogue est fini et connu : on
 * l'écrit. La comparaison ignore les accents, car le nom peut en perdre un
 * selon la source du texte, et « une randonnée » reste correct des deux côtés.
 */
const FEMININE_LABELS: ReadonlySet<string> = new Set([
  'randonnee',
  'course',
  'canoe',
  'regate',
  'plongee',
  'escalade',
  'nuit en bivouac',
]);

/** Minuscules, sans accents ni marqueur de décomposition Unicode. */
function foldLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Article indéfini, décidé par le genre connu du nom, jamais par son initiale. */
function indefiniteArticle(label: string): 'un' | 'une' {
  return FEMININE_LABELS.has(foldLabel(label)) ? 'une' : 'un';
}

/**
 * Ligne de justification de la proposition, a la volee dans le module : elle est
 * composee de mesures, donc elle ne peut pas etre ecrite en dur dans l'ecran.
 */
export function guessJustification(
  signals: FreeSessionSignals,
  guess: ActivityGuess
): string {
  const pace = formatPace(paceFromSpeed(signals.averageSpeedKmH));
  if (pace !== NO_VALUE) return `Proposé par LKDV · allure ${pace} min/km`;
  return `Proposé par LKDV · ${guess.because}`;
}
