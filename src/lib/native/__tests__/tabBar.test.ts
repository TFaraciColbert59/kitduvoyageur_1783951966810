import { describe, expect, it } from 'vitest';
import {
  NATIVE_TAB_HREFS,
  NATIVE_TAB_IDS,
  hrefForTabId,
  isAllowedTabId,
  isNativeTabBarHiddenRoute,
  tabIdForHref,
  tabIdForPathname,
} from '../tabBar';

/**
 * POC iOS Liquid Glass — contrat fermé du pont route ↔ tab.
 *
 * Garanties testées :
 * - exactement 5 onglets, hrefs canoniques du registre ;
 * - aucune URL arbitraire acceptée (allowlist stricte) ;
 * - résolution route → onglet déléguée au registre (préfixes longs) ;
 * - routes no-nav (miroir MobileNavWrapper) masquées côté natif.
 */
describe('native tab bar bridge contract', () => {
  it('expose exactement les cinq onglets canoniques, dans l ordre du registre', () => {
    expect([...NATIVE_TAB_IDS]).toEqual([
      'adventures',
      'community',
      'explorer',
      'messages',
      'me',
    ]);
    expect(NATIVE_TAB_HREFS).toEqual({
      adventures: '/hub',
      community: '/communaute',
      explorer: '/explorer',
      messages: '/messagerie',
      me: '/compte',
    });
  });

  it('hrefForTabId refuse tout identifiant hors allowlist', () => {
    expect(hrefForTabId('adventures')).toBe('/hub');
    expect(hrefForTabId('me')).toBe('/compte');
    expect(hrefForTabId('https://evil.example' as never)).toBeNull();
    expect(hrefForTabId('admin' as never)).toBeNull();
    expect(hrefForTabId('' as never)).toBeNull();
  });

  it('tabIdForHref ne résout que les hrefs exacts (pas de préfixe inventé)', () => {
    expect(tabIdForHref('/hub')).toBe('adventures');
    expect(tabIdForHref('/compte')).toBe('me');
    expect(tabIdForHref('/hub/extra')).toBeNull();
    expect(tabIdForHref('https://lkdv.example/hub')).toBeNull();
  });

  it('isAllowedTabId rejette les URL arbitraires et les chaînes vides', () => {
    expect(isAllowedTabId('explorer')).toBe(true);
    expect(isAllowedTabId('/explorer')).toBe(false);
    expect(isAllowedTabId('https://evil.example')).toBe(false);
    expect(isAllowedTabId('')).toBe(false);
    expect(isAllowedTabId(null)).toBe(false);
    expect(isAllowedTabId(undefined)).toBe(false);
  });

  it('tabIdForPathname suit le registre (exact puis préfixe le plus long)', () => {
    expect(tabIdForPathname('/hub')).toBe('adventures');
    expect(tabIdForPathname('/compas')).toBe('adventures');
    expect(tabIdForPathname('/communaute')).toBe('community');
    expect(tabIdForPathname('/clubs')).toBe('community');
    expect(tabIdForPathname('/explorer')).toBe('explorer');
    expect(tabIdForPathname('/pays/france')).toBe('explorer');
    expect(tabIdForPathname('/messagerie')).toBe('messages');
    expect(tabIdForPathname('/messagerie/conversation-1')).toBe('messages');
    expect(tabIdForPathname('/compte')).toBe('me');
    expect(tabIdForPathname('/profil/moi')).toBe('me');
    // Après navigation in-page, le bon onglet reste sélectionné.
    expect(tabIdForPathname('/carnets/mon-carnet')).toBe('community');
    expect(tabIdForPathname(null)).toBeNull();
    expect(tabIdForPathname('/route-inconnue-xyz')).toBeNull();
  });

  it('isNativeTabBarHiddenRoute miroite MobileNavWrapper (auth, checkout, publication)', () => {
    expect(isNativeTabBarHiddenRoute('/connexion')).toBe(true);
    expect(isNativeTabBarHiddenRoute('/inscription')).toBe(true);
    expect(isNativeTabBarHiddenRoute('/checkout')).toBe(true);
    expect(isNativeTabBarHiddenRoute('/checkout/success')).toBe(true);
    expect(isNativeTabBarHiddenRoute('/communaute/publier')).toBe(true);
    expect(isNativeTabBarHiddenRoute('/hub')).toBe(false);
    expect(isNativeTabBarHiddenRoute('/messagerie')).toBe(false);
    expect(isNativeTabBarHiddenRoute('/carte-interactive')).toBe(false);
    expect(isNativeTabBarHiddenRoute(null)).toBe(false);
  });
});
