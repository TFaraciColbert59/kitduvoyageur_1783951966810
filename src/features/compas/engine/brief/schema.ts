/**
 * Compas v6 — le Brief : ce que le moteur a compris d'une demande, variable par
 * variable, avec la source de chacune (ADR-V6-001 §3).
 *
 * Module PUR. Le schéma zod est la seule source : types, liste des variables,
 * schéma JSON donné à l'extraction.
 *
 * Règle R1 : aucune variable n'est une coordonnée, un prix constaté, un horaire
 * réel ou une distance mesurée. Le Brief porte des SOUHAITS et des NOMS ; les
 * faits viennent ensuite de données vérifiables. Aucun champ `lat` / `lon` ici.
 */
import { z } from 'zod';
import { COMPAS_ACTIVITIES } from '../intent';

export const BRIEF_SCHEMA_VERSION = 1;

export const BRIEF_SOURCES = ['dit', 'profil', 'historique', 'deduit', 'defaut'] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];

/** Sources privées : jamais rangées sur le voyage partagé (règle R5). */
export const PRIVATE_SOURCES: readonly BriefSource[] = ['profil', 'historique'];

export interface BriefValue<T> {
  value: T | null;
  source: BriefSource;
  /** 0 à 1. */
  confidence: number;
  /** Passage exact de la phrase quand `source = 'dit'`, sinon null. */
  evidence: string | null;
  /** Vrai dès que la personne a modifié la valeur : plus jamais écrasée. */
  locked: boolean;
  /**
   * Vrai si la valeur vient du profil ou de l'historique, OU en est déduite
   * (devise tirée du pays de résidence, niveau tiré de l'allure…). Une déduction
   * hérite de la source la plus privée de ses entrées. Jamais rangée (règle R5).
   */
  prive: boolean;
}

/** Une variable du Brief autour d'un type de valeur. */
function bv<T extends z.ZodType>(value: T) {
  return z.strictObject({
    value: value.nullable(),
    source: z.enum(BRIEF_SOURCES),
    confidence: z.number().min(0).max(1),
    evidence: z.string().max(400).nullable(),
    locked: z.boolean(),
    prive: z.boolean(),
  });
}

const text = z.string().trim().min(1).max(120);
const names = z.array(text).max(8);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const count = (max: number) => z.number().int().min(0).max(max);
const yes = z.boolean();

const NIGHT_KINDS = ['bivouac', 'refuge', 'camping', 'gite', 'hotel', 'chez_habitant', 'vehicule', 'mixte'] as const;
const TRANSPORT_MODES = ['voiture', 'train', 'bus', 'avion', 'velo', 'marche', 'bateau', 'covoiturage'] as const;

