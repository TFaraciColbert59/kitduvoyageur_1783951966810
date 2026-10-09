/**
 * Contexte projet du Compas : la référence unique dont découlent itinéraire,
 * nuits, sac, réservations, Verdict et Kit.
 *
 * Fonction PURE, jamais stockée : elle relit à chaque fois les données du
 * voyage (`trips` + `metadata.compas.prefs`) et le profil (`user_orientation`),
 * qui n'est jamais recopié dans le projet. Chaque champ porte sa valeur et sa
 * SOURCE, dans cet ordre de priorité :
 *   1. phrase  — demande en cours (Dis-le), pas encore appliquée
 *   2. projet  — personnalisation propre à ce projet
 *   3. compas  — sélection active du voyage (activité, dates, personnes)
 *   4. profil  — préférences habituelles
 *   5. defaut  — proposé selon l'activité, la durée, la saison
 * Puis un contrôle de cohérence ADAPTE une valeur héritée (profil ou défaut)
 * qui ne tient pas pour CE projet, et le dit. Une valeur choisie (phrase ou
 * projet) n'est jamais changée en silence : c'est au Verdict de prévenir.
 */
import type {
  CompasAutonomy,
  CompasLevel,
  CompasNights,
  CompasPreferences,
  CompasPriority,
  CompasTerrain,
} from './compasModel';
import type { Pace } from './weather';

export type ContextSource = 'phrase' | 'projet' | 'compas' | 'profil' | 'defaut';

export const SOURCE_LABEL: Record<ContextSource, string> = {
  phrase: 'ta demande',
  projet: 'réglé pour ce projet',
  compas: 'choisi dans le Compas',
  profil: 'ton profil',
  defaut: 'proposé',
};

export interface CtxField<T> {
  value: T;
  source: ContextSource;
  /** Pourquoi cette valeur, en clair (adaptation ou défaut). */
  why?: string;
}

export type ProjectScope = 'sortie' | 'journee' | 'sejour';

export interface ProfileInput {
  terrain: CompasTerrain | null;
  autonomy: CompasAutonomy | null;
  priority: CompasPriority | null;
  experience: CompasLevel | null;
}

export interface ContextInput {
  /** trips.primary_activity */
  activity: string | null;
  /** Nombre de jours (dates ou durée retenue sans date). */
  days: number | null;
  /** Durée en heures quand la sortie tient en moins d'une journée. */
  hours: number | null;
  partySize: number | null;
  /** Mois du départ (1-12), si connu. */
  month: number | null;
  /** Latitude de la destination, si connue : au sud, les saisons sont décalées de six mois. */
  lat?: number | null;
  /** Altitude maximale connue du parcours, si mesurée. */
  maxAltitudeM?: number | null;
  /** Personnalisations du projet (metadata.compas.prefs). */
  project: Partial<CompasPreferences> | null;
  /** Préférences habituelles (user_orientation), lues à la volée. */
  profile: ProfileInput | null;
  /** Demande en cours, pas encore appliquée (aperçu). */
  phrase?: Partial<CompasPreferences> & { activity?: string | null };
}

export interface ContextAdaptation {
  field: 'nights' | 'autonomy';
  /** Ce que la préférence habituelle aurait donné. */
  usual: string;
  /** Ce qui est retenu pour ce projet. */
  chosen: string;
  why: string;
}

export interface ProjectContext {
  scope: ProjectScope;
  activity: CtxField<string | null>;
  pace: CtxField<Pace>;
  nights: CtxField<CompasNights | null>;
  level: CtxField<CompasLevel | null>;
  autonomy: CtxField<CompasAutonomy | null>;
  priority: CtxField<CompasPriority | null>;
  terrain: CtxField<CompasTerrain | null>;
  maxPackKg: CtxField<number | null>;
  outdoorNights: CtxField<number | null>;
  adaptations: ContextAdaptation[];
  /** Modules utiles pour CE projet : le reste n'est pas proposé. */
  modules: {
    nights: boolean;
    transport: boolean;
    resa: boolean;
    /** Sac complet (couchage, cuisine) ; sinon tenue et essentiels de sortie. */
    fullPack: boolean;
  };
}

/** Sorties courtes par nature : jamais de nuit, ni de sac de trek. */
export const SHORT_ACTIVITIES = new Set(['running', 'trail']);
/** Activités qui dorment sous un toit (ou dans le véhicule), sauf choix dit. */
const ROOF_ACTIVITIES = new Set(['cultural', 'roadtrip', 'citytrip', 'beach', 'vanlife', 'ski']);
/** Terrain qui a du sens pour l'activité (sinon le profil n'est pas suivi). */
const TRAIL_ACTIVITIES = new Set(['hiking', 'trekking', 'bivouac', 'mixed', 'trail', 'running', 'bushcraft']);

