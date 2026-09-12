import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartTerrainSection } from '@/features/materiel/components/depart/DepartTerrainSection';
import type { MapTrail } from '@/components/explorer/types';
import type { WeatherForecast } from '@/features/materiel/services/getWeather';

vi.mock('framer-motion', async () => ({
  ...(await vi.importActual('framer-motion')),
  useReducedMotion: () => false,
}));

vi.mock('next/dynamic', () => ({
  default: () => () => React.createElement('div', { 'data-testid': 'mock-depart-map' }, 'Carte GPS'),
}));

const trail: MapTrail = {
  id: 'tmb',
  name: 'Tour du Mont-Blanc',
  lat: 45.9,
  lng: 6.87,
  distance_km: 42,
};

const weather: WeatherForecast = {
  cells: [{ hour: '09:00', tempC: 14, precipPct: 10, weathercode: 1 }],
  days: [
    {
      date: '2026-09-20',
      day: 'Dim',
      tempMinC: 8,
      tempMaxC: 18,
      precipPct: 20,
      weathercode: 2,
    },
  ],
  current: { tempC: 15, weathercode: 1, precipPct: 10 },
  location: { latitude: 45.9, longitude: 6.87, label: 'Chamonix' },
};

const render = (props: { trail: MapTrail | null; weather: WeatherForecast | null }) =>
  renderToStaticMarkup(
    React.createElement(DepartTerrainSection, { ...props, updatedAt: '2026-09-12T08:00:00Z' })
  );

describe('DepartTerrainSection', () => {
  it('expose l’eyebrow « Terrain » et une carte unique', () => {
    const html = render({ trail, weather: null });
    expect(html).toContain('Terrain');
    expect(html).toContain('data-testid="mock-depart-map"');
    expect(html.match(/data-testid="mock-depart-map"/g)).toHaveLength(1);
  });

  it('affiche la pastille de distance quand le sentier en fournit une', () => {
    const html = render({ trail, weather: null });
    expect(html).toContain('glass-pill');
    expect(html).toContain('42 km');
  });

  it('rend la météo quand elle est fournie, sans bloc vide sinon', () => {
    const withWeather = render({ trail, weather });
    expect(withWeather).toContain('aria-label="Météo"');
    expect(withWeather).toContain('Météo du secteur');

    const withoutWeather = render({ trail, weather: null });
    expect(withoutWeather).not.toContain('aria-label="Météo"');
    expect(withoutWeather).not.toContain('Météo du secteur');
  });

  it('reste sur le vocabulaire DS autorisé (source du nouveau composant)', () => {
    const src = readFileSync(
      'src/features/materiel/components/depart/DepartTerrainSection.tsx',
      'utf8'
    );
    for (const forbidden of [/rose-\d/, /sand-\d/, /forest-\d/, /bg-white\/(60|90)/, /dark:/]) {
      expect(src).not.toMatch(forbidden);
    }
  });
});
