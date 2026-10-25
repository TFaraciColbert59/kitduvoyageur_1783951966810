/** T31 — tâches collectives : confirmateur distinct, substance, pas de double. */
import { describe, it, expect } from 'vitest';
import { evaluateGroupTask } from '@/features/progression/server/groupTaskProof';

const BASE = {
  responsibleId: 'u1',
  confirmerId: 'u2',
  contentLength: 120,
  isMicroSplit: false,
  creditedAsOrganizationForSameService: false,
  taskFingerprint: 'task-1',
};

describe('tâche collective', () => {
  it('confirmation par un autre membre → claim unique', () => {
    expect(evaluateGroupTask(BASE)).toEqual({ ok: true, claimKey: 'group_task:task-1' });
  });

  it('refus : auto-confirmation, micropartition, double organisation, doublon', () => {
    expect(evaluateGroupTask({ ...BASE, confirmerId: 'u1' })).toEqual({ ok: false, reason: 'auto_confirmation' });
    expect(evaluateGroupTask({ ...BASE, isMicroSplit: true })).toEqual({ ok: false, reason: 'tache_sans_substance' });
    expect(evaluateGroupTask({ ...BASE, contentLength: 5 })).toEqual({ ok: false, reason: 'tache_sans_substance' });
    expect(evaluateGroupTask({ ...BASE, creditedAsOrganizationForSameService: true })).toEqual({ ok: false, reason: 'deja_creditee_comme_organisation' });
    expect(evaluateGroupTask({ ...BASE, existingFingerprints: ['task-1'] })).toEqual({ ok: false, reason: 'deja_creditee' });
  });
});