const NIGHTS_TEXT: Record<CompasNights, string> = {
  bivouac: 'le bivouac',
  refuge: 'le refuge',
  hebergement: 'un hébergement',
  mixte: 'des nuits mixtes',
};
const AUTONOMY_TEXT: Record<CompasAutonomy, string> = {
  journee: 'les sorties à la journée',
  bivouac_1_2: 'le bivouac sur 1 à 2 nuits',
  itinerance_longue: 'l’itinérance en autonomie',
};

export function scopeOf(input: Pick<ContextInput, 'activity' | 'days' | 'hours'>): ProjectScope {
  if (input.hours != null && input.hours < 24) return 'sortie';
  // Course et trail d'un jour : une sortie (quelques heures, sans nuit).
  if (SHORT_ACTIVITIES.has(input.activity ?? '') && (input.days == null || input.days <= 1)) return 'sortie';
  if (input.days == null) return 'sejour';
  return input.days <= 1 ? 'journee' : 'sejour';
}

/** Première valeur définie dans l'ordre de priorité. */
function pick<T>(
  candidates: Array<[ContextSource, T | null | undefined]>,
  fallback: CtxField<T>
): CtxField<T> {
  for (const [source, value] of candidates) {
    if (value !== undefined && value !== null) return { value, source };
  }
  return fallback;
}

/** Mois d'hiver dans l'hémisphère nord. */
const WINTER = new Set([11, 12, 1, 2, 3]);

/** Le mois équivalent dans l'hémisphère nord : au sud, six mois de décalage (juillet ↔ janvier). */
function northernEquivalent(month: number, lat: number | null | undefined): number {
  return lat != null && lat < 0 ? ((month + 5) % 12) + 1 : month;
}

export function resolveProjectContext(input: ContextInput): ProjectContext {
  const project = input.project ?? {};
  const phrase = input.phrase ?? {};
  const profile = input.profile;
  const adaptations: ContextAdaptation[] = [];

  const activity = pick<string | null>(
    [
      ['phrase', phrase.activity],
      ['compas', input.activity],
    ],
    { value: null, source: 'defaut' }
  );
  const act = activity.value ?? '';
  const scope = scopeOf({ activity: act, days: input.days, hours: input.hours });
  const nightsCount = scope === 'sejour' ? Math.max(0, (input.days ?? 1) - 1) : 0;

  /* Niveau : choisi pour le projet, sinon l'expérience du profil. */
  const level = pick<CompasLevel | null>(
    [
      ['phrase', phrase.level],
      ['projet', project.level],
      ['profil', profile?.experience],
    ],
    { value: null, source: 'defaut' }
  );

  /* Priorité et terrain habituels. */
  const priority = pick<CompasPriority | null>(
    [
      ['phrase', phrase.priority],
      ['projet', project.priority],
      ['profil', profile?.priority],
    ],
    { value: null, source: 'defaut' }
  );
  let terrain = pick<CompasTerrain | null>(
    [
      ['phrase', phrase.terrain],
      ['projet', project.terrain],
      ['profil', profile?.terrain],
    ],
    { value: null, source: 'defaut' }
  );
  // Le terrain habituel (sentier, montagne…) n'a pas de sens pour une ville ou la mer.
  if (terrain.source === 'profil' && !TRAIL_ACTIVITIES.has(act))
    terrain = { value: null, source: 'defaut', why: 'sans objet pour cette activité' };

  /* Rythme : choisi, sinon déduit du niveau, sinon normal. */
  let pace = pick<Pace>(
    [
      ['phrase', phrase.pace],
      ['projet', project.pace],
    ],
    { value: 'normal', source: 'defaut' }
  );
  if (pace.source === 'defaut' && level.value === 'debut')
    pace = { value: 'tranquille', source: level.source, why: 'niveau débutant : étapes plus courtes' };

  /* Autonomie : choisie, sinon profil, puis cohérence avec la durée. */
  let autonomy = pick<CompasAutonomy | null>(
    [
      ['phrase', phrase.autonomy],
      ['projet', project.autonomy],
      ['profil', profile?.autonomy],
    ],
    { value: null, source: 'defaut' }
  );
  if (scope !== 'sejour' && autonomy.source === 'profil' && autonomy.value && autonomy.value !== 'journee') {
    adaptations.push({
      field: 'autonomy',
      usual: AUTONOMY_TEXT[autonomy.value],
      chosen: AUTONOMY_TEXT.journee,
      why: scope === 'sortie' ? 'cette sortie tient en quelques heures' : 'ce projet tient en une journée',
    });
    autonomy = { value: 'journee', source: 'defaut', why: 'aucune nuit à prévoir' };
  }

  /* Nuits dehors et poids maximal : seulement s'ils sont choisis. */
  const outdoorNights = pick<number | null>(
    [
      ['phrase', phrase.outdoorNights],
      ['projet', project.outdoorNights],
    ],
    { value: null, source: 'defaut' }
  );
  const maxPackKg = pick<number | null>(
    [
      ['phrase', phrase.maxPackKg],
      ['projet', project.maxPackKg],
    ],
    { value: null, source: 'defaut' }
  );

  /* Nuits. */
  let nights = pick<CompasNights | null>(
    [
      ['phrase', phrase.nights],
      ['projet', project.nights],
    ],
    { value: null, source: 'defaut' }
  );
  if (nightsCount === 0) {
    nights = { value: null, source: 'defaut', why: 'aucune nuit dans ce projet' };
  } else if (nights.source === 'defaut') {
    const out = outdoorNights.value;
    if (out != null && out > 0)
      nights = {
        value: out >= nightsCount ? 'bivouac' : 'mixte',
        source: outdoorNights.source,
        why: `${out} nuit${out > 1 ? 's' : ''} dehors demandée${out > 1 ? 's' : ''}`,
      };
    else if (ROOF_ACTIVITIES.has(act))
      nights = { value: 'hebergement', source: 'defaut', why: 'activité qui dort sous un toit' };
    else if (priority.value === 'budget' && priority.source === 'profil') {
      const cold = input.month != null && WINTER.has(northernEquivalent(input.month, input.lat));
      const high = (input.maxAltitudeM ?? 0) >= 1500;
      if (cold && (high || level.value === 'debut')) {
        adaptations.push({
          field: 'nights',
          usual: NIGHTS_TEXT.bivouac,
          chosen: NIGHTS_TEXT.refuge,
          why: high ? 'nuits d’hiver en altitude' : 'nuits d’hiver pour un premier bivouac',
        });
        nights = { value: 'refuge', source: 'defaut', why: 'hiver : un toit est plus sûr' };
      } else {
        nights = { value: 'bivouac', source: 'profil', why: 'tu privilégies le budget' };
      }
    } else if (priority.value === 'confort' && priority.source === 'profil') {
      nights = { value: 'refuge', source: 'profil', why: 'tu privilégies le confort' };
    }
  }

  return {
    scope,
    activity,
    pace,
    nights,
    level,
    autonomy,
    priority,
    terrain,
    maxPackKg,
    outdoorNights: nightsCount === 0 ? { value: null, source: 'defaut' } : outdoorNights,
    adaptations,
    modules: {
      nights: nightsCount > 0,
      transport: scope !== 'sortie',
      resa: scope !== 'sortie',
      fullPack: scope === 'sejour' && !SHORT_ACTIVITIES.has(act),
    },
  };
}

