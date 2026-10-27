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

const KIT_ID = '11111111-1111-4111-8111-111111111111';

const PRODUCT = {
  id: 'product-1',
  name: 'Sac 45 L',
  category: 'Portage',
  weightG: 900,
  quantity: 1,
  condition: 'good',
  priority: null,
  vital: false,
  brand: null,
  description: null,
  image: 'https://img/x.jpg',
};

function openProduct() {
  fireEvent.click(screen.getByRole('tab', { name: 'Détail du produit' }));
}

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
            products: [PRODUCT],
            proven: 3,
          },
        ]}
        gearItems={[]}
      />
    );

    const image = screen.getByRole('button', { name: PRODUCT.name }).querySelector('img')!;
    openProduct();
    expect(image.getAttribute('src')).toBe('https://img/x.jpg');
    expect(screen.getByLabelText(/Partager/)).toBeTruthy();
    expect(screen.getByLabelText(/Récupérer/)).toBeTruthy();
  });

  it('garde les actions du kit sans produits accessibles depuis la vue initiale', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        entries: [{ action: 'forked', created_at: '2026-10-01T09:00:00Z' }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <KitSlot
        lens="kits"
        viewer="owner"
        kits={[
          {
            id: KIT_ID,
            n: 'Kit sans produits',
            products: [],
          },
        ]}
      />
    );

    expect(screen.getByRole('tab', { name: 'Vue du kit' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(
      (screen.getByRole('tab', { name: 'Détail du produit' }) as HTMLButtonElement).disabled
    ).toBe(true);
    const actions = screen.getByRole('group', { name: 'Actions du kit Kit sans produits' });
    for (const name of ['Récupérer', 'Partager', 'Fiche']) {
      expect((within(actions).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(
        false
      );
    }
    fireEvent.click(within(actions).getByText('Autres actions du kit'));
    for (const name of ['Royalties', 'Historique', 'Découvrir']) {
      expect((within(actions).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(
        false
      );
    }
    fireEvent.click(within(actions).getByRole('button', { name: 'Historique' }));

    const panel = await screen.findByRole('region', {
      name: 'Historique du kit Kit sans produits',
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/materiel/kits/${KIT_ID}/history`);
    expect(within(panel).getByText(/Récupéré · 01\/10\/2026/)).toBeTruthy();
  });

  it('réutilise le visuel produit du kit ou en génère un, jamais une image cassée', () => {
    render(
      <KitSlot
        lens="kits"
        kits={[{ id: 'k2', n: 'Bivouac léger', products: [{ ...PRODUCT, image: null }] }]}
      />
    );

    const image = screen.getByRole('button', { name: PRODUCT.name }).querySelector('img')!;
    expect(image.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('lit les kits du payload de bootstrap', () => {
    render(
      <KitSlot
        lens="kits"
        payload={{ kits: [{ id: 'k3', n: 'Kit payload', image: null, products: [PRODUCT] }] }}
      />
    );

    expect(screen.getByRole('button', { name: PRODUCT.name })).toBeTruthy();
    expect(screen.queryByText('Aucun kit enregistré.')).toBeNull();
  });

  it('affiche la filiation G1 → G2 → G3', () => {
    render(<KitSlot lens="kits" kits={[{ id: 'k4', n: 'Kit G2', gen: 'Lignée G2', prop: 1 }]} />);

    const lineage = screen.getByRole('group', { name: /Filiation/ });
    expect(within(lineage).getByText('G1')).toBeTruthy();
    expect(within(lineage).getByText('G2')).toBeTruthy();
    expect(within(lineage).getByText('G3')).toBeTruthy();
  });

  it('affiche l’état vide explicitement', () => {
    render(<KitSlot lens="kits" kits={[]} gearItems={[]} />);

    expect(screen.getByText('Aucun kit enregistré.')).toBeTruthy();
  });

  it('branche Récupérer sur /api/materiel/fork avec un identifiant UUID', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ kit: { id: 'fork-1' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByLabelText(/Récupérer/));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/materiel/fork');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ kit_id: KIT_ID });
    await waitFor(() => expect(screen.getByText('Kit récupéré dans ton Compas.')).toBeTruthy());
  });

  it('réseau indisponible : message localisé, jamais « Failed to fetch »', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByLabelText(/Récupérer/));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Impossible de récupérer ce kit\./);
    expect(alert.textContent).not.toMatch(/Failed to fetch/);
  });

  it('branche Partager sur /api/materiel/share et copie le lien /k/<token>', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ url: '/k/token123' }));
    vi.stubGlobal('fetch', fetchMock);
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByLabelText(/Partager/));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/materiel/share');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ kit_id: KIT_ID, permission: 'lecture' });
    await waitFor(() => expect(screen.getByText('Lien de partage copié.')).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/k/token123'));
  });

  it('n’annonce pas la copie quand le presse-papier refuse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ url: '/k/token123' }))
    );
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(async () => {
          throw new Error('NotAllowedError');
        }),
      },
    });

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByLabelText(/Partager/));

    await waitFor(() =>
      expect(screen.getByRole('region', { name: /Lien de partage/ })).toBeTruthy()
    );
    expect(screen.queryByText('Lien de partage copié.')).toBeNull();
    expect(screen.getByText('Lien de partage affiché ci-dessus.')).toBeTruthy();
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
          kit: { id: KIT_ID, name: 'Kit 3 saisons', parent_name: null },
          journal: [],
          trust: { endurance_score: 9.7 },
          survival: [],
        });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByLabelText(/Fiche/));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/kits/${KIT_ID}/refer`);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/kits/${KIT_ID}/sheet`);
    const panel = await screen.findByRole('region', { name: /Fiche du kit/ });
    expect(within(panel).getByText(/Indice d.endurance : 9\.70\./)).toBeTruthy();
    expect(within(panel).queryByText(/%/)).toBeNull();
  });

  it('somme les parts en share_cents et ne crédite que les entrées credit', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/kits/my-royalties') {
        return jsonResponse({
          shares: [{ share_cents: 1200 }, { share_cents: 300 }],
          ledger: [
            { amount_cents: 500, entry_type: 'credit' },
            { amount_cents: 900, entry_type: 'debit' },
          ],
        });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByText('Autres actions du kit'));
    fireEvent.click(screen.getByLabelText(/Royalties/));

    const panel = await screen.findByRole('region', { name: 'Royalties' });
    expect(within(panel).getByText('2 parts créateur.')).toBeTruthy();
    expect(within(panel).getByText('Crédit boutique : 5,00 €.')).toBeTruthy();
    expect(within(panel).getByText('Parts cumulées : 15,00 €.')).toBeTruthy();
    expect(within(panel).queryByText(/14,00/)).toBeNull();
  });

  it('localise les actions connues de l’historique', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === `/api/materiel/kits/${KIT_ID}/history`) {
        return jsonResponse({
          entries: [
            { action: 'forked', created_at: '2026-10-01T09:00:00Z' },
            { action: 'optimized', created_at: '2026-10-02T09:00:00Z' },
          ],
        });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByText('Autres actions du kit'));
    fireEvent.click(screen.getByLabelText(/Historique/));

    const panel = await screen.findByRole('region', { name: /Historique du kit/ });
    expect(within(panel).getByText(/Récupéré · 01\/10\/2026/)).toBeTruthy();
    expect(within(panel).getByText(/Optimisé · 02\/10\/2026/)).toBeTruthy();
    expect(within(panel).queryByText(/forked|optimized/)).toBeNull();
  });

  it('annonce la conservation en forks et l’indice d’endurance brut', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/kits/discovery') {
        return jsonResponse({
          lineages: [{ kit_name: 'Lignée Vercors', endurance_score: 9.7 }],
          items: [{ kept_count: 3 }],
        });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <KitSlot lens="kits" kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]} />
    );
    openProduct();
    fireEvent.click(screen.getByText('Autres actions du kit'));
    fireEvent.click(screen.getByLabelText(/Découvrir/));

    const panel = await screen.findByRole('region', { name: /Découverte/ });
    expect(within(panel).getByText(/Lignée Vercors · Indice d.endurance 9\.70/)).toBeTruthy();
    expect(within(panel).getByText('Objet gardé dans 3 forks.')).toBeTruthy();
    expect(within(panel).queryByText(/%/)).toBeNull();
  });

  it('visiteur : aucune action propriétaire', () => {
    render(
      <KitSlot
        lens="kits"
        kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]}
        viewer="visitor"
      />
    );

    expect(screen.getByRole('button', { name: PRODUCT.name })).toBeTruthy();
    openProduct();
    for (const label of [
      /Récupérer/,
      /Partager/,
      /Fiche/,
      /Royalties/,
      /Historique/,
      /Découvrir/,
    ]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
    expect(screen.queryByRole('group', { name: /Actions du kit/ })).toBeNull();
  });

  it('propriétaire : toutes les actions restent disponibles', () => {
    render(
      <KitSlot
        lens="kits"
        kits={[{ id: KIT_ID, n: 'Kit 3 saisons', products: [PRODUCT] }]}
        viewer="owner"
      />
    );

    openProduct();
    fireEvent.click(screen.getByText('Autres actions du kit'));
    const actions = screen.getByRole('group', { name: /Actions du kit/ });
    for (const label of [
      /Récupérer/,
      /Partager/,
      /Fiche/,
      /Royalties/,
      /Historique/,
      /Découvrir/,
    ]) {
      expect(within(actions).getByLabelText(label)).toBeTruthy();
    }
  });

  it('déduit le visiteur du profil du payload', () => {
    render(
      <KitSlot
        lens="kits"
        payload={{
          kits: [{ id: KIT_ID, n: 'Kit payload' }],
          profile: { viewer: 'visitor' },
        }}
      />
    );

    expect(screen.getByTestId('slot-content').getAttribute('data-viewer')).toBe('visitor');
    expect(screen.queryByRole('group', { name: /Actions du kit/ })).toBeNull();
  });
});
