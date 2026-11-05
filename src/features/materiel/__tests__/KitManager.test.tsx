// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { KitManager } from '../components/kits/KitManager';
import type { KitListItem } from '../services/getKits';
import type { InventoryItem } from '../services/getInventory';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockInventory: InventoryItem[] = [
  { id: 'inv-1', name: 'Tente 2P', category: 'Bivouac', weight_g: 1500, quantity: 1, is_lent: false, brand: null, price_cents: null, condition: null, photo_url: null, purchase_date: null, maintenance_due_at: null, expiry_date: null, tags: null },
  { id: 'inv-2', name: 'Duvet 0C', category: 'Couchage', weight_g: 800, quantity: 1, is_lent: false, brand: null, price_cents: null, condition: null, photo_url: null, purchase_date: null, maintenance_due_at: null, expiry_date: null, tags: null },
  { id: 'inv-3', name: 'Réchaud Gas', category: 'Cuisine', weight_g: 300, quantity: 1, is_lent: false, brand: null, price_cents: null, condition: null, photo_url: null, purchase_date: null, maintenance_due_at: null, expiry_date: null, tags: null },
];

const mockKit: KitListItem = {
  id: 'kit-123',
  name: 'Kit Alpin',
  description: 'Pour les sommets',
  season: 'ete',
  total_weight_g: 2300,
  is_favorite: false,
  is_trashed: false,
  updated_at: new Date().toISOString(),
  item_count: 2,
  checked_count: 0,
  items: [
    { name: 'Tente 2P', category: 'Bivouac', weight_g: 1500, quantity: 1, product_ownership_id: 'inv-1' },
    { name: 'Duvet 0C', category: 'Couchage', weight_g: 800, quantity: 1, product_ownership_id: 'inv-2' },
  ],
};

describe('L0-1c: KitManager edit form item retention', () => {
  let fetchSpy: any;

  beforeEach(() => {
    cleanup();
    fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({ kit: mockKit }),
    } as any));
  });

  afterEach(() => {
    cleanup();
  });

  it('ouvrir l\'édition d\'un kit à 2 articles → 2 cases cochées', async () => {
    render(<KitManager kits={[mockKit]} inventory={mockInventory} />);

    const editButton = screen.getByRole('button', { name: /modifier/i });
    fireEvent.click(editButton);

    expect(screen.getByText('Articles (2)')).toBeDefined();
    const checkboxTente = screen.getByLabelText(/Tente 2P/i) as HTMLInputElement;
    const checkboxDuvet = screen.getByLabelText(/Duvet 0C/i) as HTMLInputElement;
    expect(checkboxTente.checked).toBe(true);
    expect(checkboxDuvet.checked).toBe(true);
  });

  it('renommer un kit ne vide pas ses articles', async () => {
    render(<KitManager kits={[mockKit]} inventory={mockInventory} />);
    const editButton = screen.getByRole('button', { name: /modifier/i });
    fireEvent.click(editButton);

    const nameInput = screen.getByDisplayValue('Kit Alpin');
    fireEvent.change(nameInput, { target: { value: 'Kit Alpin V2' } });

    const saveButton = screen.getByRole('button', { name: /enregistrer/i });
    fireEvent.click(saveButton);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [, options] = fetchSpy.mock.calls[0];
    const sentPayload = JSON.parse(options.body);

    expect(sentPayload.name).toBe('Kit Alpin V2');
    expect(sentPayload.items).toBeUndefined();
  });
});
