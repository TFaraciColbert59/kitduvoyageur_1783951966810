import { z } from 'zod';

/**
 * Contrat du programme de points LKDV (pur, sans IO).
 *
 * Une seule unité grand public : les « points », portés par le journal
 * `loyalty_history` (solde = somme des écritures). Les XP de progression, les
 * parts économiques legacy (`reward_accounts`) et le crédit boutique créateur
 * sont des unités distinctes : jamais converties, jamais additionnées ici.
 *
 * Le barème pilote C (dossier `docs/research/2026-10-25-recompenses-lkdv/`)
 * est une hypothèse à tester. Toute émission reste fermée tant que la
 * configuration serveur `reward_config.points_program` ne l'ouvre pas, et
 * chaque producteur reste fermé tant que sa preuve serveur n'existe pas.
 */

export const RULE_KEYS = ['activity_validated', 'useful_story', 'help_accepted', 'preparation_done'] as const;
export type RuleKey = (typeof RULE_KEYS)[number];

/** Plafond économique hebdomadaire du pilote (semaine civile Europe/Paris). */
export const PILOT_WEEKLY_CAP = 250;

export interface RuleDefinition {
  key: string;
  label: string;
  points: number;
  weeklyLimit: number | null;
  producerOpen: boolean;
  requiresReview: boolean;
}

export interface ProgramContract {
  version: string;
  emissionOpen: boolean;
  closureReason: string | null;
  weeklyCap: number;
  rules: RuleDefinition[];
}

/** Barème pilote C, fermé : miroir de la migration 20261025120000. */
export const PILOT_C_RULES: readonly RuleDefinition[] = [
  { key: 'activity_validated', label: 'Sortie validée', points: 50, weeklyLimit: 3, producerOpen: false, requiresReview: false },
  { key: 'useful_story', label: 'Récit utile', points: 25, weeklyLimit: 2, producerOpen: false, requiresReview: true },
  { key: 'help_accepted', label: 'Aide acceptée', points: 25, weeklyLimit: 2, producerOpen: false, requiresReview: true },
  { key: 'preparation_done', label: 'Préparation terminée', points: 10, weeklyLimit: 1, producerOpen: false, requiresReview: false },
];

/**
 * Actions qui ne rapportent jamais de points, quelle que soit la
 * configuration : l'usage essentiel, la sécurité et la confidentialité ne
 * conditionnent pas une rémunération (05-proposition-et-validation.md § 3).
 */
export const NEVER_REWARDED = [
  'like',
  'connexion',
  'temps_passe',
  'clic',
  'partage_natif',
  'sos',
  'partage_position',
  'vitesse',
  'achat_pour_xp',
  'badge',
] as const;

export const CLOSED_PROGRAM: ProgramContract = {
  version: 'fermé',
  emissionOpen: false,
  closureReason: null,
  weeklyCap: 0,
  rules: [],
};

const ruleSchema = z.object({
  key: z.string().regex(/^[a-z_]{3,40}$/),
  label: z.string().min(1).max(80).nullable().optional(),
  points: z.number().int().positive().max(10_000),
  weekly_limit: z.number().int().min(0).max(100).nullable().optional(),
  producer_open: z.boolean().optional(),
  requires_review: z.boolean().optional(),
});

export const programSchema = z.object({
  version: z.string().min(1).max(60).nullable().optional(),
  emission_open: z.boolean(),
  closure_reason: z.string().max(300).nullable().optional(),
  weekly_cap: z.number().int().min(0).max(100_000),
  rules: z.array(ruleSchema).max(50),
});

/**
 * `reward_config.points_program` stocke les règles en objet (clé → règle) ;
 * le snapshot SQL et le contrat les lisent en liste. Conversion pure.
 */
export function programConfigToList(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const rules = record.rules;
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) return value;
  return {
    ...record,
    rules: Object.entries(rules as Record<string, unknown>).map(([key, rule]) => ({
      key,
      ...(rule && typeof rule === 'object' ? (rule as Record<string, unknown>) : {}),
    })),
  };
}

