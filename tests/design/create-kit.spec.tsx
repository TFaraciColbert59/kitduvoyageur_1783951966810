// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KitCreateForm } from '@/features/community/create/KitCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

afterEach(cleanup);

function renderKit() {
  return render(
    <KitCreateForm open onClose={() => {}} user={{ id: 'user-kit' }} onCreated={() => {}} />,
  );
}

describe('KitCreateForm', () => {
  it('affiche les deux étapes Identité / Poids', () => {
    renderKit();

    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Poids' })).toBeTruthy();
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    expect(screen.getByLabelText('Saison')).toBeTruthy();
    expect(screen.getByTestId('media-picker')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
  });

  it('refuse un kit sans nom', async () => {
    renderKit();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect((await screen.findAllByText('Le nom du kit est requis.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe('true');
  });

  it('règle le poids au stepper et expose la visibilité', () => {
    renderKit();
    fireEvent.click(screen.getByRole('tab', { name: 'Poids' }));

    const input = screen.getByRole('spinbutton', { name: 'Poids total' }) as HTMLInputElement;
    expect(input.value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter Poids total' }));
    expect(input.value).toBe('100');
    expect(screen.getByRole('combobox', { name: 'Visibilité' })).toBeTruthy();
  });

  it('refuse un poids nul, négatif ou non entier', () => {
    const base = { ...createDefaults('kit'), name: 'Kit bivouac' };

    expect(createSchemas.kit.safeParse({ ...base, weightG: 0 }).success).toBe(false);
    expect(createSchemas.kit.safeParse({ ...base, weightG: -10 }).success).toBe(false);
    expect(createSchemas.kit.safeParse({ ...base, weightG: 1200.5 }).success).toBe(false);
    expect(createSchemas.kit.safeParse({ ...base, weightG: 4200 }).success).toBe(true);
  });
});
