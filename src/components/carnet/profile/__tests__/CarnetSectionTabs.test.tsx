// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARNET_SECTIONS, CarnetSectionTabs } from '../CarnetSectionTabs';

afterEach(() => cleanup());

describe('CarnetSectionTabs — capsule 48 dans la carte', () => {
  it('expose les cinq sections attendues, dans l’ordre', () => {
    expect(CARNET_SECTIONS.map((s) => s.label)).toEqual([
      'Récit',
      'Parcours',
      'Moments',
      'Matériel',
      'Nature',
    ]);
  });

  it('rend une seule lentille et délègue le changement d’index', () => {
    const onIndexChange = vi.fn();
    const { container } = render(<CarnetSectionTabs activeIndex={0} onIndexChange={onIndexChange} />);
    expect(container.querySelectorAll('.sel-lens')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Récit' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Matériel' }));
    expect(onIndexChange).toHaveBeenCalledWith(3);
  });

  it('avance au clavier avec les flèches', () => {
    const onIndexChange = vi.fn();
    render(<CarnetSectionTabs activeIndex={0} onIndexChange={onIndexChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });
});
