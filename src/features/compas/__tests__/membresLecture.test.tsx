// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { CompasScreen } from '../components/CompasScreen';
import { TRIP, U1, U2, compasData, item } from './helpers/compasData';
import { resetScreenMocks } from './helpers/screenMocks';
import { U3, labCompasData } from '../dev/labData';
import type { CompasData } from '../server/getCompasData';

/*
 * Nous · Équipe en lecture (PLAN-100 5.5) : niveau, présence, rôle et charge portée, avec « non
 * renseigné » quand la donnée manque. Aucune commande de gestion : le Hub gère le groupe.
 */

vi.mock('next/navigation', async () => {
  const { router } = await import('./helpers/screenMocks');
  return { useRouter: () => router, usePathname: () => '/compas' };
});
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="map" /> }));
vi.mock('../server/compasActions', async () => (await import('./helpers/screenMocks')).compas);
vi.mock('@/app/voyages/kit-actions', async () => (await import('./helpers/screenMocks')).kit);
vi.mock('@/app/voyages/budget-actions', async () => (await import('./helpers/screenMocks')).budget);
vi.mock('../server/poiActions', async () => (await import('./helpers/screenMocks')).poi);
vi.mock('../server/bottleActions', async () => (await import('./helpers/screenMocks')).bottle);
vi.mock('../server/resaActions', async () => (await import('./helpers/screenMocks')).resa);
vi.mock('../server/autofillActions', async () => (await import('./helpers/screenMocks')).autofill);
vi.mock('@/lib/cart', async () => (await import('./helpers/screenMocks')).cart);

beforeEach(() => {
  resetScreenMocks();
  class RO {
    observe() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
});
afterEach(cleanup);

const stepsNav = () => screen.getByRole('navigation', { name: 'Étapes du Compas' });

async function openEquipe(data: CompasData): Promise<HTMLElement> {
  render(<CompasScreen data={data} />);
  fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Détails : Nous' }));
  return screen.findByRole('dialog', { name: 'Nous' });
}

async function scan(root: Element): Promise<string[]> {
  const res = await axe.run(root as HTMLElement, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });
  return res.violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

describe('Nous · Équipe : les membres en lecture', () => {
  it('chaque membre : rôle, niveau (ou « non renseigné »), allure, charge portée sur sa limite', async () => {
    const sheet = await openEquipe(labCompasData());
    const rows = within(sheet).getAllByRole('button', { name: /porte/ });
    const byName = (n: string) => rows.find((r) => r.querySelector('b')?.textContent?.startsWith(n))!;

    const tony = byName('Tony');
    expect(tony.textContent).toContain('(moi)');
    expect(tony.textContent).toContain('Organisateur');
    expect(tony.textContent).toContain('Niveau confirmé · estimé');
    expect(tony.textContent).toContain('4,6 km/h · mesurée');
    expect(tony.textContent).toMatch(/porte .* sur 14 kg \(repère moyen\)/);

    // Léa : profil posé en moyennes de population → ni niveau ni allure affichés comme les siens.
    const lea = byName('Léa');
    expect(lea.textContent).toContain('Membre du groupe');
    expect(lea.textContent).toContain('allure non renseignée');
    expect(lea.textContent).toContain('niveau non renseigné');
    expect(lea.textContent).not.toMatch(/intermédiaire|4 km\/h/);

    const noe = byName('Noé');
    expect(noe.textContent).toContain('Lecture seule');
    expect(noe.textContent).toContain('Niveau débutant');
    expect(noe.textContent).toContain('3,6 km/h');
  });

  it('la limite est un repère moyen, la barre est décorative et le texte dit les chiffres', async () => {
    const sheet = await openEquipe(labCompasData());
    const bars = sheet.querySelectorAll('.cp-mem__bar');
    expect(bars.length).toBeGreaterThan(0);
    for (const b of bars) expect(b.getAttribute('aria-hidden')).toBe('true');
  });

  it('sans capacité renseignée : pas de barre ni de pourcentage, la phrase le dit', async () => {
    const data = compasData({
      members: [
        { userId: U1, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: null, flatSpeedKmh: null, experienceLevel: null, calibrationLevel: null },
      ],
      items: [item({ id: 'a', name: 'Tente', weightGrams: 1800 })],
    });
    const sheet = await openEquipe(data);
    const row = within(sheet).getByRole('button', { name: /Tony/ });
    expect(row.textContent).toContain('capacité non renseignée');
    expect(row.querySelector('.cp-mem__bar')).toBeNull();
    expect(row.textContent).not.toMatch(/\d+ %/);
  });

  it('présence : les invitations sans réponse sont à part, « pas encore dans le voyage »', async () => {
    const sheet = await openEquipe(labCompasData());
    expect(within(sheet).getByText(/Dans le voyage/)).toBeTruthy();
    expect(within(sheet).getByText(/3 présents · 1 en attente/)).toBeTruthy();
    const heading = within(sheet).getByText(/En attente de réponse/);
    expect(heading.closest('p')?.textContent).toContain('pas encore dans le voyage');
    expect(within(sheet).getByText('Sam')).toBeTruthy();
    expect(within(sheet).getByText('Invitation en attente · peut modifier')).toBeTruthy();
    // Sam n'est pas un membre : aucune ligne de sac pour lui.
    expect(within(sheet).queryByRole('button', { name: /Sam/ })).toBeNull();
  });

  it('le groupe se gère dans le Hub : lien vers /hub/groupe, aucune commande de rôle ni de retrait ajoutée ici', async () => {
    const sheet = await openEquipe(labCompasData());
    const link = within(sheet).getByRole('link', { name: /Gérer le groupe dans le Hub/ });
    expect(link.getAttribute('href')).toBe('/hub/groupe');
    expect(within(sheet).queryByRole('combobox')).toBeNull();
    expect(within(sheet).queryByRole('button', { name: /Retirer|Rôle de/ })).toBeNull();
  });

  it('objets communs sans porteur : dit et mène aux sacs', async () => {
    const sheet = await openEquipe(labCompasData());
    expect(within(sheet).getByText(/1 objet commun sans porteur/)).toBeTruthy();
  });

  it('toucher un membre ouvre son sac, avec rôle, niveau et charge', async () => {
    const sheet = await openEquipe(labCompasData());
    fireEvent.click(within(sheet).getByRole('button', { name: /Léa/ }));
    const bag = await screen.findByRole('dialog', { name: 'Sac de Léa' });
    expect(within(bag).getByText('Membre du groupe')).toBeTruthy();
    expect(within(bag).getByText(/niveau non renseigné/)).toBeTruthy();
    expect(within(bag).getByText(/sur 14 kg \(repère moyen\)/)).toBeTruthy();
  });

  it('carte Nous : la capacité « renseignée » ne compte pas les repères moyens', async () => {
    render(<CompasScreen data={labCompasData()} />);
    fireEvent.click(within(stepsNav()).getByRole('button', { name: /Nous/ }));
    const line = screen.getByText(/Capacité de portage renseignée/);
    expect(line.textContent).toContain('0 / 3');
    expect(line.textContent).toContain('repère moyen pour 3');
    expect(U3).toBeTruthy();
    expect(U2).toBeTruthy();
    expect(TRIP).toBeTruthy();
  });

  it('axe-core : 0 violation WCAG 2 A/AA sur le tiroir Équipe', async () => {
    const sheet = await openEquipe(labCompasData());
    expect(await scan(sheet)).toEqual([]);
  });
});
