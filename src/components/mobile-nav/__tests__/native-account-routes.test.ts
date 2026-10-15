import { describe, expect, it } from 'vitest';
import { getNativeGlassDestination, isProtectedCompasRoute, shouldShowNativeGlass, hasCommunityInPageTabs, isNoBottomNavigationRoute } from '../nativeAccountRoutes';
import { DESTINATIONS } from '../destinationRegistry';

const HUB_HREF = DESTINATIONS.find((destination) => destination.id === 'adventures')!.href;

describe('Native iOS Liquid Glass — all navigable app routes except Compas', () => {
  it('never duplicates the Community category tabs at the bottom', () => {
    expect(hasCommunityInPageTabs('/communaute')).toBe(true);
    expect(hasCommunityInPageTabs('/communaute/publier')).toBe(false);
    expect(hasCommunityInPageTabs('/clubs')).toBe(false);
  });
  it('recognizes every auth and composer route as full-screen', () => {
    expect(isNoBottomNavigationRoute('/connexion')).toBe(true);
    expect(isNoBottomNavigationRoute('/checkout/retour')).toBe(true);
    expect(isNoBottomNavigationRoute('/communaute/publier')).toBe(true);
    expect(isNoBottomNavigationRoute('/communaute')).toBe(false);
  });
  it.each([
    [HUB_HREF, 'adventures'], [`${HUB_HREF}/voyage`, 'adventures'],
    ['/voyages', 'adventures'], ['/groupes', 'adventures'],
    ['/materiel', 'adventures'], ['/kits/sac', 'adventures'],
    ['/prepare', 'adventures'], ['/preparer-randonnee', null],
    ['/communaute', 'community'], ['/communaute/123', 'community'],
    ['/communaute-pro/equipe', 'community'], ['/clubs/42', 'community'],
    ['/carnets/42', 'community'], ['/evenements/123', 'community'],
    ['/explorer', 'explorer'], ['/pays/france', 'explorer'],
    ['/messagerie', 'messages'], ['/messagerie/42', 'messages'],
    ['/compte', 'me'], ['/profil/abc', 'me'], ['/progression', 'me'],
    ['/boutique', null], ['/panier', null], ['/outils', null], ['/', null],
    ['/randonnee-active', null], ['/carte-interactive', null],
  ] as const)('native bar is present on %s and highlights %s', (route, selectedId) => {
    expect(shouldShowNativeGlass(route)).toBe(true);
    expect(getNativeGlassDestination(route)).toBe(selectedId);
  });

  it.each([
    '/compas', '/compas/', '/compas/parcours', '/compas/parcours/123',
  ])('NEVER activates UIKit or changes web bar on protected %s', (route) => {
    expect(isProtectedCompasRoute(route)).toBe(true);
    expect(shouldShowNativeGlass(route)).toBe(false);
    expect(getNativeGlassDestination(route)).toBeNull();
  });

  it('does not confuse a lookalike route with Compas', () => {
    expect(isProtectedCompasRoute('/compass')).toBe(false);
    expect(shouldShowNativeGlass('/compass')).toBe(true);
  });

  it.each([
    '/connexion', '/connexion/mot-de-passe', '/inscription',
    '/checkout', '/checkout/resultat',
    '/communaute/publier', '/communaute/publier/photos', null,
  ])('keeps existing full-screen no-nav policy at %s', (route) => {
    expect(shouldShowNativeGlass(route)).toBe(false);
    expect(getNativeGlassDestination(route)).toBeNull();
  });
});
