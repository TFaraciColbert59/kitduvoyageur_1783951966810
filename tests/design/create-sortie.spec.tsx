// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SortieCreateForm } from '@/features/community/create/SortieCreateForm';
import { createDefaults, createSchemas } from '@/features/community/create/engine/createSchemas';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

afterEach(cleanup);

function isoInDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function renderSortie() {
  return render(
    <SortieCreateForm open onClose={() => {}} user={{ id: 'user-sortie' }} onCreated={() => {}} />,
  );
}

describe('SortieCreateForm', () => {
  it('affiche les trois étapes Infos / Détails / Participants', () => {
    renderSortie();

    expect(screen.getByRole('tab', { name: 'Infos' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Détails' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Participants' })).toBeTruthy();
    expect(screen.getByLabelText('Titre')).toBeTruthy();
    expect(screen.getByLabelText('Date')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
  });

  it('avance à Détails puis exige un lieu', async () => {
    renderSortie();

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Lac Blanc' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: isoInDays(7) } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    await screen.findByLabelText('Lieu');
    expect(screen.getByRole('tab', { name: 'Détails' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect((await screen.findAllByText('Le lieu est requis.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Détails' }).getAttribute('aria-selected')).toBe('true');
  });

  it('règle les participants au stepper', async () => {
    renderSortie();
    fireEvent.click(screen.getByRole('tab', { name: 'Participants' }));

    const input = screen.getByRole('spinbutton', { name: 'Participants max' }) as HTMLInputElement;
    expect(input.value).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter Participants max' }));
    expect(input.value).toBe('11');
  });

  it('refuse une sortie passée et un niveau inconnu', () => {
    const base = {
      ...createDefaults('sortie'),
      title: 'Lac Blanc',
      location: 'Chamonix',
    };

    expect(createSchemas.sortie.safeParse({ ...base, startDate: '2020-01-01' }).success).toBe(false);
    expect(
      createSchemas.sortie.safeParse({
        ...base,
        startDate: isoInDays(7),
        level: 'extreme',
      }).success,
    ).toBe(false);
    expect(
      createSchemas.sortie.safeParse({ ...base, startDate: isoInDays(7), level: 'facile' }).success,
    ).toBe(true);
  });
});
