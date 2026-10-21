// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotSelector } from '../SlotSelector';
import { SlotShell } from '../SlotShell';

afterEach(cleanup);

const lenses = [
  { id: 'stats', label: 'Stats' },
  { id: 'repost', label: 'Republication' },
  { id: 'badges', label: 'Trophées' },
];

function renderShell(onSlotChange = vi.fn()) {
  render(
    <SlotShell
      slot="vitrine"
      viewer="owner"
      visibility="public"
      invited
      title="Vitrine"
      subtitle="Ta trace publique"
      icon={null}
      lenses={lenses}
      activeLensIndex={0}
      onLensChange={() => {}}
      renderLens={(lens) => <div data-testid="slot-content">Contenu {lens.id}</div>}
      selector={<SlotSelector activeSlot="vitrine" onSlotChange={onSlotChange} />}
    />
  );
  return onSlotChange;
}

describe('SlotShell — panes et sélecteur accessibles', () => {
  it('ne laisse qu’un slot-content (pane active) et nomme les autres panes', () => {
    renderShell();
    expect(screen.getAllByTestId('slot-content')).toHaveLength(1);
    expect(screen.getByTestId('slot-pane-repost')).toBeTruthy();
    expect(screen.getByTestId('slot-pane-badges')).toBeTruthy();
    expect(screen.getByTestId('slot-pane-repost').hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('slot-pane-badges').hasAttribute('inert')).toBe(true);
  });

  it('relie les onglets de slot au panneau et applique le roving tabindex', () => {
    renderShell();
    const tablist = screen.getByRole('tablist', { name: 'Slots du profil' });
    const vitrine = screen.getByRole('tab', { name: 'Vitrine' });
    const kit = screen.getByRole('tab', { name: 'Kit' });
    expect(vitrine.getAttribute('aria-controls')).toBe('lkdv-slot-panel-vitrine');
    expect(screen.getByRole('tabpanel', { name: 'Vitrine' })).toBeTruthy();
    expect(vitrine.getAttribute('tabindex')).toBe('0');
    expect(kit.getAttribute('tabindex')).toBe('-1');
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('navigue entre les slots au clavier avec les flèches', () => {
    const onSlotChange = renderShell();
    const tablist = screen.getByRole('tablist', { name: 'Slots du profil' });
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onSlotChange).toHaveBeenCalledWith('kit');
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onSlotChange).toHaveBeenCalledWith('communaute');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onSlotChange).toHaveBeenCalledWith('communaute');
  });
});
