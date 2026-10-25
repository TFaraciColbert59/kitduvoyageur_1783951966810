// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InventoryWorkspace } from '@/features/materiel/components/inventaire/InventoryWorkspace';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/materiel/components/inventaire/InventoryVirtualGrid', () => ({
  InventoryVirtualGrid: ({
    items,
    onSelect,
  }: {
    items: InventoryItem[];
    onSelect: (i: InventoryItem) => void;
  }) => (
    <div>
      {items.map((i) => (
        <button key={i.id} onClick={() => onSelect(i)}>
          {i.name}
        </button>
      ))}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const item = {
  id: 'one',
  name: 'Tente',
  brand: null,
  category: 'Autre',
  weight_g: 100,
  price_cents: 1000,
  condition: 'bon',
  photo_url: null,
  is_lent: false,
  purchase_date: null,
  maintenance_due_at: null,
  expiry_date: null,
  tags: null,
  quantity: 1,
  listing_mode: 'vente',
  status: 'en_stock',
  serial_number: 'SER-42',
  location: 'Garage',
  description: 'Deux places',
} satisfies InventoryItem;
it('creates rental in euros with contextual private fields', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetcher);
  render(<InventoryWorkspace items={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'location' } });
  fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Sac' } });
  fireEvent.change(screen.getByLabelText('Tarif de location (€ / jour) *'), {
    target: { value: '12.50' },
  });
  fireEvent.change(screen.getByLabelText('Caution (€)'), { target: { value: '80' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    listing_mode: 'location',
    rental_price_cents: 1250,
    deposit_cents: 8000,
    status: 'en_stock',
  });
});
it('edits without protected status and preserves catalog relation', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetcher);
  render(<InventoryWorkspace items={[{ ...item, product_id: 'catalog' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Tente légère' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body).not.toHaveProperty('status');
  expect(body).not.toHaveProperty('is_lent');
  expect(body).toHaveProperty('product_id', 'catalog');
});
it('confirms terminal manual sale and supplies expected status', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ item: { ...item, status: 'vendu' } }) });
  vi.stubGlobal('fetch', fetcher);
  render(<InventoryWorkspace items={[item]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Tente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmer la vente' }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByText(/aucun paiement/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Marquer définitivement vendu' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    status: 'vendu',
    expected_status: 'en_stock',
  });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull());
});
it('filters private metadata and keeps failed form intact', async () => {
  render(<InventoryWorkspace items={[item]} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher' }), {
    target: { value: 'SER-42' },
  });
  expect(screen.getByRole('button', { name: 'Tente' })).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrer par statut' }), {
    target: { value: 'vendu' },
  });
  expect(screen.queryByRole('button', { name: 'Tente' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Bâtons' } });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Réseau indisponible')));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Réseau indisponible')
  );
  expect((screen.getByLabelText('Nom *') as HTMLInputElement).value).toBe('Bâtons');
});
it('keeps active objects read-only with only return and handles conflict', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: false, json: async () => ({ error: 'Statut modifié, rechargez' }) });
  vi.stubGlobal('fetch', fetcher);
  render(
    <InventoryWorkspace items={[{ ...item, status: 'en_location', listing_mode: 'location' }]} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tente' }));
  expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le retour' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Statut modifié'));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    status: 'en_stock',
    expected_status: 'en_location',
  });
});
it('combines category, mode, location filters and opens details using keyboard table action', () => {
  render(
    <InventoryWorkspace
      items={[
        item,
        { ...item, id: 'two', name: 'Sac', listing_mode: 'personnel', location: 'Cave' },
      ]}
    />
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrer par mode' }), {
    target: { value: 'vente' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrer par localisation' }), {
    target: { value: 'Garage' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrer par catégorie' }), {
    target: { value: 'Autre' },
  });
  expect(screen.queryByRole('button', { name: 'Sac' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
  const rowButton = screen.getByRole('button', { name: 'Tente' });
  expect(rowButton.tagName).toBe('BUTTON');
  fireEvent.click(rowButton);
  expect(screen.getByRole('heading', { name: 'Tente' })).toBeTruthy();
});
it('starts from safe catalog prefill and pins serialized quantity to one', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetcher);
  render(
    <InventoryWorkspace
      items={[]}
      initialProduct={{
        id: '12345678-1234-4123-8123-123456789abc',
        slug: 'sac',
        name: 'Sac catalogue',
        brand: 'Marque',
        category: 'Autre',
        weight_g: 300,
        price_cents: 1234,
      }}
    />
  );
  expect((screen.getByLabelText('Prix d’achat (€)') as HTMLInputElement).value).toBe('12.34');
  fireEvent.change(screen.getByLabelText('Numéro de série (privé)'), {
    target: { value: 'SN-123' },
  });
  expect((screen.getByLabelText('Quantité') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    quantity: 1,
    serial_number: 'SN-123',
    product_id: '12345678-1234-4123-8123-123456789abc',
    price_cents: 1234,
  });
});
it('requires returning an available object to stock before editing its mode', () => {
  render(
    <InventoryWorkspace
      items={[{ ...item, status: 'a_louer', listing_mode: 'location', rental_price_cents: 1000 }]}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
  expect((screen.getByLabelText('Mode') as HTMLSelectElement).disabled).toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('updates catalog prefill for a newly received product without reopening on same-ID refresh', async () => {
  const product = {
    id: '12345678-1234-4123-8123-123456789abc',
    slug: 'sac',
    name: 'Sac',
    brand: null,
    category: 'Autre',
    weight_g: 100,
    price_cents: 1000,
  };
  const { rerender } = render(<InventoryWorkspace items={[]} initialProduct={product} />);
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  rerender(<InventoryWorkspace items={[]} initialProduct={{ ...product }} />);
  expect(screen.queryByLabelText('Nom *')).toBeNull();
  rerender(
    <InventoryWorkspace
      items={[]}
      initialProduct={{
        ...product,
        id: '22345678-1234-4123-8123-123456789abc',
        name: 'Tente catalogue',
      }}
    />
  );
  await waitFor(() =>
    expect((screen.getByLabelText('Nom *') as HTMLInputElement).value).toBe('Tente catalogue')
  );
});
