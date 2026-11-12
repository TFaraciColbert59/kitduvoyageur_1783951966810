// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Montage réel d'ExplorerV2 avec ses enfants lourds neutralisés : vérifie que
 * l'hydratation du réglage S1.05 est bien branchée au montage. Sans l'appel
 * `hydrateAutoPausePreference()` dans l'effet, ce test échoue.
 */
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@/features/explorer-v2/map/prefetchMapStage', () => ({}));
vi.mock('@/features/explorer-v2/sheet/ExplorerSheet', () => ({
  ExplorerSheet: () => null,
}));
vi.mock('@/features/explorer-v2/sheet/SheetContent', () => ({
  buildSheetModel: () => ({
    title: '',
    subtitle: '',
    tabs: [],
    actions: [],
    mini: 0,
    onBack: undefined,
    tabsBottom: false,
  }),
}));
vi.mock('@/features/explorer-v2/chrome/TopChrome', () => ({ TopChrome: () => null }));
vi.mock('@/features/explorer-v2/chrome/BottomBar', () => ({ ActivityPill: () => null }));
vi.mock('@/features/explorer-v2/chrome/SosButton', () => ({ SosButton: () => null }));
vi.mock('@/features/explorer-v2/activity/Countdown', () => ({
  Countdown: () => null,
  useLongPress: () => ({}),
}));
vi.mock('@/features/explorer-v2/activity/useGpsTracker', () => ({
  useGpsTracker: () => undefined,
}));
vi.mock('@/features/explorer-v2/native/liveActivity', () => ({
  startLiveActivity: async () => undefined,
  updateLiveActivity: async () => undefined,
  endLiveActivity: async () => undefined,
}));
vi.mock('@/features/explorer-v2/activity/sosCall', () => ({
  performSosCall: () => false,
  planSosCall: () => ({ number: '112' }),
  sosSimulated: () => true,
}));
vi.mock('@/features/explorer-v2/offline/queue', () => ({
  enqueue: async () => undefined,
  flushQueue: async () => ({ sent: 0 }),
  listQueue: async () => [],
}));
vi.mock('@/features/explorer-v2/offline/zone', () => ({
  registerOfflineWorker: async () => undefined,
}));
vi.mock('@/features/explorer-v2/activity/offRoute', () => ({
  bearingLabel: () => null,
  offRouteLabel: () => '',
}));
vi.mock('@/features/explorer-v2/ui/XpIcon', () => ({ XpIcon: () => null }));
vi.mock('@/features/explorer-v2/state/haptics', () => ({
  haptic: () => undefined,
}));
vi.mock('@/features/explorer-v2/data/hooks', () => ({
  geometryCenter: () => null,
  useCountriesGeo: () => ({ data: null, status: 'success', error: null }),
  useCountryDetails: () => ({ data: null }),
  useOnline: () => true,
  usePlace: () => ({ data: null }),
  useReducedMotion: () => false,
  useRegionsGeo: () => ({ data: null }),
  useSystemTheme: () => 'light',
  useWeather: () => ({ data: null }),
  useContent: () => ({ data: [] }),
  useReportsNear: () => ({ data: [] }),
}));
vi.mock('@/features/explorer-v2/sheet/context', () => ({
  distanceKm: () => 0,
  findCountryAt: () => null,
  findRegionAt: () => null,
  formatDistance: () => '0 km',
  formatDuration: () => '0:00',
  SPORT_META: {},
}));

import ExplorerV2 from '@/features/explorer-v2/ExplorerV2';
import {
  AUTO_PAUSE_STORAGE_KEY,
  useExplorerStore,
} from '@/features/explorer-v2/state/store';

describe('explorer-v2 · hydratation au montage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(AUTO_PAUSE_STORAGE_KEY);
    useExplorerStore.setState({
      activity: undefined,
      summary: undefined,
      summarySaved: undefined,
      autoPauseEnabled: useExplorerStore.getInitialState().autoPauseEnabled,
      locationPermission: 'denied',
      scene: undefined,
      sheet: 'level',
      detent: 'peek',
      camera: { type: 'none' },
      center: [6.87, 45.92],
      zoom: 11,
    });
  });

  afterEach(cleanup);

  it('applique la préférence stockée pendant le montage', async () => {
    window.localStorage.setItem(AUTO_PAUSE_STORAGE_KEY, '0');

    render(<ExplorerV2 />);

    await waitFor(() => {
      expect(useExplorerStore.getState().autoPauseEnabled).toBe(false);
    });
  });

  it('conserve le défaut ON quand aucune préférence n’est stockée', async () => {
    expect(useExplorerStore.getInitialState().autoPauseEnabled).toBe(true);

    render(<ExplorerV2 />);

    await waitFor(() => {
      expect(useExplorerStore.getState().autoPauseEnabled).toBe(true);
    });
  });
});
