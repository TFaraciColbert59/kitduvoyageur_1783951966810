import { describe, expect, it } from 'vitest';
import { getNativeGlassDestination, isProtectedCompasRoute, shouldShowNativeGlass } from '../nativeAccountRoutes';
import { DESTINATIONS } from '../destinationRegistry';

const HUB_HREF = DESTINATIONS.find((destination) => destination.id === 'adventures')!.href;

describe('Native iOS Liquid Glass — all navigable app routes except Compas', () => {
  it.each([
    [HUB_HREF, 'adventures'], [`${HUB_HREF}/voyage`, 'adventures'],
    ['/groupes', 'adventures'], ['/groupes/42', 'adventures'],
    ['/communaute', 'community'], ['/communaute/123', 'community'],
    ['/communaute', 'community'], ['/communaute/42', 'community'],
    ['/communaute/42', 'community'],
    ['/explorer', 'explorer'], ['/pays/france', 'explorer'],
    ['/messagerie', 'messages'], ['/messagerie/42', 'messages'],
    ['/compte', 'me'], ['/profil/abc', 'me'], ['/progression', 'me'],
    ['/panier', null], ['/', null], ['/carte-interactive', null],
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
    null,
  ])('keeps existing full-screen no-nav policy at %s', (route) => {
    expect(shouldShowNativeGlass(route)).toBe(false);
    expect(getNativeGlassDestination(route)).toBeNull();
  });
});