export const briefSchema = z.strictObject({
  projet: z.strictObject({
    /** Activité principale, parmi celles que le moteur connaît. */
    activite: bv(z.enum(COMPAS_ACTIVITIES)),
    /** Activités dites en plus de la principale, dans l'ordre de la phrase. */
    activitesSecondaires: bv(z.array(z.enum(COMPAS_ACTIVITIES)).max(6)),
    forme: bv(z.enum(['boucle', 'traversee', 'etoile', 'multi_bases', 'itinerant', 'sejour'])),
    motif: bv(z.enum(['repos', 'defi', 'decouverte', 'fete', 'entrainement'])),
    /** Sentier, épreuve ou itinéraire nommé (« GR20 », « Camino Francés »). */
    itineraireNomme: bv(text),
    /** Tronçon dit d'un itinéraire nommé (« sud », « de Vizzavona à Conca »). */
    troncon: bv(text),
  }),
  ou: z.strictObject({
    /** Destination telle que dite, sans correction. */
    destination: bv(text),
    /** Pays dit, en toutes lettres tel que dit. */
    paysDit: bv(text),
    envies: bv(names),
    aEviter: bv(names),
    /** Lieu de départ dit (« depuis Lyon »). */
    depart: bv(text),
    /** Retour ailleurs qu'au départ. */
    retour: bv(text),
    /** Étapes ou lieux de passage imposés, dans l'ordre dit. */
    passages: bv(names),
    /** Rayon accepté autour du lieu, souhait en km. */
    rayonKm: bv(z.number().min(1).max(2000)),
    /** « près de chez moi », « autour de moi » : le lieu est la position partagée. */
    autourDeMoi: bv(yes),
  }),
  quand: z.strictObject({
    dateDebut: bv(isoDate),
    dateFin: bv(isoDate),
    jours: bv(z.number().int().min(1).max(60)),
    /** Sortie de moins d'un jour. */
    heures: bv(z.number().min(0.25).max(23.75)),
    mois: bv(z.number().int().min(1).max(12)),
    saison: bv(z.enum(['printemps', 'ete', 'automne', 'hiver'])),
    /** Jours de souplesse acceptés autour des dates. */
    souplesseJours: bv(count(30)),
    heureDepart: bv(clock),
    heureRetourMax: bv(clock),
    momentJournee: bv(z.enum(['matin', 'midi', 'apres_midi', 'soir', 'nuit'])),
  }),
  qui: z.strictObject({
    personnes: bv(z.number().int().min(1).max(30)),
    adultes: bv(z.number().int().min(1).max(30)),
    enfants: bv(count(10)),
    agesEnfants: bv(z.array(z.number().int().min(0).max(17)).max(10)),
    animal: bv(z.enum(['chien', 'autre'])),
    niveau: bv(z.enum(['debut', 'regulier', 'aguerri'])),
    /** Niveau du plus faible du groupe quand il est dit à part. */
    niveauPlusFaible: bv(z.enum(['debut', 'regulier', 'aguerri'])),
    /** Allure de marche sur le plat, km/h. */
    allureKmH: bv(z.number().min(1).max(20)),
    /** Dénivelé positif tenu par heure, m/h. */
    deniveleParHeure: bv(z.number().min(50).max(2000)),
    peurDuVide: bv(yes),
    malDesTransports: bv(yes),
    mobiliteReduite: bv(yes),
    poussette: bv(yes),
  }),
  effort: z.strictObject({
    kmParJour: bv(z.number().min(1).max(300)),
    deniveleParJour: bv(z.number().min(0).max(4000)),
    heuresParJour: bv(z.number().min(0.5).max(16)),
    /** Distance totale visée (« 100 km en 5 jours »). */
    kmTotal: bv(z.number().min(1).max(10000)),
    joursDeRepos: bv(count(20)),
    rythme: bv(z.enum(['tranquille', 'normal', 'soutenu'])),
    terrain: bv(z.enum(['sentier', 'montagne', 'hors_sentier', 'itinerance', 'urbain_transit'])),
  }),
  nuits: z.strictObject({
    type: bv(z.enum(NIGHT_KINDS)),
    confort: bv(z.enum(['rustique', 'simple', 'confortable', 'haut_de_gamme'])),
    bivouacAccepte: bv(yes),
    nuitsDehors: bv(count(60)),
    autonomie: bv(z.enum(['journee', 'bivouac_1_2', 'itinerance_longue'])),
    /** Un seul hébergement pour tout le séjour. */
    baseUnique: bv(yes),
  }),
  repas: z.strictObject({
    autonomie: bv(z.enum(['tout_porte', 'ravitaillement', 'restaurants', 'mixte'])),
    regime: bv(z.enum(['vegetarien', 'vegan', 'sans_gluten', 'halal', 'casher', 'sans_porc', 'autre'])),
    allergies: bv(names),
    rechaud: bv(yes),
    restaurants: bv(yes),
  }),
  transport: z.strictObject({
    moyensAcceptes: bv(z.array(z.enum(TRANSPORT_MODES)).max(8)),
    moyensRefuses: bv(z.array(z.enum(TRANSPORT_MODES)).max(8)),
    sansVoiture: bv(yes),
    sansAvion: bv(yes),
    vehiculePossede: bv(z.enum(['voiture', 'van', 'camping_car', 'moto', 'velo', 'aucun'])),
    /** Temps de trajet d'approche maximal accepté, en heures. */
    trajetMaxHeures: bv(z.number().min(0.25).max(48)),
    /** Déplacement sur place (« en bus sur place », « location de voiture »). */
    surPlace: bv(z.enum(TRANSPORT_MODES)),
  }),
  budget: z.strictObject({
    enveloppe: bv(z.number().min(0).max(1_000_000)),
    devise: bv(z.string().regex(/^[A-Z]{3}$/)),
    base: bv(z.enum(['par_personne', 'total'])),
    priorite: bv(z.enum(['prix', 'confort', 'temps', 'legerete', 'securite'])),
    /** Le trajet d'approche est-il compris dans l'enveloppe dite. */
    trajetCompris: bv(yes),
  }),
  risque: z.strictObject({
    tolerance: bv(z.enum(['prudente', 'moyenne', 'engagee'])),
    isolementAccepte: bv(yes),
    reseauExige: bv(yes),
    encadrementSouhaite: bv(yes),
  }),
  materiel: z.strictObject({
    /** Poids de sac visé, kg. */
    poidsViseKg: bv(z.number().min(1).max(40)),
    locationAcceptee: bv(yes),
    achatAccepte: bv(yes),
    /** Objets dits comme possédés ou à emporter (« j'ai ma tente »). */
    possedeDit: bv(names),
  }),
});