/** « Habituellement tu préfères X, mais pour ce projet Y » — une phrase par adaptation. */
export function adaptationText(a: ContextAdaptation): string {
  return `Habituellement tu préfères ${a.usual}, mais pour ce projet : ${a.chosen} (${a.why}).`;
}

/* ---------- Distance attendue et choix d'un parcours du catalogue ---------- */

/** Vitesse moyenne réaliste par activité (km/h, pauses comprises). */
const SPEED_KMH: Record<string, number> = {
  running: 9,
  trail: 7,
  hiking: 3.5,
  trekking: 3.5,
  bivouac: 3.5,
  mixed: 3.5,
  cycling: 18,
  water: 5,
};
const PER_DAY_KM: Record<Pace, number> = { tranquille: 12, normal: 16, soutenu: 22 };

/**
 * Distance que le projet appelle : la distance dite, sinon la durée × la
 * vitesse de l'activité (sortie), sinon jours × étape type selon rythme et
 * niveau (séjour). null quand rien ne permet de l'estimer.
 */
export function expectedKm(
  ctx: Pick<ProjectContext, 'scope' | 'activity' | 'pace' | 'level'>,
  input: { hours: number | null; days: number | null; targetKm: number | null }
): number | null {
  const act = ctx.activity.value ?? '';
  if (ctx.scope === 'sortie') {
    if (input.targetKm) return input.targetKm;
    const speed = SPEED_KMH[act];
    return input.hours && speed ? Math.round(input.hours * speed * 10) / 10 : null;
  }
  if (!input.days) return null;
  const perDay = input.targetKm ?? Math.min(PER_DAY_KM[ctx.pace.value], ctx.level.value === 'debut' ? 12 : 99);
  return input.days * perDay;
}

/**
 * Parcours du catalogue qui épouse le projet : le plus proche de la distance
 * attendue (à ±50 %), à égalité le plus près. Sans distance attendue, le
 * plus proche du départ. Aucun ne convient : null (l'itinéraire est composé).
 */
export function pickCatalogRoute<T extends { distance_km: number | string | null; distance_from_m?: number | null }>(
  routes: T[],
  want: number | null
): T | null {
  if (!routes.length) return null;
  if (want == null) return routes[0];
  const scored = routes
    .map((r) => ({ r, km: Number(r.distance_km) }))
    .filter((x) => Number.isFinite(x.km) && x.km > 0 && Math.abs(x.km - want) <= want * 0.5)
    .sort((a, b) => Math.abs(a.km - want) - Math.abs(b.km - want) || (a.r.distance_from_m ?? 0) - (b.r.distance_from_m ?? 0));
  return scored[0]?.r ?? null;
}
