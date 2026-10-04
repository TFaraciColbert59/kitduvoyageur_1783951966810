import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSsoProviders } from '@/lib/auth/sso';

describe('getSsoProviders', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('retourne une liste vide par défaut (aucun bouton)', () => {
    vi.stubEnv('NEXT_PUBLIC_SSO_PROVIDERS', '');
    expect(getSsoProviders()).toEqual([]);
  });

  it('accepte les fournisseurs connus avec libellés', () => {
    vi.stubEnv('NEXT_PUBLIC_SSO_PROVIDERS', 'azure,google');
    expect(getSsoProviders()).toEqual([
      { id: 'azure', label: 'Microsoft' },
      { id: 'google', label: 'Google' },
    ]);
  });

  it('ignore les inconnus, normalise et déduplique', () => {
    vi.stubEnv('NEXT_PUBLIC_SSO_PROVIDERS', ' Google,evil-provider,google , AZURE ');
    expect(getSsoProviders()).toEqual([
      { id: 'google', label: 'Google' },
      { id: 'azure', label: 'Microsoft' },
    ]);
  });
});
