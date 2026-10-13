/** T42 — publication de règles : validation, simulation sans mutation, refus explicites. */
import { describe, it, expect } from 'vitest';
import {
  simulateRules,
  validateRegistryCandidate,
} from '@/features/progression/server/rulePublication';

describe('administration des règles (simulation)', () => {
  it('candidat invalide (version manquante / catalogue incomplet) → refus', () => {
    expect(validateRegistryCandidate(null)).toEqual({ ok: false, error: 'version_manquante' });
    expect(validateRegistryCandidate({ version: '2.1', rules: [] })).toEqual({
      ok: false,
      error: 'catalogue_incomplet',
    });
  });

  it('simulation : XP prudents pour les actions publiées, refus explicites sinon', () => {
    const report = simulateRules(
      [
        { action: 'hike_session_processed', count: 3 },
        { action: 'compas_prepared', count: 2 },
      ],
      {
        registry: { version: '2.1', rules: Array.from({ length: 29 }, (_, i) => ({ id: `r${i}` })) },
      }
    );

    expect(report.version).toBe('2.1');
    expect(report.totalProjectedXp).toBe(120); // 3 × 40 prudent
    expect(report.refused).toBe(2);
    expect(report.lines[1].reason).toBe('action_non_publiee');
  });

  it('la simulation n’écrit RIEN : aucun RPC, aucun import de client Supabase', async () => {
    const rulePublication = await import('@/features/progression/server/rulePublication');
    expect(Object.keys(rulePublication)).not.toContain('publishRuleVersion');
    const report = simulateRules([{ action: 'hike_session_processed', count: 1 }]);
    expect(report.lines).toHaveLength(1);
  });
});