/**
 * Lecture fail-closed : configuration absente, mal formée ou incohérente
 * (plafond nul alors que l'émission serait ouverte) = programme fermé.
 */
export function parseProgram(input: unknown): ProgramContract {
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return CLOSED_PROGRAM;
  const value = parsed.data;
  const rules: RuleDefinition[] = value.rules.map((rule) => ({
    key: rule.key,
    label: rule.label ?? rule.key,
    points: rule.points,
    weeklyLimit: rule.weekly_limit ?? null,
    producerOpen: rule.producer_open === true,
    requiresReview: rule.requires_review === true,
  }));
  const emissionOpen = value.emission_open && value.weekly_cap > 0;
  return {
    version: value.version ?? 'inconnue',
    emissionOpen,
    closureReason: value.closure_reason ?? null,
    weeklyCap: value.weekly_cap,
    rules,
  };
}

/** Un gain n'est annonçable que si le programme ET son producteur sont ouverts. */
export function isRuleEarnable(program: ProgramContract, ruleKey: string): boolean {
  if (!program.emissionOpen) return false;
  if ((NEVER_REWARDED as readonly string[]).includes(ruleKey)) return false;
  const rule = program.rules.find((candidate) => candidate.key === ruleKey);
  return Boolean(rule && rule.producerOpen && rule.points > 0);
}

export type AwardDecision =
  | { kind: 'duplicate' }
  | { kind: 'closed'; reason: 'emission_closed' | 'producer_closed' | 'unknown_rule' }
  | { kind: 'refused'; reason: 'rule_limit' | 'weekly_cap'; weekRemaining: number }
  | { kind: 'pending'; points: number; weekRemaining: number }
  | { kind: 'confirmed'; points: number; weekRemaining: number };

export interface AwardContext {
  alreadyDecided: boolean;
  /** Points confirmés + en vérification de la semaine (réservés au plafond). */
  weekUsed: number;
  /** Décisions confirmées ou en vérification de cette règle cette semaine. */
  ruleCountThisWeek: number;
}

/**
 * Décision d'attribution, miroir pur de `rewards_award_points` : un fait = une
 * décision ; gain entier ou rien (jamais +25 annoncé puis +15 versé).
 */
export function decideAward(program: ProgramContract, ruleKey: string, ctx: AwardContext): AwardDecision {
  const rule = program.rules.find((candidate) => candidate.key === ruleKey);
  if (!rule) return { kind: 'closed', reason: 'unknown_rule' };
  if (ctx.alreadyDecided) return { kind: 'duplicate' };
  if (!program.emissionOpen) return { kind: 'closed', reason: 'emission_closed' };
  if (!rule.producerOpen) return { kind: 'closed', reason: 'producer_closed' };

  const remaining = Math.max(0, program.weeklyCap - ctx.weekUsed);
  if (rule.weeklyLimit !== null && ctx.ruleCountThisWeek >= rule.weeklyLimit) {
    return { kind: 'refused', reason: 'rule_limit', weekRemaining: remaining };
  }
  if (ctx.weekUsed + rule.points > program.weeklyCap) {
    return { kind: 'refused', reason: 'weekly_cap', weekRemaining: remaining };
  }
  const weekRemaining = program.weeklyCap - ctx.weekUsed - rule.points;
  return rule.requiresReview
    ? { kind: 'pending', points: rule.points, weekRemaining }
    : { kind: 'confirmed', points: rule.points, weekRemaining };
}

/**
 * Contre-écriture : débite au plus le solde disponible, trace le reliquat,
 * ne retire jamais d'XP (les XP ne sont pas dans ce contrat).
 */
export function reversalAmounts(points: number, balance: number): { debit: number; shortfall: number } {
  const debit = Math.min(points, Math.max(0, balance));
  return { debit, shortfall: points - debit };
}
