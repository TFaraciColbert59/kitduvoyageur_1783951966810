// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buildProfile, pointAt, sampleRoute, sparkPath } from '../engine/elevation';
import { CompasAccessory } from '../components/CompasAccessory';

const line: Array<[number, number]> = [
  [45.0, 5.5],
  [45.0, 5.6],
  [45.1, 5.6],
];

describe('sampleRoute — échantillons réguliers le long du tracé', () => {
  it('commence au départ, finit à l’arrivée, distances croissantes', () => {
    const s = sampleRoute(line, 5);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ lat: 45, lon: 5.5, km: 0 });
    expect(s[4]).toMatchObject({ lat: 45.1, lon: 5.6 });
    expect(s[4].km).toBeGreaterThan(18);
    for (let i = 1; i < s.length; i += 1) expect(s[i].km).toBeGreaterThan(s[i - 1].km);
  });

  it('CONTRE-EXEMPLE — un seul point ou des coordonnées invalides : rien', () => {
    expect(sampleRoute([[45, 5.5]])).toEqual([]);
    expect(
      sampleRoute([
        [95, 5.5],
        [NaN, 1],
      ] as Array<[number, number]>)
    ).toEqual([]);
  });
});

describe('buildProfile — aucune altitude inventée', () => {
  const samples = [{ km: 0 }, { km: 1 }, { km: 2 }, { km: 3 }];

  it('garde les valeurs reçues, trouve le point haut', () => {
    const p = buildProfile(samples, [1000, 1500.4, null, 1200], 'src');
    expect(p?.points.map((x) => x.m)).toEqual([1000, 1500, 1200]);
    expect(p).toMatchObject({ maxM: 1500, minM: 1000, maxAtKm: 1, source: 'src' });
    expect(pointAt(p!, 1).m).toBe(1200);
    expect(sparkPath(p!)).toMatch(/^M0\.0 /);
  });

  it('CONTRE-EXEMPLE — réponse incomplète ou absurde : pas de profil', () => {
    expect(buildProfile(samples, [1000, 1100], 'src')).toBeNull();
    expect(buildProfile(samples, [null, null, 99999, 1], 'src')).toBeNull();
    expect(buildProfile(samples, 'erreur', 'src')).toBeNull();
  });
});

describe('CompasAccessory', () => {
  afterEach(cleanup);

  const profile = buildProfile(
    [{ km: 0 }, { km: 5 }, { km: 10 }],
    [1000, 2100, 1400],
    'Open-Meteo · Copernicus DEM GLO-90'
  );

  it('affiche l’altitude max et se lit au clavier', () => {
    render(
      <CompasAccessory profile={profile} gainM={1100} distanceKm={10} days={1} stepsCount={1} />
    );
    expect(screen.getByText(/2\s?100 m/)).toBeTruthy();
    const slider = screen.getByRole('slider', { name: 'Profil d’altitude du parcours' });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByText(/1\s?400 m/)).toBeTruthy();
    expect(screen.getByText('au km 10,0')).toBeTruthy();
  });

  it('sans profil : dénivelé et distance, aucune altitude', () => {
    render(<CompasAccessory profile={null} gainM={800} distanceKm={12} days={2} stepsCount={3} />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText('dénivelé positif')).toBeTruthy();
  });
});