export type Brief = z.infer<typeof briefSchema>;
export type BriefBlock = keyof Brief;

/** Chemin d'une variable : « quand.jours ». */
export type BriefPath = { [B in BriefBlock]: `${B}.${Extract<keyof Brief[B], string>}` }[BriefBlock];

/** Valeur absente : défaut, confiance nulle, non verrouillée. */
export function emptyValue<T>(): BriefValue<T> {
  return { value: null, source: 'defaut', confidence: 0, evidence: null, locked: false, prive: false };
}

/** Toutes les variables du Brief, dans l'ordre du schéma. */
export function briefPaths(): BriefPath[] {
  const out: string[] = [];
  for (const [block, shape] of Object.entries(briefSchema.shape))
    for (const key of Object.keys(shape.shape)) out.push(`${block}.${key}`);
  return out as BriefPath[];
}

/** Brief vide : chaque variable absente. */
export function emptyBrief(): Brief {
  const out: Record<string, Record<string, BriefValue<unknown>>> = {};
  for (const [block, shape] of Object.entries(briefSchema.shape)) {
    out[block] = {};
    for (const key of Object.keys(shape.shape)) out[block][key] = emptyValue();
  }
  return out as unknown as Brief;
}

type AnyValue = BriefValue<unknown>;
type Loose = Record<string, Record<string, AnyValue>>;

/** Lit une variable par son chemin. */
export function getValue(brief: Brief, path: BriefPath): AnyValue {
  const [block, key] = path.split('.') as [string, string];
  return (brief as unknown as Loose)[block][key];
}

/** Copie du Brief avec une variable remplacée (le Brief d'entrée n'est pas modifié). */
export function withValue(brief: Brief, path: BriefPath, value: AnyValue): Brief {
  const [block, key] = path.split('.') as [string, string];
  const loose = brief as unknown as Loose;
  return { ...loose, [block]: { ...loose[block], [key]: value } } as unknown as Brief;
}

/**
 * Forme comparable d'un texte : compatibilité Unicode (NFKC : chiffres pleine
 * chasse, ligatures), casse, apostrophes et guillemets typographiques, espaces.
 */
