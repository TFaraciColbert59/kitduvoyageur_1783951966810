// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Chaîne iOS natif : acquireStoryOpen -> événement `lkdv-toggle-bottom-bar` ->
 * NavigationBar (plugin LKDVAccountTabBar.setVisible) -> UIKit. Ici on vérifie
 * l'émission et l'absence de « dernier écrivant gagne » avec les autres demandeurs.
 */
const ios = vi.hoisted(() => ({ value: true }));
vi.mock('@/lib/native/platform', () => ({ isIOS: () => ios.value }));

type Mod = typeof import('../storyOpenMarker');
let mod: Mod;
let seen: boolean[];
const record = (e: Event) => seen.push((e as CustomEvent<{ hide: boolean }>).detail.hide);
const external = (hide: boolean) =>
  window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide } }));

beforeEach(async () => {
  vi.resetModules();
  ios.value = true;
  seen = [];
  mod = await import('../storyOpenMarker');
  window.addEventListener('lkdv-toggle-bottom-bar', record);
});
afterEach(() => {
  window.removeEventListener('lkdv-toggle-bottom-bar', record);
  delete document.documentElement.dataset.storyOpen;
  delete document.body.dataset.storyOpen;
});

describe('storyOpenMarker : barre native iOS', () => {
  it('iOS natif : hide à la première ouverture, show à la dernière fermeture', () => {
    const a = mod.acquireStoryOpen();
    const b = mod.acquireStoryOpen();
    expect(seen).toEqual([true]);
    a();
    expect(seen).toEqual([true]);
    b();
    expect(seen).toEqual([true, false]);
  });

  it('web / Android : aucun événement (le CSS suffit)', () => {
    ios.value = false;
    mod.acquireStoryOpen()();
    expect(seen).toEqual([]);
  });

  it('un autre demandeur masque déjà la barre : la fermeture de la story ne la rend pas', () => {
    external(true); // ex. tiroir carte ouvert
    seen.length = 0;
    const release = mod.acquireStoryOpen();
    release();
    expect(seen).toEqual([true]); // ouverture émise, fermeture NON émise
  });

  it('un autre demandeur lève le masquage pendant la story : il est rétabli', async () => {
    const release = mod.acquireStoryOpen();
    seen.length = 0;
    external(false);
    await Promise.resolve();
    expect(seen).toEqual([false, true]);
    release();
    expect(seen).toEqual([false, true, false]);
  });
});
