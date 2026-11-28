// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXPLORER_CATEGORY_ORDER,
  selectExplorerMapContext,
  type ExplorerCategory,
  type ExplorerDetent,
} from '../mapContext';
import { ExplorerGlassDrawer } from '../ExplorerGlassDrawer';

describe('explorer-v2 redesign · selectExplorerMapContext', () => {
  it('stays dormant on cold boot in peek detent (returns exact reference)', () => {
    const userLayers: Record<string, boolean> = {
      routes: true,
      hillshade: true,
      pokedexSpecies: false,
      hazardFires: false,
      socialBottles: false,
    };

    const result = selectExplorerMapContext({
      detent: 'peek',
      category: 'pokedex',
      lensId: 'all',
      userLayerVisibility: userLayers,
      hasInteracted: false,
    });

    expect(result).toBe(userLayers);
    expect(result.pokedexSpecies).toBe(false);
  });

  it('respects user layers unchanged for explorer and layers categories', () => {
    const userLayers: Record<string, boolean> = {
      routes: true,
      slope: false,
    };

    expect(
      selectExplorerMapContext({
        detent: 'mid',
        category: 'explorer',
        lensId: 'spots',
        userLayerVisibility: userLayers,
        hasInteracted: true,
      }),
    ).toBe(userLayers);

    expect(
      selectExplorerMapContext({
        detent: 'full',
        category: 'layers',
        lensId: 'presets',
        userLayerVisibility: userLayers,
        hasInteracted: true,
      }),
    ).toBe(userLayers);
  });

  it('overlays ephemeral pokedexSpecies without mutating userLayerVisibility', () => {
    const userLayers: Record<string, boolean> = {
      routes: true,
      pokedexSpecies: false,
    };
    const snapshot = { ...userLayers };

    const result = selectExplorerMapContext({
      detent: 'mid',
      category: 'pokedex',
      lensId: 'all',
      userLayerVisibility: userLayers,
      hasInteracted: true,
    });

    expect(result).not.toBe(userLayers);
    expect(result.pokedexSpecies).toBe(true);
    expect(result.routes).toBe(true);
    expect(userLayers).toEqual(snapshot);
  });

  it('overlays ephemeral safety layers per lens (hazards, weather, survival) without mutating input', () => {
    const base: Record<string, boolean> = {
      routes: true,
      hazardFires: false,
      hazardFloods: false,
      hazardSeismic: false,
      dangers: false,
      rainRadar: false,
      water: false,
      refuges: false,
      rescue: false,
    };
    const snapshot = { ...base };

    const hazards = selectExplorerMapContext({
      detent: 'mid',
      category: 'safety',
      lensId: 'hazards',
      userLayerVisibility: base,
      hasInteracted: true,
    });
    expect(hazards.hazardFires).toBe(true);
    expect(hazards.hazardFloods).toBe(true);
    expect(hazards.hazardSeismic).toBe(true);
    expect(hazards.dangers).toBe(true);
    expect(hazards.rainRadar).toBe(false);

    const weather = selectExplorerMapContext({
      detent: 'mid',
      category: 'safety',
      lensId: 'weather',
      userLayerVisibility: base,
      hasInteracted: true,
    });
    expect(weather.rainRadar).toBe(true);
    expect(weather.hazardFires).toBe(false);

    const survival = selectExplorerMapContext({
      detent: 'full',
      category: 'safety',
      lensId: 'survival',
      userLayerVisibility: base,
      hasInteracted: true,
    });
    expect(survival.water).toBe(true);
    expect(survival.refuges).toBe(true);
    expect(survival.rescue).toBe(true);
    expect(survival.rainRadar).toBe(false);

    expect(base).toEqual(snapshot);
  });

  it('overlays ephemeral community layers per lens (bottles, carnets, clubs, stories) without mutating input', () => {
    const base: Record<string, boolean> = {
      routes: true,
      socialBottles: false,
      socialCarnets: false,
      socialClubs: false,
      socialStories: false,
    };
    const snapshot = { ...base };

    const cases: Array<[string, keyof typeof base]> = [
      ['bottles', 'socialBottles'],
      ['carnets', 'socialCarnets'],
      ['clubs', 'socialClubs'],
      ['stories', 'socialStories'],
    ];

    for (const [lensId, expectedKey] of cases) {
      const result = selectExplorerMapContext({
        detent: 'mid',
        category: 'community',
        lensId,
        userLayerVisibility: base,
        hasInteracted: true,
      });
      expect(result[expectedKey]).toBe(true);
      expect(result.routes).toBe(true);
    }

    expect(base).toEqual(snapshot);
  });

  it('exports the exact 6-category order including activities (Rando, GR & Activités)', () => {
    expect(EXPLORER_CATEGORY_ORDER).toEqual([
      'explorer',
      'activities',
      'layers',
      'pokedex',
      'safety',
      'community',
    ]);
  });

  it('activates routes, walkRoutes, bikeRoutes and distanceMarkers when category is activities', () => {
    const base = { routes: false, walkRoutes: false, bikeRoutes: false, distanceMarkers: false };
    const result = selectExplorerMapContext({
      detent: 'mid',
      category: 'activities',
      lensId: 'all',
      userLayerVisibility: base,
      hasInteracted: true,
    });
    expect(result.routes).toBe(true);
    expect(result.walkRoutes).toBe(true);
    expect(result.bikeRoutes).toBe(true);
    expect(result.distanceMarkers).toBe(true);
  });
});

