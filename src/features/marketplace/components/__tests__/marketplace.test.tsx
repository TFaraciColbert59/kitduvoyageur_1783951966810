// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceWorkspace, transactionActions } from '../MarketplaceWorkspace';
import { request, SignIn } from '../shared';
import type { MarketplaceTransaction } from '../../types';
const { auth } = vi.hoisted(() => ({ auth: { user: { id: 'owner' }, loading: false } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/ui', () => ({
  Button: ({ children, loading, ...props }: any) => (
    <button {...props} disabled={props.disabled || loading}>
      {children}
    </button>
  ),
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));
const item = {
  id: 'item',
  name: 'Sac',
  brand: null,
  category: null,
  weight_g: null,
  price_cents: 3500,
  condition: 'bon',
  photo_url: null,
  is_lent: false,
  purchase_date: null,
  maintenance_due_at: null,
  expiry_date: null,
  tags: null,
  quantity: 1,
  listing_mode: 'vente' as const,
  status: 'en_stock' as const,
  description: 'Description privée confidentielle',
  location: 'Adresse privée confidentielle',
  serial_number: 'SERIAL-SECRET',
};
beforeEach(() => {
  auth.user = { id: 'owner' };
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ listings: [], transactions: [], can_moderate: false }), {
          status: 200,
        })
    )
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('Persistent marketplace UI', () => {
  it('preserves the complete destination when signing in', () => {
    render(<SignIn next="/hub/inventaire#marketplace" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/connexion?next=%2Fhub%2Finventaire%23marketplace'
    );
  });
  it('rejects failed persistence responses and preserves server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Adresse e-mail à confirmer' }), { status: 403 })
      )
    );
    await expect(request('/api/marketplace/listings', { item_id: 'item' })).rejects.toThrow(
      'Adresse e-mail à confirmer'
    );
  });
  it('keeps private fields out of public inputs and does not claim success after failed publication', async () => {
    const fetcher = vi.fn(
      async (_url: string, options?: RequestInit) =>
        new Response(
          JSON.stringify(
            options?.method === 'POST'
              ? { error: 'Publication refusée' }
              : { listings: [], transactions: [], can_moderate: false }
          ),
          { status: options?.method === 'POST' ? 403 : 200 }
        )
    );
    vi.stubGlobal('fetch', fetcher);
    render(<MarketplaceWorkspace items={[item]} />);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(screen.queryByDisplayValue(item.description)).toBeNull();
    expect(screen.queryByDisplayValue(item.location)).toBeNull();
    expect(screen.queryByDisplayValue(item.serial_number)).toBeNull();
    fireEvent.change(screen.getByLabelText('Objet disponible'), { target: { value: 'item' } });
    fireEvent.change(screen.getByLabelText('Description publique'), {
      target: { value: 'Un sac à vendre en bon état' },
    });
    fireEvent.change(screen.getByLabelText('Commune publique'), { target: { value: 'Lyon' } });
    fireEvent.change(screen.getByLabelText('Prix de vente (€)'), { target: { value: '20' } });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Publier ces informations' }).closest('form')!
    );
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Publication refusée');
    expect(screen.queryByText('Annonce publique enregistrée.')).toBeNull();
    const posted = fetcher.mock.calls.find(([, opts]) => opts?.method === 'POST');
    expect(JSON.parse(posted![1]!.body as string)).toEqual({
      item_id: 'item',
      description: 'Un sac à vendre en bon état',
      public_location: 'Lyon',
      price_cents: 2000,
      deposit_cents: 0,
    });
  });
  it('does not offer lifecycle actions to outsiders or buyer owner actions', () => {
    const tx = {
      owner_id: 'owner',
      buyer_id: 'buyer',
      status: 'accepted',
      mode: 'vente',
    } as MarketplaceTransaction;
    expect(transactionActions(tx, 'outsider')).toEqual([]);
    expect(transactionActions(tx, 'buyer').map((a) => a.action)).toEqual(['cancel']);
    expect(transactionActions({ ...tx, status: 'active' }, 'owner').map((a) => a.action)).toEqual([
      'dispute',
    ]);
    expect(transactionActions({ ...tx, status: 'active' }, 'buyer').map((a) => a.action)).toEqual([
      'receive',
      'dispute',
    ]);
    expect(transactionActions({ ...tx, status: 'completed' }, 'buyer')).toEqual([]);
  });
});
