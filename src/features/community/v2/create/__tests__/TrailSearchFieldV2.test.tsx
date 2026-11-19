// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { TrailSearchFieldV2, traceFromGeoJson } from '../carnet/TrailSearchFieldV2';
import { createDefaultsV2 } from '../engine/createSchemasV2';
import type { CarnetFormValuesV2 } from '../engine/createSchemasV2';

const SEARCH_RESULT = {
  id: '1109',
  name: 'GRP 125 Liaison Lac de Val Joly',
  lat: 50.36,
  lng: 3.73,
  distance_km: 10.7,
  elevation_gain: 220,
  difficulty: 'Modérée',
};

const DETAIL = {
  id: '1109',
  name: 'GRP 125 Liaison Lac de Val Joly',
  geojson: {
    type: 'MultiLineString',
    coordinates: [
      [
        [3.7337, 50.3671],
        [3.7326, 50.3673],
      ],
      [
        [3.82, 50.3781],
        [3.8198, 50.3778],
      ],
    ],
  },
};

function Harness({ onReady }: { onReady?: (form: UseFormReturn<CarnetFormValuesV2>) => void }) {
  const form = useForm<CarnetFormValuesV2>({ defaultValues: createDefaultsV2('carnet') });
  onReady?.(form);
  return (
    <FormProvider {...form}>
      <TrailSearchFieldV2 />
    </FormProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TrailSearchFieldV2 — recherche de randonnée dans la création de carnet', () => {
  it('cherche via /api/hikes puis importe le tracé réel via /api/hikes/{id}', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/hikes?')) return { ok: true, json: async () => [SEARCH_RESULT] };
      return { ok: true, json: async () => DETAIL };
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const formRef: { current: UseFormReturn<CarnetFormValuesV2> | null } = { current: null };
    render(<Harness onReady={(instance) => { formRef.current = instance; }} />);

    fireEvent.change(screen.getByLabelText(/Rechercher une randonnée existante/i), {
      target: { value: 'lac' },
    });

    const row = await screen.findByRole('button', { name: /GRP 125 Liaison Lac de Val Joly/i }, { timeout: 2500 });
    expect(row.textContent).toContain('10,7 km');
    fireEvent.click(row);

    await waitFor(() => expect(formRef.current?.getValues('trace').length).toBe(4), { timeout: 2500 });
    expect(formRef.current?.getValues('startLng')).toBeCloseTo(3.7337, 4);
    expect(formRef.current?.getValues('startLat')).toBeCloseTo(50.3671, 4);

    const urls = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/api/hikes?') && url.includes('search=lac') && url.includes('min_lng=-5'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/hikes/1109'))).toBe(true);
  });

  it('n’appelle pas l’API sous deux lettres', () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    render(<Harness />);
    fireEvent.change(screen.getByLabelText(/Rechercher une randonnée existante/i), {
      target: { value: 'l' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('traceFromGeoJson — conversion du tracé réel', () => {
  it('convertit LineString, MultiLineString et Feature', () => {
    expect(traceFromGeoJson({ type: 'LineString', coordinates: [[1, 2], [3, 4]] })).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(
      traceFromGeoJson({
        type: 'MultiLineString',
        coordinates: [
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ],
      })
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    expect(
      traceFromGeoJson({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } })
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('ignore une géométrie absente ou invalide', () => {
    expect(traceFromGeoJson(null)).toEqual([]);
    expect(traceFromGeoJson({ type: 'Point', coordinates: [1, 2] })).toEqual([]);
    expect(traceFromGeoJson({ type: 'LineString', coordinates: [['x', 'y']] })).toEqual([]);
  });
});

describe('TrailSearchFieldV2 — import refusé sans tracé réel', () => {
  it('signale une randonnée dont la géométrie est absente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/hikes?')) return { ok: true, json: async () => [SEARCH_RESULT] };
        return { ok: true, json: async () => ({ geojson: null }) };
      }) as unknown as typeof fetch
    );
    render(<Harness />);
    fireEvent.change(screen.getByLabelText(/Rechercher une randonnée existante/i), {
      target: { value: 'lac' },
    });
    const row = await screen.findByRole('button', { name: /GRP 125 Liaison Lac de Val Joly/i }, { timeout: 2500 });
    fireEvent.click(row);
    expect(await screen.findByText(/pas de tracé disponible/i, {}, { timeout: 2500 })).toBeTruthy();
  });
});
