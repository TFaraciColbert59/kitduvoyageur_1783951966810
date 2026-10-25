/** Plan 2.11 : cookies de session Lax, None seulement dans un cadre d'un autre site. */
import { describe, expect, it } from 'vitest';
import { sessionCookieAttrs } from '@/lib/supabase/client';

describe('attributs des cookies de session', () => {
  it('page normale en HTTPS : Lax et Secure', () => {
    expect(sessionCookieAttrs({ crossSiteFrame: false, https: true })).toBe('SameSite=Lax; Secure');
  });
  it('développement en HTTP : Lax sans Secure', () => {
    expect(sessionCookieAttrs({ crossSiteFrame: false, https: false })).toBe('SameSite=Lax');
  });
  it('cadre d’un autre site : None et Secure (seul cas où Lax ne marche pas)', () => {
    expect(sessionCookieAttrs({ crossSiteFrame: true, https: true })).toBe('SameSite=None; Secure');
  });
});
