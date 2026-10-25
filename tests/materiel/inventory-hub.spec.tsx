import { expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
const fixtures = vi.hoisted(() => ({ items: [] as InventoryItem[] }));
vi.mock('@/features/materiel/services/getInventory', () => ({
  getInventory: async () => fixtures.items,
}));
vi.mock('@/features/materiel/services/getProductSuggestions', () => ({
  getProductSuggestions: async () => [],
}));
vi.mock('@/features/materiel/services/getInventoryCatalog', () => ({
  getInventoryCatalog: async () => [],
}));
vi.mock('@/features/materiel/services/getLoans', () => ({ getLoans: async () => [] }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
import { HubInventaireSection } from '@/features/hub/components/possession/HubInventaireSection';
import { HubDisponibiliteSection } from '@/features/hub/components/possession/HubDisponibiliteSection';
import { InventoryOverview } from '@/features/materiel/components/inventaire/InventoryOverview';
import { AvailabilityGauge } from '@/features/materiel/components/disponibilite/AvailabilityGauge';
function propsOf(node: ReactNode, target: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = propsOf(child, target);
      if (result) return result;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === target) return node.props as Record<string, unknown>;
  return propsOf(node.props.children, target);
}
const base = {
  id: 'stock',
  name: 'Sac',
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
  quantity: 2,
  listing_mode: 'personnel',
  status: 'en_stock',
} satisfies InventoryItem;
it('excludes sold and wishlist from ownership KPIs but retains active owned weight', async () => {
  fixtures.items = [
    base,
    { ...base, id: 'sold', listing_mode: 'vente', status: 'vendu' },
    { ...base, id: 'wish', status: 'a_acheter' },
    { ...base, id: 'rental', listing_mode: 'location', status: 'en_location', quantity: 1 },
  ];
  expect(propsOf(await HubInventaireSection(), InventoryOverview)?.data).toMatchObject({
    count: 2,
    totalWeightG: 300,
  });
});
it('counts inventory availability independently from loan rows and excludes active rentals', async () => {
  fixtures.items = [
    base,
    { ...base, id: 'sold', listing_mode: 'vente', status: 'vendu' },
    { ...base, id: 'wish', status: 'a_acheter' },
    { ...base, id: 'rental', listing_mode: 'location', status: 'en_location' },
    { ...base, id: 'lent', listing_mode: 'pret', status: 'en_pret' },
  ];
  expect(propsOf(await HubDisponibiliteSection(), AvailabilityGauge)).toMatchObject({
    total: 3,
    availableCount: 1,
  });
});