export function normalizeForEvidence(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Un passage d'un seul signe se retrouve toujours (surtout en japonais ou en chinois) : il ne prouve rien. */
const MIN_EVIDENCE_LENGTH = 2;

/** Règle R2 : le passage cité est-il mot pour mot dans la phrase ? */
export function evidenceInPhrase(evidence: string | null | undefined, phrase: string): boolean {
  if (!evidence) return false;
  const e = normalizeForEvidence(evidence);
  return [...e].length >= MIN_EVIDENCE_LENGTH && normalizeForEvidence(phrase).includes(e);
}

/** Variables dont la valeur est un nom dit : il doit figurer tel quel dans le passage cité. */
const NAME_PATHS: ReadonlySet<string> = new Set([
  'projet.itineraireNomme',
  'projet.troncon',
  'ou.destination',
  'ou.paysDit',
  'ou.depart',
  'ou.retour',
  'ou.envies',
  'ou.aEviter',
  'ou.passages',
  'repas.allergies',
  'materiel.possedeDit',
]);
const DATE_PATHS: ReadonlySet<string> = new Set(['quand.dateDebut', 'quand.dateFin']);

/** Nombres écrits en lettres, dans les cinq langues du Compas (début de mot : « zwei » couvre « zweit »). */
const NUMBER_WORDS: Readonly<Record<number, readonly string[]>> = {
  1: ['un', 'une', 'one', 'uno', 'una', 'ein', 'eine', 'seul', 'seule', 'solo', 'sola', 'alone', 'allein'],
  2: ['deux', 'two', 'dos', 'zwei', 'due', 'couple', 'coppia', 'pareja', 'paar'],
  3: ['trois', 'three', 'tres', 'drei', 'tre'],
  4: ['quatre', 'four', 'cuatro', 'vier', 'quattro'],
  5: ['cinq', 'five', 'cinco', 'fünf', 'cinque'],
  6: ['six', 'seis', 'sechs', 'sei'],
  7: ['sept', 'seven', 'siete', 'sieben', 'sette'],
  8: ['huit', 'eight', 'ocho', 'acht', 'otto'],
  9: ['neuf', 'nine', 'nueve', 'neun', 'nove'],
  10: ['dix', 'ten', 'diez', 'zehn', 'dieci'],
  12: ['douze', 'twelve', 'doce', 'zwölf', 'dodici'],
  15: ['quinze', 'fifteen', 'quince', 'fünfzehn', 'quindici'],
  20: ['vingt', 'twenty', 'veinte', 'zwanzig', 'venti'],
  30: ['trente', 'thirty', 'treinta', 'dreißig', 'trenta'],
};

function numberInEvidence(n: number, evidence: string): boolean {
  const e = normalizeForEvidence(evidence);
  const digits = e.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (digits.some((d) => Number(d.replace(',', '.')) === n)) return true;
  const words = NUMBER_WORDS[n];
  if (!words) return false;
  const tokens = e.split(/[^\p{L}]+/u);
  return words.some((w) => tokens.some((t) => t === w || (w.length >= 4 && t.startsWith(w))));
}

/**
 * La valeur sort-elle vraiment du passage cité ? Prouver que le passage existe
 * ne suffit pas (« en famille » ne dit pas « 4 »).
 * - nom : il figure tel quel dans le passage ;
 * - nombre : le passage porte ce nombre, en chiffres ou en lettres ;
 * - heure : le passage porte le chiffre de l'heure ;
 * - date : jamais vérifiable ici (elle se calcule) ;
 * - choix dans une liste, oui/non : c'est une lecture, le passage suffit.
 */
export function valueInEvidence(path: BriefPath, value: unknown, evidence: string): 'oui' | 'non' | 'date' {
  if (DATE_PATHS.has(path)) return 'date';
  if (NAME_PATHS.has(path)) {
    const e = normalizeForEvidence(evidence);
    const all = (Array.isArray(value) ? value : [value]).map((v) => normalizeForEvidence(String(v)));
    return all.length > 0 && all.every((v) => v.length > 0 && e.includes(v)) ? 'oui' : 'non';
  }
  if (typeof value === 'number') return numberInEvidence(value, evidence) ? 'oui' : 'non';
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'number'))
    return value.every((v) => numberInEvidence(v as number, evidence)) ? 'oui' : 'non';
  if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value))
    return numberInEvidence(Number(value.slice(0, 2)), evidence) ? 'oui' : 'non';
  return 'oui';
}

export type BriefIssueReason =
  | 'dit_sans_preuve'
  | 'preuve_absente_de_la_phrase'
  | 'valeur_absente_du_passage'
  | 'date_non_confirmee'
  | 'preuve_sur_source_non_dite'
  | 'valeur_nulle_avec_confiance'
  | 'source_privee_non_marquee';

export interface BriefIssue {
  path: BriefPath;
  reason: BriefIssueReason;
}

