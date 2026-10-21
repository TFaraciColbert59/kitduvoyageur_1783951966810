// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KitSlot } from '../slots/KitSlot';
import { WearGauge } from '../cards/WearGauge';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: async () => data,
  }) as Response;

describe('KitSlot — lentille Kits', () => {
  it('affiche une image produit et les actions kit existantes', () => {
    render(
      <KitSlot
        lens="kits"
        kits={[
          {
            id: 'k1',
            n: 'Kit 3 saisons',
            w: 4200,
            items: 10,
            image: 'https://img/x.jpg',
            proven: 3,
          },
        ]}
        gearItems={[]}
      />
    );

    const image = screen.getByRole('img', { name: /Kit 3 saisons/ }) as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://img/x.jpg');
    expect(screen.getByLabelText(/Partager/)).toBeTruthy();
    expect(screen.getByLabelText(/Récupérer/)).toBeTruthy();
  });

  it('réutilise le visuel produit du kit ou en génère un, jamais une image cassée', () => {
    render(<KitSlot lens="kits" kits={[{ id: 'k2', n: 'Bivouac léger' }]} />);

    const image = screen.getByRole('img', { name: /Bivouac léger/ }) as HTMLImageElement;
    expect(image.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('lit les kits du payload de bootstrap', () => {
    render(
      <KitSlot
        lens="kits"
        payload={{ kits: [{ id: 'k3', n: 'Kit payload', image: null }] }}
      />
    );

    expect(screen.getByRole('img', { name: /Kit payload/ })).toBeTruthy();
    expect(screen.queryByText('Aucun kit enregistré.')).toBeNull();
  });

  it('affiche la filiation G1 → G2 → G3', () => {
    render(
      <KitSlot
        lens="kits"
        kits={[{ id: 'k4', n: 'Kit G2', gen: 'Lignée G2', prop: 1 }]}
      />
    );

    const lineage = screen.getByLabelText(/Filiation/);
    expect(within(lineage).getByText('G1')).toBeTruthy();
    expect(within(lineage).getByText('G2')).toBeTruthy();
    expect(within(lineage).getByText('G3')).toBeTruthy();
  });

  it('affiche l’état vide explicitement', () => {
    render(<KitSlot lens="kits" kits={[]} gearItems={[]} />);

    expect(screen.getByText('Aucun kit enregistré.')).toBeTruthy();
  });

  it('branche Récupérer sur /api/materiel/fork', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ kit: { id: 'fork-1' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(<KitSlot lens="kits" kits={[{ id: 'k1', n: 'Kit 3 saisons' }]} />);
    fireEvent.click(screen.getByLabelText(/Récupérer/));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/materiel/fork');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ kit_id: 'k1' });
  });

  it('branche Partager sur /api/materiel/share et restitue le lien /k/<token>', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ url: '/k/token123' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<KitSlot lens="kits" kits={[{ id: 'k1', n: 'Kit 3 saisons' }]} />);
    fireEvent.click(screen.getByLabelText(/Partager/));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/materiel/share');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ kit_id: 'k1', permission: 'lecture' });
    await waitFor(() => expect(screen.getByText(/Lien de partage copié/)).toBeTruthy());
  });

  it('dérive l’usure des sorties et recommande l’entretien au seuil', () => {
    render(<WearGauge outings={18} threshold={20} kitName="Kit 3 saisons" />);

    const gauge = screen.getByRole('progressbar', { name: /Usure de Kit 3 saisons/ });
    expect(gauge.getAttribute('aria-valuenow')).toBe('90');
    expect(screen.getByText('90 %')).toBeTruthy();
    expect(screen.getByText('Entretien recommandé')).toBeTruthy();
    expect(screen.getByLabelText(/Planifier l’entretien|Planifier l'entretien/)).toBeTruthy();
  });

  it('ne fabrique pas d’usure quand les sorties sont inconnues', () => {
    render(<WearGauge kitName="Kit 3 saisons" />);

    expect(screen.getByText('Non mesurée')).toBeTruthy();
    expect(screen.getByText('Sorties non renseignées')).toBeTruthy();
  });

  it('branche Fiche sur le référencement puis la fiche existante', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/refer')) return jsonResponse({ ok: true });
      if (url.endsWith('/sheet')) {
        return jsonResponse({
          kit: { id: 'k1', name: 'Kit 3 saisons', parent_name: null },
          journal: [],
          trust: { endurance_score: 88 },
          survival: [],
        });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<KitSlot lens="kits" kits={[{ id: 'k1', n: 'Kit 3 saisons' }]} />);
    fireEvent.click(screen.getByLabelText(/Fiche/));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/kits/k1/refer');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/kits/k1/sheet');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /Fiche du kit/ })).toBeTruthy()
    );
  });
});
