// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClubCreateForm,
  buildClubRules,
  slugify,
} from '@/features/community/create/ClubCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';
import { COVER } from './_coverFixture';

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
  it('affiche les quatre étapes Identité / Univers / Adhésion / Publication', () => {
    renderClub();

    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Univers' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Adhésion' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Publication' })).toBeTruthy();
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    expect(screen.getByLabelText('Catégorie')).toBeTruthy();
    expect(screen.getByLabelText('Lieu')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('exige le nom et la catégorie avant de continuer', async () => {
    renderClub();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect((await screen.findAllByText('Le nom du club est requis.')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('La catégorie est requise.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Identité' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('avance à Univers puis expose l’adhésion, les questions et la publication', async () => {
    renderClub();

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'La Cordée du Vercors' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'Randonnée' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    await screen.findByLabelText('Description');
    expect(screen.getByRole('tab', { name: 'Univers' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Adhésion' }));
    const privacy = screen.getByRole('combobox', { name: 'Adhésion' }) as HTMLSelectElement;
    expect(privacy.value).toBe('open');
    fireEvent.change(privacy, { target: { value: 'closed' } });
    expect(privacy.value).toBe('closed');
    expect(screen.getByLabelText('Règles d’adhésion')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une question' }));
    expect(screen.getByLabelText('Question 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Publication' }));
    const welcome = screen.getByRole('switch', { name: 'Post d’accueil' });
    expect(welcome.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(welcome);
    expect(welcome.getAttribute('aria-checked')).toBe('false');
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
        cover: COVER,
      }).success,
    ).toBe(true);
    expect(
      createSchemas.club.safeParse({
        ...createDefaults('club'),
        name: 'La Cordée',
        category: 'Randonnée',
        joinQuestions: ['A', 'B', 'C', 'D'],
      }).success,
    ).toBe(false);
  });

  it('exige une image et modère l’activité', () => {
    const base = { ...createDefaults('club'), name: 'La Cordée', category: 'Trail', cover: COVER };
    expect(createSchemas.club.safeParse(base).success).toBe(true);

    const noImage = createSchemas.club.safeParse({ ...base, cover: [] });
    expect(noImage.success).toBe(false);
    if (!noImage.success) {
      expect(noImage.error.issues.map((issue) => issue.message)).toContain('Ajoute une image pour ton club : elle est obligatoire.');
    }

    for (const bad of ['', 'x', 'Trail 2026', 'porn', 'Club nazi', 'a'.repeat(41), 'https://exemple.fr']) {
      expect(createSchemas.club.safeParse({ ...base, category: bad }).success, bad).toBe(false);
    }
    expect(createSchemas.club.safeParse({ ...base, category: 'Ski de randonnée' }).success).toBe(true);
    expect(createSchemas.club.safeParse({ ...base, name: 'Club porn' }).success).toBe(false);
  });

  it('génère le slug et concatène les questions dans clubs.rules', () => {
    expect(slugify('La Cordée du Vercors !')).toBe('la-cordee-du-vercors');

    expect(
      buildClubRules({
        ...createDefaults('club'),
        membershipRules: '  Niveau requis  ',
        joinQuestions: ['Quel est ton niveau ?', '  ', 'As-tu un DVA ?'],
      }),
    ).toBe(
      'Niveau requis\n\nQuestions d’adhésion :\n1. Quel est ton niveau ?\n2. As-tu un DVA ?',
    );
    expect(
      buildClubRules({ ...createDefaults('club'), membershipRules: '', joinQuestions: [] }),
    ).toBeNull();
  });
});
