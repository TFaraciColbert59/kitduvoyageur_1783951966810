// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ContrastPairInput } from '@/features/accessibility';
import {
  ContrastAuditTable,
  LKDV_CONTRAST_SAMPLES,
  resolveContrastPair,
  resolveCssColor,
} from '../ContrastAuditTable';

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--test-foreground');
  document.documentElement.style.removeProperty('--test-background');
});

const PAIRS: ContrastPairInput[] = [
  { id: 'aaa', label: 'Noir sur blanc', foreground: '#000000', background: '#ffffff' },
  { id: 'aa', label: 'Gris AA', foreground: '#767676', background: '#ffffff' },
  { id: 'fail', label: 'Gris insuffisant', foreground: '#999999', background: '#ffffff' },
  {
    id: 'ui',
    label: 'Contour de composant',
    foreground: '#949494',
    background: '#ffffff',
    isUiComponent: true,
  },
];

describe('ContrastAuditTable — WCAG AA/AAA & RGAA', () => {
  it('affiche le ratio, le niveau et les verdicts AA/AAA sans couleur seule', () => {
    render(<ContrastAuditTable pairs={PAIRS} showFailures />);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(PAIRS.length + 1);

    const aaaRow = within(table).getByRole('row', { name: /Noir sur blanc/ });
    expect(within(aaaRow).getByText('21.00:1')).toBeTruthy();
    expect(within(aaaRow).getByText('AAA')).toBeTruthy();
    expect(within(aaaRow).getByText('Conforme AA')).toBeTruthy();
    expect(within(aaaRow).getByText('Conforme AAA')).toBeTruthy();

    const failRow = within(table).getByRole('row', { name: /Gris insuffisant/ });
    expect(within(failRow).getByText('Échec AA')).toBeTruthy();
    expect(failRow.getAttribute('data-level')).toBe('FAIL');

    const uiRow = within(table).getByRole('row', { name: /Contour de composant/ });
    expect(within(uiRow).getByText('Conforme AA')).toBeTruthy();
    expect(within(uiRow).getByText('Conforme AAA')).toBeTruthy();
  });

  it('résume les conformités et liste les échecs AA', () => {
    render(<ContrastAuditTable pairs={PAIRS} />);

    const summary = screen.getByTestId('contrast-summary');
    expect(summary.getAttribute('role')).toBe('alert');
    expect(summary.textContent).toContain('3 / 4 paires conformes AA');
    expect(summary.textContent).toContain('2 / 4 conformes AAA');
    expect(summary.textContent).toContain('1 échec(s) AA');

    const failures = screen.getByRole('list', { name: 'Paires en échec AA' });
    expect(within(failures).getByText(/Gris insuffisant/)).toBeTruthy();
  });

  it('résout les jetons CSS après montage, sans casser le rendu SSR', async () => {
    document.documentElement.style.setProperty('--test-foreground', '#000000');
    document.documentElement.style.setProperty('--test-background', '#ffffff');

    render(
      <ContrastAuditTable
        pairs={[
          {
            id: 'token',
            label: 'Jeton résolu',
            foreground: 'var(--test-foreground, #000000)',
            background: 'var(--test-background, #ffffff)',
          },
        ]}
        title="Audit des jetons"
      />,
    );

    const table = await screen.findByRole('table');
    expect(within(table).getByText('21.00:1')).toBeTruthy();
    expect(within(table).getByText('#000000')).toBeTruthy();
  });

  it('résout une couleur de jeton ou renvoie la valeur directe', () => {
    expect(resolveCssColor('#123456')).toBe('#123456');
    expect(resolveCssColor('var(--absent, #abcdef)')).toBe('#abcdef');
    expect(
      resolveContrastPair({
        id: 'x',
        foreground: 'var(--absent, #000000)',
        background: '#ffffff',
      }),
    ).toMatchObject({ foreground: '#000000', background: '#ffffff' });
  });

  it('signale une couleur invalide sans faire tomber l’écran', () => {
    render(
      <ContrastAuditTable
        pairs={[
          { id: 'bad', label: 'Couleur invalide', foreground: 'pas-une-couleur', background: '#fff' },
        ]}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Format de couleur non supporté');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('fournit un jeu de paires LKDV basé uniquement sur des jetons', () => {
    expect(LKDV_CONTRAST_SAMPLES.length).toBeGreaterThan(0);
    for (const pair of LKDV_CONTRAST_SAMPLES) {
      expect(pair.foreground).toContain('var(--lkv-');
      expect(pair.background).toContain('var(--lkv-');
    }
  });
});
