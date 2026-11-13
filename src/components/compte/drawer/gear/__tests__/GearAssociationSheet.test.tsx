// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GearAssociationSheet } from '../GearAssociationSheet';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const catalog = {
  sport: 'rando',
  items: [
    {
      item: {
        id: 'g1',
        name: 'Chaussures de rando',
        kind: 'shoe',
        weightG: 620,
        condition: 'bon',
        photoUrl: null,
      },
      isDefault: true,
      source: 'sport' as const,
    },
  ],
  existingGearIds: [],
  defaultsAvailable: true,
};

describe('GearAssociationSheet — association réelle', () => {
  it('propose les objets du bon type et associe au clic', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ status: 'attached' }) };
      return { ok: true, json: async () => catalog };
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const onClose = vi.fn();
    const onAttached = vi.fn();
    render(<GearAssociationSheet outingId="o1" onClose={onClose} onAttached={onAttached} />);

    const row = await screen.findByRole('button', { name: /Chaussures de rando, associer/ });
    fireEvent.click(row);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onAttached).toHaveBeenCalledTimes(1);
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
    expect(post?.[0]).toBe('/api/compte/sorties/o1/gear/associate');
    expect(post?.[1]?.body).toBe(JSON.stringify({ gearItemId: 'g1' }));
  });

  it('affiche un état vide quand l’inventaire ne contient ni vélo ni chaussures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ ...catalog, items: [] }) })) as unknown as typeof fetch
    );
    render(<GearAssociationSheet outingId="o1" onClose={() => {}} />);

    expect(await screen.findByText(/Aucun vélo ni chaussure dans ton inventaire/)).toBeTruthy();
  });
});
