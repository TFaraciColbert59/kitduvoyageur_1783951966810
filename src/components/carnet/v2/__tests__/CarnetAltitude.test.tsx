// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CarnetAltitude } from '../CarnetAltitude';
import type { ElevationPoint } from '@/features/carnet/detail/types';

afterEach(() => cleanup());

const points: ElevationPoint[] = [
  { distanceKm: 0, elevationM: 1200, lat: 45.9, lng: 6.9 },
  { distanceKm: 2.5, elevationM: 1450, lat: 45.91, lng: 6.91 },
  { distanceKm: 5, elevationM: 1320, lat: 45.92, lng: 6.92 },
];

describe('CarnetAltitude', () => {
  it('ne rend rien sans deux mesures réelles', () => {
    const { container } = render(<CarnetAltitude points={[]} />);
    expect(container.querySelector('svg')).toBeNull();

    const one = render(<CarnetAltitude points={[points[0]]} />);
    expect(one.container.querySelector('svg')).toBeNull();
  });

  it('rend un profil interactif et expose l’altitude au clavier', () => {
    const onScrub = vi.fn();
    render(<CarnetAltitude points={points} interactive onScrub={onScrub} />);

    const slider = screen.getByRole('slider', { name: /Profil d’altitude/ });
    expect(slider.getAttribute('aria-valuemax')).toBe('2');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onScrub).toHaveBeenCalledWith(points[1]);
    expect(slider.getAttribute('aria-valuetext')).toContain('1450 mètres');
  });

  it('reste une image non interactive sans le drapeau', () => {
    render(<CarnetAltitude points={points} />);
    const image = screen.getByRole('img', { name: /Profil d’altitude/ });
    expect(image.getAttribute('tabindex')).toBeNull();
  });
});
