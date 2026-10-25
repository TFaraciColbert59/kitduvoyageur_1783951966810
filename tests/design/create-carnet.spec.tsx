// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CarnetCreateForm } from '@/features/community/create/CarnetCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

afterEach(cleanup);

function renderCarnet() {
  return render(
    <CarnetCreateForm open onClose={() => {}} user={{ id: 'user-carnet' }} onCreated={() => {}} />,
  );
}

describe('CarnetCreateForm', () => {
  it('affiche les trois étapes Infos / Dates / Visibilité', () => {
    renderCarnet();

    expect(screen.getByRole('tab', { name: 'Infos' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Dates' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Visibilité' })).toBeTruthy();
    expect(screen.getByLabelText('Titre')).toBeTruthy();
    expect(screen.getByLabelText('Destination')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
  });

  it('refuse un carnet sans titre', async () => {
    renderCarnet();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect((await screen.findAllByText('Le titre est requis.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Infos' }).getAttribute('aria-selected')).toBe('true');
  });

  it('affiche la plage de dates et refuse une fin avant le début', async () => {
    renderCarnet();
    fireEvent.click(screen.getByRole('tab', { name: 'Dates' }));

    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '2026-12-10' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2026-12-05' } });

    expect(
      await screen.findAllByText('La date de fin ne peut pas précéder la date de début.'),
    ).not.toHaveLength(0);
  });

  it('refuse une couverture dont l’URL est invalide', () => {
    const result = createSchemas.carnet.safeParse({
      ...createDefaults('carnet'),
      title: 'Traversée',
      destination: 'Vercors',
      cover: [
        {
          id: 'c1',
          name: 'cover.jpg',
          type: 'image/jpeg',
          size: 1000,
          previewUrl: 'blob:cover',
          url: 'pas-une-url',
          alt: '',
          cover: true,
          status: 'uploaded',
          progress: 100,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
