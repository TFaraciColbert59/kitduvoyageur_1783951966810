import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('@/features/pays/hooks/usePaysWeather', () => ({ usePaysWeather: vi.fn() }));
vi.mock('@/features/pays/hooks/usePaysRegions', () => ({ usePaysRegions: vi.fn() }));

import { usePaysWeather } from '@/features/pays/hooks/usePaysWeather';
import { usePaysRegions } from '@/features/pays/hooks/usePaysRegions';
import { PaysWeatherCard } from '@/features/pays/components/PaysWeatherCard';
import { PaysRegionsList } from '@/features/pays/components/PaysRegionsList';

const weatherMock = vi.mocked(usePaysWeather);
const regionsMock = vi.mocked(usePaysRegions);

describe('PaysWeatherCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche la météo réelle quand disponible', () => {
    weatherMock.mockReturnValue({
      data: {
        status: 'ok',
        current: { temperatureC: 4, condition: 'Nuageux', windKmH: 12, precipitationProbability: 20, uvIndex: 1 },
      },
      isLoading: false,
      isError: false,
    } as never);
    const html = renderToStaticMarkup(<PaysWeatherCard countryCode="IS" />);
    expect(html).toContain('4°C');
    expect(html).toContain('Nuageux');
    expect(html).toContain('Open-Meteo');
  });

  it('ne rend rien en erreur (discret)', () => {
    weatherMock.mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    expect(renderToStaticMarkup(<PaysWeatherCard countryCode="IS" />)).toBe('');
  });
});

describe('PaysRegionsList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche les régions réelles', () => {
    regionsMock.mockReturnValue({
      data: { status: 'ok', items: [{ id: '1', name: 'Suðurland' }] },
      isLoading: false,
      isError: false,
    } as never);
    const html = renderToStaticMarkup(<PaysRegionsList countryCode="IS" />);
    expect(html).toContain('Régions');
    expect(html).toContain('Suðurland');
  });

  it('ne rend rien si vide', () => {
    regionsMock.mockReturnValue({
      data: { status: 'empty', items: [] },
      isLoading: false,
      isError: false,
    } as never);
    expect(renderToStaticMarkup(<PaysRegionsList countryCode="IS" />)).toBe('');
  });
});
