// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/compas',
}));
vi.mock('../server/compasActions', () => ({ compasCreateTripAction: vi.fn() }));

import { CompasStart } from '../components/CompasStart';

afterEach(cleanup);

/*
 * « Voici ce que j'ai compris » avant l'envoi : la ligne « Lieu » lit la phrase comme la compréhension
 * de l'envoi (`settleLinkedOrigin`, `settleLinkedDestination`), sans la carte. Un bout de nom
 * (« Bresse » pour « Bourg en Bresse ») n'est jamais donné pour la destination.
 */

function typeSaying(text: string): HTMLElement {
  render(<CompasStart signedIn />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Ta demande' }), {
    target: { value: text },
  });
  const summary = screen.getByText('Voici ce que j’ai compris').parentElement as HTMLElement;
  return summary;
}
const lieu = (summary: HTMLElement): HTMLElement =>
  within(summary).getByText('Lieu').closest('.cp-fr') as HTMLElement;
const lieuValue = (summary: HTMLElement): string =>
  lieu(summary).querySelector('.cp-fr__v')?.textContent ?? '';

describe('CompasStart · ligne « Lieu » de l’aperçu', () => {
  it('« depuis Bourg en Bresse » : jamais « Bresse » comme lieu', () => {
    const s = typeSaying('rando 3 jours depuis Bourg en Bresse');
    expect(lieuValue(s)).not.toBe('Bresse');
    expect(lieuValue(s)).toBe(
      '« Bourg en Bresse » est le départ si la carte le connaît ; sinon Bresse'
    );
    expect(lieu(s).getAttribute('data-state')).toBe('defaut');
  });

  it('« à Bourg en Bresse » : le nom long, puis le nom court si la carte ne le connaît pas', () => {
    const s = typeSaying('rando 3 jours à Bourg en Bresse');
    expect(lieuValue(s)).toBe('Bourg en Bresse si la carte le connaît ; sinon Bourg');
  });

  it.each([
    ['week-end à La Roche sur Yon', 'La Roche sur Yon si la carte le connaît ; sinon Roche'],
    ['week-end à Neuilly sur Seine', 'Neuilly sur Seine si la carte le connaît ; sinon Neuilly'],
    [
      'week-end depuis La Roche sur Yon',
      '« La Roche sur Yon » est le départ si la carte le connaît ; sinon Yon',
    ],
  ])('« %s »', (text, expected) => {
    expect(lieuValue(typeSaying(text))).toBe(expected);
  });

  it('« depuis Lyon en Corse » : la Corse reste lue, avec le doute dit', () => {
    expect(lieuValue(typeSaying('5 jours depuis Lyon en Corse'))).toBe(
      '« Lyon en Corse » est le départ si la carte le connaît ; sinon Corse'
    );
  });

  it('sans doute possible, la ligne ne change pas', () => {
    expect(lieuValue(typeSaying('5 jours de trek dans le Vercors depuis Lyon'))).toBe('Vercors');
    cleanup();
    const s = typeSaying('week-end à Lyon en train');
    expect(lieuValue(s)).toBe('Lyon');
    expect(lieu(s).getAttribute('data-state')).toBe('compris');
  });
});
