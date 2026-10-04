// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryEntryButton from '../InventoryEntryButton';
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  set: vi.fn(),
  user: { id: 'owner' } as { id: string } | null,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/hub/context/ActiveAdventureContext', () => ({
  useActiveAdventure: () => ({ setActiveAdventure: mocks.set }),
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, loading, ...props }: any) => (
    <button {...props} disabled={loading || props.disabled}>
      {children}
    </button>
  ),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'owner' };
  mocks.set.mockResolvedValue(true);
});
describe('catalogue → inventaire', () => {
  it('sélectionne le contexte possession avant d’ouvrir le formulaire lié', async () => {
    render(<InventoryEntryButton productId="catalogue-id" />);
    fireEvent.click(screen.getByRole('button', { name: 'Gérer dans mon inventaire' }));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/hub/inventaire?product_id=catalogue-id')
    );
    expect(mocks.set).toHaveBeenCalledWith({ nature: 'possession' });
  });
  it('garde la fiche et permet de réessayer si la sélection échoue', async () => {
    mocks.set.mockResolvedValue(false);
    render(<InventoryEntryButton productId="catalogue-id" />);
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('alert');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
  });
  it('redirige vers la connexion en conservant la fiche source', () => {
    mocks.user = null;
    render(<InventoryEntryButton productId="catalogue-id" productSlug="tente" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mocks.push).toHaveBeenCalledWith('/connexion?next=%2Fproduit%2Ftente');
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
