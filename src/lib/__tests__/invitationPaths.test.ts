import { describe, expect, it } from 'vitest';
import {
  profileInvitationLoginPath,
  profileInvitationPath,
} from '@/lib/invitationPaths';

describe('invitationPaths — liens d’invitation de profil', () => {
  it('construit le chemin public dédié au profil, pas celui du voyage', () => {
    expect(profileInvitationPath('jeton-abc_123')).toBe(
      '/invitation/profil/jeton-abc_123'
    );
  });

  it('encode le jeton et le next de connexion', () => {
    const token = 'a/b c';
    const path = profileInvitationPath(token);
    expect(path).toBe('/invitation/profil/a%2Fb%20c');
    expect(profileInvitationLoginPath(token)).toBe(
      `/connexion?next=${encodeURIComponent(path)}`
    );
  });
});
