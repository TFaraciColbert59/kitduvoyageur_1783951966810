// @vitest-environment jsdom

/*
 * PLAN-100 phase 6, lot 1 : l'écran vide du Compas, la préparation, le squelette, l'essai,
 * la mention IA et le crédit Geoapify lisent la locale du site (`LocaleProvider`).
 * Le français est inchangé (tests existants) ; ici, l'anglais rendu et les pluriels Intl.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/locale';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({ compasCreateTripAction: vi.fn() }));

import { CompasStart } from '../components/CompasStart';
import { CompasPrep } from '../components/CompasPrep';
import { CompasSkeleton } from '../components/CompasSkeleton';
import { TrialNote } from '../components/TrialNote';
import { AiNotice } from '../components/AiNotice';
import GeoapifyCredit from '../components/GeoapifyCredit';

afterEach(cleanup);

const noop = vi.fn();
const inLocale = (locale: Locale, ui: React.ReactElement) =>
  render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>);

// L'anglais garde l'apostrophe courbe (’) : seuls les accents, guillemets français et mots courants trahissent le FR.
const FRENCH = /[àâéèêëîïôùûç«»]|\b(ton|ta|tes|pour|avec|dans|une)\b/i;

function openDetails() {
  for (const d of document.querySelectorAll('details')) d.setAttribute('open', '');
}

describe('Compas en anglais (lot 1)', () => {
  it('écran vide : titre, demande, précisions, bouton et carte en anglais', () => {
    const { container } = inLocale('en', <CompasStart signedIn={false} aiOn />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Where do you want to go?');
    expect(screen.getByRole('navigation', { name: 'Compas steps' })).toBeTruthy();
    expect(screen.getByLabelText('Your request', { selector: 'textarea' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Plan my adventure/ })).toBeTruthy();
    expect(screen.getByText('Add details (optional)')).toBeTruthy();
    expect(screen.getByText(/to save your adventure\./).textContent).toBe(
      'Sign in to save your adventure.'
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'What it receives' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Route map' })).toBeTruthy();
    // Les libellés d'étapes et d'activités viennent du moteur (lots suivants) : on ne lit que nos textes.
    const ours = [
      container.querySelector('.cp-sub'),
      container.querySelector('.cp-map__empty'),
      container.querySelector('#cp-start-locked'),
      container.querySelector('.cp-ai'),
    ];
    for (const el of ours) expect(el?.textContent ?? '').not.toMatch(FRENCH);
  });

  it('précisions : pluriels par Intl.PluralRules et libellés lus du compteur', () => {
    inLocale('en', <CompasStart signedIn />);
    openDetails();
    const duration = screen.getByRole('group', { name: 'Duration' });
    expect(within(duration).getByRole('status').textContent).toBe('auto');
    const more = within(duration).getByRole('button', { name: 'Duration: increase' });
    fireEvent.click(more);
    expect(within(duration).getByRole('status').textContent).toBe('1 day');
    fireEvent.click(more);
    expect(within(duration).getByRole('status').textContent).toBe('2 days');
    const people = screen.getByRole('group', { name: 'People' });
    fireEvent.click(within(people).getByRole('button', { name: 'People: increase' }));
    expect(within(people).getByRole('status').textContent).toBe('1 person');
    fireEvent.click(within(people).getByRole('button', { name: 'People: increase' }));
    expect(within(people).getByRole('status').textContent).toBe('2 people');
  });

  it('français : mêmes pluriels qu’avant (1 jour, 2 jours ; 1 personne, 2 personnes)', () => {
    inLocale('fr', <CompasStart signedIn />);
    openDetails();
    const duration = screen.getByRole('group', { name: 'Durée' });
    const more = within(duration).getByRole('button', { name: 'Durée : plus' });
    fireEvent.click(more);
    expect(within(duration).getByRole('status').textContent).toBe('1 jour');
    fireEvent.click(more);
    expect(within(duration).getByRole('status').textContent).toBe('2 jours');
    const people = screen.getByRole('group', { name: 'Personnes' });
    fireEvent.click(within(people).getByRole('button', { name: 'Personnes : plus' }));
    fireEvent.click(within(people).getByRole('button', { name: 'Personnes : plus' }));
    expect(within(people).getByRole('status').textContent).toBe('2 personnes');
  });

  it('préparation : titres, étapes, états lus et actions en anglais', () => {
    const { rerender, container } = inLocale(
      'en',
      <CompasPrep
        prep={{ stage: 'itinerary' }}
        aiOn
        onStop={noop}
        onClose={noop}
        onRetry={noop}
        onEditRequest={noop}
      />
    );
    expect(screen.getByRole('status', { name: 'Preparing your adventure' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Preparing your adventure…');
    expect(screen.getByText('Mapping the itinerary')).toBeTruthy();
    expect(screen.getByText('in progress')).toBeTruthy();
    expect(screen.getAllByText('up next')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(container.textContent ?? '').not.toMatch(FRENCH);

    rerender(
      <LocaleProvider initialLocale="en">
        <CompasPrep
          prep={{ stage: 'error', at: 'rest' }}
          onStop={noop}
          onClose={noop}
          onRetry={noop}
          onEditRequest={noop}
        />
      </LocaleProvider>
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Preparation interrupted');
    expect(screen.getByText('interrupted')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refine my request' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();

    rerender(
      <LocaleProvider initialLocale="en">
        <CompasPrep
          prep={{ stage: 'done', usedAi: true }}
          aiOn
          onStop={noop}
          onClose={noop}
          onRetry={noop}
          onEditRequest={noop}
        />
      </LocaleProvider>
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Your adventure is ready');
    expect(screen.getByRole('button', { name: /View my adventure/ })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('AI contributed to this plan');
  });

  it('squelette, essai, mention IA et crédit', () => {
    inLocale('en', <CompasSkeleton />);
    expect(screen.getByRole('status').textContent).toContain('Opening Compas…');
    cleanup();

    inLocale('en', <TrialNote />);
    expect(screen.getByRole('note').textContent).toBe(
      'Trial without an account: deleted after 7 days without a visit. Keep my trip'
    );
    cleanup();

    inLocale('en', <AiNotice variant="run" />);
    expect(screen.getByRole('note').textContent).toContain('An AI may help');
    cleanup();

    // Formule exigée par Geoapify : identique dans toutes les langues.
    inLocale('en', <GeoapifyCredit />);
    expect(screen.getByRole('link').textContent).toBe('Powered by Geoapify');
  });

  it('un libellé de squelette fourni par le parent reste prioritaire', () => {
    inLocale('en', <CompasSkeleton label="Loading trip…" />);
    expect(screen.getByRole('status').textContent).toContain('Loading trip…');
  });
});
