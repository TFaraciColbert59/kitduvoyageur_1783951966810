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
}

/** Une variable du Brief autour d'un type de valeur. */
function bv<T extends z.ZodType>(value: T) {
  return z.strictObject({
    value: value.nullable(),
    source: z.enum(BRIEF_SOURCES),
    confidence: z.number().min(0).max(1),
    evidence: z.string().max(400).nullable(),
    locked: z.boolean(),
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
  return { value: null, source: 'defaut', confidence: 0, evidence: null, locked: false };
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
 * Forme comparable d'un texte : casse, accents composés (NFC), apostrophes et
 * guillemets typographiques, espaces de toute nature.
 */
export function normalizeForEvidence(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[\s   ]+/g, ' ')
    .trim();
}

/** Règle R2 : le passage cité est-il mot pour mot dans la phrase ? */
export function evidenceInPhrase(evidence: string | null | undefined, phrase: string): boolean {
  if (!evidence) return false;
  const e = normalizeForEvidence(evidence);
  return e.length > 0 && normalizeForEvidence(phrase).includes(e);
}

export interface BriefIssue {
  path: BriefPath;
  reason: 'dit_sans_preuve' | 'preuve_absente_de_la_phrase' | 'preuve_sur_source_non_dite' | 'valeur_nulle_avec_confiance';
}

/**
 * Contrôle des règles de valeur sur un Brief déjà conforme au schéma.
 * Une valeur verrouillée (posée par la personne à l'écran) n'a pas à citer la phrase.
 */
export function briefIssues(brief: Brief, phrase: string): BriefIssue[] {
  const issues: BriefIssue[] = [];
  for (const path of briefPaths()) {
    const v = getValue(brief, path);
    if (v.value == null) {
      if (v.confidence > 0) issues.push({ path, reason: 'valeur_nulle_avec_confiance' });
      continue;
    }
    if (v.locked) continue;
    if (v.source === 'dit') {
      if (!v.evidence) issues.push({ path, reason: 'dit_sans_preuve' });
      else if (!evidenceInPhrase(v.evidence, phrase)) issues.push({ path, reason: 'preuve_absente_de_la_phrase' });
    } else if (v.evidence) issues.push({ path, reason: 'preuve_sur_source_non_dite' });
  }
  return issues;
}

/**
 * Brief sans les valeurs fautives : chacune retombe à « absente », pour que la
 * source suivante (profil, historique, défaut) puisse la remplir.
 */
export function dropInvalid(brief: Brief, phrase: string): { brief: Brief; dropped: BriefIssue[] } {
  const dropped = briefIssues(brief, phrase);
  let out = brief;
  for (const issue of dropped) out = withValue(out, issue.path, emptyValue());
  return { brief: out, dropped };
}

/**
 * Ce qui peut être rangé sur le voyage partagé (règle R5) : toute valeur de
 * source privée redevient « absente », sauf si la personne l'a verrouillée
 * (elle l'a alors posée elle-même sur le voyage).
 */
export function briefForStorage(brief: Brief): Brief {
  let out = brief;
  for (const path of briefPaths()) {
    const v = getValue(brief, path);
    if (PRIVATE_SOURCES.includes(v.source) && !v.locked) out = withValue(out, path, emptyValue());
  }
  return out;
}

/** Vrai si aucune valeur de source privée non verrouillée ne reste (contrôle avant écriture). */
export function isStorable(brief: Brief): boolean {
  return briefPaths().every((p) => {
    const v = getValue(brief, p);
    return v.locked || v.value == null || !PRIVATE_SOURCES.includes(v.source);
  });
}

/** Lecture défensive d'un `jsonb` : le Brief s'il est conforme et de la version connue, sinon null. */
export function parseStoredBrief(raw: unknown, version: unknown): Brief | null {
  if (version !== BRIEF_SCHEMA_VERSION) return null;
  const parsed = briefSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
