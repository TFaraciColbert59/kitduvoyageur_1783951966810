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

  it('dessine un chemin par morceau, sans relier deux segments', () => {
    const segmented: ElevationPoint[] = [
      { distanceKm: 0, elevationM: 1200, lat: 45.9, lng: 6.9, segmentIndex: 0 },
      { distanceKm: 0.8, elevationM: 1300, lat: 45.91, lng: 6.91, segmentIndex: 0 },
      { distanceKm: 0.8, elevationM: 1250, lat: 45.95, lng: 6.95, segmentIndex: 1 },
      { distanceKm: 1.6, elevationM: 1400, lat: 45.96, lng: 6.96, segmentIndex: 1 },
    ];
    const { container } = render(<CarnetAltitude points={segmented} />);

    const lines = container.querySelectorAll('path[data-altitude-line]');
    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute('data-altitude-line')).toBe('0');
    expect(lines[1].getAttribute('data-altitude-line')).toBe('1');
    /* Le second chemin démarre à x=50 %, pas à 0 : la distance est cumulée. */
    const second = lines[1].getAttribute('d') ?? '';
    expect(second.startsWith('M50.00,')).toBe(true);
  });

  it('reste une image non interactive sans le drapeau', () => {
    render(<CarnetAltitude points={points} />);
    const image = screen.getByRole('img', { name: /Profil d’altitude/ });
    expect(image.getAttribute('tabindex')).toBeNull();
  });
});
