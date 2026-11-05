// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { BagListView } from '../list/BagListView';
import { BagScene } from '../scene/BagScene';
import { PersonnaliserDrawer } from '../drawers/PersonnaliserDrawer';
import { createInitialKitConfiguration, DEFAULT_BAG_CAPABILITIES } from '../state/kitConfiguration';
import { selectDerivedTotals } from '../state/selectors';

describe('Cycle de vie Scène 3D, Mode Liste & Contrôles Lecture Seule — C-15, C-17, D-07, E-07', () => {
  it('E-07 & C-15 : BagListView en readOnly=true n’émet AUCUN bouton d’édition dans le DOM, et offre 100 % des contrôles en mode propriétaire', () => {
    const config = createInitialKitConfiguration('kit-list-1', {
      slots: {
        'front-pocket': {
          id: 'front-pocket',
          kind: 'pocket',
          capacityL: 4,
          maxItems: 5,
          itemIds: ['item-1'],
        },
      },
      items: [
        {
          id: 'item-1',
          productOwnershipId: null,
          name: 'Lampe frontale',
          category: 'Sécurité',
          quantity: 1,
          weightG: 92,
          weightSource: 'declared',
          isChecked: false,
          slotId: 'front-pocket',
          slotOrder: 0,
          visual: null,
        },
      ],
    });
    const totals = selectDerivedTotals(config);

    // 1. Mode lecture seule (membre du groupe, E-07)
    const { rerender } = render(
      <BagListView
        config={config}
        totals={totals}
        readOnly={true}
        ownerLabel="Camille"
        onToggleChecked={() => {}}
        onUpdateQuantity={() => {}}
        onMoveItem={() => {}}
        onRemoveItem={() => {}}
        onOpenDrawer={() => {}}
      />
    );

    expect(screen.queryByTestId('list-check-item-item-1')).toBeNull();
    expect(screen.queryByTestId('list-slot-select-item-1')).toBeNull();
    expect(screen.queryByTestId('list-qty-inc-item-1')).toBeNull();
    expect(screen.queryByTestId('list-qty-dec-item-1')).toBeNull();
    expect(screen.queryByTestId('list-remove-item-item-1')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();

    // 2. Mode propriétaire (C-15 : parité complète des commandes)
    const onCheck = vi.fn();
    rerender(
      <BagListView
        config={config}
        totals={totals}
        readOnly={false}
        onToggleChecked={onCheck}
        onUpdateQuantity={() => {}}
        onMoveItem={() => {}}
        onRemoveItem={() => {}}
        onOpenDrawer={() => {}}
      />
    );

    const checkBtn = screen.getByTestId('list-check-item-item-1');
    fireEvent.click(checkBtn);
    expect(onCheck).toHaveBeenCalledWith('item-1', true);
    expect(screen.getByTestId('list-slot-select-item-1')).toBeTruthy();
    expect(screen.getByTestId('list-remove-item-item-1')).toBeTruthy();
  });

  it('D-07 : PersonnaliserDrawer affiche un état indisponible explicite lorsque customizableParts est vide', () => {
    const config = createInitialKitConfiguration('kit-no-parts', {
      bag: {
        modelId: 'duffel-60',
        capabilities: {
          ...DEFAULT_BAG_CAPABILITIES,
          customizableParts: [],
        },
        parts: {},
        declaredCapacityL: 60,
      },
    });

    render(
      <PersonnaliserDrawer
        config={config}
        selectedPartId={null}
        onFocusPart={() => {}}
        onCustomizePart={() => {}}
        onSelectBagModel={() => {}}
      />
    );

    expect(screen.getByTestId('personnaliser-unavailable').textContent).toContain(
      'Personnalisation par pièce indisponible'
    );
  });

  it('C-17 : BagScene met sa boucle de rendu en pause dès qu’il est recouvert par une feuille opaque', () => {
    const config = createInitialKitConfiguration('kit-scene-pause', {
      bag: {
        modelId: 'trekker-55',
        capabilities: DEFAULT_BAG_CAPABILITIES,
        parts: {},
        declaredCapacityL: 55,
      },
    });

    const { rerender } = render(
      <BagScene
        config={config}
        isCoveredByOpaqueSheet={false}
        onDegraded={() => {}}
      />
    );

    const sceneEl = screen.getByTestId('kit-studio-bag-scene');
    expect(sceneEl.getAttribute('data-render-paused')).toBe('false');
    // C-09 : bouton Recentrer toujours présent
    expect(screen.getByTestId('studio-recenter-btn')).toBeTruthy();

    rerender(
      <BagScene
        config={config}
        isCoveredByOpaqueSheet={true}
        onDegraded={() => {}}
      />
    );

    expect(
      screen.getByTestId('kit-studio-bag-scene').getAttribute('data-render-paused')
    ).toBe('true');
  });
});
