// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CarnetCreateForm,
  buildCarnetRow,
} from '@/features/community/create/CarnetCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';
import { COVER } from './_coverFixture';

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
  it('affiche les cinq étapes Identité / Itinéraire / Logistique / Récit / Partage', () => {
    renderCarnet();

    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Itinéraire' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Logistique' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Récit' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Partage' })).toBeTruthy();
    expect(screen.getByLabelText('Titre')).toBeTruthy();
    expect(screen.getByLabelText('Destination')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('refuse un carnet sans titre', async () => {
    renderCarnet();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect((await screen.findAllByText('Le titre est requis.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('affiche la plage de dates et refuse une fin avant le début', async () => {
    renderCarnet();
    fireEvent.click(screen.getByRole('tab', { name: 'Logistique' }));

    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '2026-12-10' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2026-12-05' } });

    expect(
      await screen.findAllByText('La date de fin ne peut pas précéder la date de début.'),
    ).not.toHaveLength(0);
  });

  it('expose l’itinéraire, la logistique et le partage', () => {
    renderCarnet();

    fireEvent.click(screen.getByRole('tab', { name: 'Itinéraire' }));
    expect(screen.getByLabelText('Départ')).toBeTruthy();
    expect(screen.getByLabelText('Arrivée')).toBeTruthy();
    expect(screen.getByLabelText('Distance (km)')).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Dénivelé' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Logistique' }));
    expect(screen.getByRole('spinbutton', { name: 'Nuits' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Voyageurs' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Collaboratif' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Partage' }));
    expect(screen.getByRole('combobox', { name: 'Visibilité' })).toBeTruthy();
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

  it('valide les métriques et les mappe sur les colonnes existantes', () => {
    const base = {
      ...createDefaults('carnet'),
      title: 'Traversée du Vercors',
      destination: 'Vercors',
      cover: COVER,
    };

    expect(createSchemas.carnet.safeParse({ ...base, distanceKm: -1 }).success).toBe(false);
    expect(createSchemas.carnet.safeParse({ ...base, deniveleM: -20 }).success).toBe(false);
    expect(createSchemas.carnet.safeParse({ ...base, nbVoyageurs: 0 }).success).toBe(false);
    expect(createSchemas.carnet.safeParse({ ...base, routeRating: 6 }).success).toBe(false);
    expect(
      createSchemas.carnet.safeParse({
        ...base,
        distanceKm: 42.5,
        deniveleM: 1800,
        nbNuits: 3,
        nbVoyageurs: 4,
        routeRating: 4.5,
        tags: ['rando'],
        isCollaborative: true,
      }).success,
    ).toBe(true);

    const row = buildCarnetRow(
      {
        ...base,
        startDate: '2026-12-10',
        endDate: '2026-12-13',
        lieuDepart: ' Chamonix ',
        lieuArrivee: 'Les Houches',
        distanceKm: 42.5,
        deniveleM: 1800,
        nbNuits: 3,
        nbVoyageurs: 4,
        weather: ' Neige ',
        routeRating: 4.5,
        tags: ['rando'],
        isCollaborative: true,
        visibility: 'private',
      },
      'user-carnet',
      'https://cdn.test/cover.jpg',
    );

    expect(row).toMatchObject({
      title: 'Traversée du Vercors',
      destination: 'Vercors',
      author_id: 'user-carnet',
      start_date: '2026-12-10',
      end_date: '2026-12-13',
      lieu_depart: 'Chamonix',
      lieu_arrivee: 'Les Houches',
      distance_km: 42.5,
      denivele_m: 1800,
      nb_nuits: 3,
      nb_voyageurs: 4,
      weather: 'Neige',
      route_rating: 4.5,
      tags: ['rando'],
      is_collaborative: true,
      visibility: 'private',
      cover_image: 'https://cdn.test/cover.jpg',
    });
  });
});
