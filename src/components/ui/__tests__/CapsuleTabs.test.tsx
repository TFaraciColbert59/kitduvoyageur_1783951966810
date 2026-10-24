// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapsuleTabs, type CapsuleTabItem } from '../CapsuleTabs';

afterEach(() => cleanup());

const ITEMS: CapsuleTabItem[] = [
  { id: 'a', label: 'Alpha', icon: <span>1</span> },
  { id: 'b', label: 'Bravo', icon: <span>2</span> },
  { id: 'c', label: 'Charlie', icon: <span>3</span> },
];

describe('CapsuleTabs — capsule principale 48 px', () => {
  it('rend un onglet par item, une seule lentille et `--n`', () => {
    const { container } = render(
      <CapsuleTabs items={ITEMS} activeIndex={1} onIndexChange={() => {}} ariaLabel="Sections" />
    );

    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    expect(tablist.className).toContain('segc');
    expect(tablist.className).toContain('lg-tabs');
    expect(tablist.className).toContain('lens-on');
    expect(tablist.className).toContain('lkdv-capsule');
    expect((tablist as HTMLElement).style.getPropertyValue('--n')).toBe('3');
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');

    expect(screen.getAllByRole('tab')).toHaveLength(3);

    const lens = container.querySelectorAll('.sel-lens');
    expect(lens).toHaveLength(1);
    expect((lens[0] as HTMLElement).style.getPropertyValue('--i')).toBe('1');
    expect(lens[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('marque un seul onglet actif et applique le roving tabindex', () => {
    render(<CapsuleTabs items={ITEMS} activeIndex={1} onIndexChange={() => {}} ariaLabel="Sections" />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(tabs[1].getAttribute('aria-label')).toBe('Bravo');
    expect(tabs[1].getAttribute('title')).toBe('Bravo');
  });

  it('ne place `aria-controls` que sur l’onglet actif', () => {
    render(
      <CapsuleTabs
        items={ITEMS}
        activeIndex={0}
        onIndexChange={() => {}}
        ariaLabel="Sections"
        idFor={(id) => `tab-${id}`}
        panelIdFor={(id) => `panel-${id}`}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('aria-controls')).toBe('panel-a');
    expect(tabs[1].getAttribute('aria-controls')).toBeNull();
    expect(tabs[2].getAttribute('aria-controls')).toBeNull();
    expect(tabs[0].id).toBe('tab-a');
  });

  it('gère flèches, Home et End', () => {
    const onIndexChange = vi.fn();
    render(
      <CapsuleTabs items={ITEMS} activeIndex={1} onIndexChange={onIndexChange} ariaLabel="Sections" />
    );
    const tablist = screen.getByRole('tablist', { name: 'Sections' });

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    fireEvent.keyDown(tablist, { key: 'End' });
    fireEvent.keyDown(tablist, { key: 'Home' });

    expect(onIndexChange.mock.calls.map((call) => call[0])).toEqual([2, 0, 2, 0]);
  });

  it('boucle de la dernière à la première cellule', () => {
    const onIndexChange = vi.fn();
    render(
      <CapsuleTabs items={ITEMS} activeIndex={2} onIndexChange={onIndexChange} ariaLabel="Sections" />
    );
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Sections' }), { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('ne rappelle pas `onIndexChange` en cliquant l’onglet déjà actif', () => {
    const onIndexChange = vi.fn();
    render(
      <CapsuleTabs items={ITEMS} activeIndex={1} onIndexChange={onIndexChange} ariaLabel="Sections" />
    );
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(onIndexChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('tab')[2]);
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it('ne rend rien sans item', () => {
    const { container } = render(
      <CapsuleTabs items={[]} activeIndex={0} onIndexChange={() => {}} ariaLabel="Vide" />
    );
    expect(container.firstChild).toBeNull();
  });
});
