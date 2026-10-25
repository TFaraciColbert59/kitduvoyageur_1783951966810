import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CLOSED_PROGRAM,
  PILOT_C_RULES,
  PILOT_WEEKLY_CAP,
  decideAward,
  isRuleEarnable,
  parseProgram,
  programConfigToList,
  reversalAmounts,
  type ProgramContract,
} from '@/features/rewards/domain/contract';

/** Configuration telle qu'écrite par la migration 20261025120000 (fermée). */
const MIGRATION_PROGRAM = {
  version: 'pilote-c-2026-10',
  emission_open: false,
  closure_reason: 'Financement et conditions des nouveaux gains non démontrés',
  weekly_cap: 250,
  rules: [
    { key: 'activity_validated', label: 'Sortie validée', points: 50, weekly_limit: 3, producer_open: false, requires_review: false },
    { key: 'help_accepted', label: 'Aide acceptée', points: 25, weekly_limit: 2, producer_open: false, requires_review: true },
    { key: 'preparation_done', label: 'Préparation terminée', points: 10, weekly_limit: 1, producer_open: false, requires_review: false },
    { key: 'useful_story', label: 'Récit utile', points: 25, weekly_limit: 2, producer_open: false, requires_review: true },
  ],
};

function openProgram(): ProgramContract {
  return {
    version: 'test',
    emissionOpen: true,
    closureReason: null,
    weeklyCap: PILOT_WEEKLY_CAP,
    rules: PILOT_C_RULES.map((rule) => ({ ...rule, producerOpen: true })),
  };
}

const fresh = { alreadyDecided: false, weekUsed: 0, ruleCountThisWeek: 0 };

describe('contrat du programme de points', () => {
  it('lit la configuration de la migration : fermée, plafond 250, sous-plafonds du pilote C', () => {
    const program = parseProgram(MIGRATION_PROGRAM);
    expect(program.emissionOpen).toBe(false);
    expect(program.weeklyCap).toBe(250);
    expect(program.rules.find((r) => r.key === 'activity_validated')).toMatchObject({ points: 50, weeklyLimit: 3, producerOpen: false });
    // Somme des sous-plafonds du pilote = 260 > 250 : l'écrêtage agrégé reste nécessaire.
    const sum = PILOT_C_RULES.reduce((total, rule) => total + rule.points * (rule.weeklyLimit ?? 0), 0);
    expect(sum).toBe(260);
  });

  it('la configuration écrite par la migration SQL = le barème du contrat TS', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261025120000_rewards_points_v1.sql'), 'utf8');
    const match = sql.match(/'points_program',\s*'(\{[\s\S]*?\})'::jsonb/);
    expect(match).not.toBeNull();
    const program = parseProgram(programConfigToList(JSON.parse(match![1])));
    expect(program.emissionOpen).toBe(false);
    expect(program.weeklyCap).toBe(PILOT_WEEKLY_CAP);
    const byKey = Object.fromEntries(program.rules.map((rule) => [rule.key, rule]));
    for (const rule of PILOT_C_RULES) {
      expect(byKey[rule.key]).toEqual(rule);
    }
    expect(program.rules).toHaveLength(PILOT_C_RULES.length);
  });

  it('fail-closed : configuration absente, mal formée ou plafond nul = fermé', () => {
    expect(parseProgram(undefined)).toEqual(CLOSED_PROGRAM);
    expect(parseProgram({ emission_open: 'oui', weekly_cap: 250, rules: [] })).toEqual(CLOSED_PROGRAM);
    expect(parseProgram({ emission_open: true, weekly_cap: 0, rules: [] }).emissionOpen).toBe(false);
    expect(parseProgram({ ...MIGRATION_PROGRAM, rules: [{ key: 'x', points: -5 }] })).toEqual(CLOSED_PROGRAM);
  });

  it('aucun gain annonçable tant que le programme ou le producteur est fermé', () => {
    expect(isRuleEarnable(parseProgram(MIGRATION_PROGRAM), 'activity_validated')).toBe(false);
    const halfOpen = parseProgram({ ...MIGRATION_PROGRAM, emission_open: true });
    expect(isRuleEarnable(halfOpen, 'activity_validated')).toBe(false);
    expect(isRuleEarnable(openProgram(), 'activity_validated')).toBe(true);
  });

  it('like, SOS, partage de position ou vitesse ne rapportent jamais', () => {
    const program = openProgram();
    program.rules.push({ key: 'like', label: 'Like', points: 5, weeklyLimit: 3, producerOpen: true, requiresReview: false });
    expect(isRuleEarnable(program, 'like')).toBe(false);
    expect(isRuleEarnable(program, 'sos')).toBe(false);
    expect(isRuleEarnable(program, 'partage_position')).toBe(false);
  });

  it('décision : fermé, doublon, sous-plafond, plafond hebdomadaire, attente, confirmé', () => {
    const closed = parseProgram(MIGRATION_PROGRAM);
    expect(decideAward(closed, 'activity_validated', fresh)).toEqual({ kind: 'closed', reason: 'emission_closed' });
    expect(decideAward(closed, 'inconnue', fresh)).toEqual({ kind: 'closed', reason: 'unknown_rule' });

    const program = openProgram();
    expect(decideAward(program, 'activity_validated', { ...fresh, alreadyDecided: true })).toEqual({ kind: 'duplicate' });
    expect(decideAward(program, 'activity_validated', fresh)).toEqual({ kind: 'confirmed', points: 50, weekRemaining: 200 });
    expect(decideAward(program, 'useful_story', fresh)).toEqual({ kind: 'pending', points: 25, weekRemaining: 225 });
    expect(decideAward(program, 'activity_validated', { ...fresh, ruleCountThisWeek: 3 })).toMatchObject({ kind: 'refused', reason: 'rule_limit' });
    // Gain entier ou rien : 235 + 25 > 250 → refus, jamais +15.
    expect(decideAward(program, 'useful_story', { ...fresh, weekUsed: 235 })).toEqual({ kind: 'refused', reason: 'weekly_cap', weekRemaining: 15 });
    expect(decideAward(program, 'useful_story', { ...fresh, weekUsed: 225 })).toMatchObject({ kind: 'pending', weekRemaining: 0 });
  });

  it('contre-écriture : débit borné au solde, reliquat tracé', () => {
    expect(reversalAmounts(50, 200)).toEqual({ debit: 50, shortfall: 0 });
    expect(reversalAmounts(50, 20)).toEqual({ debit: 20, shortfall: 30 });
    expect(reversalAmounts(50, -10)).toEqual({ debit: 0, shortfall: 50 });
  });
});
