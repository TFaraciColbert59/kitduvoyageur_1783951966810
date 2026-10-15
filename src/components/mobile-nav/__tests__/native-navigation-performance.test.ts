import { describe, it, expect } from 'vitest';
import { NATIVE_PREFETCH_ROUTES, getNativePrefetchRoutes, nativeSyncKey } from '../nativeNavigationPerformance';
import { shouldShowNativeGlass } from '../nativeAccountRoutes';

describe('iOS Liquid Glass — instant navigation policy', () => {
  it('warms exactly five unique canonical tabs and never the protected Compas', () => {
    expect(NATIVE_PREFETCH_ROUTES).toHaveLength(5);
    expect(new Set(NATIVE_PREFETCH_ROUTES.map((r) => r.href)).size).toBe(5);
    expect(NATIVE_PREFETCH_ROUTES.map((r) => r.href)).not.toContain('/compas');
  });
  it('avoids refetching the current route and duplicate speculative requests', () => {
    expect(getNativePrefetchRoutes('/hub')).not.toContain('/hub');
    expect(getNativePrefetchRoutes('/communaute')).toHaveLength(4);
    expect(getNativePrefetchRoutes('/communaute/123')).toHaveLength(5);
  });
  it('does not reuse native sync keys across routes or selection changes', () => {
    expect(nativeSyncKey({ visible: true, selectedId: 'community' }, '/communaute'))
      .not.toBe(nativeSyncKey({ visible: true, selectedId: 'me' }, '/compte'));
    expect(nativeSyncKey({ visible: false, selectedId: null }, '/compas'))
      .not.toBe(nativeSyncKey({ visible: true, selectedId: 'adventures' }, '/hub'));
  });
  it('preserves the absolute no-native-navigation protection for Compas', () => {
    expect(shouldShowNativeGlass('/compas')).toBe(false);
    expect(shouldShowNativeGlass('/compas/itineraire')).toBe(false);
  });
});