describe('explorer-v2 redesign · ExplorerGlassDrawer', () => {
  const bottomBarEvents: Array<{ hide: boolean }> = [];
  const onToggleBottomBar = (event: Event) => {
    const custom = event as CustomEvent<{ hide: boolean }>;
    bottomBarEvents.push(custom.detail);
  };

  beforeEach(() => {
    bottomBarEvents.length = 0;
    delete document.documentElement.dataset.explorerSheetOpen;
    window.addEventListener('lkdv-toggle-bottom-bar', onToggleBottomBar);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('lkdv-toggle-bottom-bar', onToggleBottomBar);
    delete document.documentElement.dataset.explorerSheetOpen;
  });

  function renderDrawer(overrides?: {
    detent?: ExplorerDetent;
    activeCategory?: ExplorerCategory;
    onDetentChange?: (detent: ExplorerDetent) => void;
    onCategoryChange?: (category: ExplorerCategory) => void;
    onOpenSportLaunch?: () => void;
  }) {
    const onDetentChange = overrides?.onDetentChange ?? vi.fn();
    const onCategoryChange = overrides?.onCategoryChange ?? vi.fn();
    const onOpenSportLaunch = overrides?.onOpenSportLaunch ?? vi.fn();

    const utils = render(
      React.createElement(ExplorerGlassDrawer, {
        detent: overrides?.detent ?? 'peek',
        onDetentChange,
        activeCategory: overrides?.activeCategory ?? 'explorer',
        onCategoryChange,
        categoryTitle: 'Explorer',
        lenses: [
          { id: 'spots', label: 'Spots' },
          { id: 'territory', label: 'Territoire' },
        ],
        activeLensIndex: 0,
        onLensChange: vi.fn(),
        onOpenSportLaunch,
        renderLens: (lens) => React.createElement('div', null, `Pane ${lens.id}`),
      }),
    );

    return { ...utils, onDetentChange, onCategoryChange, onOpenSportLaunch };
  }

  it('renders 6 full-width CapsuleTabs categories inside the drawer header', () => {
    renderDrawer({ detent: 'peek' });

    const tablist = screen.getByRole('tablist', { name: 'Catégories Explorer' });
    const tabs = tablist.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(6);
  });

  it('dispatches lkdv-toggle-bottom-bar (hide: false in peek, hide: true in mid/full) and restores on unmount', () => {
    const { rerender, unmount, onDetentChange, onCategoryChange, onOpenSportLaunch } =
      renderDrawer({ detent: 'peek' });

    expect(bottomBarEvents[bottomBarEvents.length - 1]).toEqual({ hide: false });
    expect(document.documentElement.dataset.explorerSheetOpen).toBeUndefined();

    rerender(
      React.createElement(ExplorerGlassDrawer, {
        detent: 'mid',
        onDetentChange,
        activeCategory: 'explorer',
        onCategoryChange,
        categoryTitle: 'Explorer',
        lenses: [{ id: 'spots', label: 'Spots' }],
        activeLensIndex: 0,
        onLensChange: vi.fn(),
        onOpenSportLaunch,
      }),
    );

    expect(bottomBarEvents[bottomBarEvents.length - 1]).toEqual({ hide: true });
    expect(document.documentElement.dataset.explorerSheetOpen).toBe('true');

    rerender(
      React.createElement(ExplorerGlassDrawer, {
        detent: 'full',
        onDetentChange,
        activeCategory: 'explorer',
        onCategoryChange,
        categoryTitle: 'Explorer',
        lenses: [{ id: 'spots', label: 'Spots' }],
        activeLensIndex: 0,
        onLensChange: vi.fn(),
        onOpenSportLaunch,
      }),
    );

    expect(document.documentElement.dataset.explorerSheetOpen).toBe('true');

    unmount();
    expect(bottomBarEvents[bottomBarEvents.length - 1]).toEqual({ hide: false });
    expect(document.documentElement.dataset.explorerSheetOpen).toBeUndefined();
  });

  it('expands peek -> mid when clicking another category icon or the active category icon', () => {
    const onDetentChange = vi.fn();
    const onCategoryChange = vi.fn();
    renderDrawer({
      detent: 'peek',
      activeCategory: 'explorer',
      onDetentChange,
      onCategoryChange,
    });

    const pokedexTab = screen.getByRole('tab', { name: 'Pokédex' });
    fireEvent.click(pokedexTab);

    expect(onCategoryChange).toHaveBeenCalledWith('pokedex');
    expect(onDetentChange).toHaveBeenCalledWith('mid');

    onDetentChange.mockClear();
    const explorerTab = screen.getByRole('tab', { name: 'Explorer' });
    fireEvent.click(explorerTab);
    expect(onDetentChange).toHaveBeenCalledWith('mid');
  });

  it('cycles peek -> mid -> full -> peek when tapping the grabber', () => {
    const onDetentChange = vi.fn();
    const { rerender, onCategoryChange, onOpenSportLaunch } = renderDrawer({
      detent: 'peek',
      onDetentChange,
    });

    const grabber = document.querySelector<HTMLButtonElement>('.lkdv-mgrab');
    expect(grabber).toBeTruthy();

    fireEvent.click(grabber!);
    expect(onDetentChange).toHaveBeenLastCalledWith('mid');

    rerender(
      React.createElement(ExplorerGlassDrawer, {
        detent: 'mid',
        onDetentChange,
        activeCategory: 'explorer',
        onCategoryChange,
        categoryTitle: 'Explorer',
        lenses: [{ id: 'spots', label: 'Spots' }],
        activeLensIndex: 0,
        onLensChange: vi.fn(),
        onOpenSportLaunch,
      }),
    );
    fireEvent.click(grabber!);
    expect(onDetentChange).toHaveBeenLastCalledWith('full');

    rerender(
      React.createElement(ExplorerGlassDrawer, {
        detent: 'full',
        onDetentChange,
        activeCategory: 'explorer',
        onCategoryChange,
        categoryTitle: 'Explorer',
        lenses: [{ id: 'spots', label: 'Spots' }],
        activeLensIndex: 0,
        onLensChange: vi.fn(),
        onOpenSportLaunch,
      }),
    );
    fireEvent.click(grabber!);
    expect(onDetentChange).toHaveBeenLastCalledWith('peek');
  });
});