/**
 * D'où vient le Brief contrôlé.
 * - `regles` : l'analyseur déterministe (`parseIntentRules`). Il calcule lui-même
 *   les nombres et les dates : le passage doit exister, la valeur n'est pas recomptée.
 * - `ia` : l'extraction. Un nombre doit se retrouver dans le passage ; une date
 *   n'est jamais acceptée d'elle seule (CLAUDE.md §2 : l'IA ne fournit pas de date).
 */
export type BriefOrigin = 'regles' | 'ia';

/**
 * Contrôle des règles de valeur sur un Brief déjà conforme au schéma.
 * Une valeur verrouillée (posée par la personne à l'écran) n'a pas à citer la phrase.
 */
export function briefIssues(brief: Brief, phrase: string, origin: BriefOrigin = 'ia'): BriefIssue[] {
  const issues: BriefIssue[] = [];
  for (const path of briefPaths()) {
    const v = getValue(brief, path);
    if (v.value == null) {
      if (v.confidence > 0) issues.push({ path, reason: 'valeur_nulle_avec_confiance' });
      continue;
    }
    if (PRIVATE_SOURCES.includes(v.source) && !v.prive) {
      issues.push({ path, reason: 'source_privee_non_marquee' });
      continue;
    }
    if (v.locked) continue;
    if (v.source === 'dit') {
      if (!v.evidence) issues.push({ path, reason: 'dit_sans_preuve' });
      else if (!evidenceInPhrase(v.evidence, phrase)) issues.push({ path, reason: 'preuve_absente_de_la_phrase' });
      else if (origin === 'ia') {
        const found = valueInEvidence(path, v.value, v.evidence);
        if (found === 'non') issues.push({ path, reason: 'valeur_absente_du_passage' });
        else if (found === 'date') issues.push({ path, reason: 'date_non_confirmee' });
      }
    } else if (v.evidence) issues.push({ path, reason: 'preuve_sur_source_non_dite' });
  }
  return issues;
}

/**
 * Brief sans les valeurs fautives : chacune retombe à « absente », pour que la
 * source suivante (profil, historique, défaut) puisse la remplir.
 */
export function dropInvalid(
  brief: Brief,
  phrase: string,
  origin: BriefOrigin = 'ia'
): { brief: Brief; dropped: BriefIssue[] } {
  const dropped = briefIssues(brief, phrase, origin);
  let out = brief;
  for (const issue of dropped) out = withValue(out, issue.path, emptyValue());
  return { brief: out, dropped };
}

/**
 * La personne pose elle-même une valeur à l'écran : elle devient un réglage du
 * voyage (donc partagé avec lui), verrouillé, et n'est plus privée — même si la
 * valeur proposée venait de son profil. L'écran l'annonce avant.
 */
export function lockValue<T>(value: T): BriefValue<T> {
  return { value, source: 'dit', confidence: 1, evidence: null, locked: true, prive: false };
}

const isPrivate = (v: AnyValue) => v.prive || PRIVATE_SOURCES.includes(v.source);

/**
 * Ce qui peut être rangé sur le voyage (règle R5) :
 * - toute valeur privée (profil, historique, ou déduite d'eux) redevient « absente » ;
 * - aucun passage de la phrase n'est gardé (`evidence` vidé) : la phrase peut dire
 *   des choses intimes et le voyage se partage.
 */
export function briefForStorage(brief: Brief): Brief {
  let out = brief;
  for (const path of briefPaths()) {
    const v = getValue(brief, path);
    if (v.value == null) continue;
    if (isPrivate(v)) out = withValue(out, path, emptyValue());
    else if (v.evidence != null) out = withValue(out, path, { ...v, evidence: null });
  }
  return out;
}

/** Vrai si rien de privé ni aucun passage de phrase ne reste (contrôle avant écriture). */
export function isStorable(brief: Brief): boolean {
  return briefPaths().every((p) => {
    const v = getValue(brief, p);
    return v.value == null || (!isPrivate(v) && v.evidence == null);
  });
}

/** Lecture défensive d'un `jsonb` : le Brief s'il est conforme et de la version connue, sinon null. */
export function parseStoredBrief(raw: unknown, version: unknown): Brief | null {
  if (version !== BRIEF_SCHEMA_VERSION) return null;
  const parsed = briefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
