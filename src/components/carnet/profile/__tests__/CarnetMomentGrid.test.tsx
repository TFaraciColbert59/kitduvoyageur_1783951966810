// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetMomentGrid } from '../CarnetMomentGrid';
import { moment } from './fixtures';

afterEach(() => cleanup());

describe('CarnetMomentGrid — grille dans la carte', () => {
  it('affiche jusqu’à 9 tuiles et résume le reste', () => {
    const moments = Array.from({ length: 12 }, (_, i) => moment(`m${i}`, `https://cdn.test/${i}.jpg`));
    const { container } = render(<CarnetMomentGrid moments={moments} onOpenViewer={() => {}} isOwner={false} />);
    expect(container.querySelectorAll('.ckp-tile')).toHaveLength(9);
    expect(container.querySelector('.ckp-tile-more')?.textContent).toBe('+3');
    expect(container.querySelector('.ckp-grid-wrap')).toBeTruthy();
  });

  it('ouvre le viewer sur la bonne image', () => {
    const onOpenViewer = vi.fn();
    const { container } = render(
      <CarnetMomentGrid moments={[moment('a', 'https://cdn.test/a.jpg'), moment('b', 'https://cdn.test/b.jpg')]} onOpenViewer={onOpenViewer} isOwner={false} />,
    );
    fireEvent.click(container.querySelectorAll('.ckp-tile')[1]);
    expect(onOpenViewer).toHaveBeenCalledWith(1);
  });

  it('affiche l’état vide honnête', () => {
    render(<CarnetMomentGrid moments={[]} onOpenViewer={() => {}} isOwner={false} />);
    expect(screen.getByText('Aucun moment pour l’instant.')).toBeTruthy();
  });
});
