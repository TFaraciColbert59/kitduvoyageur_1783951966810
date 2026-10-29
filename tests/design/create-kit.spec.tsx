// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KitCreateForm } from '@/features/community/create/KitCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 'gear-1', name: 'Sac 40 L', photo_url: null, condition: 'bon', category: 'Portage', weight_g: 900 },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ toast: () => {} }) }));

afterEach(cleanup);

function renderKit() {
  return render(
    <KitCreateForm open onClose={() => {}} user={{ id: 'user-kit' }} onCreated={() => {}} />,
  );
}

describe('KitCreateForm — inventaire first', () => {
  it('affiche les trois étapes Inventaire / Compléter / Partager', async () => {
    renderKit();

    expect(screen.getByRole('tab', { name: 'Inventaire' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Compléter' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Partager' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajouter un élément au kit' })).toBeTruthy();
  });

  it('sélectionne un produit et calcule le poids', async () => {
    renderKit();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un élément au kit' }));
    const row = await screen.findByRole('button', { name: 'Ajouter Sac 40 L au kit' });
    fireEvent.click(row);
    expect(await screen.findByText('Sac 40 L')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Ajouter un élément au kit' })).toHaveLength(1);
  });

  it('affiche les champs de partage à la dernière étape', async () => {
    renderKit();
    fireEvent.click(screen.getByRole('tab', { name: 'Partager' }));
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    expect(screen.getByLabelText('Saison')).toBeTruthy();
    expect(screen.getByLabelText('Visibilité')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
  });

  it('refuse un poids nul, négatif ou non entier', () => {
    const base = { ...createDefaults('kit'), name: 'Kit bivouac', inventoryIds: ['gear-1'] };
    expect(createSchemas.kit.safeParse({ ...base, weightG: 0 }).success).toBe(false);
    expect(createSchemas.kit.safeParse({ ...base, weightG: -10 }).success).toBe(false);
    expect(createSchemas.kit.safeParse({ ...base, weightG: 1200.5 }).success).toBe(false);
    expect(createSchemas.kit.safeParse({ ...base, weightG: 4200 }).success).toBe(true);
  });
});
