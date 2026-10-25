import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Plan 5.4 : « Barre d'état lisible sur le paysage clair du Compas ».
 *
 * Le Compas force le thème clair (paysage éclairci) ; le reste de l'app garde la
 * barre d'état verte à texte clair. Sur le Compas seul, le texte de la barre
 * doit être sombre, et le style d'avant doit revenir en le quittant.
 *
 * Ces tests prouvent les appels faits au plugin Capacitor, pas le rendu natif :
 * celui-ci n'est vérifiable que sur un iPhone ou un Android réel.
 */

const plugin = vi.hoisted(() => ({
  setStyle: vi.fn(async (_o: { style: string }) => {}),
  setBackgroundColor: vi.fn(async (_o: { color: string }) => {}),
  setOverlaysWebView: vi.fn(async (_o: { overlay: boolean }) => {}),
}));
const native = vi.hoisted(() => ({ value: true }));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: plugin,
  Style: { Dark: 'DARK', Light: 'LIGHT', Default: 'DEFAULT' },
}));
vi.mock('@/lib/native/platform', () => ({ isNative: () => native.value }));

import {
  applyLKDVStatusBarTheme,
  applyStatusBarTheme,
  statusBarThemeForPath,
} from '@/lib/native/status-bar';

beforeEach(() => {
  native.value = true;
  plugin.setStyle.mockClear().mockImplementation(async () => {});
  plugin.setBackgroundColor.mockClear().mockImplementation(async () => {});
  plugin.setOverlaysWebView.mockClear().mockImplementation(async () => {});
});

describe('thème de barre d’état selon la page', () => {
  it('le Compas et ses sous-pages ont leur thème, rien d’autre', () => {
    expect(statusBarThemeForPath('/compas')).toBe('compas');
    expect(statusBarThemeForPath('/compas/')).toBe('compas');
    expect(statusBarThemeForPath('/compas/chargement')).toBe('compas');
    expect(statusBarThemeForPath('/compasX')).toBe('default');
    expect(statusBarThemeForPath('/hub')).toBe('default');
    expect(statusBarThemeForPath('/voyages/compas')).toBe('default');
    expect(statusBarThemeForPath('/')).toBe('default');
    expect(statusBarThemeForPath(null)).toBe('default');
    expect(statusBarThemeForPath(undefined)).toBe('default');
  });
});

describe('barre d’état native', () => {
  it('Compas : texte sombre (Style.Light) sur fond clair, la page passe dessous', async () => {
    await applyStatusBarTheme('compas');
    expect(plugin.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    // Android ≤ 14 et fonds opaques : un fond clair, jamais le vert du reste de l'app.
    expect(plugin.setBackgroundColor).toHaveBeenCalledWith({ color: '#FBFAF6' });
    expect(plugin.setOverlaysWebView).toHaveBeenCalledWith({ overlay: true });
  });

  it('autres pages : texte clair (Style.Dark) sur vert forêt, comme avant', async () => {
    await applyStatusBarTheme('default');
    expect(plugin.setStyle).toHaveBeenCalledWith({ style: 'DARK' });
    expect(plugin.setBackgroundColor).toHaveBeenCalledWith({ color: '#17402C' });
    expect(plugin.setOverlaysWebView).toHaveBeenCalledWith({ overlay: true });
  });

  it('applyLKDVStatusBarTheme reste le thème des autres pages (le hub l’appelle)', async () => {
    await applyLKDVStatusBarTheme();
    expect(plugin.setStyle).toHaveBeenCalledWith({ style: 'DARK' });
    expect(plugin.setBackgroundColor).toHaveBeenCalledWith({ color: '#17402C' });
  });

  it('entrée puis sortie du Compas : le dernier mot est celui des autres pages', async () => {
    // Appels lancés sans attendre, comme le fait un changement rapide de page :
    // l'ordre des appels natifs doit rester celui des demandes.
    const entering = applyStatusBarTheme('compas');
    const leaving = applyStatusBarTheme('default');
    await Promise.all([entering, leaving]);
    const styles = plugin.setStyle.mock.calls.map((c) => c[0].style);
    expect(styles).toEqual(['LIGHT', 'DARK']);
    const colors = plugin.setBackgroundColor.mock.calls.map((c) => c[0].color);
    expect(colors).toEqual(['#FBFAF6', '#17402C']);
  });

  it('une étape non gérée (fond sur iOS) n’empêche pas le style, qui compte le plus', async () => {
    plugin.setBackgroundColor.mockRejectedValue(new Error('unimplemented'));
    plugin.setOverlaysWebView.mockRejectedValue(new Error('unimplemented'));
    await expect(applyStatusBarTheme('compas')).resolves.toBeUndefined();
    expect(plugin.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('un échec n’empoisonne pas les demandes suivantes', async () => {
    plugin.setStyle.mockRejectedValueOnce(new Error('plugin absent'));
    await expect(applyStatusBarTheme('compas')).resolves.toBeUndefined();
    await applyStatusBarTheme('default');
    expect(plugin.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' });
  });

  it('dans un navigateur : aucun appel natif', async () => {
    native.value = false;
    await applyStatusBarTheme('compas');
    await applyStatusBarTheme('default');
    await applyLKDVStatusBarTheme();
    expect(plugin.setStyle).not.toHaveBeenCalled();
    expect(plugin.setBackgroundColor).not.toHaveBeenCalled();
    expect(plugin.setOverlaysWebView).not.toHaveBeenCalled();
  });
});
