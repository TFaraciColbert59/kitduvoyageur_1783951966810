// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sport, SportSelection } from '@/features/explorer-v2/state/types';
import { useExplorerStore } from '@/features/explorer-v2/state/store';
import { SportPicker } from '@/features/explorer-v2/sheet/SheetContent';
import type { SheetContext } from '@/features/explorer-v2/sheet/context';

afterEach(cleanup);

function context(onStartSport: (sport: Sport, selection?: SportSelection) => void): SheetContext {
  useExplorerStore.setState({ locationPermission: 'granted' });
  return {
    state: useExplorerStore.getState(),
    onStartSport,
  } as unknown as SheetContext;
}

describe('explorer-v2 · drawer de départ', () => {
  beforeEach(() => {
    // jsdom n’implémente pas Geolocation ; on teste la décision de départ, pas
    // la capture native (qui reste une preuve appareil séparée).
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {},
    });
  });

  it('transmet la variante choisie au callback de démarrage', () => {
    const onStartSport = vi.fn<(sport: Sport, selection?: SportSelection) => void>();
    render(<SportPicker ctx={context(onStartSport)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Randonnée' }));
    fireEvent.click(screen.getByRole('button', { name: 'Randonnée avec nuit en refuge' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Démarrer · Randonnée avec nuit en refuge/ }),
    );

    expect(onStartSport).toHaveBeenCalledTimes(1);
    expect(onStartSport).toHaveBeenCalledWith(
      'rando',
      expect.objectContaining({
        sport: 'rando',
        variantId: 'rando-refuge',
        variantLabel: 'Randonnée avec nuit en refuge',
        catalogSlug: 'rando-refuge',
        environment: 'outdoor',
      }),
    );
  });

  it('ne rend pas cliquable une variante indoor indisponible', () => {
    render(<SportPicker ctx={context(vi.fn())} />);

    fireEvent.click(screen.getByRole('button', { name: 'Course' }));

    expect(screen.queryByRole('button', { name: 'Course sur tapis' })).toBeNull();
    expect(screen.getByText(/Aucune capture indoor n’est branchée/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Démarrer · Course sur route/ })).toBeTruthy();
  });
});
