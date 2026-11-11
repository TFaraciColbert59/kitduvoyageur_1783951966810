// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HikeSearchSheet } from '../HikeSearchSheet';

const TRAIL = {
  id: '1109',
  name: 'Tour du Mont-Blanc — reconnaissance',
  lat: 45.9,
  lng: 6.85,
  distance_km: 42.5,
  elevation_gain: 2600,
  difficulty: 'Difficile',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HikeSearchSheet — recherche branchée sur /api/hikes', () => {
  it('interroge l’API Explorer avec la recherche et le polygone France', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [TRAIL] })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    render(<HikeSearchSheet open onClose={() => undefined} onPick={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/Nom ou massif/i), { target: { value: 'mont' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    const url = String((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain('/api/hikes?');
    expect(url).toContain('search=mont');
    expect(url).toContain('min_lng=-5');
    expect(url).toContain('max_lat=51');

    const result = await screen.findByRole('button', { name: /Tour du Mont-Blanc/i });
    expect(result.textContent).toContain('42,5 km');
    expect(result.textContent).toContain('+2\u202f600 m');
  });

  it('rend la randonnée choisie à l’appelant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => [TRAIL] })) as unknown as typeof fetch
    );
    const onPick = vi.fn();
    render(<HikeSearchSheet open onClose={() => undefined} onPick={onPick} />);
    fireEvent.change(screen.getByLabelText(/Nom ou massif/i), { target: { value: 'mont' } });
    fireEvent.click(await screen.findByRole('button', { name: /Tour du Mont-Blanc/i }, { timeout: 2000 }));
    expect(onPick).toHaveBeenCalledWith(TRAIL);
  });

  it('n’appelle pas l’API sous deux lettres', () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    render(<HikeSearchSheet open onClose={() => undefined} onPick={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/Nom ou massif/i), { target: { value: 'm' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
