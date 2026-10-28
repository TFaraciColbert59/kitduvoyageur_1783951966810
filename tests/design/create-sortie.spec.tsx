// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SortieCreateForm,
  buildSortieDescription,
  buildSortieEventRow,
  buildSortieSnapshot,
} from '@/features/community/create/SortieCreateForm';
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
  it('affiche les quatre étapes Type & lieu / Itinéraire / Participants / Sécurité', () => {
    renderSortie();

    expect(
      screen.getByRole('tab', { name: 'Type & lieu' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('tab', { name: 'Itinéraire' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Participants' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sécurité' })).toBeTruthy();
    expect(screen.getByLabelText('Titre')).toBeTruthy();
    expect(screen.getByLabelText('Type de sortie')).toBeTruthy();
    expect(screen.getByLabelText('Lieu')).toBeTruthy();
    expect(screen.queryByText(/Cover \(URL\)/)).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('exige le lieu puis la date avant d’atteindre les participants', async () => {
    renderSortie();

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Lac Blanc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect((await screen.findAllByText('Le lieu est requis.')).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('tab', { name: 'Type & lieu' }).getAttribute('aria-selected'),
    ).toBe('true');

    fireEvent.change(screen.getByLabelText('Lieu'), {
      target: { value: 'Chamonix' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    await screen.findByLabelText('Date');
    expect(screen.getByRole('tab', { name: 'Itinéraire' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect((await screen.findAllByText(/La date est requise/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Itinéraire' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('règle les participants au stepper et expose la liste d’attente', async () => {
    renderSortie();
    fireEvent.click(screen.getByRole('tab', { name: 'Participants' }));

    const input = screen.getByRole('spinbutton', { name: 'Participants max' }) as HTMLInputElement;
    expect(input.value).toBe('10');
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter Participants max' }));
    expect(input.value).toBe('11');

    const waitlist = screen.getByRole('switch', { name: 'Liste d’attente' });
    expect(waitlist.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(waitlist);
    expect(waitlist.getAttribute('aria-checked')).toBe('true');
  });

  it('expose la sécurité à l’étape dédiée', () => {
    renderSortie();
    fireEvent.click(screen.getByRole('tab', { name: 'Sécurité' }));

    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByLabelText('Consignes de sécurité')).toBeTruthy();
  });

  it('refuse une sortie passée, un niveau et un type inconnus', () => {
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
      createSchemas.sortie.safeParse({
        ...base,
        startDate: isoInDays(7),
        eventType: 'kayak',
      }).success,
    ).toBe(false);
    expect(
      createSchemas.sortie.safeParse({ ...base, startDate: isoInDays(7), level: 'facile' }).success,
    ).toBe(true);
    expect(
      createSchemas.sortie.safeParse({ ...base, startDate: isoInDays(7), distanceKm: 600 }).success,
    ).toBe(false);
  });

  it('encode rendez-vous, liste d’attente et sécurité dans les colonnes existantes', () => {
    const values = {
      ...createDefaults('sortie'),
      title: 'Lac Blanc',
      startDate: isoInDays(7),
      endDate: isoInDays(8),
      duration: '',
      location: 'Chamonix',
      level: 'difficile' as const,
      eventType: 'escalade' as const,
      meetingPoint: 'Parking de la Flégère',
      waitlist: true,
      distanceKm: 12.5,
      deniveleM: 900,
      safetyNotes: 'DVA + pelle + sonde',
      description: 'Arête nord.',
    };

    const description = buildSortieDescription(values);
    expect(description).toContain('Niveau : Difficile');
    expect(description).toContain('Rendez-vous : Parking de la Flégère');
    expect(description).toContain('Distance : 12.5 km');
    expect(description).toContain('Dénivelé : +900 m');
    expect(description).toContain('Liste d’attente : oui');
    expect(description).toContain('Sécurité : DVA + pelle + sonde');
    expect(description.startsWith('Arête nord.')).toBe(true);

    const row = buildSortieEventRow(values, 'user-sortie', 'https://cdn.test/cover.jpg');
    expect(row).toMatchObject({
      title: 'Lac Blanc',
      type: 'escalade',
      organizer_id: 'user-sortie',
      event_date: isoInDays(7),
      duration: `Du ${isoInDays(7)} au ${isoInDays(8)}`,
      location: 'Chamonix',
      max_participants: 10,
      cover_image: 'https://cdn.test/cover.jpg',
      status: 'upcoming',
    });

    expect(buildSortieSnapshot(values)).toMatchObject({
      schema: 'lkdv.sortie.options.v1',
      event_type: 'escalade',
      meeting_point: 'Parking de la Flégère',
      waitlist: true,
      level: 'difficile',
      distance_km: 12.5,
      denivele_m: 900,
    });
  });
});
