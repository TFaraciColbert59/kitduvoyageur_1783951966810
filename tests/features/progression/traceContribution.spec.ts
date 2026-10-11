/** T28 — traces contributives : import seul, clone, zone sensible, licence. */
import { describe, it, expect } from 'vitest';
import { evaluateTraceContribution } from '@/features/progression/server/traceProof';

const BASE = {
  importOnly: false,
  hasControlledRealization: true,
  traceFingerprint: 'abc123def456',
  license: 'cc_by',
};

describe('preuve de trace', () => {
  it('trace authentifiée nouvelle → claim trace', () => {
    expect(evaluateTraceContribution(BASE)).toEqual({ ok: true, claimKey: 'trace:abc123def456' });
  });

  it('refus : import seul, réalisation absente, clone, sensible, licence', () => {
    expect(evaluateTraceContribution({ ...BASE, importOnly: true })).toEqual({ ok: false, reason: 'import_seul_refuse' });
    expect(evaluateTraceContribution({ ...BASE, hasControlledRealization: false })).toEqual({ ok: false, reason: 'realisation_non_controlee' });
    expect(evaluateTraceContribution({ ...BASE, existingFingerprints: ['abc123def456'] })).toEqual({ ok: false, reason: 'deja_incluse' });
    expect(evaluateTraceContribution({ ...BASE, containsSensitiveZone: true })).toEqual({ ok: false, reason: 'geometrie_sensible' });
    expect(evaluateTraceContribution({ ...BASE, license: 'proprietary' })).toEqual({ ok: false, reason: 'licence_incompatible' });
  });

  it('empreinte trop courte (révision inutile) → refus', () => {
    expect(evaluateTraceContribution({ ...BASE, traceFingerprint: 'abc' })).toEqual({ ok: false, reason: 'trace_inchangee' });
  });
});
