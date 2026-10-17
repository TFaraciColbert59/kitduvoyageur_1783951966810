import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  LIQUID_GLASS_DETENTS,
  addNativeSheetDetentListener,
  addNativeUndoListener,
  dismissNativeSheet,
  getNativeLiquidGlassCapabilities,
  hideNativeUndoBanner,
  isAllowedSheetDetent,
  isNativeLiquidGlassSupported,
  presentNativeMorphingMenu,
  presentNativeUndoBanner,
  setNativeOutdoorMode,
  setNativeSheetDetent,
  triggerNativeGlassHaptic,
} from '../liquidGlass';
import {
  addNativeTabAccessoryListener,
  setNativeTabBarAccessory,
  setNativeTabBarMinimized,
  setNativeTabBarOutdoorMode,
} from '../tabBar';

const ROOT = process.cwd();

describe('iOS 27 Liquid Glass v8 native bridge contract', () => {
  it('expose exactement les 4 états de feuille normalisés (closed, peek, medium, large)', () => {
    expect([...LIQUID_GLASS_DETENTS]).toEqual(['closed', 'peek', 'medium', 'large']);
    expect(isAllowedSheetDetent('peek')).toBe(true);
    expect(isAllowedSheetDetent('medium')).toBe(true);
    expect(isAllowedSheetDetent('large')).toBe(true);
    expect(isAllowedSheetDetent('closed')).toBe(true);
    expect(isAllowedSheetDetent('fullscreen')).toBe(false);
    expect(isAllowedSheetDetent('')).toBe(false);
    expect(isAllowedSheetDetent(null)).toBe(false);
  });

  it('est no-op sûr hors environnement iOS natif (Web / Node / SSR)', async () => {
    expect(isNativeLiquidGlassSupported()).toBe(false);
    const caps = await getNativeLiquidGlassCapabilities();
    expect(caps).toEqual({
      available: false,
      iosMajor: 0,
      supportsLiquidGlass: false,
      supportsThreeDetents: false,
      supportsTabAccessory: false,
      outdoorMode: false,
      activeDetent: 'closed',
    });

    await expect(setNativeSheetDetent('peek')).resolves.toBeUndefined();
    await expect(dismissNativeSheet()).resolves.toBeUndefined();
    await expect(
      presentNativeMorphingMenu({
        title: 'Visibilité',
        selectedId: '1',
        options: [{ id: '1', label: 'Communauté' }],
      })
    ).resolves.toBeNull();
    await expect(
      presentNativeUndoBanner({ title: 'Empreinte : Communauté', undoable: true })
    ).resolves.toBeUndefined();
    await expect(hideNativeUndoBanner()).resolves.toBeUndefined();
    await expect(setNativeOutdoorMode(true)).resolves.toBeUndefined();
    await expect(triggerNativeGlassHaptic('selection')).resolves.toBeUndefined();

    const unsubUndo = await addNativeUndoListener(() => {});
    expect(typeof unsubUndo).toBe('function');
    unsubUndo();

    const unsubDetent = await addNativeSheetDetentListener(() => {});
    expect(typeof unsubDetent).toBe('function');
    unsubDetent();
  });

  it('expose les méthodes d accessoire, de minimisation et de mode plein soleil sur NativeTabBar en no-op web sûr', async () => {
    await expect(setNativeTabBarMinimized(true)).resolves.toBeUndefined();
    await expect(setNativeTabBarOutdoorMode(true)).resolves.toBeUndefined();
    await expect(
      setNativeTabBarAccessory({
        visible: true,
        title: '318 km',
        subtitle: '12 derniers mois',
        symbol: 'mountain.2',
        sparkline: [12, 18, 22, 19, 34, 42, 38, 28, 31, 24, 29, 21],
      })
    ).resolves.toBeUndefined();

    const unsubAcc = await addNativeTabAccessoryListener(() => {});
    expect(typeof unsubAcc).toBe('function');
    unsubAcc();
  });

  it('vérifie la cohérence des fichiers Swift iOS 27 et du projet Xcode', () => {
    const containerSwift = readFileSync(
      join(ROOT, 'ios/App/App/NativeTabBar/NativeTabBarContainer.swift'),
      'utf8'
    );
    const tabPluginSwift = readFileSync(
      join(ROOT, 'ios/App/App/NativeTabBar/NativeTabBarPlugin.swift'),
      'utf8'
    );
    const glassPluginSwift = readFileSync(
      join(ROOT, 'ios/App/App/NativeTabBar/NativeLiquidGlassPlugin.swift'),
      'utf8'
    );
    const pbxproj = readFileSync(
      join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'),
      'utf8'
    );

    expect(containerSwift).toContain('LKDVSparklineView');
    expect(containerSwift).toContain('setMinimized');
    expect(containerSwift).toContain('setOutdoorMode');
    expect(containerSwift).toContain('presentUndoBanner');
    expect(tabPluginSwift).toContain('CAPPluginMethod(name: "setAccessory"');
    expect(tabPluginSwift).toContain('CAPPluginMethod(name: "setMinimized"');
    expect(tabPluginSwift).toContain('CAPPluginMethod(name: "setOutdoorMode"');
    expect(glassPluginSwift).toContain('@objc(NativeLiquidGlass)');
    expect(glassPluginSwift).toContain('CAPPluginMethod(name: "setSheetDetent"');
    expect(glassPluginSwift).toContain('CAPPluginMethod(name: "presentMorphingMenu"');
    expect(glassPluginSwift).toContain('CAPPluginMethod(name: "presentUndoBanner"');
    expect(pbxproj).toContain('NativeLiquidGlassPlugin.swift in Sources');
  });
});
