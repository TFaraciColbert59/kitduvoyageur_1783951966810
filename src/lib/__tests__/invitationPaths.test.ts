import { describe, expect, it } from 'vitest';
import {
  profileInvitationLoginPath,
  profileInvitationPath,
} from '@/lib/invitationPaths';

describe('invitationPaths — liens d’invitation de profil', () => {
  it('renvoie vers le compte : les pages d invitation ont été supprimées', () => {
    expect(profileInvitationPath('jeton-abc_123')).toBe('/compte');
  });

  it('encode le next de connexion vers le compte', () => {
    const token = 'a/b c';
    const path = profileInvitationPath(token);
    expect(path).toBe('/compte');
    expect(profileInvitationLoginPath(token)).toBe(
      `/connexion?next=${encodeURIComponent(path)}`
    );
  });
});
