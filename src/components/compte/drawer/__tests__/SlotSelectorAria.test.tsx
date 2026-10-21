// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SlotSelector } from '../SlotSelector';
import { SlotShell } from '../SlotShell';

afterEach(() => cleanup());

function renderShell(activeSlot: 'vitrine' | 'kit' = 'vitrine') {
  return render(
    <SlotShell
      slot={activeSlot}
      viewer="visitor"
      visibility="public"
      title="Vitrine"
      subtitle="Ta trace publique"
      icon={<span aria-hidden="true">◆</span>}
      lenses={[{ id: 'stats', label: 'Stats' }]}
      activeLensIndex={0}
      onLensChange={() => {}}
      selector={<SlotSelector activeSlot={activeSlot} onSlotChange={() => {}} />}
    >
      contenu
    </SlotShell>
  );
}

describe('SlotSelector — ARIA sans IDREF orphelin', () => {
  it('ne référence que le panneau réellement monté', () => {
    const { container } = renderShell('vitrine');
    const tabs = screen.getAllByRole('tab', { name: /Vitrine|Kit|Prêts|Souvenirs|Communauté/ });

    expect(tabs).toHaveLength(5);
    const withControls = tabs.filter((tab) => tab.hasAttribute('aria-controls'));
    expect(withControls).toHaveLength(1);
    expect(withControls[0].getAttribute('aria-selected')).toBe('true');

    const panelId = withControls[0].getAttribute('aria-controls') as string;
    expect(container.querySelector(`#${panelId}`)).not.toBeNull();

    for (const tab of tabs) {
      const controls = tab.getAttribute('aria-controls');
      if (controls) {
        expect(document.getElementById(controls), `IDREF orphelin : ${controls}`).not.toBeNull();
      }
    }
  });

  it('déplace l’unique référence quand un autre slot est actif', () => {
    const { container } = renderShell('kit');
    const tabs = screen.getAllByRole('tab', { name: /Vitrine|Kit|Prêts|Souvenirs|Communauté/ });
    const withControls = tabs.filter((tab) => tab.hasAttribute('aria-controls'));

    expect(withControls).toHaveLength(1);
    expect(withControls[0].getAttribute('aria-selected')).toBe('true');
    const panelId = withControls[0].getAttribute('aria-controls') as string;
    expect(panelId).toBe('lkdv-slot-panel-kit');
    expect(container.querySelector(`#${panelId}`)).not.toBeNull();
  });
});
