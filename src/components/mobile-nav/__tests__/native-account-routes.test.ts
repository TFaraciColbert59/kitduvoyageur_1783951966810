import { describe, expect, it } from 'vitest';
import { shouldUseNativeAccountBar } from '../nativeAccountRoutes';

describe('iOS native Account Liquid Glass pilot routing', () => {
  it.each(['/compte', '/compte/parametres', '/compte/abonnements', '/profil', '/profil/123', '/progression'])(
    'enables native bar on account route %s',
    (path) => expect(shouldUseNativeAccountBar(path)).toBe(true),
  );

  it.each(['/hub', '/communaute', '/explorer', '/messagerie', '/connexion', '/connexion?mode=connexion', '/inscription', '/checkout', '/', null])(
    'keeps the web bar or no-nav policy on %s',
    (path) => expect(shouldUseNativeAccountBar(path)).toBe(false),
  );
});
