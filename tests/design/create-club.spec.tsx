// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClubCreateForm } from '@/features/community/create/ClubCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

afterEach(cleanup);

function renderClub() {
  return render(
    <ClubCreateForm open onClose={() => {}} user={{ id: 'user-club' }} onCreated={() => {}} />,
  );
}

describe('ClubCreateForm', () => {
  it('affiche les trois étapes Identité / Présentation / Adhésion', () => {
    renderClub();

    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Présentation' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Adhésion' })).toBeTruthy();
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    expect(screen.getByLabelText('Catégorie')).toBeTruthy();
    expect(screen.getByLabelText('Lieu')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
  });

  it('exige le nom et la catégorie avant de continuer', async () => {
    renderClub();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect((await screen.findAllByText('Le nom du club est requis.')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('La catégorie est requise.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe('true');
  });

  it('avance à Présentation puis expose l’adhésion et les règles', async () => {
    renderClub();

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'La Cordée du Vercors' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'Randonnée' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    await screen.findByLabelText('Description');
    expect(screen.getByRole('tab', { name: 'Présentation' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Adhésion' }));
    const privacy = screen.getByRole('combobox', { name: 'Adhésion' }) as HTMLSelectElement;
    expect(privacy.value).toBe('open');
    fireEvent.change(privacy, { target: { value: 'closed' } });
    expect(privacy.value).toBe('closed');
    expect(screen.getByLabelText('Règles d’adhésion')).toBeTruthy();
  });

  it('refuse un club sans catégorie et une confidentialité inconnue', () => {
    expect(
      createSchemas.club.safeParse({ ...createDefaults('club'), name: 'La Cordée' }).success,
    ).toBe(false);
    expect(
      createSchemas.club.safeParse({
        ...createDefaults('club'),
        name: 'La Cordée',
        category: 'Randonnée',
        privacy: 'secret',
      }).success,
    ).toBe(false);
    expect(
      createSchemas.club.safeParse({
        ...createDefaults('club'),
        name: 'La Cordée',
        category: 'Randonnée',
      }).success,
    ).toBe(true);
  });
});
