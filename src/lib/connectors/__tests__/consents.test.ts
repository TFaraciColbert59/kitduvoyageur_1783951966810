import { beforeEach, describe, expect, it } from 'vitest';

import { hydrateConnectorConsentFromDb } from '../consents';
import { getConnectorSession, resetConnectorStoreForTests } from '../serverStore';

function fakeClient(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: async () => result,
      }),
    }),
  } as never;
}

beforeEach(() => {
  resetConnectorStoreForTests();
});

describe('Connecteurs — hydratation des consentements P01', () => {
  it('lit les finalités réelles et force la santé à false', async () => {
    await hydrateConnectorConsentFromDb(
      'user-consent',
      fakeClient({
        data: [
          { purpose: 'personal_performance', granted: true, policy_version: 'a1-v1' },
          { purpose: 'collective_terrain', granted: false, policy_version: 'a1-v1' },
          { purpose: 'external_readiness', granted: true, policy_version: 'a1-v1' },
        ],
        error: null,
      })
    );

    const snapshot = getConnectorSession('user-consent').snapshot;
    expect(snapshot.purposes.personal_performance).toBe(true);
    expect(snapshot.purposes.collective_terrain).toBe(false);
    expect(snapshot.purposes.external_readiness).toBe(false);
    expect(snapshot.policyVersion).toBe('a1-v1');
  });

  it('conserve le snapshot courant si la base est indisponible', async () => {
    const session = getConnectorSession('user-consent');
    session.snapshot = { ...session.snapshot, purposes: { personal_performance: true } };

    await hydrateConnectorConsentFromDb(
      'user-consent',
      fakeClient({ data: null, error: { message: 'db down' } })
    );

    expect(getConnectorSession('user-consent').snapshot.purposes.personal_performance).toBe(true);
  });
});
