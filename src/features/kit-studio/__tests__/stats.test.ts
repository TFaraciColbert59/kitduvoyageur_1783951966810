// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { createInitialKitConfiguration, DEFAULT_BAG_CAPABILITIES } from '../state/kitConfiguration';
import { selectDerivedTotals } from '../state/selectors';
import { StatistiquesDrawer } from '../drawers/StatistiquesDrawer';

describe('StatistiquesDrawer — C-03, D-08, D-09, D-10, D-11', () => {
  afterEach(() => {
    cleanup();
  });

  it('C-03 & D-08 : affiche des unités explicites (g / kg) et signale « + 3 objets non pesés » sans les compter pour 0 g', () => {
    const config = createInitialKitConfiguration('kit-stats-1', {
      items: [
        {
          id: 'i-1',
          productOwnershipId: null,
          name: 'Tente 2P',
          category: 'Abri',
          quantity: 1,
          weightG: 1400,
          weightSource: 'declared',
          isChecked: true,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
        {
          id: 'i-2',
          productOwnershipId: null,
          name: 'Veste pluie',
          category: 'Vêtements',
          quantity: 1,
          weightG: null,
          weightSource: 'unknown',
          isChecked: false,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
        {
          id: 'i-3',
          productOwnershipId: null,
          name: 'Gants laine',
          category: 'Vêtements',
          quantity: 2,
          weightG: null,
          weightSource: 'unknown',
          isChecked: false,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    const totals = selectDerivedTotals(config);
    expect(totals.unknownWeightCount).toBe(3);
    expect(totals.knownWeightG).toBe(1400);

    render(React.createElement(StatistiquesDrawer, { config, totals }));

    expect(screen.getByTestId('stats-known-weight').textContent).toBe('1,4 kg');
    expect(screen.getByTestId('stats-checked-weight').textContent).toBe('1,4 kg');
    expect(screen.getByTestId('stats-unknown-weight-banner').textContent).toContain(
      '+ 3 objets non pesés'
    );
  });

  it('D-09 : n’affiche AUCUNE jauge ni section de volume lorsque capacityL / declaredCapacityL est null', () => {
    const config = createInitialKitConfiguration('kit-stats-null-vol', {
      bag: {
        modelId: 'duffel-60',
        capabilities: { ...DEFAULT_BAG_CAPABILITIES, hasInterior: false },
        parts: {},
        declaredCapacityL: null,
      },
    });
    const totals = selectDerivedTotals(config);
    expect(totals.volumeEstimateL).toBeNull();

    render(React.createElement(StatistiquesDrawer, { config, totals }));
    expect(screen.queryByTestId('stats-volume-section')).toBeNull();
  });

  it('D-10 : ne contient aucune occurrence des mots interdits dans le code ni dans le rendu', () => {
    const filePath = path.resolve(
      __dirname,
      '../drawers/StatistiquesDrawer.tsx'
    );
    const source = fs.readFileSync(filePath, 'utf8').toLowerCase();
    const forbiddenA = ['p', 'a', 'r', 'f', 'a', 'i', 't'].join('');
    const forbiddenB = ['s', 'c', 'o', 'r', 'e'].join('');
    expect(source.includes(forbiddenA)).toBe(false);
    expect(source.includes(forbiddenB)).toBe(false);
  });

  it('D-11 : permet d’épingler une configuration et de la comparer à la configuration courante sans perdre la précédente', () => {
    const configA = createInitialKitConfiguration('kit-compare-1', {
      revision: 1,
      items: [
        {
          id: 'i-a',
          productOwnershipId: null,
          name: 'Duvet 0°C',
          category: 'Couchage',
          quantity: 1,
          weightG: 850,
          weightSource: 'declared',
          isChecked: true,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    });

    const { rerender } = render(
      React.createElement(StatistiquesDrawer, {
        config: configA,
        totals: selectDerivedTotals(configA),
      })
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Comparer' }));
    fireEvent.change(screen.getByTestId('stats-snapshot-label-input'), {
      target: { value: 'Base 850g' },
    });
    fireEvent.click(screen.getByTestId('stats-pin-snapshot-btn'));

    const configB = {
      ...configA,
      revision: 2,
      items: [
        ...configA.items,
        {
          id: 'i-b',
          productOwnershipId: null,
          name: 'Matelas isolant',
          category: 'Couchage',
          quantity: 1,
          weightG: 450,
          weightSource: 'declared' as const,
          isChecked: false,
          slotId: null,
          slotOrder: null,
          visual: null,
        },
      ],
    };

    rerender(
      React.createElement(StatistiquesDrawer, {
        config: configB,
        totals: selectDerivedTotals(configB),
      })
    );

    const grid = screen.getByTestId('stats-comparison-grid');
    expect(grid.textContent).toContain('Base 850g');
    expect(grid.textContent).toContain('850 g');
    expect(grid.textContent).toContain('1,3 kg');
    expect(screen.getByTestId('stats-comparison-delta').textContent).toContain('+ 450 g');
  });
});
